import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types/api'
import { getUserInfo } from '@/api/auth'
import { resetRouter } from '@/router'
import { useTagsViewStore } from './tagsView'
import { usePermissionStore } from './permission'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const refreshTokenVal = ref(localStorage.getItem('refresh_token') || '')
  const tenantId = ref(Number(localStorage.getItem('tenant_id')) || 1)
  const userInfo = ref<UserInfo | null>(null)
  const permissions = ref<string[]>([])
  const roles = ref<string[]>([])

  function setToken(accessToken: string, newRefreshToken: string) {
    token.value = accessToken
    refreshTokenVal.value = newRefreshToken
    localStorage.setItem('token', accessToken)
    localStorage.setItem('refresh_token', newRefreshToken)
  }

  function setTenantId(id: number) {
    tenantId.value = id
    localStorage.setItem('tenant_id', String(id))
  }

  async function fetchUserInfo() {
    const { data } = await getUserInfo()
    userInfo.value = data.data
    permissions.value = data.data.permissions
    roles.value = data.data.roles
  }

  function logout() {
    token.value = ''
    refreshTokenVal.value = ''
    userInfo.value = null
    permissions.value = []
    roles.value = []
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    // Clear dynamic routes and permission state
    resetRouter()
    usePermissionStore().reset()
    // Clear all tag views
    useTagsViewStore().visitedViews = []
    useTagsViewStore().cachedViews = []
  }

  return { token, refreshTokenVal, tenantId, userInfo, permissions, roles, setToken, setTenantId, fetchUserInfo, logout }
})