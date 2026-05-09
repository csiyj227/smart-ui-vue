import type { Directive } from 'vue'
import { useUserStore } from '@/stores/user'

export const permission: Directive = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const required = binding.value as string[]
    if (!required || required.length === 0) return
    if (userStore.roles.includes('ADMIN')) return
    const hasPermission = required.some((p) => userStore.permissions.includes(p))
    if (!hasPermission) {
      el.parentNode?.removeChild(el)
    }
  },
}