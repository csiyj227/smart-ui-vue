import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import DefaultLayout from '@/layout/layouts/DefaultLayout.vue'
import ClassicLayout from '@/layout/layouts/ClassicLayout.vue'

export function useLayout() {
  const themeStore = useThemeStore()

  const currentLayout = computed(() => {
    return themeStore.layoutMode === 'classic' ? ClassicLayout : DefaultLayout
  })

  return { currentLayout }
}