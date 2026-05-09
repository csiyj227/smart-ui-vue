<template>
  <!--
    Element Plus locale must be injected explicitly to ensure components like
    ElPagination / ElTable / ElDatePicker display text in the correct language.
    The computed `elementLocale` switches between zh-cn and en based on the
    current i18n locale.
  -->
  <el-config-provider :size="themeStore.componentSize" :locale="elementLocale">
    <router-view />
    <LockScreen />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import LockScreen from '@/components/LockScreen/index.vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'

const themeStore = useThemeStore()
const { locale } = useI18n()

const elementLocale = computed(() => (locale.value === 'en' ? en : zhCn))
</script>

<style>
/* Global styles are imported via main.ts -> theme/global.scss */
</style>