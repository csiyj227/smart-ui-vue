<template>
  <transition name="sidebar">
    <aside
      v-show="visible"
      class="sidebar-container"
      :class="{ 'is-mobile': isMobile, 'is-collapsed': collapsed }"
    >
      <SidebarLogo :collapsed="collapsed" @toggle="appStore.toggleSidebar()" />
      <el-scrollbar>
        <SidebarMenu :collapsed="collapsed" :menus="menus" />
      </el-scrollbar>
      <!-- Resize handle -->
      <div
        v-if="!isMobile && !collapsed"
        class="sidebar-resize-handle"
        @mousedown="onResizeStart"
      />
      <!-- Mobile backdrop -->
      <div v-if="isMobile && !collapsed" class="sidebar-backdrop" @click="appStore.toggleSidebar()" />
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useThemeStore } from '@/stores/theme'
import type { MenuData } from '@/types/layout'
import SidebarLogo from './SidebarLogo.vue'
import SidebarMenu from './SidebarMenu.vue'

const props = defineProps<{ menus: MenuData[] }>()
const appStore = useAppStore()
const themeStore = useThemeStore()

const collapsed = computed(() => appStore.sidebarCollapsed)
const isMobile = computed(() => appStore.isMobile)
const visible = computed(() => !isMobile.value || !collapsed.value)

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = themeStore.sidebarWidth
  const sidebar = (e.currentTarget as HTMLElement).parentElement as HTMLElement

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  sidebar.style.transition = 'none'

  const onMouseMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    const newWidth = Math.min(Math.max(startWidth + delta, 160), 400)
    themeStore.sidebarWidth = newWidth
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`)
  }

  const onMouseUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    sidebar.style.transition = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style lang="scss" scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100%;
  background: var(--gradient-sidebar);
  transition: width var(--transition-normal);
  overflow: hidden;
  flex-shrink: 0;
  z-index: 10;
  position: relative;

  // Glowing right edge — tracks primary color via CSS var
  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--color-primary-glow-strong) 25%,
      var(--color-primary-glow-strong) 75%,
      transparent 100%
    );
    pointer-events: none;
  }

  &.is-collapsed {
    width: var(--sidebar-collapsed-width);
  }

  &.is-mobile {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1000;
  }
}

.sidebar-resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 11;

  &:hover {
    background: var(--color-primary-glow);
  }
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  z-index: -1;
}
</style>