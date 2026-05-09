---
name: smart-frontend-web-dev
version: 1.0.0
description: Smart Web 前端开发 Skill。触发场景：Smart UI（Vue 3 + Element Plus）前端开发、页面编写、组件开发、API 对接、路由权限、主题适配。当用户提到 Smart 前端开发、写 Vue 页面、写 Element Plus 组件、新增前端 API、配置路由权限、调整主题样式时，应使用此 skill。
---

# Smart Web 前端开发 Skill

本文件是 Smart Web 前端开发的索引和工作流指引。细则下沉到 `references/` 目录，按需加载。

## 参考规范索引

**⛔ 按 READ 阶段按需加载，不要一次性读完所有参考文件。**

### 核心框架

| 维度 | 文件 | 何时加载 |
|------|------|----------|
| 技术栈与项目结构 | references/tech-stack.md | 新建页面/组件、理解目录结构时 |
| 请求封装与 API 规范 | references/request-api.md | 编写 API 调用、处理响应、调试接口时 |
| 状态管理与路由权限 | references/store-router.md | 配置权限、管理用户状态、动态路由时 |

### UI 与样式

| 维度 | 文件 | 何时加载 |
|------|------|----------|
| 页面编写规范 | references/page-patterns.md | 编写 CRUD 页面、弹窗表单、搜索表格时 |
| 主题系统与样式规范 | references/theme-styles.md | 调整颜色/暗黑模式、覆盖 Element Plus 样式时 |

## 工作流

### 新增 CRUD 页面

1. 加载 `references/tech-stack.md` 确认项目结构
2. 加载 `references/request-api.md` 编写 API 函数
3. 加载 `references/page-patterns.md` 按规范创建页面
4. 在 `src/router/index.ts` 添加路由（或通过后端菜单配置动态路由）
5. 在后端 `sys_menu` 表插入菜单和按钮权限数据

### 新增公共组件

1. 加载 `references/tech-stack.md` 确认组件目录
2. 加载 `references/page-patterns.md` 确认组件命名和 Props/Emits 规范
3. 在 `src/components/` 下创建组件目录和 `.vue` 文件

### 调整主题/样式

1. 加载 `references/theme-styles.md`
2. 修改 `src/theme/variables.scss` 中的 CSS 变量
3. 禁止在组件中硬编码颜色值

### 对接后端 API

1. 加载 `references/request-api.md`
2. 在 `src/api/` 新增 API 文件
3. 在 `src/types/api.ts` 补充类型定义
4. 注意 `ApiResult<T>` 的 `success/code` 兼容处理

## 硬性规则

- ⛔ **禁止使用 Options API**，必须用 `<script setup lang="ts">`
- ⛔ **禁止硬编码颜色值**，必须使用 CSS 变量（`var(--color-primary)` 等）
- ⛔ **禁止在组件中直接读写 localStorage**，必须通过 Pinia Store
- ⛔ **操作按钮必须加 `v-permission`** 权限指令
- ⛔ **删除操作必须用 `ElMessageBox.confirm` 二次确认**
- ⛔ **表格必须加 `v-loading`** 加载态
- ⛔ **请求路径以 `/api` 为前缀**，Vite 代理会 rewrite 去除
- ⛔ **文件下载/预览路径不走 `/api` 前缀**（`/file/download`、`/file/preview`）
- ⛔ **类型与后端 DTO 一一对应**，字段名保持 camelCase
