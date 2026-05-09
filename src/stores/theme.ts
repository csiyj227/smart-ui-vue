import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import type { ThemeConfig, LayoutMode, ComponentSize } from '@/types/theme'
import { DEFAULT_THEME } from '@/types/theme'

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r
    ? ((g - b) / d + (g < b ? 6 : 0)) * 60
    : max === g
      ? ((b - r) / d + 2) * 60
      : ((r - g) / d + 4) * 60
  return [h, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60)        { r = c; g = x; b = 0 }
  else if (h < 120)  { r = x; g = c; b = 0 }
  else if (h < 180)  { r = 0; g = c; b = x }
  else if (h < 240)  { r = 0; g = x; b = c }
  else if (h < 300)  { r = x; g = 0; b = c }
  else               { r = c; g = 0; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function generateShades(hex: string): Record<string, string> {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const mix = (amount: number) => {
    const nr = Math.round(r + (255 - r) * amount)
    const ng = Math.round(g + (255 - g) * amount)
    const nb = Math.round(b + (255 - b) * amount)
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
  }

  const darken = (amount: number) => {
    const nr = Math.round(r * (1 - amount))
    const ng = Math.round(g * (1 - amount))
    const nb = Math.round(b * (1 - amount))
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
  }

  // Shift hue +30° for gradient end color (gives purple tint on indigo, teal on green, etc.)
  const [h, s, l] = hexToHsl(hex)
  const gradientEnd = hslToHex(h + 30, Math.min(s * 1.05, 1), Math.min(l * 1.08, 0.75))
  const gradientHoverStart = hslToHex(h - 10, s, l * 0.9)

  return {
    '--color-primary': hex,
    '--color-primary-light': mix(0.2),
    '--color-primary-dark': darken(0.2),
    '--color-primary-subtle': mix(0.9),
    '--color-primary-glow': `rgba(${r}, ${g}, ${b}, 0.25)`,
    '--color-primary-glow-strong': `rgba(${r}, ${g}, ${b}, 0.55)`,
    '--shadow-primary': `0 4px 14px rgba(${r}, ${g}, ${b}, 0.35)`,
    '--gradient-primary': `linear-gradient(135deg, ${hex} 0%, ${gradientEnd} 100%)`,
    '--gradient-primary-hover': `linear-gradient(135deg, ${gradientHoverStart} 0%, ${hex} 100%)`,
    '--sidebar-hover': `rgba(${r}, ${g}, ${b}, 0.12)`,
    '--sidebar-active-bg': `rgba(${r}, ${g}, ${b}, 0.18)`,
    '--sidebar-active-indicator': hex,
    '--el-color-primary': hex,
    '--el-color-primary-light-3': mix(0.3),
    '--el-color-primary-light-5': mix(0.5),
    '--el-color-primary-light-7': mix(0.7),
    '--el-color-primary-light-8': mix(0.8),
    '--el-color-primary-light-9': mix(0.9),
    '--el-color-primary-dark-2': darken(0.2),
  }
}

// Dark-mode corrections for primary-color-derived vars that need higher opacity/different values
function applyDarkPrimaryOverrides(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const root = document.documentElement
  root.style.setProperty('--color-primary-subtle', `rgba(${r}, ${g}, ${b}, 0.18)`)
  root.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.3)`)
  root.style.setProperty('--color-primary-glow-strong', `rgba(${r}, ${g}, ${b}, 0.65)`)
  root.style.setProperty('--shadow-primary', `0 4px 16px rgba(${r}, ${g}, ${b}, 0.4)`)
  root.style.setProperty('--sidebar-hover', `rgba(${r}, ${g}, ${b}, 0.15)`)
  root.style.setProperty('--sidebar-active-bg', `rgba(${r}, ${g}, ${b}, 0.22)`)
  root.style.setProperty('--el-color-primary-light-9', `rgba(${r}, ${g}, ${b}, 0.18)`)
}

// All static dark-mode vars applied as inline styles to guarantee precedence over
// any EP component SCSS that loads at runtime after the global stylesheet.
// Standard neutral dark palette — no purple tint, similar to macOS Dark Mode.
const DARK_VARS: Record<string, string> = {
  '--color-bg': '#111113',
  '--color-surface': '#1C1C1E',
  '--color-surface-elevated': '#2C2C2E',
  '--color-border': '#3A3A3C',
  '--color-border-light': '#2C2C2E',
  '--color-text': '#F5F5F7',
  '--color-text-regular': '#AEAEB2',
  '--color-text-muted': '#636366',
  '--color-text-inverse': '#000000',
  '--color-success-light': '#1A3A2A',
  '--color-warning-light': '#3A2A10',
  '--color-danger-light': '#3A1A1A',
  '--gradient-sidebar': 'linear-gradient(180deg, #0D0D0F 0%, #080809 100%)',
  '--sidebar-bg': '#0A0A0C',
  '--sidebar-bg-secondary': '#111113',
  '--sidebar-text': '#8E8E93',
  '--sidebar-text-active': '#FFFFFF',
  '--sidebar-text-muted': '#48484A',
  '--header-bg': 'rgba(28, 28, 30, 0.92)',
  '--header-border': 'rgba(58, 58, 60, 0.8)',
  '--tags-bg': 'rgba(28, 28, 30, 0.95)',
  '--tags-item-bg': '#2C2C2E',
  '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
  '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
  '--shadow-lg': '0 12px 28px rgba(0, 0, 0, 0.6)',
  '--shadow-card-hover': '0 8px 24px rgba(0, 0, 0, 0.6)',
  '--el-bg-color': '#111113',
  '--el-bg-color-overlay': '#1C1C1E',
  '--el-bg-color-page': '#111113',
  '--el-border-color': '#3A3A3C',
  '--el-border-color-light': '#2C2C2E',
  '--el-border-color-lighter': '#252527',
  '--el-border-color-extra-light': '#1C1C1E',
  '--el-text-color-primary': '#F5F5F7',
  '--el-text-color-regular': '#AEAEB2',
  '--el-text-color-secondary': '#636366',
  '--el-text-color-placeholder': '#48484A',
  '--el-fill-color': '#2C2C2E',
  '--el-fill-color-light': '#1C1C1E',
  '--el-fill-color-lighter': '#111113',
  '--el-fill-color-blank': '#1C1C1E',
  '--el-mask-color': 'rgba(0, 0, 0, 0.75)',
}

function applyThemeVars(vars: Record<string, string>) {
  const root = document.documentElement
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val)
  })
}

export const useThemeStore = defineStore('theme', () => {
  const saved = getStorage<ThemeConfig>('themeConfig', DEFAULT_THEME)

  const primaryColor = ref(saved.primaryColor)
  const isDark = ref(saved.isDark)
  const layoutMode = ref<LayoutMode>(saved.layoutMode)
  const componentSize = ref<ComponentSize>(saved.componentSize)
  const showLogo = ref(saved.showLogo)
  const showTagsView = ref(saved.showTagsView)
  const showBreadcrumb = ref(saved.showBreadcrumb)
  const showFooter = ref(saved.showFooter)
  const showWatermark = ref(saved.showWatermark)
  const isWeak = ref(saved.isWeak)
  const isGray = ref(saved.isGray)
  const sidebarWidth = ref(saved.sidebarWidth)
  const lockScreenTime = ref(saved.lockScreenTime)

  function applyDarkClass(dark: boolean) {
    const root = document.documentElement
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
    root.classList.toggle('dark', dark)
    // Apply all dark vars as inline styles — inline styles always beat any stylesheet rule,
    // guaranteeing dark mode works regardless of EP component SCSS load order.
    if (dark) {
      Object.entries(DARK_VARS).forEach(([k, v]) => root.style.setProperty(k, v))
    } else {
      Object.keys(DARK_VARS).forEach(k => root.style.removeProperty(k))
    }
  }

  function applyTheme() {
    applyDarkClass(isDark.value)
    document.documentElement.setAttribute('data-size', componentSize.value)
    applyThemeVars(generateShades(primaryColor.value))
    if (isDark.value) applyDarkPrimaryOverrides(primaryColor.value)
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth.value}px`)
    applyFilters()
  }

  function applyFilters() {
    const root = document.documentElement
    const filters: string[] = []
    if (isGray.value) filters.push('grayscale(1)')
    if (isWeak.value) filters.push('invert(80%)')
    root.style.filter = filters.length ? filters.join(' ') : ''
  }

  function setPrimaryColor(color: string) {
    primaryColor.value = color
    applyThemeVars(generateShades(color))
    if (isDark.value) applyDarkPrimaryOverrides(color)
  }

  function toggleDark() {
    isDark.value = !isDark.value
    applyDarkClass(isDark.value)
    // Re-apply primary shades after dark class change so primary-derived vars stay current
    applyThemeVars(generateShades(primaryColor.value))
    if (isDark.value) applyDarkPrimaryOverrides(primaryColor.value)
  }

  function setLayoutMode(mode: LayoutMode) {
    layoutMode.value = mode
  }

  function setComponentSize(size: ComponentSize) {
    componentSize.value = size
    document.documentElement.setAttribute('data-size', size)
  }

  function setWeak(val: boolean) {
    isWeak.value = val
    if (val) isGray.value = false
    applyFilters()
  }

  function setGray(val: boolean) {
    isGray.value = val
    if (val) isWeak.value = false
    applyFilters()
  }

  function resetTheme() {
    primaryColor.value = DEFAULT_THEME.primaryColor
    isDark.value = DEFAULT_THEME.isDark
    layoutMode.value = DEFAULT_THEME.layoutMode
    componentSize.value = DEFAULT_THEME.componentSize
    showLogo.value = DEFAULT_THEME.showLogo
    showTagsView.value = DEFAULT_THEME.showTagsView
    showBreadcrumb.value = DEFAULT_THEME.showBreadcrumb
    showFooter.value = DEFAULT_THEME.showFooter
    showWatermark.value = DEFAULT_THEME.showWatermark
    isWeak.value = DEFAULT_THEME.isWeak
    isGray.value = DEFAULT_THEME.isGray
    sidebarWidth.value = DEFAULT_THEME.sidebarWidth
    lockScreenTime.value = DEFAULT_THEME.lockScreenTime
    applyTheme()
  }

  // Persist on change
  watch(
    [primaryColor, isDark, layoutMode, componentSize, showLogo, showTagsView, showBreadcrumb, showFooter, showWatermark, isWeak, isGray, sidebarWidth, lockScreenTime],
    () => {
      setStorage('themeConfig', {
        primaryColor: primaryColor.value,
        isDark: isDark.value,
        layoutMode: layoutMode.value,
        componentSize: componentSize.value,
        showLogo: showLogo.value,
        showTagsView: showTagsView.value,
        showBreadcrumb: showBreadcrumb.value,
        showFooter: showFooter.value,
        showWatermark: showWatermark.value,
        isWeak: isWeak.value,
        isGray: isGray.value,
        sidebarWidth: sidebarWidth.value,
        lockScreenTime: lockScreenTime.value,
      })
    },
    { deep: true }
  )

  // Watch isDark to sync DOM — handles direct v-model mutations from SettingsDrawer
  watch(isDark, (val) => {
    applyDarkClass(val)
    applyThemeVars(generateShades(primaryColor.value))
    if (val) applyDarkPrimaryOverrides(primaryColor.value)
  })

  // Apply on init
  applyTheme()

  return {
    primaryColor, isDark, layoutMode, componentSize,
    showLogo, showTagsView, showBreadcrumb, showFooter,
    showWatermark, isWeak, isGray,
    sidebarWidth, lockScreenTime,
    setPrimaryColor, toggleDark, setLayoutMode, setComponentSize,
    setWeak, setGray, resetTheme, applyTheme,
  }
})