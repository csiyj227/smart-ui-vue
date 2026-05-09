import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TagView } from '@/types/layout'

export const useTagsViewStore = defineStore('tagsView', () => {
  const visitedViews = ref<TagView[]>([])
  const cachedViews = ref<string[]>([])

  function addView(route: { path: string; name?: string | symbol; meta?: any; query?: any }) {
    const name = route.name as string
    if (!name) return

    const exists = visitedViews.value.some(v => v.path === route.path)
    if (!exists) {
      visitedViews.value.push({
        path: route.path,
        name,
        title: route.meta?.title || name,
        titleKey: route.meta?.titleKey as string | undefined,
        icon: route.meta?.icon,
        affix: route.meta?.affix || false,
        query: route.query,
      })
    }

    if (!cachedViews.value.includes(name) && route.meta?.keepAlive !== false) {
      cachedViews.value.push(name)
    }
  }

  function removeView(path: string) {
    const idx = visitedViews.value.findIndex(v => v.path === path)
    if (idx !== -1) {
      const view = visitedViews.value[idx]
      if (view.affix) return null
      visitedViews.value.splice(idx, 1)
      const cacheIdx = cachedViews.value.indexOf(view.name)
      if (cacheIdx !== -1) cachedViews.value.splice(cacheIdx, 1)
      // Return the nearest view to navigate to
      return visitedViews.value[idx] || visitedViews.value[idx - 1] || null
    }
    return null
  }

  function removeOthers(path: string) {
    visitedViews.value = visitedViews.value.filter(v => v.affix || v.path === path)
    const current = visitedViews.value.find(v => v.path === path)
    cachedViews.value = current ? [current.name] : []
  }

  function removeAll() {
    visitedViews.value = visitedViews.value.filter(v => v.affix)
    cachedViews.value = []
    return visitedViews.value[0] || null
  }

  function removeLeft(path: string) {
    const idx = visitedViews.value.findIndex(v => v.path === path)
    if (idx === -1) return
    visitedViews.value = visitedViews.value.filter((v, i) => v.affix || i >= idx)
    // cachedViews 直接按剩余 visitedViews 重建，避免老逻辑里 `!v.affix || v.path === path`
    // 永远为 true 的 BUG（对非 affix 项 !v.affix 已经是 true，整个 || 短路成 true）
    cachedViews.value = visitedViews.value.map(v => v.name)
  }

  function removeRight(path: string) {
    const idx = visitedViews.value.findIndex(v => v.path === path)
    if (idx === -1) return
    visitedViews.value = visitedViews.value.filter((v, i) => v.affix || i <= idx)
    cachedViews.value = visitedViews.value.map(v => v.name)
  }

  return {
    visitedViews, cachedViews,
    addView, removeView, removeOthers, removeAll, removeLeft, removeRight,
  }
})