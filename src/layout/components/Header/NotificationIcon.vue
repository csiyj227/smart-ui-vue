<template>
  <el-popover placement="bottom" :width="240" trigger="click">
    <template #reference>
      <div class="notification-icon">
        <el-badge is-dot :hidden="!hasUnread" class="notification-badge">
          <el-icon :size="18"><Bell /></el-icon>
        </el-badge>
      </div>
    </template>
    <div class="notification-panel">
      <div class="notification-header">{{ t('header.notification') }}</div>
      <div class="notification-empty">{{ t('header.noNotification') }}</div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const hasUnread = ref(false)
</script>

<style lang="scss" scoped>
.notification-icon {
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

.notification-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.notification-panel {
  .notification-header {
    font-weight: 600;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border-light);
    color: var(--color-text);
    font-size: 14px;
  }

  .notification-empty {
    text-align: center;
    padding: 24px 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }
}
</style>