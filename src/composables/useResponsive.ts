import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'

export function useResponsive() {
  const appStore = useAppStore()
  let resizeHandler: (() => void) | null = null

  function check() {
    appStore.setMobile(window.innerWidth < 768)
  }

  onMounted(() => {
    check()
    resizeHandler = check
    window.addEventListener('resize', resizeHandler)
  })

  onUnmounted(() => {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler)
    }
  })

  return { check }
}