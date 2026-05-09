<template>
  <transition name="zoom">
    <div v-if="visible" class="tags-context-menu" :style="menuStyle">
      <div class="menu-item" @click="$emit('refresh')">
        <el-icon><RefreshRight /></el-icon>刷新
      </div>
      <div class="menu-item" :class="{ disabled: tag?.affix }" @click="!tag?.affix && $emit('close')">
        <el-icon><Close /></el-icon>关闭
      </div>
      <div class="menu-item" @click="$emit('closeOthers')">
        <el-icon><CircleClose /></el-icon>关闭其他
      </div>
      <div class="menu-item" @click="$emit('closeLeft')">
        <el-icon><Back /></el-icon>关闭左侧
      </div>
      <div class="menu-item" @click="$emit('closeRight')">
        <el-icon><Right /></el-icon>关闭右侧
      </div>
      <div class="menu-item" @click="$emit('closeAll')">
        <el-icon><FolderDelete /></el-icon>关闭全部
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TagView } from '@/types/layout'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  tag: TagView | null
}>()

defineEmits(['refresh', 'close', 'closeOthers', 'closeLeft', 'closeRight', 'closeAll'])

const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}))
</script>

<style lang="scss" scoped>
.tags-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  min-width: 140px;

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--color-text-regular);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover {
      background-color: var(--color-primary-subtle);
      color: var(--color-primary);
    }

    &.disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>