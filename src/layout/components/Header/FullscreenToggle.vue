<template>
  <div class="fullscreen-toggle" @click="toggle">
    <el-tooltip :content="isFullscreen ? $t('layout.exitFullscreen') : $t('layout.fullscreen')" placement="bottom">
      <el-icon :size="18">
        <Aim v-if="isFullscreen" />
        <FullScreen v-else />
      </el-icon>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isFullscreen = ref(false)

function toggle() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange))
</script>

<style lang="scss" scoped>
.fullscreen-toggle {
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