<template>
  <div class="login-page">
    <!-- Left decorative panel -->
    <div class="login-left">
      <div class="left-content">
        <div class="brand">
          <img src="@/assets/logo-128.png" alt="Smart Admin" class="brand-icon" />
          <h1>Smart Admin</h1>
        </div>
        <p class="tagline">{{ $t('login.tagline') }}</p>
        <div class="decorative-shapes">
          <div class="shape shape-1" />
          <div class="shape shape-2" />
          <div class="shape shape-3" />
          <div class="shape shape-4" />
        </div>
      </div>
    </div>

    <!-- Right form panel -->
    <div class="login-right">
      <div class="login-form-wrapper">
        <div class="form-header">
          <h2>{{ $t('login.welcome') }}</h2>
          <p>{{ $t('login.subtitle') }}</p>
        </div>

        <!-- Login mode tabs -->
        <div class="login-tabs">
          <div
            class="tab-item"
            :class="{ active: loginMode === 'password' }"
            @click="switchMode('password')"
          >
            {{ $t('login.tabPassword') }}
          </div>
          <div
            class="tab-item"
            :class="{ active: loginMode === 'sms' }"
            @click="switchMode('sms')"
          >
            {{ $t('login.tabSms') }}
          </div>
        </div>

        <!-- Password login form -->
        <el-form
          v-show="loginMode === 'password'"
          ref="passwordFormRef"
          :model="passwordForm"
          @submit.prevent="handlePasswordLogin"
        >
          <el-alert
            v-if="loginError"
            :title="loginError"
            type="error"
            :closable="false"
            show-icon
            style="margin-bottom: 20px; border-radius: 8px;"
          />
          <el-form-item>
            <el-input
              v-model="passwordForm.username"
              :placeholder="$t('login.username')"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>

          <el-form-item>
            <el-input
              v-model="passwordForm.password"
              type="password"
              :placeholder="$t('login.password')"
              prefix-icon="Lock"
              show-password
              size="large"
            />
          </el-form-item>

          <!-- Captcha -->
          <el-form-item>
            <div class="captcha-row">
              <el-input
                v-model="passwordForm.captchaCode"
                :placeholder="$t('login.captcha')"
                prefix-icon="Key"
                size="large"
              />
              <div class="captcha-image-wrapper" @click="loadCaptcha">
                <img
                  v-if="captchaData"
                  :src="captchaData.image"
                  :alt="$t('login.captcha')"
                  :title="$t('login.captchaRefresh')"
                  class="captcha-image"
                />
                <div v-else class="captcha-placeholder" :title="$t('login.captchaRefresh')">
                  <el-icon :size="20"><RefreshRight /></el-icon>
                  <span>{{ captchaLoading ? $t('login.captchaLoading') : $t('login.captchaRefresh') }}</span>
                </div>
              </div>
            </div>
          </el-form-item>

          <el-form-item>
            <el-select
              v-if="tenantList.length > 0"
              v-model="passwordForm.tenantId"
              :placeholder="$t('login.tenantSelect')"
              size="large"
              style="width: 100%"
            >
              <el-option v-for="tenant in tenantList" :key="tenant.id" :label="tenant.tenantName" :value="tenant.id" />
            </el-select>
            <el-input
              v-else
              v-model.number="passwordForm.tenantId"
              :placeholder="$t('login.tenantId')"
              size="large"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="loading" size="large" style="width: 100%" native-type="submit">
              {{ $t('login.submit') }}
            </el-button>
          </el-form-item>
        </el-form>

        <!-- SMS login form -->
        <el-form
          v-show="loginMode === 'sms'"
          ref="smsFormRef"
          :model="smsForm"
          @submit.prevent="handleSmsLogin"
        >
          <el-alert
            v-if="loginError"
            :title="loginError"
            type="error"
            :closable="false"
            show-icon
            style="margin-bottom: 20px; border-radius: 8px;"
          />
          <el-form-item>
            <el-input
              v-model="smsForm.phone"
              :placeholder="$t('login.phone')"
              prefix-icon="Iphone"
              size="large"
            />
          </el-form-item>

          <el-form-item>
            <div class="sms-code-row">
              <el-input
                v-model="smsForm.code"
                :placeholder="$t('login.smsCode')"
                prefix-icon="Message"
                size="large"
              />
              <el-button
                :disabled="smsCountdown > 0"
                size="large"
                class="send-code-btn"
                @click="handleSendCode"
              >
                {{ smsCountdown > 0 ? $t('login.sendCodeCountdown', { seconds: smsCountdown }) : $t('login.sendCode') }}
              </el-button>
            </div>
          </el-form-item>

          <el-form-item>
            <el-select
              v-if="tenantList.length > 0"
              v-model="smsForm.tenantId"
              :placeholder="$t('login.tenantSelect')"
              size="large"
              style="width: 100%"
            >
              <el-option v-for="tenant in tenantList" :key="tenant.id" :label="tenant.tenantName" :value="tenant.id" />
            </el-select>
            <el-input
              v-else
              v-model.number="smsForm.tenantId"
              :placeholder="$t('login.tenantId')"
              size="large"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="loading" size="large" style="width: 100%" native-type="submit">
              {{ $t('login.submit') }}
            </el-button>
          </el-form-item>
        </el-form>

        <!-- Social login -->
        <div class="social-login">
          <div class="social-divider">
            <span>{{ $t('login.socialLogin') }}</span>
          </div>
          <div class="social-icons">
            <div
              v-for="provider in staticSocialProviders"
              :key="provider.type"
              class="social-icon-btn"
              :title="provider.name"
              @click="handleSocialLogin(provider.type)"
            >
              <svg v-if="provider.type === 'github'" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              <svg v-else-if="provider.type === 'google'" viewBox="0 0 24 24" width="20" height="20">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <svg v-else-if="provider.type === 'wechat'" viewBox="0 0 24 24" width="20" height="20" fill="#07C160">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05a6.42 6.42 0 01-.235-1.678c0-3.644 3.38-6.602 7.548-6.602.322 0 .634.027.942.058C17.018 4.723 13.2 2.188 8.691 2.188zm-2.7 4.4a1.06 1.06 0 11.001 2.121 1.06 1.06 0 010-2.121zm5.4 0a1.06 1.06 0 110 2.122 1.06 1.06 0 010-2.122zM16.735 9.42c-3.608 0-6.533 2.563-6.533 5.727 0 3.163 2.925 5.727 6.533 5.727.725 0 1.42-.108 2.07-.31a.706.706 0 01.584.08l1.56.913a.27.27 0 00.136.044c.13 0 .238-.108.238-.24 0-.06-.023-.117-.039-.174l-.32-1.212a.478.478 0 01.173-.541C22.594 18.527 24 16.748 24 15.147c0-3.164-2.926-5.727-6.534-5.727h-.731zm-2.097 3.373a.868.868 0 110 1.737.868.868 0 010-1.737zm4.462 0a.868.868 0 110 1.737.868.868 0 010-1.737z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  login, smsLogin, getTenantList, getCaptcha,
  getSocialAuthorizeUrl,
} from '@/api/auth'
import type { CaptchaResult } from '@/api/auth'
import type { SysTenant } from '@/types/api'

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const loginError = ref('')
const tenantList = ref<SysTenant[]>([])

