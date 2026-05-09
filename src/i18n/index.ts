import { createI18n } from 'vue-i18n'
import type { WritableComputedRef } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import zhCN from './zh-CN'
import en from './en'

export type LocaleType = 'zh-CN' | 'en'

const STORAGE_KEY = 'smart_locale'

export function getStoredLocale(): LocaleType {
  return (getStorage(STORAGE_KEY) as LocaleType) || 'zh-CN'
}

const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

/**
 * 全局 locale 的响应式引用。
 * 直接操作 i18n.global.locale，确保修改后所有组件中的 $t() 同步更新。
 */
export const globalLocale = i18n.global.locale as WritableComputedRef<string>

/**
 * 切换全局语言并持久化到 localStorage。
 */
export function setLocale(newLocale: LocaleType): void {
  globalLocale.value = newLocale
  setStorage(STORAGE_KEY, newLocale)
}

export default i18n
