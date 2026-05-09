<template>
  <el-menu
    class="sidebar-menu"
    :default-active="activeMenu"
    :collapse="collapsed"
    :collapse-transition="false"
    router
  >
    <SidebarMenuItem v-for="item in menus" :key="item.menuId" :item="item" />
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { MenuData } from '@/types/layout'
import SidebarMenuItem from './SidebarMenuItem.vue'

const props = defineProps<{
  collapsed: boolean
  menus: MenuData[]
}>()

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style lang="scss" scoped>
.sidebar-menu {
  border-right: none;
  padding-top: 4px;
  background-color: transparent !important;

  // Expose EP menu CSS vars so EP internals use our sidebar tokens
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--sidebar-text);
  --el-menu-active-color: var(--sidebar-text-active);
  --el-menu-hover-bg-color: var(--sidebar-hover);
  --el-menu-item-hover-fill: var(--sidebar-hover);
  --el-menu-border-color: transparent;

  &:not(.el-menu--collapse) {
    width: var(--sidebar-width);
  }
}
</style>