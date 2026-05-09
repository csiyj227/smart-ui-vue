<template>
  <div class="search-toggle" @click="open">
    <el-tooltip placement="bottom">
      <template #content>
        {{ t('header.searchMenu') }}
        <span class="search-toggle__kbd">{{ shortcutLabel }}</span>
      </template>
      <el-icon :size="18">
        <Search />
      </el-icon>
    </el-tooltip>
  </div>

  <MenuSearchDialog v-model="visible" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MenuSearchDialog from './MenuSearchDialog.vue'

const { t } = useI18n()
const visible = ref(false)

// 使用 Mac 的 ⌘ 或其他平台的 Ctrl
const isMac = computed(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform))
const shortcutLabel = computed(() => (isMac.value ? '⌘K' : 'Ctrl+K'))

function open() {
  visible.value = true
}

// 全局快捷键：Cmd/Ctrl + K 打开
function onKeydown(e: KeyboardEvent) {
  const key = e.key?.toLowerCase()
  if (key !== 'k') return
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    visible.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
.search-toggle {
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

  &__kbd {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.18);
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
  }
}
</style>
