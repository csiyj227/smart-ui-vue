<template>
  <component :is="currentLayout" :menus="menus" @open-settings="showSettings = true" />
  <SettingsDrawer v-model="showSettings" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import i18n from '@/i18n'
import { useLayout } from '@/composables/useLayout'
import { useResponsive } from '@/composables/useResponsive'
import { usePermissionStore } from '@/stores/permission'
import SettingsDrawer from '@/components/SettingsDrawer/index.vue'
import type { MenuData } from '@/types/layout'

const { currentLayout } = useLayout()
useResponsive()

const showSettings = ref(false)
const permissionStore = usePermissionStore()

const homeMenu = computed<MenuData>(() => ({
  menuId: 0,
  menuName: i18n.global.t('layout.home'),
  path: '/home',
  component: 'home/index',
  parentId: 0,
  icon: 'HomeFilled',
  sortOrder: -1,
  menuType: '1',
  keepAlive: false,
  visible: true,
  permission: '',
}))

const menus = computed<MenuData[]>(() => [homeMenu.value, ...permissionStore.menuList])
</script>