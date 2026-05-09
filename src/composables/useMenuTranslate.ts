import { useI18n } from 'vue-i18n'
import zhCN from '@/i18n/zh-CN'

/**
 * Composable for translating dynamic menu names via i18n.
 *
 * Backend returns Chinese menu names (e.g. "系统管理"). This builds a reverse
 * map from Chinese → i18n key so we can look up the correct translation at
 * render time, keeping the result reactive to locale changes.
 */
export function useMenuTranslate() {
  const { t } = useI18n()

  const zhMenuEntries = Object.entries(zhCN.menu as Record<string, string>)
  const chineseToKeyMap = new Map(zhMenuEntries.map(([key, value]) => [value, key]))

  function translateMenu(menuName: string): string {
    const i18nKey = chineseToKeyMap.get(menuName)
    if (i18nKey) {
      return t(`menu.${i18nKey}`)
    }
    return menuName
  }

  return { translateMenu }
}
