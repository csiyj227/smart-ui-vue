<template>
  <el-container class="layout-classic" direction="vertical">
    <header class="classic-header">
      <div class="classic-header-left">
        <div class="header-logo" @click="router.push('/')">
          <img src="@/assets/logo.png" alt="Smart Admin" class="logo-img" />
          <span class="logo-text">Smart Admin</span>
        </div>
        <el-menu
          mode="horizontal"
          class="horizontal-menu"
          :default-active="route.path"
          router
          :ellipsis="false"
        >
          <template v-for="item in menus" :key="item.menuId">
            <el-sub-menu v-if="item.children?.length" :index="item.path">
              <template #title>
                <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
                {{ translateMenu(item.menuName) }}
              </template>
              <el-menu-item v-for="child in item.children" :key="child.menuId" :index="child.path">
                <el-icon v-if="child.icon"><component :is="child.icon" /></el-icon>
                {{ translateMenu(child.menuName) }}
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="item.path">
              <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
              {{ translateMenu(item.menuName) }}
            </el-menu-item>
          </template>
        </el-menu>
      </div>
      <HeaderRight @open-settings="$emit('openSettings')" />
    </header>
    <TagsView />
    <el-main class="layout-main">
      <router-view v-slot="{ Component, route: r }">
        <transition name="fade-transform" mode="out-in">
          <keep-alive :include="tagsViewStore.cachedViews">
            <component :is="Component" :key="r.path" />
          </keep-alive>
        </transition>
      </router-view>
    </el-main>
    <Footer v-if="themeStore.showFooter" />
  </el-container>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import type { MenuData } from '@/types/layout'
import { useThemeStore } from '@/stores/theme'
import { useTagsViewStore } from '@/stores/tagsView'
import { useMenuTranslate } from '@/composables/useMenuTranslate'
import HeaderRight from '@/layout/components/Header/HeaderRight.vue'
import TagsView from '@/layout/components/Header/TagsView.vue'
import Footer from '@/layout/components/Footer/index.vue'

defineProps<{ menus: MenuData[] }>()
defineEmits<{ openSettings: [] }>()

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const tagsViewStore = useTagsViewStore()
const { translateMenu } = useMenuTranslate()
</script>

<style lang="scss" scoped>
.layout-classic {
  height: 100vh;
  overflow: hidden;
}

.classic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 20px;
  background-color: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  flex-shrink: 0;

  .classic-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    overflow: hidden;
  }
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex-shrink: 0;

  .logo-img {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    object-fit: contain;
  }

  .logo-text {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }
}

.horizontal-menu {
  border-bottom: none !important;
  background: transparent !important;

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: var(--header-height);
    line-height: var(--header-height);
  }
}

.layout-main {
  padding: 20px;
  background-color: var(--color-bg);
  overflow-y: auto;
}
</style>