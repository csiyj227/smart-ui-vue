<template>
  <div class="settings-icon" @click="$emit('openSettings')">
    <el-tooltip :content="t('layout.settings')" placement="bottom">
      <el-icon :size="18"><Setting /></el-icon>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineEmits<{ openSettings: [] }>()
</script>

<style lang="scss" scoped>
.settings-icon {
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

    :deep(.el-icon) {
      animation: spin-once 0.4s ease-out;
    }
  }

  &:active {
    transform: scale(0.92);
  }
}

@keyframes spin-once {
  from { transform: rotate(0deg); }
  to   { transform: rotate(90deg); }
}
</style>