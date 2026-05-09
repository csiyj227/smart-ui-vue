<template>
  <el-breadcrumb separator="/" class="breadcrumb">
    <el-breadcrumb-item v-for="item in items" :key="item.path" :to="item.to">
      {{ item.titleKey ? $t(item.titleKey) : item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const items = computed(() => {
  return route.matched
    .filter(r => r.meta?.title && !r.meta?.hidden)
    .map(r => ({
      path: r.path,
      title: r.meta.title as string,
      titleKey: r.meta.titleKey as string | undefined,
      to: r.redirect ? undefined : r.path,
    }))
})
</script>

<style lang="scss" scoped>
.breadcrumb {
  font-size: 13.5px;

  :deep(.el-breadcrumb__separator) {
    color: var(--color-border);
    margin: 0 6px;
  }

  :deep(.el-breadcrumb__inner) {
    color: var(--color-text-muted);
    font-weight: 400;
    transition: color var(--transition-fast);

    &.is-link:hover {
      color: var(--color-primary);
    }
  }

  :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
    color: var(--color-text);
    font-weight: 500;
  }
}
</style>