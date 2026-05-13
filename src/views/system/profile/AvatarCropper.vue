<template>
  <el-dialog
    v-model="visible"
    title="修改头像"
    width="800px"
    :close-on-click-modal="false"
    append-to-body
    @opened="handleDialogOpened"
    @close="handleDialogClose"
  >
    <el-row :gutter="20">
      <!-- 左侧：裁剪区 -->
      <el-col :xs="24" :md="14">
        <div class="cropper-wrapper">
          <VueCropper
            v-if="cropperVisible"
            ref="cropperRef"
            :img="options.img"
            :info="true"
            :auto-crop="options.autoCrop"
            :auto-crop-width="options.autoCropWidth"
            :auto-crop-height="options.autoCropHeight"
            :fixed-box="options.fixedBox"
            :fixed="true"
            :fixed-number="[1, 1]"
            :output-type="options.outputType"
            :output-size="0.95"
            :can-move-box="true"
            :center-box="true"
            @real-time="handleRealTime"
          />
          <div v-else class="cropper-empty">
            <el-icon :size="40"><Picture /></el-icon>
            <p>请点击下方「选择图片」按钮上传头像</p>
          </div>
        </div>
      </el-col>

      <!-- 右侧：实时预览 -->
      <el-col :xs="24" :md="10">
        <div class="preview-section">
          <div class="preview-title">效果预览</div>
          <div class="preview-row">
            <div class="preview-item">
              <div class="preview-circle preview-large">
                <img v-if="previewState.url" :src="previewState.url" :style="previewState.img" alt="" />
              </div>
              <div class="preview-label">120 × 120</div>
            </div>
            <div class="preview-item">
              <div class="preview-circle preview-small">
                <img v-if="previewState.url" :src="previewState.url" :style="previewState.img" alt="" />
              </div>
              <div class="preview-label">40 × 40</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 底部工具栏 -->
    <div class="toolbar">
      <el-upload
        class="toolbar-upload"
        action="#"
        :show-file-list="false"
        :http-request="handlePickFile"
        :before-upload="beforePickFile"
        accept="image/*"
      >
        <el-button :icon="Upload" size="default">选择图片</el-button>
      </el-upload>

      <el-button-group class="toolbar-group">
        <el-tooltip content="放大" placement="top">
          <el-button :icon="ZoomIn" :disabled="!cropperVisible" @click="changeScale(1)" />
        </el-tooltip>
        <el-tooltip content="缩小" placement="top">
          <el-button :icon="ZoomOut" :disabled="!cropperVisible" @click="changeScale(-1)" />
        </el-tooltip>
        <el-tooltip content="向左旋转" placement="top">
          <el-button :icon="RefreshLeft" :disabled="!cropperVisible" @click="rotateLeft" />
        </el-tooltip>
        <el-tooltip content="向右旋转" placement="top">
          <el-button :icon="RefreshRight" :disabled="!cropperVisible" @click="rotateRight" />
        </el-tooltip>
      </el-button-group>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="uploading"
        :disabled="!cropperVisible"
        @click="handleSubmit"
      >
        保存头像
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 头像裁剪上传组件 —— 参考 ruoyi 的 userAvatar.vue 用法、用 vue-cropper（Vue3 版本）实现。
 *
 * 与 ruoyi 原版的关键差异：
 *  1. 上传链路改成「先 /file/upload 拿 URL，再 /profile/avatar 写库」两步走，复用项目现有
 *     的 SysFileController + SysProfileController，避免再为头像专门加一个端点；
 *  2. 全部用 Composition API + TS 重写，避免选项式 API 在 IDE 里类型推断不友好；
 *  3. 没用 ruoyi 的全局 store.commit('SET_AVATAR')，因为本项目 userStore 直接调
 *     fetchUserInfo() 重新拉，更简单也更不容易出现「DB 已写新值但 store 还是旧值」的不一致。
 *
 * 选图后必须先 dataURL 转给 cropper.img，否则 cropper 在 Vue3 里不会自动检测到 img 变化。
 */
