<template>
  <div class="profile-page">
    <!-- 左侧：用户卡片 -->
    <el-card class="profile-card" shadow="never">
      <div class="avatar-section">
        <!--
          头像区现在直接点开「裁剪弹窗」，不再用 el-upload 直传。
          交互链路：点击头像 → 弹窗打开 → 用户选图 → 缩放/旋转/裁剪 → 保存
          → AvatarCropper 内部完成 /file/upload + /profile/avatar 两步走 → 通知本页刷新
        -->
        <div class="avatar-wrapper" @click="cropperVisible = true">
          <el-avatar :size="120" :src="form.avatar || ''">
            {{ initials }}
          </el-avatar>
          <div class="avatar-mask">
            <el-icon><Camera /></el-icon>
            <span>{{ t('profile.changeAvatar') }}</span>
          </div>
        </div>
        <div class="username">{{ profile?.username || '-' }}</div>
        <div class="real-name">{{ profile?.realName || '-' }}</div>
      </div>

      <el-divider />

      <ul class="info-list">
        <li>
          <span class="label"><el-icon><Phone /></el-icon> {{ t('profile.phone') }}</span>
          <span class="value">{{ profile?.phone || t('profile.notBound') }}</span>
        </li>
        <li>
          <span class="label"><el-icon><Message /></el-icon> {{ t('profile.email') }}</span>
          <span class="value">{{ profile?.email || t('profile.notBound') }}</span>
        </li>
        <li>
          <span class="label"><el-icon><OfficeBuilding /></el-icon> {{ t('profile.dept') }}</span>
          <span class="value">{{ profile?.deptName || '-' }}</span>
        </li>
        <li>
          <span class="label"><el-icon><UserFilled /></el-icon> {{ t('profile.role') }}</span>
          <span class="value">{{ userStore.roles.join('、') || '-' }}</span>
        </li>
        <li>
          <span class="label"><el-icon><Calendar /></el-icon> {{ t('profile.createTime') }}</span>
          <span class="value">{{ profile?.createTime || '-' }}</span>
        </li>
      </ul>
    </el-card>

    <!-- 右侧：Tab 编辑区 -->
    <el-card class="profile-tabs" shadow="never">
      <el-tabs v-model="activeTab">
        <!-- 基本资料 -->
        <el-tab-pane :label="t('profile.basicInfo')" name="basic">
          <el-form
            ref="basicFormRef"
            :model="form"
            :rules="basicRules"
            label-width="100px"
            class="basic-form"
          >
            <el-form-item :label="t('profile.username')">
              <el-input :model-value="profile?.username" disabled />
              <div class="form-tip">{{ t('profile.usernameTip') }}</div>
            </el-form-item>
            <el-form-item :label="t('profile.realName')" prop="realName">
              <el-input v-model="form.realName" :placeholder="t('profile.realNamePlaceholder')" maxlength="32" />
            </el-form-item>
            <el-form-item :label="t('profile.phone')" prop="phone">
              <el-input v-model="form.phone" :placeholder="t('profile.phonePlaceholder')" maxlength="32" />
            </el-form-item>
            <el-form-item :label="t('profile.email')" prop="email">
              <el-input v-model="form.email" :placeholder="t('profile.emailPlaceholder')" maxlength="128" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="basicSaving" @click="handleSaveBasic">{{ t('profile.saveChanges') }}</el-button>
              <el-button @click="resetBasic">{{ t('common.reset') }}</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 修改密码 -->
        <el-tab-pane :label="t('profile.changePassword')" name="password">
          <el-form
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            label-width="100px"
            class="pwd-form"
          >
            <el-form-item :label="t('profile.oldPassword')" prop="oldPassword">
              <el-input v-model="pwdForm.oldPassword" type="password" :placeholder="t('profile.oldPasswordPlaceholder')" show-password />
            </el-form-item>
            <el-form-item :label="t('profile.newPassword')" prop="newPassword">
              <el-input v-model="pwdForm.newPassword" type="password" :placeholder="t('profile.newPasswordLength')" show-password />
            </el-form-item>
            <el-form-item :label="t('profile.confirmPassword')" prop="confirmPassword">
              <el-input v-model="pwdForm.confirmPassword" type="password" :placeholder="t('profile.confirmPasswordPlaceholder')" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="pwdSaving" @click="handleChangePwd">{{ t('profile.submitChanges') }}</el-button>
              <el-button @click="resetPwd">{{ t('common.reset') }}</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 头像裁剪弹窗 -->
    <AvatarCropper
      v-model="cropperVisible"
      :current="form.avatar"
      @success="handleAvatarUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Camera,
  Phone,
  Message,
  OfficeBuilding,
  UserFilled,
  Calendar,
} from '@element-plus/icons-vue'
import {
  getProfile,
  updateProfile as apiUpdateProfile,
  changePassword as apiChangePassword,
} from '@/api/admin'
import type { SysUser } from '@/types/api'
import { useUserStore } from '@/stores/user'
import AvatarCropper from './AvatarCropper.vue'

defineOptions({ name: 'UserProfile' })

const { t } = useI18n()
const userStore = useUserStore()

const profile = ref<SysUser | null>(null)
const activeTab = ref<'basic' | 'password'>('basic')

