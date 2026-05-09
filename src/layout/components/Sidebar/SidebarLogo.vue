<template>
  <div class="sidebar-logo" :class="{ collapsed: collapsed }" @click="$emit('toggle')">
    <div class="logo-icon">
      <img src="@/assets/logo.png" alt="Smart Admin" />
    </div>
    <transition name="fade">
      <span v-if="!collapsed" class="logo-text">Smart Admin</span>
    </transition>
  </div>
</template>

<script setup lang="ts">
defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<style lang="scss" scoped>
.sidebar-logo {
  display: flex;
  align-items: center;
  height: var(--header-height);
  padding: 0 16px;
  cursor: pointer;
  gap: 12px;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: all var(--transition-normal);
  position: relative;

  &:hover .logo-icon {
    transform: scale(1.08) rotate(-3deg);
    filter: drop-shadow(0 0 8px var(--color-primary-glow-strong));
  }

  .logo-icon {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    transition: transform var(--transition-normal), filter var(--transition-normal);

    img {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      filter: drop-shadow(0 2px 8px var(--color-primary-glow));
      object-fit: contain;
    }
  }

  .logo-text {
    font-size: 17px;
    font-weight: 700;
    // Always on dark sidebar — white gradient text is intentional
    background: linear-gradient(135deg, #fff 0%, rgba(199, 200, 255, 0.9) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  &.collapsed {
    justify-content: center;
    padding: 0;
  }
}
</style>