<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    :modal="true"
    :append-to-body="true"
    :lock-scroll="true"
    top="12vh"
    width="640px"
    class="menu-search-dialog"
    @opened="onOpened"
    @closed="onClosed"
  >
    <!-- 搜索输入框 -->
    <div class="search-header">
      <el-icon class="search-header__icon"><Search /></el-icon>
      <input
        ref="inputRef"
        v-model="keyword"
        type="text"
        class="search-header__input"
        :placeholder="t('header.searchPlaceholder')"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="goActive"
        @keydown.esc.prevent="visible = false"
      />
      <span class="search-header__shortcut">ESC</span>
    </div>

    <!-- 结果列表 -->
    <div ref="listRef" class="search-results">
      <template v-if="results.length > 0">
        <div
          v-for="(item, idx) in results"
          :key="item.menuId"
          :ref="(el) => setItemRef(el, idx)"
          class="search-result-item"
          :class="{ 'is-active': idx === activeIndex }"
          @mouseenter="activeIndex = idx"
          @click="goTo(item)"
        >
          <el-icon class="search-result-item__icon">
            <component :is="resolveIcon(item.icon)" />
          </el-icon>
          <div class="search-result-item__main">
            <div class="search-result-item__title" v-html="highlight(translateMenu(item.menuName))"></div>
            <div class="search-result-item__path">{{ item.parentPath }}{{ item.path }}</div>
          </div>
          <el-icon class="search-result-item__enter">
            <Right />
          </el-icon>
        </div>
      </template>

      <!-- 空态 -->
      <div v-else-if="keyword" class="search-empty">
        <el-icon :size="32"><DocumentDelete /></el-icon>
        <span>{{ t('header.noResults') }}</span>
      </div>

      <!-- 默认提示 -->
      <div v-else class="search-tips">
        <div class="search-tips__title">{{ t('header.quickActions') }}</div>
        <div class="search-tips__row">
          <span class="kbd">↑</span>
          <span class="kbd">↓</span>
          <span class="search-tips__desc">{{ t('header.select') }}</span>
          <span class="kbd ml16">Enter</span>
          <span class="search-tips__desc">{{ t('header.open') }}</span>
          <span class="kbd ml16">Esc</span>
          <span class="search-tips__desc">{{ t('header.close') }}</span>
        </div>
        <div class="search-tips__title mt16">{{ t('header.recentVisits') }}</div>
        <div
          v-for="(item, idx) in recentList"
          :key="item.menuId"
          :ref="(el) => setItemRef(el, idx)"
          class="search-result-item"
          :class="{ 'is-active': idx === activeIndex }"
          @mouseenter="activeIndex = idx"
          @click="goTo(item)"
        >
          <el-icon class="search-result-item__icon">
            <component :is="resolveIcon(item.icon)" />
          </el-icon>
          <div class="search-result-item__main">
            <div class="search-result-item__title">{{ translateMenu(item.menuName) }}</div>
            <div class="search-result-item__path">{{ item.parentPath }}{{ item.path }}</div>
          </div>
          <el-icon class="search-result-item__enter"><Right /></el-icon>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { usePermissionStore } from '@/stores/permission'
import { useMenuTranslate } from '@/composables/useMenuTranslate'
import type { MenuData } from '@/types/layout'

const { t } = useI18n()
const { translateMenu } = useMenuTranslate()

interface SearchItem extends MenuData {
  parentPath: string
}

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const router = useRouter()
const permissionStore = usePermissionStore()

const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement>()
const listRef = ref<HTMLElement>()
const itemRefs = ref<HTMLElement[]>([])

const RECENT_KEY = 'smart_recent_menus'
const recentList = ref<SearchItem[]>([])

// === 把树扁平化为「叶子菜单」列表 ===
function flatten(menus: MenuData[], parentPath = ''): SearchItem[] {
  const result: SearchItem[] = []
  for (const menu of menus) {
    if (!menu.visible || menu.menuType === '2') continue
    if (menu.menuType === '1') {
      // 叶子菜单（用户能跳转的）
      result.push({ ...menu, parentPath })
    }
    if (menu.children && menu.children.length > 0) {
      result.push(...flatten(menu.children, `${parentPath}${menu.path}/`.replace(/\/+/g, '/')))
    }
  }
  return result
}

const allMenus = computed<SearchItem[]>(() => flatten(permissionStore.menuList || []))

// === 模糊匹配（支持中文 / 路径 / 拼音首字母不实现，避免引依赖） ===
const results = computed<SearchItem[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return []
  return allMenus.value
    .filter((m) => {
      const name = (m.menuName || '').toLowerCase()
      const translatedName = translateMenu(m.menuName).toLowerCase()
      const path = (m.path || '').toLowerCase()
      return name.includes(kw) || translatedName.includes(kw) || path.includes(kw)
    })
    .slice(0, 30)
})

watch(keyword, () => {
  activeIndex.value = 0
})

watch(
  () => results.value,
  () => {
    activeIndex.value = 0
  },
)

