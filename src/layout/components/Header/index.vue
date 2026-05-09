<template>
  <header class="layout-header">
    <div class="header-left">
      <CollapseToggle />
      <Breadcrumb v-if="themeStore.showBreadcrumb" />
    </div>
    <HeaderRight @open-settings="$emit('openSettings')" />
  </header>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import CollapseToggle from './CollapseToggle.vue'
import Breadcrumb from './Breadcrumb.vue'
import HeaderRight from './HeaderRight.vue'

defineEmits<{ openSettings: [] }>()

const themeStore = useThemeStore()
</script>

<style lang="scss" scoped>
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 20px;
  background-color: var(--header-bg);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  border-bottom: 1px solid var(--header-border);
  flex-shrink: 0;
  z-index: 9;
  position: sticky;
  top: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}
</style>