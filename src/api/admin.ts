import request from '@/utils/request'
import type {
  R,
  PageResult,
  SysUser,
  SysRole,
  SysMenu,
  SysDept,
  SysDict,
  SysDictItem,
  SysTenant,
  SysLog,
  UserForm,
  SysPost,
  SysOauthClient,
  SysNotice,
  SysLoginLog,
  OnlineUser,
  GenTable,
  GenTemplate,
  GenTemplateGroup,
  SysPublicParam,
  SysRouteConf,
} from '@/types/api'

// Profile (当前登录用户自助接口，无需任何业务权限)
export const getProfile = () => request.get<R<SysUser>>('/system/profile')
export const updateProfile = (data: { realName: string; phone?: string; email?: string; avatar?: string }) =>
  request.put<R<void>>('/system/profile', data)
export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  request.put<R<void>>('/system/profile/password', data)
export const updateAvatar = (avatar: string) => request.post<R<void>>('/system/profile/avatar', { avatar })

// User
export const getUserPage = (params: any) => request.get<R<PageResult<SysUser>>>('/system/user/page', { params })
export const getUserById = (userId: number) => request.get<R<SysUser>>(`/system/user/${userId}`)
export const createUser = (data: UserForm) => request.post<R<void>>('/system/user', data)
export const updateUser = (data: UserForm) => request.put<R<void>>('/system/user', data)
export const deleteUser = (userId: number) => request.delete<R<void>>(`/system/user/${userId}`)
export const getUserRoleIds = (userId: number) => request.get<R<number[]>>(`/system/user/${userId}/roles`)
export const resetUserPassword = (userId: number, password: string) => request.put<R<void>>(`/system/user/${userId}/password`, { password })
export const saveUserRoles = (userId: number, roleIds: number[]) => request.put<R<void>>(`/system/user/${userId}/roles`, roleIds)

// Role
export const getRolePage = (params: any) => request.get<R<PageResult<SysRole>>>('/system/role/page', { params })
export const getRoleById = (roleId: number) => request.get<R<SysRole>>(`/system/role/${roleId}`)
export const createRole = (data: SysRole) => request.post<R<void>>('/system/role', data)
export const updateRole = (data: SysRole) => request.put<R<void>>('/system/role', data)
export const deleteRole = (roleId: number) => request.delete<R<void>>(`/system/role/${roleId}`)
export const saveRoleMenus = (roleId: number, menuIds: number[]) => request.put<R<void>>(`/system/role/${roleId}/menus`, menuIds)
export const saveRoleDepts = (roleId: number, deptIds: number[]) => request.put<R<void>>(`/system/role/${roleId}/depts`, deptIds)
export const getRoleMenuIds = (roleId: number) => request.get<R<number[]>>(`/system/role/${roleId}/menus`)

// Menu
export const getMenuTree = () => request.get<R<SysMenu[]>>('/system/menu/tree')
export const getUserMenuTree = () => request.get<R<SysMenu[]>>('/system/menu/user-tree')
export const getMenuById = (menuId: number) => request.get<R<SysMenu>>(`/system/menu/${menuId}`)
export const createMenu = (data: Partial<SysMenu>) => request.post<R<void>>('/system/menu', data)
export const updateMenu = (data: Partial<SysMenu>) => request.put<R<void>>('/system/menu', data)
export const deleteMenu = (menuId: number) => request.delete<R<void>>(`/system/menu/${menuId}`)

// Dept
export const getDeptTree = () => request.get<R<SysDept[]>>('/system/dept/tree')
export const getDeptById = (deptId: number) => request.get<R<SysDept>>(`/system/dept/${deptId}`)
export const createDept = (data: SysDept) => request.post<R<void>>('/system/dept', data)
export const updateDept = (data: SysDept) => request.put<R<void>>('/system/dept', data)
export const deleteDept = (deptId: number) => request.delete<R<void>>(`/system/dept/${deptId}`)

