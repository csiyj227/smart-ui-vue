import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import i18n from '@/i18n'

// Static routes (no auth required)
const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', titleKey: 'route.login', hidden: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { title: '无权限', titleKey: 'route.forbidden', hidden: true },
  },
  /*
   * 个人中心：所有登录用户均可访问，不需要任何业务权限。
   * 故而以静态路由形式注册（不依赖 sys_menu 配置），并 hidden=true 避免出现在主导航。
   * 入口由顶栏头像下拉菜单触发跳转。
   */
  {
    path: '/profile',
    component: () => import('@/layout/index.vue'),
    redirect: '/profile/index',
    meta: { hidden: true },
    children: [
      {
        path: 'index',
        name: 'UserProfile',
        component: () => import('@/views/system/profile/index.vue'),
        meta: { title: '个人中心', titleKey: 'route.profile', hidden: true },
      },
    ],
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', titleKey: 'route.notFound', hidden: true },
  },
  /*
   * smart-flow 模块路由 —— 列表页 + 设计器。
   *
   * ⚠️ 必须套 Layout 父级，children 才能在主布局的 <router-view> 里渲染，
   * 否则页面打开是「全屏空白 + 仅显示组件本身」，看不到侧边栏菜单和顶部导航。
   * 这与项目其他菜单页面（permissionStore.generateRoutes 动态生成）的写法保持一致 ——
   * 那边每条菜单也都是「Layout 根路由 + children 业务页」。
   *
   * 之所以仍放在 staticRoutes 而不是走 permissionStore.generateRoutes()
   * 的动态注册路径：smart-flow 的菜单还没有沉淀到 sys_menu 表里，先以
   * 静态路由形式打通设计器入口，等业务跑稳之后再迁到菜单表（迁移成本
   * 是一行 import → router.addRoute，几分钟的事）。
   *
   * 设计器路由特意放 hidden=true，因为它是「列表页跳转过去」的二级页面，
   * 不应出现在主导航里。chartId 用 `:chartId` 形式声明，路由解析时拿到
   * 的是 string，组件内部判断 'new' 或 Number(...)。
   */
  {
    path: '/flow',
    component: () => import('@/layout/index.vue'),
    redirect: '/flow/list',
    meta: { title: '流程管理', titleKey: 'route.flow', icon: 'Connection' },
    children: [
      {
        path: 'list',
        name: 'FlowList',
        component: () => import('@/views/flow/list/flow-list.vue'),
        meta: { title: '流程定义', titleKey: 'route.flowList', permission: ['flow_def_view'] },
      },
      {
        path: 'designer/:chartId',
        name: 'FlowDesigner',
        component: () => import('@/views/flow/designer/designer.vue'),
        meta: { title: '流程设计器', titleKey: 'route.flowDesigner', hidden: true, permission: ['flow_def_view'] },
      },
      {
        path: 'my-todo',
        name: 'FlowMyTodo',
        component: () => import('@/views/flow/task/my-todo.vue'),
        meta: { title: '我的待办', titleKey: 'route.flowMyTodo', permission: ['flow_task_view'] },
      },
      {
        path: 'my-done',
        name: 'FlowMyDone',
        component: () => import('@/views/flow/task/my-done.vue'),
        meta: { title: '我的已办', titleKey: 'route.flowMyDone', permission: ['flow_task_view'] },
      },
      {
        path: 'my-started',
        name: 'FlowMyStarted',
        component: () => import('@/views/flow/task/my-started.vue'),
        meta: { title: '我发起的', titleKey: 'route.flowMyStarted', permission: ['flow_task_view'] },
      },
      {
        path: 'my-cc',
        name: 'FlowMyCc',
        component: () => import('@/views/flow/task/my-cc.vue'),
        meta: { title: '抄送我的', titleKey: 'route.flowMyCc', permission: ['flow_task_view'] },
      },
      {
        path: 'start',
        name: 'FlowStart',
        component: () => import('@/views/flow/start/flow-start.vue'),
        meta: { title: '发起流程', titleKey: 'route.flowStart', permission: ['flow_inst_start'] },
      },
      {
        path: 'task/handle/:processInstanceId',
        name: 'FlowTaskHandle',
        component: () => import('@/views/flow/task/flow-task-handle.vue'),
        meta: { title: '任务处理', titleKey: 'route.flowTaskHandle', hidden: true, permission: ['flow_task_view'] },
      },
    ],
  },
  /*
   * smart-form 表单管理模块路由。
   *
   * 与 smart-flow 保持相同的静态路由模式。后端接口在 smart-upms 的
   * SysFormController（/form）和 smart-flow 的 FormBindingController
   * （/flow/form）中提供。
   */
  {
    path: '/form',
    component: () => import('@/layout/index.vue'),
    redirect: '/form/list',
    meta: { title: '表单管理', titleKey: 'route.form', icon: 'Document' },
    children: [
      {
        path: 'list',
        name: 'FormList',
        component: () => import('@/views/form/list/form-list.vue'),
        meta: { title: '表单列表', titleKey: 'route.formList', permission: ['form_view'] },
      },
      {
        path: 'designer/:formId',
        name: 'FormDesigner',
        component: () => import('@/views/form/designer/designer.vue'),
        meta: { title: '表单设计器', titleKey: 'route.formDesigner', hidden: true, permission: ['form_view'] },
      },
    ],
  },
  /*
   * smart-ai 模块路由 —— AI 智能平台。
   *
   * 包含：模型配置管理、AI 对话、Agent 智能体、MCP 工具管理、RAG 知识库管理。
   * 与 smart-flow 保持相同的静态路由模式。
   */
  {
    path: '/ai',
    component: () => import('@/layout/index.vue'),
    redirect: '/ai/chat',
    meta: { title: 'AI 智能平台', titleKey: 'route.ai', icon: 'MagicStick' },
    children: [
      {
        path: 'chat',
        name: 'AiChat',
        component: () => import('@/views/ai/chat/ai-chat.vue'),
        meta: { title: 'AI 对话', titleKey: 'route.aiChat', permission: ['ai_chat'] },
      },
      {
        path: 'agent',
        name: 'AiAgent',
        component: () => import('@/views/ai/agent/agent-list.vue'),
        meta: { title: '智能体', titleKey: 'route.aiAgent', permission: ['ai_agent_view'] },
      },
      {
        path: 'model',
        name: 'AiModel',
        component: () => import('@/views/ai/model/model-config.vue'),
        meta: { title: '模型配置', titleKey: 'route.aiModel', permission: ['ai_model_view'] },
      },
      {
        path: 'mcp',
        name: 'AiMcp',
        component: () => import('@/views/ai/mcp/mcp-server.vue'),
        meta: { title: 'MCP 工具', titleKey: 'route.aiMcp', permission: ['ai_mcp_view'] },
      },
      {
        path: 'knowledge',
        name: 'AiKnowledge',
        component: () => import('@/views/ai/knowledge/knowledge-list.vue'),
        meta: { title: '知识库', titleKey: 'route.aiKnowledge', permission: ['ai_knowledge_view'] },
      },
    ],
  },
  /*
   * smart-nl2sql 模块路由 —— NL2SQL 智能分析。
   *
   * 与 smart-ai 保持相同的静态路由模式（重置计划：等业务跑稳后再迁到菜单表）。
   * 后端接口在 smart-nl2sql-biz 模块中提供，base path 为 /nl2sql。
   *
   * 4 个一级菜单：数据源 / 数据集 / 知识库 / 智能问数。
   * 与 smart/db/nl2sql.sql 中的 sys_menu 配置 (id 段 [900,999)) 严格对齐。
   */
  {
    path: '/nl2sql',
    component: () => import('@/layout/index.vue'),
    redirect: '/nl2sql/chat',
    meta: { title: 'NL2SQL 智能分析', titleKey: 'route.nl2sql', icon: 'DataAnalysis' },
    children: [
      {
        path: 'datasource',
        name: 'Nl2SqlDataSource',
        component: () => import('@/views/nl2sql/datasource/datasource-list.vue'),
        meta: { title: '数据源管理', titleKey: 'route.nl2sqlDatasource', permission: ['nl2sql_datasource'] },
      },
      {
        path: 'dataset',
        name: 'Nl2SqlDataSet',
        component: () => import('@/views/nl2sql/dataset/dataset-list.vue'),
        meta: { title: '数据集管理', titleKey: 'route.nl2sqlDataset', permission: ['nl2sql_dataset'] },
      },
      {
        path: 'knowledge',
        name: 'Nl2SqlKnowledge',
        component: () => import('@/views/nl2sql/knowledge/knowledge-list.vue'),
        meta: { title: '知识库', titleKey: 'route.nl2sqlKnowledge', permission: ['nl2sql_knowledge'] },
      },
      {
        path: 'chat',
        name: 'Nl2SqlChat',
        component: () => import('@/views/nl2sql/chat/nl2sql-chat.vue'),
        meta: { title: '智能问数', titleKey: 'route.nl2sqlChat', permission: ['nl2sql_chat'] },
      },
    ],
  },
  /*
   * 业务申请模块 —— 自定义表单关联流程的典型 case。
   *
   * 出差申请单：列表页 + 表单页（新建/编辑）+ 查看页。
   * 表单页和查看页通过 hidden=true 隐藏在侧边栏之外，从列表页跳转进入。
   */
  {
    path: '/biz',
    component: () => import('@/layout/index.vue'),
    redirect: '/biz/travel',
    meta: { title: '业务申请', titleKey: 'route.biz', icon: 'Suitcase' },
    children: [
      {
        path: 'travel',
        name: 'TravelList',
        component: () => import('@/views/biz/travel/travel-list.vue'),
        meta: { title: '出差申请', titleKey: 'route.bizTravel', permission: ['biz_travel_view'] },
      },
      {
        path: 'travel/form',
        name: 'TravelFormNew',
        component: () => import('@/views/biz/travel/travel-form.vue'),
        meta: { title: '新建出差申请', titleKey: 'route.bizTravelNew', hidden: true, permission: ['biz_travel_add'] },
      },
      {
        path: 'travel/form/:id',
        name: 'TravelFormEdit',
        component: () => import('@/views/biz/travel/travel-form.vue'),
        meta: { title: '编辑出差申请', titleKey: 'route.bizTravelEdit', hidden: true, permission: ['biz_travel_edit'] },
      },
      {
        path: 'travel/view/:id',
        name: 'TravelView',
        component: () => import('@/views/biz/travel/travel-form.vue'),
        meta: { title: '查看出差申请', titleKey: 'route.bizTravelView', hidden: true, permission: ['biz_travel_view'] },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes,
})

// Track if dynamic routes have been added
let dynamicRoutesAdded = false

// Track dynamic route names for cleanup on logout
const dynamicRouteNames: string[] = []

router.beforeEach(async (to, _from, next) => {
  NProgress.start()
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  if (to.path === '/login') {
    next()
    return
  }

  if (!userStore.token) {
    next(`/login?redirect=${to.path}`)
    return
  }

  // Fetch user info if not loaded
  if (!userStore.userInfo) {
    try {
      await userStore.fetchUserInfo()
    } catch {
      userStore.logout()
      next('/login')
      return
    }
  }

  // Generate and add dynamic routes if not done yet
  if (!dynamicRoutesAdded) {
    try {
      const dynamicRoutes = await permissionStore.generateRoutes()
      dynamicRoutes.forEach((route) => {
        router.addRoute(route)
        if (route.name) dynamicRouteNames.push(route.name as string)
        route.children?.forEach((child) => {
          if (child.name) dynamicRouteNames.push(child.name as string)
        })
      })
      dynamicRoutesAdded = true
      // Redirect to the same path now that routes are registered
      next({ ...to, replace: true })
      return
    } catch (e) {
      console.error('Failed to generate routes:', e)
      userStore.logout()
      next('/login')
      return
    }
  }

  // Permission check
  const requiredPerm = to.meta.permission as string[] | undefined
  if (requiredPerm?.length) {
    const hasPerm = requiredPerm.some((p) => userStore.permissions.includes(p))
    if (!hasPerm) {
      next('/403')
      return
    }
  }

  next()
})

router.afterEach((to) => {
  NProgress.done()
  const titleKey = to.meta.titleKey as string | undefined
  const fallbackTitle = to.meta.title as string | undefined
  const pageTitle = titleKey
    ? i18n.global.t(titleKey)
    : (fallbackTitle || '')
  document.title = pageTitle ? `${pageTitle} - Smart Admin` : 'Smart Admin'
})

// Reset dynamic routes flag on logout
export function resetRouter() {
  dynamicRoutesAdded = false
  // Remove all dynamically added routes
  dynamicRouteNames.forEach((name) => {
    if (router.hasRoute(name)) {
      router.removeRoute(name)
    }
  })
  dynamicRouteNames.length = 0
}

export default router