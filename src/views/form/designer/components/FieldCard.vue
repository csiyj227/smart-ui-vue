<template>
  <div
    class="form-canvas__field-card"
    :class="{ 'is-selected': selected }"
    draggable="true"
    @click="handleSelect"
    @dragstart="handleDragStart"
    @dragover.prevent="handleDragOver"
    @drop.stop="handleDrop"
  >
    <!-- 卡片主体 -->
    <div class="form-canvas__field-content">
      <!-- 左侧：图标 + 标签 -->
      <div class="form-canvas__field-info">
        <el-icon class="form-canvas__field-icon">
          <component :is="iconComponent" />
        </el-icon>
        <span class="form-canvas__field-label">{{ field.label }}</span>
      </div>

      <!-- 右侧：操作按钮（hover显示） -->
      <div class="form-canvas__field-actions">
        <el-button-group size="small">
          <el-button link @click.stop="handleMoveUp" title="上移">
            <el-icon><Top /></el-icon>
          </el-button>
          <el-button link @click.stop="handleMoveDown" title="下移">
            <el-icon><Bottom /></el-icon>
          </el-button>
          <el-button link @click.stop="handleCopy" title="复制">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
          <el-button link @click.stop="handleRemove" title="删除">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- 容器类型的子字段区域 -->
    <div v-if="field.fieldType === 'GROUP' && field.children" class="form-canvas__container-area">
      <div class="form-canvas__container-title">{{ field.label }}</div>
      <div class="form-canvas__container-content">
        <template v-for="(child, childIndex) in field.children" :key="child.fieldKey">
          <FieldCard
            :field="child"
            :selected="selectedFieldKey === child.fieldKey"
            :index="childIndex"
            :parent-key="field.fieldKey"
            @select="handleChildSelect"
            @move-up="handleChildMoveUp"
            @move-down="handleChildMoveDown"
            @copy="handleChildCopy"
            @remove="handleChildRemove"
            @drop="handleChildDrop"
          />
        </template>
      </div>
    </div>

    <!-- TABS 容器 -->
    <div v-else-if="field.fieldType === 'TABS' && field.tabs" class="form-canvas__tabs-container">
      <el-tabs v-model="activeTabKey">
        <el-tab-pane
          v-for="tab in field.tabs"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
        >
          <div class="form-canvas__container-content">
            <template v-for="(child, childIndex) in tab.children" :key="child.fieldKey">
              <FieldCard
                :field="child"
                :selected="selectedFieldKey === child.fieldKey"
                :index="childIndex"
                :parent-key="field.fieldKey"
                :tab-key="tab.key"
                @select="handleChildSelect"
                @move-up="handleChildMoveUp"
                @move-down="handleChildMoveDown"
                @copy="handleChildCopy"
                @remove="handleChildRemove"
                @drop="handleChildDrop"
              />
            </template>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- GRID 容器 -->
    <div v-else-if="field.fieldType === 'GRID' && field.columns" class="form-canvas__grid-container">
      <el-row :gutter="16">
        <el-col
          v-for="(column, colIndex) in field.columns"
          :key="colIndex"
          :span="column.span"
        >
          <div class="form-canvas__container-content">
            <template v-for="(child, childIndex) in column.children" :key="child.fieldKey">
              <FieldCard
                :field="child"
                :selected="selectedFieldKey === child.fieldKey"
                :index="childIndex"
                :parent-key="field.fieldKey"
                :column-index="colIndex"
                @select="handleChildSelect"
                @move-up="handleChildMoveUp"
                @move-down="handleChildMoveDown"
                @copy="handleChildCopy"
                @remove="handleChildRemove"
                @drop="handleChildDrop"
              />
            </template>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  EditPen,
  Document,
  Odometer,
  ArrowDown,
  Calendar,
  UploadFilled,
  Memo,
  Share,
  User,
  OfficeBuilding,
  Key,
  FolderOpened,
  Files,
  Grid as GridIcon,
  Delete,
  CopyDocument,
  Top,
  Bottom,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { FormFieldSchema } from '@/types/form'

