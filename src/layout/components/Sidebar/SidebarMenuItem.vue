<template>
  <!-- Directory: submenu -->
  <el-sub-menu v-if="item.children && item.children.length" :index="item.path" teleported>
    <template #title>
      <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
      <span>{{ translateMenu(item.menuName) }}</span>
    </template>
    <SidebarMenuItem v-for="child in item.children" :key="child.menuId" :item="child" />
  </el-sub-menu>

  <!-- Menu item: leaf -->
  <el-menu-item v-else :index="item.path">
    <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
    <template #title>{{ translateMenu(item.menuName) }}</template>
  </el-menu-item>
</template>

<script setup lang="ts">
import type { MenuData } from '@/types/layout'
import { useMenuTranslate } from '@/composables/useMenuTranslate'

defineProps<{ item: MenuData }>()

const { translateMenu } = useMenuTranslate()
</script>