// === 键盘 / 选中态 ===
function moveActive(delta: number) {
  const list = currentList()
  if (list.length === 0) return
  activeIndex.value = (activeIndex.value + delta + list.length) % list.length
  scrollActiveIntoView()
}

function goActive() {
  const list = currentList()
  const item = list[activeIndex.value]
  if (item) goTo(item)
}

function currentList(): SearchItem[] {
  return keyword.value ? results.value : recentList.value
}

function setItemRef(el: any, idx: number) {
  if (el) itemRefs.value[idx] = el
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = itemRefs.value[activeIndex.value]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

// === 跳转 + 写入「最近访问」 ===
function goTo(item: SearchItem) {
  visible.value = false
  // 用路由 name 跳，permission.ts 里固定为 'Menu_${menuId}'
  const routeName = `Menu_${item.menuId}`
  router.push({ name: routeName }).catch(() => {
    // name 不存在时退化用 path
    router.push(`${item.parentPath}${item.path}`.replace(/\/+/g, '/'))
  })
  saveRecent(item)
}

function saveRecent(item: SearchItem) {
  const list = recentList.value.filter((m) => m.menuId !== item.menuId)
  list.unshift(item)
  recentList.value = list.slice(0, 8)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentList.value))
  } catch {
    // 忽略 localStorage 满 / 隐私模式
  }
}

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      // 用最新 allMenus 反查，避免菜单已被删除还显示
      const map = new Map(allMenus.value.map((m) => [m.menuId, m]))
      recentList.value = arr.map((m: SearchItem) => map.get(m.menuId)).filter(Boolean) as SearchItem[]
    }
  } catch {
    recentList.value = []
  }
}

// === 高亮匹配片段 ===
function highlight(text: string): string {
  const kw = keyword.value.trim()
  if (!kw) return escapeHtml(text)
  const safe = escapeHtml(text)
  const safeKw = escapeHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return safe.replace(new RegExp(safeKw, 'gi'), (m) => `<mark>${m}</mark>`)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// === Icon 解析（项目里 icon 字段是字符串，比如 'User' / 'Setting'） ===
function resolveIcon(name?: string) {
  if (!name) return (ElementPlusIconsVue as any).Document
  // 直接命中 Element Plus 图标
  return (ElementPlusIconsVue as any)[name] || (ElementPlusIconsVue as any).Document
}

// === 弹窗生命周期 ===
function onOpened() {
  keyword.value = ''
  activeIndex.value = 0
  itemRefs.value = []
  loadRecent()
  nextTick(() => inputRef.value?.focus())
}

function onClosed() {
  itemRefs.value = []
}
</script>

<!--
  注意：必须用「非 scoped」样式覆盖 el-dialog 的根元素，
  scoped 下 :deep() 在某些层级穿不透 el-overlay。
  通过外层类名 .menu-search-dialog__wrapper 隔离作用域。
-->
<style lang="scss">
/* 提升整个弹窗体系的层级，确保盖住侧边栏 / Header */
.el-overlay:has(.menu-search-dialog) {
  z-index: 9999 !important;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
}

.menu-search-dialog {
  border-radius: 14px !important;
  overflow: hidden;
  padding: 0 !important;
  margin-top: 0 !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--el-border-color-lighter);

  .el-dialog__header,
  .el-dialog__footer {
    display: none !important;
  }

  .el-dialog__body {
    padding: 0 !important;
  }
}
</style>

<style lang="scss" scoped>
.search-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);

  &__icon {
    color: var(--el-text-color-secondary);
    font-size: 20px;
    transition: color 0.2s;
  }

  &:focus-within &__icon {
    color: var(--el-color-primary);
  }

  &__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
    color: var(--el-text-color-primary);
    line-height: 1.4;

    &::placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  &__shortcut {
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-secondary);
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    letter-spacing: 1px;
  }
}

.search-results {
  max-height: 50vh;
  overflow-y: auto;
  padding: 8px;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;

  &.is-active {
    background: var(--el-color-primary-light-9);

    .search-result-item__title {
      color: var(--el-color-primary);
    }

    .search-result-item__enter {
      opacity: 1;
      transform: translateX(0);
    }
  }

  &__icon {
    color: var(--el-text-color-secondary);
    font-size: 18px;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    :deep(mark) {
      background: var(--el-color-primary-light-7);
      color: var(--el-color-primary);
      padding: 0 2px;
      border-radius: 3px;
    }
  }

  &__path {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__enter {
    color: var(--el-color-primary);
    font-size: 16px;
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.15s;
  }
}

.search-empty,
.search-tips {
  padding: 24px 16px;
  color: var(--el-text-color-secondary);
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.search-tips {
  font-size: 13px;

  &__title {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 8px;
    padding-left: 4px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    margin-bottom: 12px;
  }

  &__desc {
    color: var(--el-text-color-regular);
    font-size: 12px;
  }
}

.kbd {
  display: inline-block;
  min-width: 20px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-regular);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  text-align: center;
}

.ml16 { margin-left: 16px; }
.mt16 { margin-top: 16px; }
</style>