// Dict
export const getDictPage = (params: any) => request.get<R<PageResult<SysDict>>>('/system/dict/page', { params })
export const getDictByTypeCode = (typeCode: string) => request.get<R<SysDictItem[]>>(`/system/dict/type/${typeCode}`)
export const createDict = (data: SysDict) => request.post<R<void>>('/system/dict', data)
export const updateDict = (data: SysDict) => request.put<R<void>>('/system/dict', data)
export const deleteDict = (id: number) => request.delete<R<void>>(`/system/dict/${id}`)
export const createDictItem = (data: SysDictItem) => request.post<R<void>>('/system/dict/item', data)
export const updateDictItem = (data: SysDictItem) => request.put<R<void>>('/system/dict/item', data)
export const deleteDictItem = (id: number) => request.delete<R<void>>(`/system/dict/item/${id}`)

// Post
export const getPostPage = (params: any) => request.get<R<PageResult<SysPost>>>('/system/post/page', { params })
export const getPostById = (postId: number) => request.get<R<SysPost>>(`/system/post/${postId}`)
export const createPost = (data: SysPost) => request.post<R<void>>('/system/post', data)
export const updatePost = (data: SysPost) => request.put<R<void>>('/system/post', data)
export const deletePost = (postId: number) => request.delete<R<void>>(`/system/post/${postId}`)
export const getPostList = () => request.get<R<SysPost[]>>('/system/post/list')



// Param
export const getParamPage = (params: any) => request.get<R<PageResult<SysPublicParam>>>('/system/param/page', { params })
export const getParamById = (id: number) => request.get<R<SysPublicParam>>(`/system/param/${id}`)
export const createParam = (data: SysPublicParam) => request.post<R<void>>('/system/param', data)
export const updateParam = (data: SysPublicParam) => request.put<R<void>>('/system/param', data)
export const deleteParam = (id: number) => request.delete<R<void>>(`/system/param/${id}`)

// Route config
export const getRouteList = () => request.get<R<SysRouteConf[]>>('/system/route/list')
export const getRouteById = (id: number) => request.get<R<SysRouteConf>>(`/system/route/${id}`)
export const createRoute = (data: SysRouteConf) => request.post<R<void>>('/system/route', data)
export const updateRoute = (data: SysRouteConf) => request.put<R<void>>('/system/route', data)
export const deleteRoute = (id: number) => request.delete<R<void>>(`/system/route/${id}`)

// Tenant
export const getTenantPage = (params: any) => request.get<R<PageResult<SysTenant>>>('/system/tenant/page', { params })
export const getTenantById = (id: number) => request.get<R<SysTenant>>(`/system/tenant/${id}`)
export const createTenant = (data: SysTenant) => request.post<R<void>>('/system/tenant', data)
export const updateTenant = (data: SysTenant) => request.put<R<void>>('/system/tenant', data)
export const deleteTenant = (id: number) => request.delete<R<void>>(`/system/tenant/${id}`)
export const getTenantBrokerTenants = () => request.get<R<SysTenant[]>>('/system/tenant-broker/tenants')
export const switchTenantBroker = (tenantId: number) => request.post<R<void>>(`/system/tenant-broker/switch/${tenantId}`)
export const exitTenantBroker = () => request.post<R<void>>('/system/tenant-broker/exit')
export const getCurrentTenantBroker = () => request.get<R<number>>('/system/tenant-broker/current')
export const getTenantBrokerSwitched = () => request.get<R<boolean>>('/system/tenant-broker/switched')

// Log
export const getLogPage = (params: any) => request.get<R<PageResult<SysLog>>>('/system/log/page', { params })

// Login log
export const getLoginLogPage = (params: any) => request.get<R<PageResult<SysLoginLog>>>('/system/login-log/page', { params })
export const getLoginLogById = (id: number) => request.get<R<SysLoginLog>>(`/system/login-log/${id}`)
export const clearLoginLog = (days = 30) => request.delete<R<void>>('/system/login-log/clear', { params: { days } })