// ---- Login mode ----
const loginMode = ref<'password' | 'sms'>('password')

function switchMode(mode: 'password' | 'sms') {
  loginMode.value = mode
  loginError.value = ''
}

// ---- Tenant ----
async function loadTenants() {
  try {
    const { data } = await getTenantList()
    tenantList.value = data.data || []
    if (tenantList.value.length > 0) {
      if (!passwordForm.tenantId) passwordForm.tenantId = tenantList.value[0].id
      if (!smsForm.tenantId) smsForm.tenantId = tenantList.value[0].id
    }
  } catch {
    tenantList.value = []
  }
}

// ---- Captcha ----
const captchaData = ref<CaptchaResult | null>(null)
const captchaLoading = ref(false)

async function loadCaptcha() {
  captchaLoading.value = true
  try {
    const { data } = await getCaptcha()
    const result = data.data
    if (result && result.type !== 'disabled') {
      captchaData.value = result
    } else {
      captchaData.value = null
    }
  } catch {
    captchaData.value = null
  } finally {
    captchaLoading.value = false
  }
}

// ---- Social login ----
const socialIconMap: Record<string, string> = {
  github: 'Connection',
  google: 'ChromeFilled',
  wechat: 'ChatDotRound',
}

// 前端静态配置社交登录，不依赖后端接口
const staticSocialProviders = [
  { type: 'github', name: 'GitHub' },
  { type: 'google', name: 'Google' },
  { type: 'wechat', name: 'WeChat' },
]

