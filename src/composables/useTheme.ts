import { useThemeStore } from '@/stores/theme'

export function useTheme() {
  const themeStore = useThemeStore()

  function initTheme() {
    themeStore.applyTheme()
  }

  return { initTheme }
}