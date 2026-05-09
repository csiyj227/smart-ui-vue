export interface R<T> {
  code: number
  msg: string
  data: T
}

export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

export interface LoginParams {
  username: string
  password: string
  grant_type: string
  tenant_id: string
  [key: string]: string
}

export interface TokenResult {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

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

export interface SysUser {
  userId: number
  username: string
  realName: string
  phone: string
  avatar: string
  email: string
  deptId: number
  postId: number
  tenantId: number
  userType: string
  status: string
  lockFlag: string
  createTime?: string
  deptName?: string
  postName?: string
}

export interface SysRole {
  roleId: number
  roleName: string
  roleCode: string
  roleDesc: string
  dsType: number
  dsScope: string
  status: string
  tenantId: number
  createTime?: string
}

export interface SysMenu {
  menuId: number
  menuName: string
  permission: string
  path: string
  component: string
  parentId: number
  icon: string
  sortOrder: number
  menuType: string
  keepAlive: boolean
  visible: boolean
  children?: SysMenu[]
}

export interface SysDept {
  deptId: number
  deptName: string
  parentId: number
  ancestors: string
  sortOrder: number
  leader: string
  phone: string
  email: string
  status: string
  tenantId: number
  createTime?: string
  children?: SysDept[]
}

export interface SysDict {
  id: number
  typeCode: string
  typeName: string
  description: string
  systemFlag: boolean
  status: string
  tenantId: number
}

export interface SysDictItem {
  id: number
  dictId: number
  itemLabel: string
  itemValue: string
  description: string
  sortOrder: number
  status: string
  tenantId: number
}

export interface SysTenant {
  id: number
  tenantName: string
  tenantCode: string
  startTime: string
  endTime: string
  status: string
  createTime?: string
}

export interface SysLog {
  id: number
  logType: string
  title: string
  serviceId: string
  remoteAddr: string
  userAgent: string
  requestUri: string
  httpMethod: string
  className: string
  methodName: string
  params: string
  executionTime: number
  exception: string
  tenantId: number
  createBy: string
  createTime: string
}

export interface RouteItem {
  path: string
  name: string
  component?: string
  redirect?: string
  meta?: RouteMeta
  children?: RouteItem[]
}

export interface RouteMeta {
  title: string
  icon?: string
  hidden?: boolean
  keepAlive?: boolean
  permission?: string[]
}

export interface UserForm {
  userId?: number
  username: string
  password?: string
  realName: string
  phone?: string
  email?: string
  deptId?: number
  postId?: number
  status?: string
  roleIds?: number[]
}

export interface SysPost {
  postId: number
  postCode: string
  postName: string
  sortOrder: number
  status: string
  tenantId: number
}

export interface SysOauthClient {
  clientId: string
  clientSecret?: string
  scope?: string
  authorizedGrantTypes?: string
  webServerRedirectUri?: string
  authorities?: string
  accessTokenValidity?: number
  refreshTokenValidity?: number
  additionalInformation?: string
  autoApprove?: string
  tenantId?: number
}

export interface SysNotice {
  noticeId?: number
  noticeTitle: string
  noticeType?: string
  noticeContent?: string
  publisher?: string
  priority?: string
  status?: string
  publishTime?: string
  expireTime?: string
  createTime?: string
}

export interface SysLoginLog {
  id: number
  userId?: number
  username?: string
  tenantId?: number
  loginType?: string
  status?: string
  ip?: string
  location?: string
  userAgent?: string
  msg?: string
  accessToken?: string
  createTime?: string
}

export interface OnlineUser {
  [key: string]: any
}

export interface GenTable {
  id?: number
  tableName: string
  tableComment?: string
  className?: string
  tplCategory?: string
  packageName?: string
  moduleName?: string
  businessName?: string
  functionName?: string
  functionAuthor?: string
  genType?: string
  genPath?: string
  options?: string
  tenantId?: number
}

export interface GenTemplateGroup {
  id?: number
  groupName: string
  groupCode: string
  description?: string
  tenantId?: number
}

export interface GenTemplate {
  id?: number
  groupId: number
  templateName: string
  templateCode: string
  templateContent: string
  filePath: string
  fileExtension?: string
  sortOrder?: number
  tenantId?: number
}


export interface SysPublicParam {
  id?: number
  paramName: string
  paramKey: string
  paramValue?: string
  paramType?: string
  status?: string
  tenantId?: number
}

export interface SysRouteConf {
  id?: number
  routeName?: string
  routeId?: string
  predicates?: string
  filters?: string
  uri?: string
  sortOrder?: number
  status?: string
}

// ─────────── 文件管理 ───────────
export interface SysFile {
  id?: number
  originalName: string
  storedName?: string
  filePath?: string
  fileUrl?: string
  fileSize?: number
  contentType?: string
  fileExt?: string
  md5?: string
  storageType?: string
  bucketName?: string
  version?: number
  parentId?: number
  isLatest?: boolean
  inRecycle?: boolean
  recycleTime?: string
  refCount?: number
  tenantId?: number
  createBy?: string
  createTime?: string
}

export interface SysFileChunk {
  id?: number
  uploadId: string
  originalName: string
  totalSize: number
  chunkSize: number
  totalChunks: number
  uploadedChunks?: string
  fileMd5?: string
  status?: string
  mergedFileId?: number
}

// ─────────── 定时任务 ───────────
export interface SysJob {
  jobId?: number
  jobName: string
  jobGroup?: string
  invokeTarget: string
  jobParam?: string
  cronExpression: string
  /** 1=立即执行 2=执行一次 3=放弃 */
  misfirePolicy?: string
  /** 0=允许并发 1=禁止并发 */
  concurrent?: string
  /** 0=暂停 1=正常 */
  status?: string
  alertOnFailure?: boolean
  alertUserIds?: string
  remark?: string
  tenantId?: number
  createTime?: string
}

export interface SysJobLog {
  logId?: number
  jobId?: number
  jobName?: string
  jobGroup?: string
  invokeTarget?: string
  jobParam?: string
  triggerType?: string
  status?: string
  exceptionInfo?: string
  result?: string
  startTime?: string
  endTime?: string
  durationMs?: number
  createTime?: string
}