// Props
interface Props {
  field: FormFieldSchema
  selected: boolean
  index: number
  parentKey?: string
  tabKey?: string
  columnIndex?: number
  selectedFieldKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  parentKey: undefined,
  tabKey: undefined,
  columnIndex: undefined,
  selectedFieldKey: undefined,
})

// Emits
const emit = defineEmits<{
  select: [fieldKey: string]
  moveUp: [fieldKey: string, index: number]
  moveDown: [fieldKey: string, index: number]
  copy: [fieldKey: string]
  remove: [fieldKey: string]
  drop: [data: {
    fieldType?: string
    fieldKey?: string
    targetIndex: number
    action: string
    parentKey?: string
    tabKey?: string
    columnIndex?: number
  }]
}>()

// 图标映射
const iconMap: Record<string, Component> = {
  EditPen,
  Document,
  Odometer,
  ArrowDown,
  Calendar,
  UploadFilled,
  Memo,
  Share,
  User,
  OfficeBuilding,
  Key,
  FolderOpened,
  Files,
  Grid: GridIcon,
  Delete,
  CopyDocument,
  Top,
  Bottom,
}

// 计算图标组件
const iconComponent = computed(() => {
  const meta = FORM_FIELD_TYPE_META[props.field.fieldType]
  return iconMap[meta?.icon] || Document
})

// 导入元数据
import { FORM_FIELD_TYPE_META } from '@/types/form'

// 当前激活的 tab
const activeTabKey = ref(props.field.tabs?.[0]?.key || '')

// 事件处理
const handleSelect = () => {
  emit('select', props.field.fieldKey)
}

const handleMoveUp = () => {
  emit('moveUp', props.field.fieldKey, props.index)
}

const handleMoveDown = () => {
  emit('moveDown', props.field.fieldKey, props.index)
}

const handleCopy = () => {
  emit('copy', props.field.fieldKey)
}

const handleRemove = () => {
  emit('remove', props.field.fieldKey)
}

const handleDragStart = (event: DragEvent) => {
  const dragData = {
    action: 'move',
    fieldType: props.field.fieldType,
    fieldKey: props.field.fieldKey,
    sourceParentKey: props.parentKey,
    sourceIndex: props.index,
  }
  event.dataTransfer?.setData('application/json', JSON.stringify(dragData))
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  const data = event.dataTransfer?.getData('application/json')
  if (data) {
    try {
      const dragData = JSON.parse(data)
      emit('drop', {
        fieldType: dragData.fieldType,
        fieldKey: dragData.fieldKey,
        targetIndex: props.index,
        action: dragData.action,
        parentKey: props.parentKey,
        tabKey: props.tabKey,
        columnIndex: props.columnIndex,
      })
    } catch (e) {
      console.error('Failed to parse drag data:', e)
    }
  }
}

// 子字段事件处理
const handleChildSelect = (fieldKey: string) => {
  emit('select', fieldKey)
}

const handleChildMoveUp = (fieldKey: string, index: number) => {
  // 子字段的移动由父组件处理
  console.log('Move up child:', fieldKey, index)
}

const handleChildMoveDown = (fieldKey: string, index: number) => {
  console.log('Move down child:', fieldKey, index)
}

const handleChildCopy = (fieldKey: string) => {
  console.log('Copy child:', fieldKey)
}

const handleChildRemove = (fieldKey: string) => {
  emit('remove', fieldKey)
}

const handleChildDrop = (data: any) => {
  emit('drop', data)
}
</script>

<style scoped lang="scss">
.form-canvas__field-card {
  background-color: #fff;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.is-selected {
    border-left-color: var(--el-color-primary);
  }
}

.form-canvas__field-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-canvas__field-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-canvas__field-icon {
  font-size: 16px;
  color: #606266;
}

.form-canvas__field-label {
  font-size: 14px;
  color: #303133;
}

.form-canvas__field-actions {
  opacity: 0;
  transition: opacity 0.2s ease;

  .form-canvas__field-card:hover & {
    opacity: 1;
  }
}

.form-canvas__container-area,
.form-canvas__tabs-container,
.form-canvas__grid-container {
  margin-top: 12px;
}

.form-canvas__container-title {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
}

.form-canvas__container-content {
  min-height: 60px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  background-color: #fafafa;
}
</style>
