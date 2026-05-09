import { useRouter } from 'vue-router'
import { useTagsViewStore } from '@/stores/tagsView'

export function useTagsView() {
  const router = useRouter()
  const tagsViewStore = useTagsViewStore()

  function closeTag(path: string) {
    const nextView = tagsViewStore.removeView(path)
    if (nextView && router.currentRoute.value.path === path) {
      router.push(nextView.path)
    } else if (!nextView && router.currentRoute.value.path === path) {
      router.push('/')
    }
  }

  function closeOthers(path: string) {
    tagsViewStore.removeOthers(path)
  }

  function closeAll() {
    const affixView = tagsViewStore.removeAll()
    router.push(affixView?.path || '/')
  }

  function closeLeft(path: string) {
    tagsViewStore.removeLeft(path)
  }

  function closeRight(path: string) {
    tagsViewStore.removeRight(path)
  }

  return { closeTag, closeOthers, closeAll, closeLeft, closeRight }
}