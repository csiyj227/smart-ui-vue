import request from '@/utils/request'
import type { R, TokenResult, UserInfo, LoginParams, SysTenant } from '@/types/api'

const CLIENT_BASIC_AUTH = 'Basic ' + btoa('smart:smart')

export function login(data: LoginParams) {
  return request.post<R<TokenResult>>('/oauth2/token', new URLSearchParams(data), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': CLIENT_BASIC_AUTH,
    },
    skipAuth: true as any,
  })
}

export function refreshToken(refreshToken: string) {
  return request.post<R<TokenResult>>('/oauth2/token', new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': CLIENT_BASIC_AUTH,
    },
    skipAuth: true as any,
  })
}

export function getUserInfo() {
  return request.get<R<UserInfo>>('/system/user/info')
}

export const verifyPassword = (password: string) => request.post<R<boolean>>('/system/user/verify-password', { password })

export const getTenantList = () => request.get<R<SysTenant[]>>('/system/tenant/list', { skipError: true })

// ---- Captcha ----

export interface CaptchaResult {
  uuid: string
  image: string
  type: string
}

export function getCaptcha() {
  return request.get<R<CaptchaResult>>('/auth/captcha/image', { skipAuth: true })
}

// ---- SMS Login ----

export interface SmsLoginParams {
  phone: string
  code: string
  grant_type: string
  tenant_id: string
  [key: string]: string
}

export function smsLogin(data: SmsLoginParams) {
  return request.post<R<TokenResult>>('/oauth2/token', new URLSearchParams(data), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': CLIENT_BASIC_AUTH,
    },
    skipAuth: true as any,
  })
}

// ---- Social Login ----

export interface SocialProvider {
  type: string
  name: string
  icon: string
}

export function getSocialProviders() {
  return request.get<R<SocialProvider[]>>('/auth/social/providers', { skipAuth: true })
}

export function getSocialAuthorizeUrl(provider: string, redirectUri: string) {
  return request.get<R<{ url: string; state: string }>>(`/auth/social/authorize/${provider}`, {
    params: { redirectUri },
    skipAuth: true,
  })
}