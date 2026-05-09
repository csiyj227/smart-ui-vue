<!--
  表单画布中的字段卡片组件（递归）。

  支持三种容器类型的递归渲染：GROUP / TABS / GRID。
  拖拽排序 + 选中 + 操作按钮。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ElIcon,
  ElButton,
  ElButtonGroup,
  ElTabs,
  ElTabPane,
  ElRow,
  ElCol,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElDatePicker,
  ElTag,
  ElRadio,
  ElRadioGroup,
  ElCheckbox,
  ElCheckboxGroup,
  ElSwitch,
  ElRate,
  ElSlider,
  ElTimePicker,
  ElColorPicker,
  ElDivider,
  ElAlert as ElAlertComp,
} from 'element-plus'
import {
  EditPen,
  Document,
  Lock,
  Odometer,
  CircleCheck,
  Check,
  ArrowDown,
  Open,
  StarFilled,
  Clock,
  Timer,
  Operation,
  Calendar,
  Brush,
  UploadFilled,
  Memo,
  Share,
  Sort,
  Connection,
  SetUp,
  Edit,
  User,
  OfficeBuilding,
  Key,
  Notebook,
  List,
  InfoFilled,
  Pointer,
  Reading,
  Tickets,
  ChromeFilled,
  Minus,
  PriceTag,
  Picture,
  FolderOpened,
  Files,
  Grid as GridIcon,
  DArrowRight,
  Postcard,
  DArrowLeft,
  Delete,
  CopyDocument,
  Top,
  Bottom,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { FormFieldSchema } from '@/types/form'
import { FORM_FIELD_TYPE_META } from '@/types/form'

interface Props {
  field: FormFieldSchema
  selectedFieldKey: string | null
  parentKey?: string
  index: number
  tabKey?: string
  columnIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  selectedFieldKey: null,
  parentKey: undefined,
  tabKey: undefined,
  columnIndex: undefined,
})

const emit = defineEmits<{
  'select-field': [fieldKey: string]
  'drop-field': [data: {
    fieldType?: string
    fieldKey?: string
    targetIndex: number
    action: string
    parentKey?: string
    tabKey?: string
    columnIndex?: number
  }]
  'remove-field': [fieldKey: string]
  'move-up': [fieldKey: string, index: number, parentKey?: string]
  'move-down': [fieldKey: string, index: number, parentKey?: string]
  'copy': [fieldKey: string]
}>()

// 图标映射（key 对应 FORM_FIELD_TYPE_META 中的 icon 字段）
const iconMap: Record<string, Component> = {
  EditPen,
  Document,
  Lock,
  Odometer,
  CircleCheck,
  Check,
  ArrowDown,
  Open,
  StarFilled,
  Clock,
  Timer,
  Operation,
  Calendar,
  Brush,
  UploadFilled,
  Memo,
  Share,
  Sort,
  Connection,
  SetUp,
  Edit,
  User,
  OfficeBuilding,
  Key,
  Notebook,
  List,
  InfoFilled,
  Pointer,
  Reading,
  Tickets,
  ChromeFilled,
  Minus,
  PriceTag,
  Picture,
  FolderOpened,
  Files,
  Grid: GridIcon,
  DArrowRight,
  Postcard,
  DArrowLeft,
}

// Tabs 当前激活项
const activeTabKey = ref(props.field.tabs?.[0]?.key || '')

const isSelected = computed(() => props.selectedFieldKey === props.field.fieldKey)

const iconComponent = computed(() => {
  const meta = FORM_FIELD_TYPE_META[props.field.fieldType]
  return iconMap[meta?.icon] || Document
})

function handleSelect() {
  emit('select-field', props.field.fieldKey)
}

function handleRemove() {
  emit('remove-field', props.field.fieldKey)
}

function handleMoveUp() {
  emit('move-up', props.field.fieldKey, props.index, props.parentKey)
}

function handleMoveDown() {
  emit('move-down', props.field.fieldKey, props.index, props.parentKey)
}

function handleCopy() {
  emit('copy', props.field.fieldKey)
}

function handleDragStart(event: DragEvent) {
  const dragData = {
    action: 'move',
    fieldType: props.field.fieldType,
    fieldKey: props.field.fieldKey,
    sourceParentKey: props.parentKey,
    sourceIndex: props.index,
  }
  event.dataTransfer?.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer!.effectAllowed = 'move'
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return
  try {
    const dragData = JSON.parse(raw)
    emit('drop-field', {
      fieldType: dragData.fieldType,
      fieldKey: dragData.fieldKey,
      targetIndex: props.index,
      action: dragData.action,
      parentKey: props.parentKey,
      tabKey: props.tabKey,
      columnIndex: props.columnIndex,
    })
  } catch (err) {
    console.error('Failed to parse drag data:', err)
  }
}

