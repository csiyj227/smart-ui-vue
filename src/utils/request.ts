import axios from 'axios'
import type { R } from '@/types/api'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import router from '@/router'
import i18n, { globalLocale } from '@/i18n'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipError?: boolean
  }
  interface InternalAxiosRequestConfig {
    skipError?: boolean
  }
}

/** Shorthand for accessing i18n.global.t in non-component code */
function t(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(key, named ?? {})
}

const OAUTH2_ERROR_KEYS: Record<string, string> = {
  access_denied: 'request.oauth2.access_denied',
  invalid_client: 'request.oauth2.invalid_client',
  invalid_grant: 'request.oauth2.invalid_grant',
  invalid_request: 'request.oauth2.invalid_request',
  invalid_scope: 'request.oauth2.invalid_scope',
  unauthorized_client: 'request.oauth2.unauthorized_client',
  unsupported_grant_type: 'request.oauth2.unsupported_grant_type',
  server_error: 'request.oauth2.server_error',
}

const HTTP_STATUS_KEYS: Record<number, string> = {
  400: 'request.http.400',
  401: 'request.http.401',
  403: 'request.http.403',
  404: 'request.http.404',
  405: 'request.http.405',
  429: 'request.http.429',
  500: 'request.http.500',
  502: 'request.http.502',
  503: 'request.http.503',
}

const request = axios.create({
  baseURL: '/api',
  timeout: 90000,
})

request.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (!(config as any).skipAuth && userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  if (userStore.tenantId) {
    config.headers['X-Tenant-Id'] = userStore.tenantId
  }
  config.headers['Accept-Language'] = globalLocale.value
  return config
})

request.interceptors.response.use(
  (response) => {
    // OAuth2 token endpoint returns standard RFC 6749 format, not R<T>
    if (response.config.url?.includes('/oauth2/token')) {
      return response
    }

    // Binary responses (file download/export) bypass R<T> unwrapping
    const responseType = response.config.responseType
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return response
    }

    const data = response.data as R<any>

    // Business error: code !== 0
    if (data.code !== 0) {
      const msg = data.msg || t('request.operationFailed')
      ElMessage.error(msg)

      if (data.code === 401) {
        const userStore = useUserStore()
        userStore.logout()
        router.push('/login')
      }

      return Promise.reject(new Error(msg))
    }

    return response
  },
  (error) => {
    // Caller opted out of global error handling
    if (error.config?.skipError) return Promise.reject(error)

    if (error.response) {
      const { status, data } = error.response
      const isLoginRequest = error.config?.url?.includes('/oauth2/token')
      const isOnLoginPage = router.currentRoute.value.path === '/login'

      // OAuth2 error format: { error: "access_denied", error_description: "..." }
      if (data && data.error && !data.code) {
        const i18nKey = OAUTH2_ERROR_KEYS[data.error]
        const msg = i18nKey ? t(i18nKey) : (data.error_description || data.error)
        if (!isLoginRequest) ElMessage.error(msg)
        return Promise.reject(new Error(msg))
      }

      // R<T> error format from global exception handler
      if (data && data.msg) {
        ElMessage.error(data.msg)
        if (status === 401 && !isLoginRequest && !isOnLoginPage) {
          const userStore = useUserStore()
          userStore.logout()
          router.push('/login')
        }
        return Promise.reject(new Error(data.msg))
      }

      // Standard HTTP errors
      const httpKey = HTTP_STATUS_KEYS[status]
      const msg = httpKey ? t(httpKey) : t('request.requestFailed', { status })
      ElMessage.error(msg)

      if (status === 401 && !isLoginRequest && !isOnLoginPage) {
        const userStore = useUserStore()
        userStore.logout()
        router.push('/login')
      }
    } else if (error.code === 'ERR_CANCELED') {
      // Request cancelled, no need to show error
    } else {
      ElMessage.error(t('request.networkError'))
    }

    return Promise.reject(error)
  },
)

export default request