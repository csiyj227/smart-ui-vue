# 状态管理与路由权限

## Pinia Store 规范

### 命名与组织

- 文件位于 `src/stores/` 目录，每个 Store 一个文件
- 使用 **Setup Store** 风格（`defineStore('name', () => { ... })`）
- Store 名称：`useXxxStore`

### user Store（核心）

```typescript
export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const refreshTokenVal = ref(localStorage.getItem('refresh_token') || '')
  const tenantId = ref(Number(localStorage.getItem('tenant_id')) || 1)
  const userInfo = ref<UserInfo | null>(null)
  const permissions = ref<string[]>([])
  const roles = ref<string[]>([])

  function setToken(accessToken: string, newRefreshToken: string) {
    token.value = accessToken
    refreshTokenVal.value = newRefreshToken
    localStorage.setItem('token', accessToken)
    localStorage.setItem('refresh_token', newRefreshToken)
  }

  async function fetchUserInfo() {
    const { data } = await getUserInfo()
    userInfo.value = data.data
    permissions.value = data.data.permissions
    roles.value = data.data.roles
  }

  function logout() {
    token.value = ''
    refreshTokenVal.value = ''
    userInfo.value = null
    permissions.value = []
    roles.value = []
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    resetRouter()
    usePermissionStore().reset()
    useTagsViewStore().visitedViews = []
    useTagsViewStore().cachedViews = []
  }

  return { token, refreshTokenVal, tenantId, userInfo, permissions, roles,
           setToken, setTenantId, fetchUserInfo, logout }
})
```

### permission Store（动态路由）

```typescript
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

  return { routes, menuList, isLoaded, generateRoutes, reset }
})
```

**菜单数据到路由的转换规则：**
- `menuType === '0'`（目录）→ 使用 Layout 组件包裹子路由
- `menuType === '1'`（菜单）→ 通过 `import.meta.glob` 动态导入 Vue 组件
- `menuType === '2'`（按钮）→ 跳过，不生成路由
- `component` 字段为相对于 `src/views/` 的路径（不带 `.vue` 后缀）

## 路由

### 静态路由（无需权限）

```typescript
const staticRoutes: RouteRecordRaw[] = [
  { path: '/login', component: () => import('@/views/login/index.vue') },
  { path: '/403',   component: () => import('@/views/error/403.vue') },
  { path: '/404',   component: () => import('@/views/error/404.vue') },
]
```

### 路由守卫流程

```
用户访问页面
  → 是否 /login？是 → 放行
  → 是否有 Token？否 → 跳转 /login?redirect=...
  → 是否已获取用户信息？否 → fetchUserInfo()
  → 是否已加载动态路由？否 → generateRoutes() → addRoute()
  → 是否有 meta.permission？是 → 检查用户是否有该权限
    → 无权限 → 跳转 /403
  → 放行
```

## v-permission 权限指令

```typescript
// 使用
<el-button v-permission="['user_add']">新增用户</el-button>
```

**权限标识来源：** `sys_menu` 表的 `permission` 字段，按钮类型菜单（`menu_type = '2'`）。

## 规则

- ⛔ **禁止在组件中直接读写 localStorage**，必须通过 Pinia Store
- Store 的 `logout()` 方法必须清除所有状态 + localStorage + 重置路由
- 动态路由只在 `isLoaded === false` 时加载，避免重复请求
