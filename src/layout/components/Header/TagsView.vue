<template>
  <div class="tags-view" v-if="themeStore.showTagsView">
    <el-scrollbar class="tags-scroll">
      <div class="tags-list">
        <TagsViewItem
          v-for="tag in tagsViewStore.visitedViews"
          :key="tag.path"
          :tag="tag"
          :is-active="route.path === tag.path"
          @click="router.push(tag.path)"
          @close="closeTag(tag.path)"
          @contextmenu="openContextMenu($event, tag)"
        />
      </div>
    </el-scrollbar>
    <TagsContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :tag="contextMenuTag"
      @refresh="refreshPage"
      @close="closeContextMenuTag"
      @close-others="handleCloseOthers"
      @close-left="handleCloseLeft"
      @close-right="handleCloseRight"
      @close-all="closeAllTags"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useTagsViewStore } from '@/stores/tagsView'
import { useTagsView } from '@/composables/useTagsView'
import type { TagView } from '@/types/layout'
import TagsViewItem from './TagsViewItem.vue'
import TagsContextMenu from './TagsContextMenu.vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const tagsViewStore = useTagsViewStore()
const { closeTag, closeOthers, closeAll, closeLeft, closeRight } = useTagsView()

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTag = ref<TagView | null>(null)

function openContextMenu(e: MouseEvent, tag: TagView) {
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuTag.value = tag
  contextMenuVisible.value = true
}

function closeContextMenuTag() {
  if (contextMenuTag.value) {
    closeTag(contextMenuTag.value.path)
  }
  contextMenuVisible.value = false
}

function refreshPage() {
  router.replace({ path: '/redirect' + route.path })
  contextMenuVisible.value = false
}

function closeAllTags() {
  closeAll()
  contextMenuVisible.value = false
}

// 以下三个函数必须把右键命中的那个 tag.path 透传给 store 操作，
// 否则 store 里的 path 参数为 undefined，filter/findIndex 全部失效：
// - closeOthers: 找不到 path 时会把所有非 affix 都过滤掉 → 看起来是"把自己也关了"
// - closeLeft / closeRight: findIndex 返回 -1 直接 return → 看起来是"没效果"
function handleCloseOthers() {
  if (!contextMenuTag.value) return
  const targetPath = contextMenuTag.value.path
  closeOthers(targetPath)
  // 右键的 tag 不一定是当前激活路由，关闭其他后要切到它，避免出现"列表只剩它，但页面还停在别处"
  if (route.path !== targetPath) {
    router.push(targetPath)
  }
  contextMenuVisible.value = false
}

function handleCloseLeft() {
  if (!contextMenuTag.value) return
  const targetPath = contextMenuTag.value.path
  // 如果当前激活的就在被关闭的左侧范围里，需要先把路由切到右键命中的 tag 上
  const currentIndex = tagsViewStore.visitedViews.findIndex(v => v.path === route.path)
  const targetIndex = tagsViewStore.visitedViews.findIndex(v => v.path === targetPath)
  closeLeft(targetPath)
  if (currentIndex !== -1 && targetIndex !== -1 && currentIndex < targetIndex) {
    router.push(targetPath)
  }
  contextMenuVisible.value = false
}

function handleCloseRight() {
  if (!contextMenuTag.value) return
  const targetPath = contextMenuTag.value.path
  const currentIndex = tagsViewStore.visitedViews.findIndex(v => v.path === route.path)
  const targetIndex = tagsViewStore.visitedViews.findIndex(v => v.path === targetPath)
  closeRight(targetPath)
  if (currentIndex !== -1 && targetIndex !== -1 && currentIndex > targetIndex) {
    router.push(targetPath)
  }
  contextMenuVisible.value = false
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

// Add route to tags on navigation
watch(() => route.path, () => {
  if (route.name && route.meta?.title) {
    tagsViewStore.addView(route)
  }
}, { immediate: true })

onMounted(() => document.addEventListener('click', closeContextMenu))
onUnmounted(() => document.removeEventListener('click', closeContextMenu))
</script>

<style lang="scss" scoped>
.tags-view {
  display: flex;
  align-items: center;
  height: var(--tags-height);
  background-color: var(--tags-bg);
  border-bottom: 1px solid var(--color-border-light);
  padding: 0 16px;
  flex-shrink: 0;
}

.tags-scroll {
  width: 100%;
}

.tags-list {
  display: flex;
  gap: 5px;
  align-items: center;
  white-space: nowrap;
  padding: 4px 0;
}
</style>