# 请求封装与 API 规范

## request.ts 核心机制

```typescript
const request = axios.create({
  baseURL: '/api',      // Vite 代理转发到 http://localhost:8080
  timeout: 90000,       // 90 秒超时
})
```

### 请求拦截器

- 自动添加 `Authorization: Bearer {token}`（除非 `skipAuth: true`）
- 自动添加 `X-Tenant-Id` 租户 ID

### 响应拦截器

| 场景 | 处理方式 |
|------|----------|
| `ApiResult<T>` 成功（`success === true`） | 正常返回 |
| `ApiResult<T>` 业务错误（`success === false`） | `ElMessage.error(msg)` + `Promise.reject` |
| 401 Unauthorized | 自动登出 + 跳转登录页 |
| OAuth2 Token 端点 | 直接返回（不走 ApiResult 解构） |
| Blob/ArrayBuffer（文件下载） | 直接放过 |
| HTTP 状态码错误 | 映射中文提示（400/401/403/404/500 等） |

### skipError 选项

静默失败场景（如 `getTenantList`）使用 `skipError: true`：

```typescript
export const getTenantList = () =>
  request.get<ApiResult<SysTenant[]>>('/tenant/list', { skipError: true })
```

## API 定义规范

### 文件组织

每个业务模块一个 API 文件，位于 `src/api/` 目录下。

### 命名与写法

```typescript
import request from '@/utils/request'
import type { ApiResult, PageResult, SysUser, UserForm } from '@/types/api'

// 分页查询 — GET /entity/page
export const getUserPage = (params: any) =>
  request.get<ApiResult<PageResult<SysUser>>>('/user/page', { params })

// 单条查询 — GET /entity/{id}
export const getUserById = (userId: number) =>
  request.get<ApiResult<SysUser>>(`/user/${userId}`)

// 新增 — POST /entity
export const createUser = (data: UserForm) =>
  request.post<ApiResult<void>>('/user', data)

// 修改 — PUT /entity
export const updateUser = (data: UserForm) =>
  request.put<ApiResult<void>>('/user', data)

// 删除 — DELETE /entity/{id}
export const deleteUser = (userId: number) =>
  request.delete<ApiResult<void>>(`/user/${userId}`)

// 树形查询 — GET /entity/tree
export const getMenuTree = () =>
  request.get<ApiResult<SysMenu[]>>('/menu/tree')
```

### OAuth2 登录接口特殊处理

```typescript
const CLIENT_BASIC_AUTH = 'Basic ' + btoa('smart:smart')

export function login(data: LoginParams) {
  return request.post<ApiResult<TokenResult>>('/oauth2/token', new URLSearchParams(data), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': CLIENT_BASIC_AUTH,
    },
    skipAuth: true as any,  // 登录时尚无 Token，跳过 Auth 拦截
  })
}
```

## 类型定义规范

所有后端响应类型定义在 `src/types/api.ts` 中：

```typescript
// 统一响应包装（对应后端 ApiResult<T>）
export interface ApiResult<T> {
  success: boolean
  msg: string
  data: T
  errorCode?: string  // 仅失败时存在
  traceId?: string
  timestamp: number
  code: number        // 兼容字段：0=成功, 1=失败
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

// Token 结果
export interface TokenResult {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

// 用户信息
export interface UserInfo {
  userId: number
  username: string
  realName: string
  phone: string
  avatar: string
  deptId: number
  tenantId: number
  roles: string[]
  permissions: string[]
}
```

**规范：** 类型与后端 DTO 一一对应，字段名保持 camelCase。`ApiResult<T>` 的 `success` 字段对应后端布尔标志，`code` 为前端兼容字段。
