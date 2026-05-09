import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuData } from '@/types/layout'
import { getUserMenuTree } from '@/api/admin'
import i18n from '@/i18n'

const Layout = () => import('@/layout/index.vue')

const modules = import.meta.glob('@/views/**/*.vue')

function transformMenusToRoutes(menus: MenuData[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []

  // Root route: Layout wrapper, always includes home page
  routes.push({
    path: '/',
    component: Layout,
    redirect: '/home',
    meta: { hidden: true },
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: i18n.global.t('layout.home'), titleKey: 'layout.home', icon: 'HomeFilled', affix: true },
      },
    ],
  })

  for (const menu of menus) {
    if (menu.menuType === '2') continue
    if (!menu.visible) continue

    if (menu.menuType === '0') {
      const childRoutes = menu.children
        ? menu.children
            .filter((c) => c.menuType !== '2' && c.visible)
            .map((child) => buildMenuRoute(child, menu.path))
        : []

      const { title, titleKey } = resolveMenuTitle(menu)
      const route: RouteRecordRaw = {
        path: menu.path,
        name: `Dir_${menu.menuId}`,
        component: Layout,
        redirect: childRoutes.length > 0 ? childRoutes[0].path : 'noRedirect',
        meta: {
          title,
          titleKey,
          icon: menu.icon,
          hidden: !menu.visible,
        },
        children: childRoutes,
      }
      routes.push(route)
    } else if (menu.menuType === '1') {
      // Top-level menu (no parent directory) — nest under root layout
      const route = buildMenuRoute(menu, '')
      // Add as child of root layout route
      routes[0].children!.push(route)
    }
  }

  return routes
}

function buildMenuRoute(menu: MenuData, parentPath: string): RouteRecordRaw {
  const componentPath = menu.component
  let component

  if (componentPath === 'LAYOUT' || !componentPath) {
    component = Layout
  } else {
    const viewPath = `/src/views/${componentPath}.vue`
    component = modules[viewPath] || (() => import('@/views/error/404.vue'))
  }

  // Use relative path for nested routes (strip parent path prefix)
  let routePath = menu.path
  if (parentPath && routePath.startsWith(parentPath + '/')) {
    routePath = routePath.slice(parentPath.length + 1)
  }

  const { title, titleKey } = resolveMenuTitle(menu)
  return {
    path: routePath,
    name: `Menu_${menu.menuId}`,
    component,
    meta: {
      title,
      titleKey,
      icon: menu.icon,
      keepAlive: menu.keepAlive,
      permission: menu.permission ? [menu.permission] : undefined,
      hidden: !menu.visible,
    },
  }
}

function resolveMenuTitle(menu: MenuData): { title: string; titleKey?: string } {
  const segments = menu.path.replace(/^\//, '').split('/')
  const toCamel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

  // 1. Try full path joined as camelCase key, e.g. /flow/my-cc -> menu.flowMyCc
  if (segments.length > 1) {
    const fullKey = segments.map(toCamel).join('')
    // Capitalize each segment after the first to form proper camelCase
    const camelFull = toCamel(segments[0]) + segments.slice(1).map((s) => {
      const c = toCamel(s)
      return c.charAt(0).toUpperCase() + c.slice(1)
    }).join('')
    const fullI18nKey = `menu.${camelFull}`
    if (i18n.global.te(fullI18nKey)) {
      return { title: i18n.global.t(fullI18nKey), titleKey: fullI18nKey }
    }
  }

  // 2. Fallback: try last segment only, e.g. /system/dict -> menu.dict
  const lastSegment = segments[segments.length - 1] || ''
  const camelKey = toCamel(lastSegment)
  const i18nKey = `menu.${camelKey}`
  if (camelKey && i18n.global.te(i18nKey)) {
    return { title: i18n.global.t(i18nKey), titleKey: i18nKey }
  }

  return { title: menu.menuName }
}

export const usePermissionStore = defineStore('permission', () => {
  const routes = ref<RouteRecordRaw[]>([])
  const menuList = ref<MenuData[]>([])
  const isLoaded = ref(false)

  async function generateRoutes() {
    const { data } = await getUserMenuTree()
    const menus = data.data || []
    menuList.value = menus
    routes.value = transformMenusToRoutes(menus)
    isLoaded.value = true
    return routes.value
  }

  function reset() {
    routes.value = []
    menuList.value = []
    isLoaded.value = false
  }

  return { routes, menuList, isLoaded, generateRoutes, reset }
})