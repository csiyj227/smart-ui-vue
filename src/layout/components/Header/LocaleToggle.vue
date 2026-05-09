<template>
  <el-dropdown trigger="click" @command="handleSwitch">
    <div class="locale-toggle">
      <el-tooltip :content="$t('layout.language')" placement="bottom">
        <el-icon :size="18">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10
                     15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </el-icon>
      </el-tooltip>
    </div>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="item in localeOptions"
          :key="item.value"
          :command="item.value"
          :class="{ 'is-active': currentLocale === item.value }"
        >
          <span class="locale-label">{{ item.label }}</span>
          <el-icon v-if="currentLocale === item.value" class="locale-check">
            <Check />
          </el-icon>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { globalLocale, setLocale, type LocaleType } from '@/i18n'

const currentLocale = computed(() => globalLocale.value as LocaleType)

const localeOptions: { value: LocaleType; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
]

function handleSwitch(newLocale: LocaleType) {
  if (newLocale === globalLocale.value) return
  setLocale(newLocale)
}
</script>

<style lang="scss" scoped>
.locale-toggle {
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

  svg {
    width: 18px;
    height: 18px;
  }
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 140px;

  &.is-active {
    color: var(--el-color-primary);
    font-weight: 500;
  }
}

.locale-label {
  flex: 1;
}

.locale-check {
  margin-left: 8px;
  font-size: 14px;
}
</style>
