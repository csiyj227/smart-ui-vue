<template>
  <div class="collapse-toggle" @click="appStore.toggleSidebar()">
    <el-icon :size="18">
      <Fold v-if="!appStore.sidebarCollapsed" />
      <Expand v-else />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
</script>

<style lang="scss" scoped>
.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-regular);
  transition: all var(--transition-fast);

  &:hover {
    background-color: var(--color-primary-subtle);
    color: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-primary-glow);
  }

  &:active {
    transform: scale(0.92);
  }
}
</style>