# 技术栈与项目结构

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.4+ | Composition API + `<script setup>` |
| Element Plus | 2.6+ | UI 组件库 |
| Vite | 5.4+ | 构建工具 |
| Pinia | 2.1+ | 状态管理 |
| Vue Router | 4.3+ | 路由（History 模式） |
| TypeScript | 5.4+ | 类型安全 |
| Axios | 1.7+ | HTTP 客户端 |
| SCSS | — | 样式预处理，主题基于 CSS 变量 |
| ECharts | 6.0+ | 图表 |
| Vue Flow | 1.48+ | 流程图可视化 |
| Mermaid | 11.14+ | 图表渲染 |

## 目录结构

```
smart-ui/src/
├── api/              # API 接口层（按业务模块划分）
│   ├── admin.ts      # 系统管理（用户、角色、菜单、部门等）
│   ├── auth.ts       # 认证授权（登录、Token）
│   ├── ai.ts         # AI 智能平台
│   ├── flow.ts       # 流程引擎
│   ├── form.ts       # 表单设计器
│   ├── nl2sql.ts     # NL2SQL 智能分析
│   └── business.ts   # 业务申请
├── views/            # 页面视图（按业务模块组织）
│   ├── ai/           # AI 对话、Agent、模型配置、MCP、知识库
│   ├── biz/          # 业务申请（出差申请等）
│   ├── flow/         # 流程定义、设计器、任务管理
│   ├── form/         # 表单列表、设计器
│   ├── nl2sql/       # 数据源、数据集、知识库、智能问数
│   ├── system/       # 系统管理（用户、角色、菜单等）
│   ├── login/        # 登录页
│   ├── home/         # 首页
│   └── error/        # 错误页面（403、404）
├── components/       # 公共组件
│   ├── Pagination/   # 分页组件
│   ├── SearchForm/   # 搜索表单
│   ├── RightToolbar/ # 右侧工具栏
│   ├── FormRenderer/ # 表单渲染器
│   ├── FlowPreview/  # 流程预览
│   └── LockScreen/   # 锁屏组件
├── router/           # 路由配置
├── stores/           # Pinia 状态管理
│   ├── user.ts       # 用户信息、Token、权限
│   ├── permission.ts # 动态路由、菜单树
│   ├── theme.ts      # 主题配置（亮色/暗色、组件尺寸）
│   ├── tagsView.ts   # 标签页管理
│   └── app.ts        # 应用全局状态
├── utils/            # 工具类
│   ├── request.ts    # Axios 封装（拦截器、错误处理）
│   ├── storage.ts    # LocalStorage 封装
│   ├── format.ts     # 格式化工具
│   └── watermark.ts  # 水印工具
├── directives/       # 自定义指令
│   └── permission.ts # v-permission 权限指令
├── composables/      # Composition API 组合式函数
├── types/            # TypeScript 类型定义
│   ├── api.ts        # 后端 API 响应类型
│   └── layout.ts     # 布局相关类型
├── layout/           # 布局组件
├── theme/            # 主题样式
│   ├── variables.scss # CSS 变量（设计 Token）
│   ├── global.scss   # 全局样式
│   ├── dark.scss     # 暗色主题
│   └── element-override.scss # Element Plus 覆盖
├── assets/           # 静态资源
├── App.vue           # 根组件
└── main.ts           # 入口文件
```

## Vite 配置要点

```typescript
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver({ importStyle: 'sass' })] }),
    Components({ resolvers: [ElementPlusResolver({ importStyle: 'sass' })] }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  css: {
    preprocessorOptions: {
      scss: { additionalData: `@use "@/theme/mixins" as *;` },
    },
  },
  server: {
    port: 8888,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/file/download': { target: 'http://localhost:8080', changeOrigin: true },
      '/file/preview': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
```

**关键点：**
- 开发端口 `8888`，代理到后端 `8080`
- `/api` 前缀会被 rewrite 去除
- 文件下载/预览路径不走 `/api` 前缀
- Element Plus 使用 SASS 样式导入（支持主题变量覆盖）

## 开发命令

```bash
cd smart-ui
npm install        # 安装依赖
npm run dev        # 开发模式（http://localhost:8888）
npm run build      # 生产构建（输出到 dist/）
```
