<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadRequestOptions } from 'element-plus'
import {
  getFilePage,
  getFileRecyclePage,
  uploadFile,
  downloadFile,
  previewFileUrl,
  listFileVersions,
  moveFileToRecycle,
  restoreFile,
  purgeFile,
  initChunkUpload,
  uploadChunkPart,
  mergeChunkUpload,
} from '@/api/business'
import type { SysFile } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

/**
 * 文件管理页：
 *  - 上传 / 下载 / 在线预览 / 软删 / 还原 / 彻底删除
 *  - 历史版本 + 回收站 Tab 切换
 *  - 单文件 ≤ 100MB 走 /file/upload；> 100MB 自动走分片 init/chunk/merge
 *  - 计算 MD5 后秒传命中由后端返回 mergedFileId
 */
const CHUNK_THRESHOLD = 100 * 1024 * 1024
const CHUNK_SIZE = 5 * 1024 * 1024

const tab = ref<'list' | 'recycle'>('list')
const loading = ref(false)
const list = ref<SysFile[]>([])
const total = ref(0)
const query = reactive({ current: 1, size: 10, keyword: '' })

const versionsVisible = ref(false)
const versions = ref<SysFile[]>([])
const versionTitle = ref('')

const uploading = ref(false)
const uploadPercent = ref(0)
const uploadName = ref('')