async function handleSocialLogin(providerType: string) {
  try {
    const redirectUri = `${window.location.origin}/social-callback`
    const { data } = await getSocialAuthorizeUrl(providerType, redirectUri)
    const result = data.data
    if (result?.url) {
      window.location.href = result.url
    }
  } catch {
    ElMessage.error(t('login.socialLoginFailed'))
  }
}

// ---- Password login ----
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  username: '',
  password: '',
  captchaCode: '',
  tenantId: 1,
})

function validatePasswordForm(): string | null {
  if (!passwordForm.username) return t('login.usernameRequired')
  if (!passwordForm.password) return t('login.passwordRequired')
  if (captchaData.value && !passwordForm.captchaCode) return t('login.captchaRequired')
  return null
}

async function handlePasswordLogin() {
  loginError.value = ''
  const error = validatePasswordForm()
  if (error) {
    loginError.value = error
    return
  }
  loading.value = true
  try {
    const params: Record<string, string> = {
      username: passwordForm.username,
      password: passwordForm.password,
      grant_type: 'password',
      tenant_id: String(passwordForm.tenantId),
    }
    if (captchaData.value && passwordForm.captchaCode) {
      params.captcha_uuid = captchaData.value.uuid
      params.captcha_code = passwordForm.captchaCode
    }
    const { data } = await login(params as any)
    await handleLoginSuccess(data, passwordForm.tenantId)
  } catch (e: any) {
    loginError.value = e.message || t('login.failed')
    loadCaptcha()
  } finally {
    loading.value = false
  }
}

// ---- SMS login ----
const smsFormRef = ref<FormInstance>()
const smsForm = reactive({
  phone: '',
  code: '',
  tenantId: 1,
})
const smsCountdown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

function validateSmsForm(): string | null {
  if (!smsForm.phone) return t('login.phoneRequired')
  if (!/^1[3-9]\d{9}$/.test(smsForm.phone)) return t('login.phoneInvalid')
  if (!smsForm.code) return t('login.smsCodeRequired')
  return null
}

function handleSendCode() {
  if (!smsForm.phone) {
    loginError.value = t('login.phoneRequired')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(smsForm.phone)) {
    loginError.value = t('login.phoneInvalid')
    return
  }
  loginError.value = ''
  smsCountdown.value = 60
  smsTimer = setInterval(() => {
    smsCountdown.value--
    if (smsCountdown.value <= 0 && smsTimer) {
      clearInterval(smsTimer)
      smsTimer = null
    }
  }, 1000)
  ElMessage.success(t('login.smsCodeRequired'))
}

async function handleSmsLogin() {
  loginError.value = ''
  const error = validateSmsForm()
  if (error) {
    loginError.value = error
    return
  }
  loading.value = true
  try {
    const { data } = await smsLogin({
      phone: smsForm.phone,
      code: smsForm.code,
      grant_type: 'sms',
      tenant_id: String(smsForm.tenantId),
    })
    await handleLoginSuccess(data, smsForm.tenantId)
  } catch (e: any) {
    loginError.value = e.message || t('login.failed')
  } finally {
    loading.value = false
  }
}

// ---- Common login success handler ----
async function handleLoginSuccess(data: any, tenantId: number) {
  userStore.setToken((data as any).access_token, (data as any).refresh_token)
  userStore.setTenantId(tenantId)
  await userStore.fetchUserInfo()
  ElMessage.success(t('login.success'))
  router.push('/')
}

// ---- Lifecycle ----
onMounted(() => {
  loadTenants()
  loadCaptcha()
})

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
})
</script>

<style lang="scss" scoped>
.login-page {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.login-left {
  flex: 1;
  background: linear-gradient(145deg, #3730A3 0%, #4F46E5 35%, #6366F1 65%, #0D0C1F 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  @media (max-width: 767px) {
    display: none;
  }
}

.left-content {
  position: relative;
  z-index: 1;
  padding: 60px;
  max-width: 480px;

  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;

    .brand-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      object-fit: contain;
      filter: drop-shadow(0 4px 16px rgba(99, 102, 241, 0.5));
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }
  }

  .tagline {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.7;
    margin-bottom: 48px;
  }
}

