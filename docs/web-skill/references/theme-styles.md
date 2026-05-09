# 主题系统与样式规范

## CSS 变量（设计 Token）

定义在 `src/theme/variables.scss`：

```scss
:root {
  // 主色：violet-indigo 渐变
  --color-primary: #6366F1;
  --color-primary-light: #818CF8;
  --color-primary-dark: #4F46E5;
  --color-primary-subtle: #EEF2FF;

  // 渐变
  --gradient-primary: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
  --gradient-sidebar: linear-gradient(180deg, #1E1B4B 0%, #0F0E2A 100%);

  // 状态色
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;

  // 表面/文字
  --color-bg: #F5F7FF;
  --color-surface: #FFFFFF;
  --color-text: #1E1B4B;
  --color-text-regular: #4B5280;
  --color-text-muted: #9CA3C4;

  // 布局
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 64px;
  --header-height: 58px;

  // Element Plus 覆盖
  --el-color-primary: var(--color-primary);
  --el-border-radius-base: var(--radius-md);
}
```

## 规则

- **禁止** 在组件中硬编码颜色值（如 `color: #333`），必须使用 CSS 变量
- 支持亮色/暗色主题切换，暗色使用 `[data-theme="dark"]` 选择器覆盖变量
- Element Plus 覆盖通过 `--el-*` 变量，不用 `!important`
- 色弱/黑白模式通过 `document.documentElement.style.filter` 实现
- 组件尺寸通过 `themeStore.componentSize` 全局控制

## 入口文件

### main.ts

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { permission } from './directives/permission'

import 'element-plus/theme-chalk/src/index.scss'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/theme/global.scss'

const app = createApp(App)
app.use(createPinia())
app.use(router)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.directive('permission', permission)
app.mount('#app')
```

### App.vue

```vue
<template>
  <el-config-provider :size="themeStore.componentSize" :locale="zhCn">
    <router-view />
    <LockScreen />
  </el-config-provider>
</template>
```