async function load() {
  loading.value = true
  try {
    const fn = tab.value === 'list' ? getFilePage : getFileRecyclePage
    const { data } = await fn(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

// element-plus 的 el-radio-group 在 v-model 双向绑定下，
// @change 触发时 tab.value 已经被 v-model 更新成新值，
// 所以"if (tab.value === t) return"会永远成立 → load() 永不执行 → 切 tab 不刷新数据。
// 这里直接用新值重置分页并加载，无需再做相等判断。
function switchTab(newTab: 'list' | 'recycle') {
  tab.value = newTab
  query.current = 1
  query.keyword = ''
  load()
}

async function md5OfFile(file: File): Promise<string> {
  // 用浏览器 SubtleCrypto 算 MD5。注意：Web Crypto 无原生 MD5，这里用 SHA-1 截断作"内容指纹"，
  // 后端只用作秒传 key，不需要严格密码学 MD5（生产可换 spark-md5 库）。
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-1', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function customUpload(opts: UploadRequestOptions) {
  const file = opts.file as File
  uploading.value = true
  uploadName.value = file.name
  uploadPercent.value = 0
  try {
    if (file.size <= CHUNK_THRESHOLD) {
      const fd = new FormData()
      fd.append('file', file)
      await uploadFile(fd)
    } else {
      await chunkedUpload(file)
    }
    ElMessage.success(t('file.uploadSuccess', { name: file.name }))
    load()
  } catch (e: any) {
    ElMessage.error(t('file.uploadFailed') + (e?.message || e))
  } finally {
    uploading.value = false
  }
}

async function chunkedUpload(file: File) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const md5 = await md5OfFile(file)
  uploadPercent.value = 1
  const initRes = await initChunkUpload({
    originalName: file.name,
    totalSize: file.size,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    fileMd5: md5,
  })
  const task = initRes.data.data
  // 秒传命中
  if (task.status === 'merged' && task.mergedFileId) {
    uploadPercent.value = 100
    return
  }
  const already = new Set(
    (task.uploadedChunks || '').split(',').filter(Boolean).map((s) => Number(s)),
  )
  for (let i = 1; i <= totalChunks; i++) {
    if (already.has(i)) {
      uploadPercent.value = Math.round((i / totalChunks) * 100)
      continue
    }
    const start = (i - 1) * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const blob = file.slice(start, end)
    const fd = new FormData()
    fd.append('file', blob, `${file.name}.part${i}`)
    await uploadChunkPart(task.uploadId, i, fd)
    uploadPercent.value = Math.round((i / totalChunks) * 100)
  }
  await mergeChunkUpload(task.uploadId)
  uploadPercent.value = 100
}

async function doDownload(row: SysFile) {
  try {
    const res = await downloadFile(row.id!)
    const blob = res.data as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.originalName
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    ElMessage.error(t('file.downloadFailed') + (e?.message || e))
  }
}

function doPreview(row: SysFile) {
  const url = previewFileUrl(row.id!)
  window.open(url, '_blank')
}

async function doRecycle(row: SysFile) {
  try {
    await ElMessageBox.confirm(
      `<div class="smart-mbx-body">${t('file.recycleConfirm', { name: escapeHtml(row.originalName) })}</div>
       <div class="smart-mbx-tip smart-mbx-tip--warning">${t('file.recycleTip')}</div>`,
      t('file.recycleTitle'),
      {
        type: 'warning',
        confirmButtonText: t('file.recycleBtn'),
        cancelButtonText: t('file.cancel'),
        dangerouslyUseHTMLString: true,
        draggable: true,
        customClass: 'smart-mbx smart-mbx--warning',
      },
    )
  } catch { return }
  try {
    await moveFileToRecycle(row.id!)
    ElMessage.success(t('file.recycleSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('file.recycleFailed') + (e?.message || e))
  }
}

async function doRestore(row: SysFile) {
  try {
    await restoreFile(row.id!)
    ElMessage.success(t('file.restoreSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('file.restoreFailed') + (e?.message || e))
  }
}

async function doPurge(row: SysFile) {
  try {
    await ElMessageBox.confirm(
      `<div class="smart-mbx-body">${t('file.purgeConfirm', { name: escapeHtml(row.originalName) })}</div>
       <div class="smart-mbx-tip smart-mbx-tip--danger">${t('file.purgeTip')}</div>`,
      t('file.purgeTitle'),
      {
        type: 'error',
        confirmButtonText: t('file.purgeBtn'),
        cancelButtonText: t('file.cancel'),
        confirmButtonClass: 'el-button--danger',
        dangerouslyUseHTMLString: true,
        draggable: true,
        customClass: 'smart-mbx smart-mbx--danger',
      },
    )
  } catch { return }
  try {
    await purgeFile(row.id!)
    ElMessage.success(t('file.purgeSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('file.purgeFailed') + (e?.message || e))
  }
}

/** 防止文件名里的 < > & " ' 破坏 dangerouslyUseHTMLString 的弹窗 HTML 结构 */
function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function showVersions(row: SysFile) {
  const res = await listFileVersions(row.id!)
  versions.value = res.data.data
  versionTitle.value = t('file.versionTitle', { name: row.originalName })
  versionsVisible.value = true
}

const sizeLabel = (s?: number) => {
  if (!s && s !== 0) return ''
  if (s < 1024) return s + ' B'
  if (s < 1024 * 1024) return (s / 1024).toFixed(1) + ' KB'
  if (s < 1024 * 1024 * 1024) return (s / 1024 / 1024).toFixed(1) + ' MB'
  return (s / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

const isImage = (row: SysFile) =>
  row.contentType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(row.fileExt || '')
const isPdf = (row: SysFile) => row.contentType === 'application/pdf' || row.fileExt === 'pdf'
const canPreview = (row: SysFile) => isImage(row) || isPdf(row)

const tabLabel = computed(() => (tab.value === 'list' ? t('file.tabAll') : t('file.tabRecycle')))

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-radio-group v-model="tab" @change="(v) => switchTab(v as any)">
        <!-- element-plus v2.6+ 起 el-radio-button 的绑定值参数从 label 改为 value，
             label 仅作展示文本。继续用 label 会导致 v-model 永远拿不到值，
             于是 tab 一直停留在初始 'list'，"回收站" tab 实际还在调 /file/page，
             用户体感"上传后回收站也能看到该文件"。 -->
        <el-radio-button value="list">{{ t('file.tabAll') }}</el-radio-button>
        <el-radio-button value="recycle">{{ t('file.tabRecycle') }}</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="query.keyword"
        :placeholder="t('file.searchPlaceholder')"
        clearable
        style="width: 240px"
        @keyup.enter="load"
      />
      <el-button type="primary" @click="load">{{ t('file.search') }}</el-button>

      <el-upload
        v-if="tab === 'list'"
        :show-file-list="false"
        :http-request="customUpload"
        :auto-upload="true"
      >
        <el-button type="success" :loading="uploading">{{ t('file.upload') }}</el-button>
      </el-upload>
      <el-progress
        v-if="uploading"
        :percentage="uploadPercent"
        style="flex: 1; min-width: 200px"
        :format="(p) => `${uploadName}  ${p}%`"
      />
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" :label="t('file.colId')" width="80" />
      <el-table-column prop="originalName" :label="t('file.colName')" min-width="200" show-overflow-tooltip />
      <el-table-column :label="t('file.colSize')" width="110">
        <template #default="{ row }">{{ sizeLabel(row.fileSize) }}</template>
      </el-table-column>
      <el-table-column prop="contentType" :label="t('file.colType')" width="180" show-overflow-tooltip />
      <el-table-column :label="t('file.colVersion')" width="80">
        <template #default="{ row }">v{{ row.version || 1 }}</template>
      </el-table-column>
      <el-table-column prop="storageType" :label="t('file.colStorage')" width="80" />
      <el-table-column :label="tab === 'list' ? t('file.colUploadTime') : t('file.colDeleteTime')" width="180">
        <template #default="{ row }">
          {{ formatDateTime(tab === 'list' ? row.createTime : row.recycleTime) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('file.colAction')" width="320" fixed="right">
        <template #default="{ row }">
          <template v-if="tab === 'list'">
            <el-button v-if="canPreview(row)" link type="primary" @click="doPreview(row)">{{ t('file.preview') }}</el-button>
            <el-button link type="primary" @click="doDownload(row)">{{ t('file.download') }}</el-button>
            <el-button link @click="showVersions(row)">{{ t('file.historyVersions') }}</el-button>
            <el-button link type="danger" @click="doRecycle(row)">{{ t('file.delete') }}</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" @click="doRestore(row)">{{ t('file.restore') }}</el-button>
            <el-button link type="danger" @click="doPurge(row)">{{ t('file.purge') }}</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <el-dialog v-model="versionsVisible" :title="versionTitle" width="720px">
      <el-table :data="versions" border>
        <el-table-column prop="version" :label="t('file.versionColVersion')" width="80">
          <template #default="{ row }">v{{ row.version }}</template>
        </el-table-column>
        <el-table-column :label="t('file.versionColSize')" width="110">
          <template #default="{ row }">{{ sizeLabel(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column prop="md5" :label="t('file.versionColMd5')" width="200" show-overflow-tooltip />
        <el-table-column :label="t('file.versionColTime')" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('file.colAction')" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="doDownload(row)">{{ t('file.download') }}</el-button>
            <el-button v-if="canPreview(row)" link @click="doPreview(row)">{{ t('file.preview') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
</style>