.decorative-shapes {
  .shape {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    animation: float linear infinite;
  }

  .shape-1 {
    width: 420px;
    height: 420px;
    top: -120px;
    right: -100px;
    animation-duration: 18s;
    animation-delay: 0s;
  }

  .shape-2 {
    width: 220px;
    height: 220px;
    bottom: 40px;
    left: -70px;
    animation-duration: 14s;
    animation-delay: -6s;
    background: rgba(255, 255, 255, 0.04);
  }

  .shape-3 {
    width: 130px;
    height: 130px;
    bottom: -20px;
    right: 80px;
    animation-duration: 10s;
    animation-delay: -3s;
    background: rgba(255, 255, 255, 0.03);
  }

  .shape-4 {
    width: 80px;
    height: 80px;
    top: 30%;
    left: 20%;
    animation-duration: 12s;
    animation-delay: -8s;
    background: rgba(255, 255, 255, 0.05);
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33%       { transform: translateY(-18px) rotate(8deg); }
  66%       { transform: translateY(10px) rotate(-5deg); }
}

.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
  padding: 40px;

  @media (max-width: 767px) {
    flex: none;
    width: 100%;
  }
}

.login-form-wrapper {
  width: 100%;
  max-width: 400px;

  .form-header {
    margin-bottom: 24px;

    h2 {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    p {
      font-size: 15px;
      color: var(--color-text-muted);
    }
  }

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-input__wrapper) {
    border-radius: var(--radius-lg) !important;
    height: 46px;
    transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
  }

  :deep(.el-select .el-input__wrapper) {
    height: 46px;
  }

  :deep(.el-button--primary) {
    border-radius: var(--radius-lg) !important;
    font-size: 15px;
    height: 48px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
}

// Login tabs
.login-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--el-border-color-lighter, #e4e7ed);

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 10px 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    position: relative;
    transition: color 0.25s;

    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 20%;
      width: 60%;
      height: 2px;
      background: transparent;
      border-radius: 1px;
      transition: background 0.25s;
    }

    &:hover {
      color: var(--color-text);
    }

    &.active {
      color: var(--el-color-primary);
      font-weight: 600;

      &::after {
        background: var(--el-color-primary);
      }
    }
  }
}

// Captcha row
.captcha-row {
  display: flex;
  gap: 12px;
  width: 100%;

  .el-input {
    flex: 1;
  }

  .captcha-image-wrapper {
    flex-shrink: 0;
    cursor: pointer;
  }

  .captcha-image {
    height: 46px;
    width: 120px;
    border-radius: 8px;
    cursor: pointer;
    object-fit: cover;
    border: 1px solid var(--el-border-color-lighter, #e4e7ed);
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.8;
    }
  }

  .captcha-placeholder {
    height: 46px;
    width: 120px;
    border-radius: 8px;
    border: 1px dashed var(--el-border-color, #dcdfe6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--color-text-muted, #909399);
    font-size: 12px;
    background: var(--el-fill-color-lighter, #fafafa);
    transition: all 0.2s;

    &:hover {
      border-color: var(--el-color-primary);
      color: var(--el-color-primary);
      background: rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.04);
    }
  }
}

// SMS code row
.sms-code-row {
  display: flex;
  gap: 12px;
  width: 100%;

  .el-input {
    flex: 1;
  }

  .send-code-btn {
    flex-shrink: 0;
    min-width: 120px;
    border-radius: var(--radius-lg) !important;
    height: 46px;
    font-size: 13px;
  }
}

// Social login
.social-login {
  margin-top: 8px;

  .social-divider {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    color: var(--color-text-muted);
    font-size: 13px;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--el-border-color-lighter, #e4e7ed);
    }

    span {
      padding: 0 16px;
      white-space: nowrap;
    }
  }

  .social-icons {
    display: flex;
    justify-content: center;
    gap: 16px;

    .social-icon-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--el-border-color-lighter, #e4e7ed);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.25s;

      &:hover {
        color: var(--el-color-primary);
        border-color: var(--el-color-primary);
        background: rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.06);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
    }
  }
}
</style>