// OAuth client
export const getOauthClientPage = (params: any) => request.get<R<PageResult<SysOauthClient>>>('/system/client/page', { params })
export const createOauthClient = (data: SysOauthClient) => request.post<R<void>>('/system/client', data)
export const updateOauthClient = (data: SysOauthClient) => request.put<R<void>>('/system/client', data)
export const deleteOauthClient = (clientId: string) => request.delete<R<void>>(`/system/client/${clientId}`)

// Notice
export const getNoticePage = (params: any) => request.get<R<PageResult<SysNotice>>>('/system/notice/page', { params })
export const getNoticeById = (noticeId: number) => request.get<R<SysNotice>>(`/system/notice/${noticeId}`)
export const createNotice = (data: SysNotice) => request.post<R<void>>('/system/notice', data)
export const updateNotice = (data: SysNotice) => request.put<R<void>>('/system/notice', data)
export const deleteNotice = (noticeId: number) => request.delete<R<void>>(`/system/notice/${noticeId}`)
export const getNoticeList = () => request.get<R<SysNotice[]>>('/system/notice/list')
export const readNotice = (noticeId: number) => request.post<R<void>>(`/system/notice/${noticeId}/read`)
export const getUnreadNoticeCount = () => request.get<R<number>>('/system/notice/unread-count')
export const getNoticeReadRecords = (noticeId: number) => request.get<R<any[]>>(`/system/notice/${noticeId}/reads`)

// Online user
export const getOnlineUserList = () => request.get<R<OnlineUser[]>>('/system/online-user/list')
export const getOnlineUserCount = () => request.get<R<number>>('/system/online-user/count')
export const forceLogoutOnlineUser = (userId: number) => request.delete<R<void>>(`/system/online-user/${userId}`)
export const forceLogoutOnlineToken = (token: string) => request.delete<R<void>>(`/system/online-user/token/${token}`)
export const cleanupOnlineUser = () => request.delete<R<void>>('/system/online-user/cleanup')

// Codegen
export const getGenTablePage = (params: any) => request.get<R<PageResult<GenTable>>>('/codegen/table/page', { params })
export const getGenTableById = (id: number) => request.get<R<GenTable>>(`/codegen/table/${id}`)
export const createGenTable = (data: GenTable) => request.post<R<void>>('/codegen/table', data)
export const updateGenTable = (data: GenTable) => request.put<R<void>>('/codegen/table', data)
export const deleteGenTable = (id: number) => request.delete<R<void>>(`/codegen/table/${id}`)
export const generateCode = (id: number) => request.post<R<Record<string, string>>>(`/codegen/table/generate/${id}`)
export const downloadGenZip = (id: number) =>
  request.get(`/codegen/table/download/${id}`, { responseType: 'blob' })
export const listDatabaseTables = (keyword?: string) =>
  request.get<R<Array<Record<string, any>>>>('/codegen/table/db-tables', { params: { keyword } })
export const importDatabaseTables = (tableNames: string[]) =>
  request.post<R<number[]>>('/codegen/table/import', tableNames)
export const getGenTemplateGroupPage = (params: any) => request.get<R<PageResult<GenTemplateGroup>>>('/codegen/template/group/page', { params })
export const getGenTemplateGroupList = () => request.get<R<GenTemplateGroup[]>>('/codegen/template/group/list')
export const createGenTemplateGroup = (data: GenTemplateGroup) => request.post<R<void>>('/codegen/template/group', data)
export const updateGenTemplateGroup = (data: GenTemplateGroup) => request.put<R<void>>('/codegen/template/group', data)
export const deleteGenTemplateGroup = (id: number) => request.delete<R<void>>(`/codegen/template/group/${id}`)
export const getGenTemplateList = (groupId: number) => request.get<R<GenTemplate[]>>('/codegen/template/list', { params: { groupId } })
export const getGenTemplateById = (id: number) => request.get<R<GenTemplate>>(`/codegen/template/${id}`)
export const createGenTemplate = (data: GenTemplate) => request.post<R<void>>('/codegen/template', data)
export const updateGenTemplate = (data: GenTemplate) => request.put<R<void>>('/codegen/template', data)
export const deleteGenTemplate = (id: number) => request.delete<R<void>>(`/codegen/template/${id}`)
