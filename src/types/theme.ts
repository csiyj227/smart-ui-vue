// Theme configuration types

export type LayoutMode = 'default' | 'classic'
export type ComponentSize = 'small' | 'default' | 'large'

export interface ThemeConfig {
  primaryColor: string
  isDark: boolean
  layoutMode: LayoutMode
  componentSize: ComponentSize
  showLogo: boolean
  showTagsView: boolean
  showBreadcrumb: boolean
  showFooter: boolean
  showWatermark: boolean
  isWeak: boolean
  isGray: boolean
  sidebarWidth: number
  lockScreenTime: number
}

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#6366F1',
  isDark: false,
  layoutMode: 'default',
  componentSize: 'default',
  showLogo: true,
  showTagsView: true,
  showBreadcrumb: true,
  showFooter: true,
  showWatermark: false,
  isWeak: false,
  isGray: false,
  sidebarWidth: 220,
  lockScreenTime: 15,
}

export const PRESET_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#0EA5E9',
]