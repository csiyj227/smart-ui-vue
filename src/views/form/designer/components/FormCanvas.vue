<template>
  <div
    class="form-canvas"
    @dragover.prevent
    @drop.prevent="handleDrop"
  >
    <!-- 空画布引导 -->
    <div v-if="fields.length === 0" class="form-canvas__empty">
      <ElIcon :size="48" color="#c0c4cc">
        <DocumentAdd />
      </ElIcon>
      <p class="form-canvas__empty-text">从左侧拖入字段或点击添加</p>
    </div>

    <!-- 字段列表（栅格布局） -->
    <ElRow v-else :gutter="12" class="form-canvas__field-list">
      <ElCol
        v-for="(field, index) in fields"
        :key="field.fieldKey"
        :span="field.span || 24"
      >
        <FieldItem
          :field="field"
          :selected-field-key="selectedFieldKey"
          :index="index"
          @select-field="emitSelectField"
          @drop-field="emitDropField"
          @remove-field="emitRemoveField"
          @move-up="handleMoveUp"
          @move-down="handleMoveDown"
          @copy="handleCopy"
        />
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
import { ElIcon, ElRow, ElCol } from 'element-plus'
import { DocumentAdd } from '@element-plus/icons-vue'
import type { FormFieldSchema, FormGlobalConfig } from '@/types/form'
import FieldItem from './FieldItem.vue'

interface Props {
  fields: FormFieldSchema[]
  formConfig: FormGlobalConfig
  selectedFieldKey: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectField: [fieldKey: string]
  dropField: [data: {
    fieldType?: string
    fieldKey?: string
    targetIndex: number
    action: string
    parentKey?: string
    tabKey?: string
    columnIndex?: number
  }]
  removeField: [fieldKey: string]
}>()

function emitSelectField(fieldKey: string) {
  emit('selectField', fieldKey)
}

function emitRemoveField(fieldKey: string) {
  emit('removeField', fieldKey)
}

function emitDropField(data: {
  fieldType?: string
  fieldKey?: string
  targetIndex: number
  action: string
  parentKey?: string
  tabKey?: string
  columnIndex?: number
}) {
  emit('dropField', data)
}

function handleMoveUp(fieldKey: string, index: number, parentKey?: string) {
  emitDropField({
    fieldKey,
    targetIndex: Math.max(0, index - 1),
    action: 'move',
    parentKey,
  })
}

function handleMoveDown(fieldKey: string, index: number, parentKey?: string) {
  emitDropField({
    fieldKey,
    targetIndex: index + 1,
    action: 'move',
    parentKey,
  })
}

function handleCopy(fieldKey: string) {
  emitDropField({
    fieldKey,
    targetIndex: 0,
    action: 'copy',
  })
}

function handleDrop(event: DragEvent) {
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return
  try {
    const dragData = JSON.parse(raw)
    emit('dropField', {
      fieldType: dragData.fieldType,
      fieldKey: dragData.fieldKey,
      targetIndex: props.fields.length,
      action: dragData.action || 'new',
    })
  } catch (err) {
    console.error('Failed to parse drag data:', err)
  }
}
</script>

<style scoped lang="scss">
.form-canvas {
  min-height: 400px;
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 4px;

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: #909399;

    &-text {
      margin-top: 16px;
      font-size: 14px;
    }
  }

  &__field-list {
    /* 不覆盖 ElRow 的原生 flex-wrap，确保栅格正常换行 */
  }
}
</style>
