import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const isMobile = ref(false)
  const lockScreen = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setMobile(val: boolean) {
    isMobile.value = val
    if (val) sidebarCollapsed.value = true
  }

  function lock() {
    lockScreen.value = true
  }

  function unlock() {
    lockScreen.value = false
  }

  return { sidebarCollapsed, isMobile, lockScreen, toggleSidebar, setMobile, lock, unlock }
})