/* ---------- 基本资料 ---------- */
const basicFormRef = ref<FormInstance>()
const basicSaving = ref(false)
const form = reactive({
  realName: '',
  phone: '',
  email: '',
  avatar: '',
})

const basicRules: FormRules = {
  realName: [{ required: true, message: t('profile.realNamePlaceholder'), trigger: 'blur' }],
  phone: [
    {
      pattern: /^1[3-9]\d{9}$/,
      message: t('profile.phonePlaceholder'),
      trigger: 'blur',
    },
  ],
  email: [{ type: 'email', message: t('profile.emailPlaceholder'), trigger: 'blur' }],
}

const initials = computed(() => (profile.value?.username || 'U').charAt(0).toUpperCase())

async function loadProfile() {
  try {
    const { data } = await getProfile()
    profile.value = data.data
    form.realName = data.data.realName || ''
    form.phone = data.data.phone || ''
    form.email = data.data.email || ''
    form.avatar = data.data.avatar || ''
  } catch {
    ElMessage.error(t('profile.loadFailed'))
  }
}

function resetBasic() {
  if (!profile.value) return
  form.realName = profile.value.realName || ''
  form.phone = profile.value.phone || ''
  form.email = profile.value.email || ''
}

async function handleSaveBasic() {
  if (!basicFormRef.value) return
  await basicFormRef.value.validate()
  basicSaving.value = true
  try {
    await apiUpdateProfile({
      realName: form.realName,
      phone: form.phone,
      email: form.email,
      avatar: form.avatar,
    })
    ElMessage.success(t('profile.saveSuccess'))
    await loadProfile()
    // 同步更新顶栏头像/姓名
    await userStore.fetchUserInfo()
  } finally {
    basicSaving.value = false
  }
}

/* ---------- 修改密码 ---------- */
const pwdFormRef = ref<FormInstance>()
const pwdSaving = ref(false)
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: t('profile.oldPasswordPlaceholder'), trigger: 'blur' }],
  newPassword: [
    { required: true, message: t('profile.newPasswordLength'), trigger: 'blur' },
    { min: 6, max: 64, message: t('profile.newPasswordLength'), trigger: 'blur' },
    {
      validator: (_rule, value: string, cb) => {
        if (value && value === pwdForm.oldPassword) {
          cb(new Error(t('profile.passwordMismatch')))
        } else {
          cb()
        }
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: t('profile.confirmPasswordPlaceholder'), trigger: 'blur' },
    {
      validator: (_rule, value: string, cb) => {
        if (value !== pwdForm.newPassword) {
          cb(new Error(t('profile.passwordMismatch')))
        } else {
          cb()
        }
      },
      trigger: 'blur',
    },
  ],
}

function resetPwd() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdFormRef.value?.clearValidate()
}

async function handleChangePwd() {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate()
  await ElMessageBox.confirm(t('profile.passwordSuccess'), t('common.tip'), {
    type: 'warning',
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
  })
  pwdSaving.value = true
  try {
    await apiChangePassword({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword,
    })
    ElMessage.success(t('profile.passwordSuccess'))
    setTimeout(() => {
      userStore.logout()
      window.location.href = '/login'
    }, 1200)
  } finally {
    pwdSaving.value = false
  }
}

/* ---------- 头像裁剪弹窗 ---------- */
const cropperVisible = ref(false)

/**
 * AvatarCropper 内部已经把上传 + 写库都做完了，这里只需要：
 *  1. 同步本页的 form.avatar / profile.avatar，让左侧卡片头像立即刷新
 *  2. 调 userStore.fetchUserInfo() 让顶栏头像也跟着变
 *
 * 注意：必须先等后端 /user/info 返回新头像 URL（即后端已从 DB 实时读 avatar）后，
 * userStore 才能拿到真值；如果走的是 JWT 缓存，这里调多少次都没用。
 */
async function handleAvatarUpdated(url: string) {
  form.avatar = url
  if (profile.value) profile.value.avatar = url
  await userStore.fetchUserInfo()
}

onMounted(loadProfile)
</script>

<style scoped lang="scss">
.profile-page {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  padding: 16px;
  align-items: start;
}

.profile-card {
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0 16px;

    .avatar-wrapper {
      position: relative;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      overflow: hidden;
      cursor: pointer;

      .avatar-mask {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
        opacity: 0;
        transition: opacity 0.2s;
        font-size: 12px;
      }

      &:hover .avatar-mask {
        opacity: 1;
      }
    }

    .username {
      margin-top: 12px;
      font-size: 16px;
      font-weight: 600;
    }

    .real-name {
      margin-top: 4px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .info-list {
    list-style: none;
    margin: 0;
    padding: 0;

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      font-size: 13px;
      border-bottom: 1px dashed var(--el-border-color-lighter);

      &:last-child {
        border-bottom: none;
      }

      .label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--el-text-color-secondary);
      }

      .value {
        color: var(--el-text-color-primary);
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.profile-tabs {
  min-height: 480px;

  .basic-form,
  .pwd-form {
    max-width: 520px;
    padding-top: 8px;
  }

  .form-tip {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    line-height: 1.4;
    margin-top: 2px;
  }
}
</style>