import { reactive, ref, watch } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import {
  Picture,
  Upload,
  ZoomIn,
  ZoomOut,
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue'
// vue-cropper@next 的 Vue3 入口，注意要拿命名导出 VueCropper
// 见：https://www.npmjs.com/package/vue-cropper
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'
import request from '@/utils/request'
import { updateAvatar as apiUpdateAvatar } from '@/api/admin'
import type { R, SysFile } from '@/types/api'

defineOptions({ name: 'UserAvatarCropper' })

interface Props {
  modelValue: boolean
  /** 当前头像 URL，弹窗打开时用于做兜底显示，没有就显示空态 */
  current?: string
}

const props = withDefaults(defineProps<Props>(), {
  current: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  /** 上传 + 写库都成功后通知父组件刷新 */
  (e: 'success', avatarUrl: string): void
}>()

/* --------------------------- 弹窗显隐 --------------------------- */
const visible = ref(false)
watch(() => props.modelValue, (val) => { visible.value = val })
watch(visible, (val) => emit('update:modelValue', val))

/* --------------------------- cropper 状态 --------------------------- */
const cropperRef = ref<InstanceType<typeof VueCropper> | null>(null)
/** 控制 cropper 重建：弹窗关闭时设为 false 销毁，下次开启时重新挂载，避免历史图片残留 */
const cropperVisible = ref(false)

/**
 * cropper 配置项。
 * 关键参数说明：
 *  - autoCrop / autoCropWidth/Height：默认裁剪框 200×200，配合 fixed=[1,1] 强制正方形
 *  - fixedBox=true：禁止用户拖拽改变裁剪框大小（避免裁出非 1:1 的奇怪比例头像）
 *  - centerBox=true：限制裁剪框只能在图片范围内，防止裁到图外白边
 */
const options = reactive({
  img: '',
  fileName: 'avatar.png',
  autoCrop: true,
  autoCropWidth: 200,
  autoCropHeight: 200,
  fixedBox: true,
  outputType: 'png' as 'png' | 'jpeg' | 'webp',
})

/* --------------------------- 实时预览 --------------------------- */
interface PreviewState {
  url?: string
  img?: Record<string, string>
}
const previewState = reactive<PreviewState>({})

function handleRealTime(data: PreviewState) {
  previewState.url = data.url
  previewState.img = data.img
}

/* --------------------------- 选图处理 --------------------------- */
function beforePickFile(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('仅支持图片文件')
    return false
  }
  // 5MB 限制：和原 profile 页保持一致
  if (file.size / 1024 / 1024 > 5) {
    ElMessage.error('头像图片不能超过 5MB')
    return false
  }
  return true
}

/**
 * el-upload 的 :http-request 钩子。我们截断默认上传，改成「读成 dataURL 喂给 cropper」。
 * 真正的上传在用户点「保存头像」按钮时才发生。
 */
function handlePickFile(opts: UploadRequestOptions): any {
  const file = opts.file as File
  const reader = new FileReader()
  reader.onload = () => {
    options.img = reader.result as string
    options.fileName = file.name || 'avatar.png'
    cropperVisible.value = true
  }
  reader.onerror = () => ElMessage.error('图片读取失败，请重试')
  reader.readAsDataURL(file)
}

/* --------------------------- 工具栏操作 --------------------------- */
function changeScale(num: number) {
  cropperRef.value?.changeScale(num)
}
function rotateLeft() {
  cropperRef.value?.rotateLeft()
}
function rotateRight() {
  cropperRef.value?.rotateRight()
}

/* --------------------------- 提交上传 --------------------------- */
const uploading = ref(false)

/**
 * 拿到裁剪后的 blob，先走 /file/upload 拿到 fileUrl，再调 /profile/avatar 写库。
 * 用 Promise 包一层是因为 cropper.getCropBlob 是回调式的。
 */
function getCropBlob(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!cropperRef.value) {
      reject(new Error('cropper 未初始化'))
      return
    }
    cropperRef.value.getCropBlob((blob: Blob) => {
      if (!blob) reject(new Error('裁剪结果为空'))
      else resolve(blob)
    })
  })
}

async function handleSubmit() {
  if (!cropperVisible.value) {
    ElMessage.warning('请先选择图片')
    return
  }
  uploading.value = true
  try {
    const blob = await getCropBlob()

    // 1. 上传到对象存储 / 文件服务，拿 fileUrl
    const fd = new FormData()
    // 文件名带上时间戳避免和已有的同名头像 key 冲突
    const safeName = (options.fileName || 'avatar').replace(/[^\w.\-]/g, '_')
    fd.append('file', blob, `${Date.now()}-${safeName}`)
    const { data: uploadResp } = await request.post<R<SysFile>>('/system/file/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const url = uploadResp.data?.fileUrl
    if (!url) {
      ElMessage.error('上传失败：服务未返回文件 URL')
      return
    }

    // 2. 把 URL 写回 user.avatar
    await apiUpdateAvatar(url)
    ElMessage.success('头像更新成功')
    emit('success', url)
    visible.value = false
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e}`)
  } finally {
    uploading.value = false
  }
}

/* --------------------------- 弹窗生命周期 --------------------------- */
function handleDialogOpened() {
  // 弹窗动画结束后再挂载 cropper：vue-cropper 依赖容器实际尺寸初始化，
  // 在 dialog 还没完成 transition 时就挂载会导致 cropper 内部 canvas 计算 0×0
  if (props.current) {
    options.img = props.current
    cropperVisible.value = true
  } else {
    cropperVisible.value = false
  }
}

function handleDialogClose() {
  // 销毁 cropper 释放图片资源 + 清空预览，避免下次打开看到残留
  cropperVisible.value = false
  options.img = ''
  previewState.url = ''
  previewState.img = undefined
}
</script>

<style scoped lang="scss">
.cropper-wrapper {
  height: 360px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cropper-empty {
  text-align: center;
  color: var(--el-text-color-placeholder);
  p {
    margin-top: 12px;
    font-size: 13px;
  }
}

.preview-section {
  height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;

  .preview-title {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .preview-row {
    display: flex;
    align-items: flex-end;
    gap: 28px;
  }

  .preview-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .preview-circle {
    border-radius: 50%;
    overflow: hidden;
    background: var(--el-fill-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .preview-large {
    width: 120px;
    height: 120px;
  }

  .preview-small {
    width: 40px;
    height: 40px;
  }

  .preview-label {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}

.toolbar {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  .toolbar-upload {
    display: inline-block;
  }

  .toolbar-group {
    margin-left: auto;
  }
}
</style>
