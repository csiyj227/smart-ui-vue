import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { permission } from './directives/permission'

// ════════════════════════════════════════════════════════════════════════════
// Element Plus 全局基础样式 —— 不能省！
// ════════════════════════════════════════════════════════════════════════════
//
// 项目 vite.config.ts 配置的是 `ElementPlusResolver({ importStyle: 'sass' })`。
// 这个 resolver 只会按需注入「单个组件」的 sass 样式（如 ElInput.scss），
// 但每个组件的 sass 都依赖 element-plus 的 base/var/reset 这些「全局变量 + 基础」
// 样式（提供 --el-* CSS variables、box-sizing reset、字体栈、组件公共间距等）。
//
// 如果不在入口手动引入 base 样式，会出现以下症状（实际踩过）：
//   - ElInput 只有底线，没有圆角边框（缺 base form 样式）
//   - ElSelect 子元素纵向堆叠（缺 flex base）
//   - ElTable 无表头底色 / 无边框（缺 var.scss 里的 --el-table-* 变量）
//   - ElPagination 各部分一项一行（缺 pagination 内部 flex base）
//   - ElButton 看似正常 —— 因为它的 css 自包含程度高，碰巧 fallback 到默认
//
// 引入完整 index.scss 之后，所有按需的组件样式就能拿到 base 变量正常渲染。
// 这一行 import 大小约 80KB（gzipped 约 15KB），相比"按需"换来的样式正确性
// 完全值得。
import 'element-plus/theme-chalk/src/index.scss'

// 暗色主题 CSS variables（通过 html.dark class 激活）—— 必须在 base 之后引入
// 才能正确覆盖
import 'element-plus/theme-chalk/dark/css-vars.css'

// ⚠️ 重要：unplugin-vue-components 的 ElementPlusResolver 只能扫描 <template> 里的
// <el-xxx> 组件并按需注入样式。通过 JS API 调用的组件（ElMessage / ElMessageBox /
// ElNotification / ElLoading）扫描不到 → 样式完全没加载 → 弹窗布局塌陷成
// "全宽 + 元素左对齐垂直堆叠"。这里必须显式手动引入。
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/loading/style/css'

// Global styles (includes theme variables, dark mode, element overrides) ——
// 必须放在 element-plus 的 base 之后，这样我们的 element-override.scss 才能
// 通过更高特异性 / !important 覆盖默认样式
import '@/theme/global.scss'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

// Register Element Plus icons globally
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.directive('permission', permission)

app.mount('#app')