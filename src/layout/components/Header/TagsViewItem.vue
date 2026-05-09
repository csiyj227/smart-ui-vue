<template>
  <div
    class="tags-view-item"
    :class="{ active: isActive }"
    @click="$emit('click')"
    @mousedown.middle.prevent="$emit('close')"
    @contextmenu.prevent="$emit('contextmenu', $event)"
  >
    <span class="tag-title">{{ tag.titleKey ? $t(tag.titleKey) : tag.title }}</span>
    <el-icon v-if="!tag.affix" class="tag-close" @click.stop="$emit('close')">
      <Close />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import type { TagView } from '@/types/layout'

defineProps<{
  tag: TagView
  isActive: boolean
}>()

defineEmits<{
  click: []
  close: []
  contextmenu: [e: MouseEvent]
}>()
</script>

<style lang="scss" scoped>
.tags-view-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 11px;
  font-size: 12px;
  border-radius: var(--radius-full);
  background-color: var(--tags-item-bg);
  color: var(--color-text-regular);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  flex-shrink: 0;
  user-select: none;

  &:hover {
    color: var(--color-primary);
    background-color: var(--color-primary-subtle);
    border-color: var(--color-primary-glow);
    transform: translateY(-1px);
  }

  &.active {
    background: var(--gradient-primary);
    color: var(--color-text-inverse);
    border-color: transparent;
    box-shadow: var(--shadow-primary);
    font-weight: 500;
  }

  .tag-close {
    font-size: 11px;
    border-radius: 50%;
    padding: 1px;
    transition: all var(--transition-fast);
    opacity: 0.7;

    &:hover {
      background-color: var(--color-primary-glow);
      opacity: 1;
    }
  }

  &:not(.active) .tag-close:hover {
    background-color: var(--color-danger-light);
    color: var(--color-danger);
    opacity: 1;
  }
}
</style>