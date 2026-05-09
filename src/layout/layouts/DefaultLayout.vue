<template>
  <el-container class="layout-default">
    <Sidebar :menus="menus" />
    <el-container class="layout-main-container" direction="vertical">
      <Header @open-settings="$emit('openSettings')" />
      <TagsView />
      <el-main class="layout-main">
        <router-view v-slot="{ Component, route }">
          <transition name="fade-transform" mode="out-in">
            <keep-alive :include="tagsViewStore.cachedViews">
              <component :is="Component" :key="route.path" />
            </keep-alive>
          </transition>
        </router-view>
      </el-main>
      <Footer v-if="themeStore.showFooter" />
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import type { MenuData } from '@/types/layout'
import { useThemeStore } from '@/stores/theme'
import { useTagsViewStore } from '@/stores/tagsView'
import Sidebar from '@/layout/components/Sidebar/index.vue'
import Header from '@/layout/components/Header/index.vue'
import TagsView from '@/layout/components/Header/TagsView.vue'
import Footer from '@/layout/components/Footer/index.vue'

defineProps<{ menus: MenuData[] }>()
defineEmits<{ openSettings: [] }>()

const themeStore = useThemeStore()
const tagsViewStore = useTagsViewStore()
</script>

<style lang="scss" scoped>
.layout-default {
  height: 100vh;
  overflow: hidden;
}

.layout-main-container {
  overflow: hidden;
}

.layout-main {
  padding: 16px;
  background-color: var(--color-bg);
  overflow-y: auto;
  flex: 1;
}
</style>