/** 处理容器内部的拖拽放置（GROUP/TABS/GRID） */
function handleContainerDrop(event: DragEvent, containerKey: string, tabKey?: string, colIndex?: number) {
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return
  try {
    const dragData = JSON.parse(raw)

    // 计算容器内已有子元素数量，默认追加到末尾
    let childrenCount = 0
    if (tabKey && props.field.tabs) {
      const tab = props.field.tabs.find((t) => t.key === tabKey)
      childrenCount = tab?.children.length ?? 0
    } else if (colIndex !== undefined && props.field.columns) {
      childrenCount = props.field.columns[colIndex]?.children.length ?? 0
    } else if (props.field.children) {
      childrenCount = props.field.children.length
    }

    emit('drop-field', {
      fieldType: dragData.fieldType,
      fieldKey: dragData.fieldKey,
      targetIndex: childrenCount,
      action: dragData.action || 'new',
      parentKey: containerKey,
      tabKey,
      columnIndex: colIndex,
    })
  } catch (err) {
    console.error('Failed to parse container drop data:', err)
  }
}

// 转发子组件事件
function forwardSelectField(fieldKey: string) {
  emit('select-field', fieldKey)
}
function forwardRemoveField(fieldKey: string) {
  emit('remove-field', fieldKey)
}
function forwardDropField(data: any) {
  emit('drop-field', data)
}
function forwardMoveUp(fieldKey: string, index: number, parentKey?: string) {
  emit('move-up', fieldKey, index, parentKey)
}
function forwardMoveDown(fieldKey: string, index: number, parentKey?: string) {
  emit('move-down', fieldKey, index, parentKey)
}
function forwardCopy(fieldKey: string) {
  emit('copy', fieldKey)
}
</script>

