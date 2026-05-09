<!--
  表单设计器对话框 — 从流程设计器中快速创建表单。

  全屏对话框，内嵌表单设计器三栏布局（字段面板 + 画布 + 属性面板）。
  保存并发布后 emit 'saved' 事件，携带 formId + formName 供父组件绑定。
-->
<script setup lang="ts">
import { ref, nextTick } from 'vue';
import {
  ElDialog,
  ElContainer,
  ElAside,
  ElMain,
  ElButton,
  ElButtonGroup,
  ElTooltip,
  ElIcon,
  ElInput,
  ElMessage,
  ElForm,
  ElFormItem,
} from 'element-plus';
import {
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue';
import { useFormSchema } from '@/composables/form/use-form-schema';
import { createForm, publishForm } from '@/api/form';
import type { FormFieldType, FormFieldTypeMeta } from '@/types/form';

import FieldPalette from '@/views/form/designer/components/FieldPalette.vue';
import FormCanvas from '@/views/form/designer/components/FormCanvas.vue';
import FieldPropertyPanel from '@/views/form/designer/components/FieldPropertyPanel.vue';

interface Props {
  visible: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  saved: [payload: { formId: number; formName: string }];
}>();

const schema = useFormSchema();

// ── 表单基本信息 ──
const formName = ref('');
const formKey = ref('');
const saving = ref(false);

/** 对话框打开时重置状态 */
function handleOpen() {
  schema.reset();
  formName.value = '';
  formKey.value = 'form_' + Date.now();
  saving.value = false;
}

/** 关闭对话框 */
function handleClose() {
  emit('update:visible', false);
}

// ── 画布事件处理 ──
function onAddField(meta: FormFieldTypeMeta) {
  schema.addField(meta.type);
}

function onSelectField(fieldKey: string) {
  schema.selectedFieldKey.value = fieldKey;
}

function onDeselectField() {
  schema.selectedFieldKey.value = null;
}

function onDropField(data: {
  fieldType?: string;
  fieldKey?: string;
  targetIndex: number;
  action: string;
  parentKey?: string;
  tabKey?: string;
  columnIndex?: number;
}) {
  if (data.action === 'new' && data.fieldType) {
    if (data.parentKey && data.tabKey) {
      schema.addFieldToTab(data.fieldType as FormFieldType, data.parentKey, data.tabKey, data.targetIndex);
    } else if (data.parentKey && data.columnIndex !== undefined) {
      schema.addFieldToColumn(data.fieldType as FormFieldType, data.parentKey, data.columnIndex, data.targetIndex);
    } else {
      schema.addField(data.fieldType as FormFieldType, data.targetIndex, data.parentKey);
    }
  } else if (data.action === 'move' && data.fieldKey) {
    schema.moveFieldTo(data.fieldKey, data.parentKey ?? null, data.targetIndex, data.tabKey, data.columnIndex);
  }
}

function onRemoveField(fieldKey: string) {
  schema.removeField(fieldKey);
}

function onUpdateField(fieldKey: string, updates: Record<string, unknown>) {
  schema.updateField(fieldKey, updates);
}

function onUpdateConfig(updates: Record<string, unknown>) {
  Object.assign(schema.formConfig.value, updates);
  schema.commit();
}

// ── 保存并发布 ──
async function onSaveAndPublish() {
  const name = formName.value.trim();
  if (!name) {
    ElMessage.warning('请输入表单名称');
    return;
  }
  if (schema.fields.value.length === 0) {
    ElMessage.warning('请至少添加一个字段');
    return;
  }

  saving.value = true;
  try {
    const schemaJson = schema.toSchemaJson();
    const res = await createForm({
      formName: name,
      formKey: formKey.value.trim(),
      schema: schemaJson,
      description: '',
      category: '',
    }) as any;
    const newId: number | undefined = res.data?.data;

    if (!newId) {
      ElMessage.error('创建表单失败');
      return;
    }

    await publishForm(newId);
    ElMessage.success('表单创建并发布成功');
    emit('saved', { formId: newId, formName: name });
    emit('update:visible', false);
  } catch (err) {
    console.error('[FormDesignerDialog] save failed', err);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ElDialog
    :model-value="visible"
    title="快速创建表单"
    fullscreen
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
    @open="handleOpen"
  >
    <template #header>
      <div class="form-dialog__header">
        <div class="form-dialog__header-left">
          <span class="form-dialog__title">快速创建表单</span>
          <ElInput
            v-model="formName"
            placeholder="请输入表单名称"
            size="default"
            style="width: 240px; margin-left: 16px"
          />
        </div>
        <div class="form-dialog__header-right">
          <ElButtonGroup size="small" style="margin-right: 12px">
            <ElTooltip content="撤销">
              <ElButton :icon="RefreshLeft" :disabled="!schema.canUndo.value" @click="schema.undo()" />
            </ElTooltip>
            <ElTooltip content="重做">
              <ElButton :icon="RefreshRight" :disabled="!schema.canRedo.value" @click="schema.redo()" />
            </ElTooltip>
          </ElButtonGroup>
          <ElButton @click="handleClose">取消</ElButton>
          <ElButton type="primary" :loading="saving" @click="onSaveAndPublish">
            保存并发布
          </ElButton>
        </div>
      </div>
    </template>

    <ElContainer class="form-dialog__body">
      <ElAside width="240px" class="form-dialog__aside form-dialog__aside--left">
        <FieldPalette @add-field="onAddField" />
      </ElAside>

      <ElMain class="form-dialog__canvas" @click.self="onDeselectField">
        <FormCanvas
          :fields="schema.fields.value"
          :form-config="schema.formConfig.value"
          :selected-field-key="schema.selectedFieldKey.value"
          @select-field="onSelectField"
          @drop-field="onDropField"
          @remove-field="onRemoveField"
        />
      </ElMain>

      <ElAside width="320px" class="form-dialog__aside form-dialog__aside--right">
        <FieldPropertyPanel
          :field="schema.selectedField.value"
          :form-config="schema.formConfig.value"
          @update-field="onUpdateField"
          @update-config="onUpdateConfig"
        />
      </ElAside>
    </ElContainer>
  </ElDialog>
</template>

<style lang="scss" scoped>
.form-dialog {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  &__header-left {
    display: flex;
    align-items: center;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  &__header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__body {
    height: calc(100vh - 110px);
    overflow: hidden;
  }

  &__aside {
    overflow-y: auto;
    background: var(--el-bg-color);

    &--left {
      border-right: 1px solid var(--el-border-color-lighter);
    }

    &--right {
      border-left: 1px solid var(--el-border-color-lighter);
    }
  }

  &__canvas {
    padding: 16px;
    background: #f5f7fa;
    overflow-y: auto;
  }
}
</style>
