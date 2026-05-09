import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useThemeStore } from '@/stores/theme'

export function useLockScreen() {
  const appStore = useAppStore()
  const themeStore = useThemeStore()
  let timer: ReturnType<typeof setTimeout> | null = null
  const isPaused = ref(false)

  function startTimer() {
    clearTimer()
    if (themeStore.lockScreenTime <= 0) return

    timer = setTimeout(() => {
      if (!isPaused.value && !appStore.lockScreen) {
        appStore.lock()
      }
    }, themeStore.lockScreenTime * 60 * 1000)
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function resetTimer() {
    if (!appStore.lockScreen) {
      startTimer()
    }
  }

  function pause() {
    isPaused.value = true
  }

  function resume() {
    isPaused.value = false
    resetTimer()
  }

  function onActivity() {
    resetTimer()
  }

  onMounted(() => {
    startTimer()
    document.addEventListener('mousemove', onActivity)
    document.addEventListener('keydown', onActivity)
    document.addEventListener('click', onActivity)
  })

  onUnmounted(() => {
    clearTimer()
    document.removeEventListener('mousemove', onActivity)
    document.removeEventListener('keydown', onActivity)
    document.removeEventListener('click', onActivity)
  })

  return { startTimer, clearTimer, resetTimer, pause, resume }
}