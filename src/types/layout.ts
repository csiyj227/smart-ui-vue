// Layout-related types

export interface MenuData {
  menuId: number
  menuName: string
  permission?: string
  path: string
  component: string
  parentId: number
  icon: string
  sortOrder: number
  menuType: string // '0'=directory, '1'=menu, '2'=button
  keepAlive: boolean
  visible: boolean
  children?: MenuData[]
}

export interface TagView {
  path: string
  name: string
  title: string
  titleKey?: string
  icon?: string
  affix: boolean
  query?: Record<string, string>
}