<template>
  <div
    class="field-item"
    :class="{ 'field-item--selected': isSelected }"
    draggable="true"
    @click.stop="handleSelect"
    @dragstart.stop="handleDragStart"
    @dragover.prevent="handleDragOver"
    @drop.stop="handleDrop"
  >
    <!-- 卡片头部：标签 + 操作按钮 -->
    <div class="field-item__header">
      <div class="field-item__info">
        <ElIcon class="field-item__icon" :size="16">
          <component :is="iconComponent" />
        </ElIcon>
        <span class="field-item__label">{{ field.label }}</span>
        <ElTag size="small" type="info" effect="plain" class="field-item__type-tag">
          {{ FORM_FIELD_TYPE_META[field.fieldType]?.label }}
        </ElTag>
      </div>
      <div class="field-item__actions">
        <ElButtonGroup size="small">
          <ElButton link @click.stop="handleMoveUp" title="上移">
            <ElIcon :size="14"><Top /></ElIcon>
          </ElButton>
          <ElButton link @click.stop="handleMoveDown" title="下移">
            <ElIcon :size="14"><Bottom /></ElIcon>
          </ElButton>
          <ElButton link @click.stop="handleCopy" title="复制">
            <ElIcon :size="14"><CopyDocument /></ElIcon>
          </ElButton>
          <ElButton link type="danger" @click.stop="handleRemove" title="删除">
            <ElIcon :size="14"><Delete /></ElIcon>
          </ElButton>
        </ElButtonGroup>
      </div>
    </div>

    <!-- 字段预览区域（按字段类型渲染不同样式） -->
    <div class="field-item__preview">
      <!-- 单行文本 -->
      <ElInput v-if="field.fieldType === 'INPUT'" :placeholder="field.placeholder || '请输入'" disabled size="small" />

      <!-- 多行文本 -->
      <ElInput v-else-if="field.fieldType === 'TEXTAREA'" type="textarea" :rows="3" :placeholder="field.placeholder || '请输入'" disabled size="small" />

      <!-- 密码输入框 -->
      <ElInput v-else-if="field.fieldType === 'PASSWORD'" type="password" placeholder="请输入密码" disabled size="small" show-password />

      <!-- 计数器 -->
      <ElInputNumber v-else-if="field.fieldType === 'NUMBER'" :model-value="0" disabled size="small" controls-position="right" style="width: 100%" />

      <!-- 单选框 -->
      <ElRadioGroup v-else-if="field.fieldType === 'RADIO'" :model-value="'option1'" disabled size="small">
        <ElRadio v-for="opt in (field.options || [{ label: '选项一', value: 'option1' }, { label: '选项二', value: 'option2' }])" :key="opt.value" :value="opt.value">{{ opt.label }}</ElRadio>
      </ElRadioGroup>

      <!-- 多选框 -->
      <ElCheckboxGroup v-else-if="field.fieldType === 'CHECKBOX'" :model-value="[]" disabled size="small">
        <ElCheckbox v-for="opt in (field.options || [{ label: '选项一', value: 'option1' }, { label: '选项二', value: 'option2' }])" :key="opt.value" :value="opt.value">{{ opt.label }}</ElCheckbox>
      </ElCheckboxGroup>

      <!-- 选择器 -->
      <ElSelect v-else-if="field.fieldType === 'SELECT'" disabled placeholder="请选择" size="small" style="width: 100%">
        <ElOption v-for="opt in (field.options || [])" :key="opt.value" :label="opt.label" :value="opt.value" />
      </ElSelect>

      <!-- 开关 -->
      <ElSwitch v-else-if="field.fieldType === 'SWITCH'" :model-value="false" disabled size="small" />

      <!-- 评分 -->
      <ElRate v-else-if="field.fieldType === 'RATE'" :model-value="3" disabled size="small" />

      <!-- 时间 -->
      <ElTimePicker v-else-if="field.fieldType === 'TIME'" disabled placeholder="请选择时间" size="small" style="width: 100%" />

      <!-- 时间区间 -->
      <ElTimePicker v-else-if="field.fieldType === 'TIME_RANGE'" is-range disabled range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" size="small" style="width: 100%" />

      <!-- 滑块 -->
      <ElSlider v-else-if="field.fieldType === 'SLIDER'" :model-value="30" disabled size="small" />

      <!-- 日期 -->
      <ElDatePicker v-else-if="field.fieldType === 'DATE'" type="date" disabled placeholder="请选择日期" size="small" style="width: 100%" />

      <!-- 日期区间 -->
      <ElDatePicker v-else-if="field.fieldType === 'DATE_RANGE'" type="daterange" disabled range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" size="small" style="width: 100%" />

      <!-- 颜色选择器 -->
      <ElColorPicker v-else-if="field.fieldType === 'COLOR_PICKER'" :model-value="'#409EFF'" disabled size="small" />

      <!-- 附件上传 -->
      <div v-else-if="field.fieldType === 'UPLOAD'" class="field-item__upload-preview">
        <ElIcon :size="24" class="field-item__upload-icon"><UploadFilled /></ElIcon>
        <span>点击或拖拽文件到此处上传</span>
      </div>

      <!-- 富文本 -->
      <div v-else-if="field.fieldType === 'RICH_TEXT'" class="field-item__richtext-preview">
        <div class="field-item__richtext-toolbar">
          <span>B</span><span>I</span><span>U</span><span>H1</span><span>H2</span><span>📎</span>
        </div>
        <div class="field-item__richtext-body">富文本编辑区域</div>
      </div>

      <!-- 级联选择器 -->
      <ElInput v-else-if="field.fieldType === 'CASCADER'" disabled placeholder="请选择" size="small" />

      <!-- 穿梭框 -->
      <div v-else-if="field.fieldType === 'TRANSFER'" class="field-item__transfer-preview">
        <div class="field-item__transfer-panel">
          <div class="field-item__transfer-header">源列表</div>
          <div class="field-item__transfer-body">项目 1<br/>项目 2</div>
        </div>
        <div class="field-item__transfer-arrows">⇄</div>
        <div class="field-item__transfer-panel">
          <div class="field-item__transfer-header">目标列表</div>
          <div class="field-item__transfer-body">项目 3</div>
        </div>
      </div>

      <!-- 树形控件 -->
      <div v-else-if="field.fieldType === 'TREE'" class="field-item__tree-preview">
        <div>📁 一级节点</div>
        <div style="padding-left: 16px;">📄 二级节点 A</div>
        <div style="padding-left: 16px;">📄 二级节点 B</div>
      </div>

      <!-- 树形选择 -->
      <ElInput v-else-if="field.fieldType === 'TREE_SELECT'" disabled placeholder="请选择" size="small" />

      <!-- 手写签名 -->
      <div v-else-if="field.fieldType === 'SIGNATURE'" class="field-item__signature-preview">
        <ElIcon :size="20"><Edit /></ElIcon>
        <span>点击进行手写签名</span>
      </div>

      <!-- 人员选择 -->
      <div v-else-if="field.fieldType === 'USER_SELECT'" class="field-item__org-preview">
        <ElIcon :size="16"><User /></ElIcon>
        <span>点击选择人员</span>
      </div>

      <!-- 部门选择 -->
      <div v-else-if="field.fieldType === 'DEPT_SELECT'" class="field-item__org-preview">
        <ElIcon :size="16"><OfficeBuilding /></ElIcon>
        <span>点击选择部门</span>
      </div>

      <!-- 角色选择 -->
      <div v-else-if="field.fieldType === 'ROLE_SELECT'" class="field-item__org-preview">
        <ElIcon :size="16"><Key /></ElIcon>
        <span>点击选择角色</span>
      </div>

      <!-- 子表单 -->
      <div v-else-if="field.fieldType === 'SUB_FORM'" class="field-item__subform-preview">
        <ElIcon :size="16"><Notebook /></ElIcon>
        <span>子表单（点击配置）</span>
      </div>

      <!-- 表格表单 -->
      <div v-else-if="field.fieldType === 'TABLE_FORM'" class="field-item__subform-preview">
        <ElIcon :size="16"><List /></ElIcon>
        <span>表格表单（点击配置）</span>
      </div>

      <!-- 提示 -->
      <ElAlertComp v-else-if="field.fieldType === 'ALERT'" title="这是一条提示信息" type="info" :closable="false" show-icon />

      <!-- 按钮 -->
      <ElButton v-else-if="field.fieldType === 'BUTTON'" type="primary" size="small">按钮</ElButton>

      <!-- 文字 -->
      <div v-else-if="field.fieldType === 'TEXT'" class="field-item__text-preview">
        这是一段文字说明内容
      </div>

      <!-- 标题 -->
      <div v-else-if="field.fieldType === 'TITLE'" class="field-item__title-preview">
        标题文本
      </div>

      <!-- HTML -->
      <div v-else-if="field.fieldType === 'HTML'" class="field-item__html-preview">
        <code>&lt;div&gt;自定义 HTML 内容&lt;/div&gt;</code>
      </div>

      <!-- 分割线 -->
      <ElDivider v-else-if="field.fieldType === 'DIVIDER'" />

      <!-- 标签 -->
      <div v-else-if="field.fieldType === 'TAG'" class="field-item__tag-preview">
        <ElTag size="small">标签一</ElTag>
        <ElTag size="small" type="success">标签二</ElTag>
        <ElTag size="small" type="warning">标签三</ElTag>
      </div>

      <!-- 图片 -->
      <div v-else-if="field.fieldType === 'IMAGE'" class="field-item__image-preview">
        <ElIcon :size="32"><Picture /></ElIcon>
        <span>图片占位</span>
      </div>

      <!-- 间距 -->
      <div v-else-if="field.fieldType === 'SPACER'" class="field-item__spacer-preview" />
    </div>

    <!-- GROUP 容器 -->
    <div v-if="field.fieldType === 'GROUP' && field.children" class="field-item__container">
      <div class="field-item__container-title">{{ field.label }}</div>
      <div
        class="field-item__container-body"
        @dragover.prevent.stop
        @drop.prevent.stop="handleContainerDrop($event, field.fieldKey)"
      >
        <ElRow :gutter="12">
          <ElCol
            v-for="(child, childIndex) in field.children"
            :key="child.fieldKey"
            :span="child.span || 24"
          >
            <FieldItem
              :field="child"
              :selected-field-key="selectedFieldKey"
              :parent-key="field.fieldKey"
              :index="childIndex"
              @select-field="forwardSelectField"
              @drop-field="forwardDropField"
              @remove-field="forwardRemoveField"
              @move-up="forwardMoveUp"
              @move-down="forwardMoveDown"
              @copy="forwardCopy"
            />
          </ElCol>
        </ElRow>
        <div v-if="field.children.length === 0" class="field-item__container-empty">
          拖入字段到此分组
        </div>
      </div>
    </div>

    <!-- TABS 容器 -->
    <div v-else-if="field.fieldType === 'TABS' && field.tabs" class="field-item__container">
      <ElTabs v-model="activeTabKey" type="card">
        <ElTabPane
          v-for="tab in field.tabs"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
        >
          <div
            class="field-item__container-body"
            @dragover.prevent.stop
            @drop.prevent.stop="handleContainerDrop($event, field.fieldKey, tab.key)"
          >
            <ElRow :gutter="12">
              <ElCol
                v-for="(child, childIndex) in tab.children"
                :key="child.fieldKey"
                :span="child.span || 24"
              >
                <FieldItem
                  :field="child"
                  :selected-field-key="selectedFieldKey"
                  :parent-key="field.fieldKey"
                  :index="childIndex"
                  :tab-key="tab.key"
                  @select-field="forwardSelectField"
                  @drop-field="forwardDropField"
                  @remove-field="forwardRemoveField"
                  @move-up="forwardMoveUp"
                  @move-down="forwardMoveDown"
                  @copy="forwardCopy"
                />
              </ElCol>
            </ElRow>
            <div v-if="tab.children.length === 0" class="field-item__container-empty">
              拖入字段到此标签
            </div>
          </div>
        </ElTabPane>
      </ElTabs>
    </div>

    <!-- GRID 容器 -->
    <div v-else-if="field.fieldType === 'GRID' && field.columns" class="field-item__container">
      <ElRow :gutter="12">
        <ElCol
          v-for="(column, colIndex) in field.columns"
          :key="colIndex"
          :span="column.span"
        >
          <div
            class="field-item__container-body"
            @dragover.prevent.stop
            @drop.prevent.stop="handleContainerDrop($event, field.fieldKey, undefined, colIndex)"
          >
            <FieldItem
              v-for="(child, childIndex) in column.children"
              :key="child.fieldKey"
              :field="child"
              :selected-field-key="selectedFieldKey"
              :parent-key="field.fieldKey"
              :index="childIndex"
              :column-index="colIndex"
              @select-field="forwardSelectField"
              @drop-field="forwardDropField"
              @remove-field="forwardRemoveField"
              @move-up="forwardMoveUp"
              @move-down="forwardMoveDown"
              @copy="forwardCopy"
            />
            <div v-if="column.children.length === 0" class="field-item__container-empty">
              拖入字段到此列
            </div>
          </div>
        </ElCol>
      </ElRow>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'FieldItem' }
</script>

<style lang="scss">
.field-item {
  background-color: #fff;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--el-border-color-light);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &--selected {
    border-left-color: var(--el-color-primary) !important;
    border-color: var(--el-color-primary-light-5);
    background-color: var(--el-color-primary-light-9);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
  }

  &__info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__icon {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  &__label {
    font-size: 14px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__type-tag {
    flex-shrink: 0;
    font-size: 11px !important;
  }

  &__actions {
    opacity: 0;
    transition: opacity 0.2s ease;
    flex-shrink: 0;

    .field-item:hover & {
      opacity: 1;
    }
  }

  &__preview {
    margin-top: 8px;

    // 禁止预览组件的交互（纯展示用）
    pointer-events: none;
  }

  &__upload-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 80px;
    border: 1px dashed var(--el-border-color);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  &__upload-icon {
    color: var(--el-text-color-secondary);
  }

  &__richtext-preview {
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    overflow: hidden;
  }

  &__richtext-toolbar {
    display: flex;
    gap: 8px;
    padding: 6px 10px;
    background: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);

    span {
      cursor: default;
    }
  }

  &__richtext-body {
    padding: 10px 12px;
    min-height: 60px;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
    background: #fff;
  }

  &__org-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 11px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  &__transfer-preview {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }

  &__transfer-panel {
    flex: 1;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    overflow: hidden;
  }

  &__transfer-header {
    padding: 4px 8px;
    background: var(--el-fill-color-light);
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__transfer-body {
    padding: 6px 8px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    min-height: 36px;
  }

  &__transfer-arrows {
    display: flex;
    align-items: center;
    font-size: 16px;
    color: var(--el-text-color-placeholder);
  }

  &__tree-preview {
    padding: 8px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.8;
  }

  &__signature-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 60px;
    border: 1px dashed var(--el-border-color);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  &__subform-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 12px;
    border: 1px dashed var(--el-color-primary-light-5);
    border-radius: 6px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-size: 13px;
  }

  &__text-preview {
    padding: 8px 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
  }

  &__title-preview {
    padding: 6px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__html-preview {
    padding: 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    background: #f8f9fa;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    code {
      font-family: monospace;
    }
  }

  &__tag-preview {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__image-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 80px;
    border: 1px dashed var(--el-border-color);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  &__spacer-preview {
    height: 24px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      var(--el-border-color-extra-light) 4px,
      var(--el-border-color-extra-light) 8px
    );
    border-radius: 4px;
  }

  &__container {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  &__container-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }

  &__container-body {
    min-height: 48px;
    border: 1px dashed var(--el-border-color-light);
    border-radius: 4px;
    padding: 8px;
    background-color: #fafbfc;
  }

  &__container-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }
}
</style>
