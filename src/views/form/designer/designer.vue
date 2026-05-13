<!--
  表单设计器主页面。

  三栏布局：左侧字段面板 + 中间画布 + 右侧属性面板。
  路由参数 formId："new" 表示新建，数字表示编辑已有表单。
-->
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ElContainer,
  ElAside,
  ElMain,
  ElButton,
  ElButtonGroup,
  ElTooltip,
  ElTag,
  ElIcon,
  ElInput,
  ElMessage,
  ElDialog,
} from 'element-plus';
import {
  Back,
  RefreshLeft,
  RefreshRight,
  View,
  Edit,
  Promotion,
} from '@element-plus/icons-vue';
import { useFormSchema } from '@/composables/form/use-form-schema';
import { getFormById, createForm, updateForm, publishForm } from '@/api/form';
import type { SysFormView, FormFieldType } from '@/types/form';

import FieldPalette from './components/FieldPalette.vue';
import FormCanvas from './components/FormCanvas.vue';
import FieldPropertyPanel from './components/FieldPropertyPanel.vue';

const route = useRoute();
const router = useRouter();
const schema = useFormSchema();

// ── 表单基本信息 ──
const formId = ref<number | null>(null);
const formName = ref('未命名表单');
const formKey = ref('');
const description = ref('');
const category = ref('');
const formStatus = ref<'NEW' | 'DRAFT' | 'PUBLISHED'>('NEW');

// ── 名称编辑 ──
const editingName = ref(false);
const nameInput = ref('');
const nameInputRef = ref<InstanceType<typeof ElInput> | null>(null);

async function startEditName() {
  nameInput.value = formName.value;
  editingName.value = true;
  await nextTick();
  nameInputRef.value?.focus();
}

function confirmName() {
  editingName.value = false;
  const trimmed = nameInput.value.trim();
  if (trimmed) {
    formName.value = trimmed;
  }
}

// ── 保存状态 ──
const saving = ref(false);
const publishing = ref(false);

// ── 预览对话框 ──
const previewVisible = ref(false);
const previewJson = ref('');

// ── 状态显示 ──
const statusMeta = {
  NEW: { type: 'info' as const, text: '未保存' },
  DRAFT: { type: 'warning' as const, text: '草稿' },
  PUBLISHED: { type: 'success' as const, text: '已发布' },
};

// ── 加载 ──
onMounted(async () => {
  const paramId = route.params.formId as string;
  if (paramId === 'new') {
    schema.reset();
    formKey.value = 'form_' + Date.now();
    return;
  }

  const id = Number(paramId);
  if (isNaN(id)) {
    ElMessage.error('无效的表单 ID');
    router.replace('/form/list');
    return;
  }

  try {
    const res = await getFormById(id) as any;
    const view = res.data?.data as SysFormView | undefined;
    if (!view) {
      ElMessage.error('表单不存在');
      router.replace('/form/list');
      return;
    }

    formId.value = view.formId;
    formName.value = view.formName;
    formKey.value = view.formKey;
    description.value = view.description ?? '';
    category.value = view.category ?? '';
    formStatus.value = view.status === '1' ? 'PUBLISHED' : 'DRAFT';

    if (view.schema) {
      schema.fromSchemaJson(view.schema);
    }
  } catch (err) {
    console.error('[form-designer] load failed', err);
    ElMessage.error('加载表单失败');
  }
});

// ── 保存 ──
async function onSave() {
  if (!formName.value.trim()) {
    ElMessage.error('请输入表单名称');
    return;
  }
  if (!formKey.value.trim()) {
    ElMessage.error('请输入表单标识');
    return;
  }

  saving.value = true;
  try {
    const schemaJson = schema.toSchemaJson();

    if (formId.value == null) {
      const res = await createForm({
        formName: formName.value.trim(),
        formKey: formKey.value.trim(),
        schema: schemaJson,
        description: description.value,
        category: category.value,
      }) as any;
      const newId: number | undefined = res.data?.data;
      if (newId) {
        formId.value = newId;
        formStatus.value = 'DRAFT';
        router.replace(`/form/designer/${newId}`);
      }
      ElMessage.success('保存成功');
    } else {
      await updateForm({
        formId: formId.value,
        formName: formName.value.trim(),
        formKey: formKey.value.trim(),
        schema: schemaJson,
        description: description.value,
        category: category.value,
      });
      ElMessage.success('保存成功');
    }
  } catch (err) {
    console.error('[form-designer] save failed', err);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

// ── 发布 ──
async function onPublish() {
  if (formId.value == null) {
    ElMessage.warning('请先保存表单');
    return;
  }

  publishing.value = true;
  try {
    await publishForm(formId.value);
    formStatus.value = 'PUBLISHED';
    ElMessage.success('发布成功');
  } catch (err) {
    console.error('[form-designer] publish failed', err);
    ElMessage.error('发布失败');
  } finally {
    publishing.value = false;
  }
}

// ── 预览 ──
function onPreview() {
  previewJson.value = schema.toSchemaJson();
  try {
    previewJson.value = JSON.stringify(JSON.parse(previewJson.value), null, 2);
  } catch {
    /* 保持原始 JSON */
  }
  previewVisible.value = true;
}

// ── 返回 ──
function onBack() {
  router.push('/form/list');
}

// ── 画布事件处理 ──
function onAddField(fieldType: FormFieldType) {
  schema.addField(fieldType);
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

// ── 属性面板事件处理 ──
function onUpdateField(fieldKey: string, updates: Record<string, unknown>) {
  schema.updateField(fieldKey, updates);
}

function onUpdateConfig(updates: Record<string, unknown>) {
  Object.assign(schema.formConfig.value, updates);
  schema.commit();
}
</script>

<template>
  <ElContainer class="form-designer" direction="vertical">
    <!-- 顶部工具栏 -->
    <header class="form-designer__toolbar">
      <div class="form-designer__toolbar-left">
        <ElButton :icon="Back" link @click="onBack">返回</ElButton>
        <ElInput
          v-if="editingName"
          ref="nameInputRef"
          v-model="nameInput"
          size="small"
          class="form-designer__name-input"
          placeholder="请输入表单名称"
          @blur="confirmName"
          @keyup.enter="confirmName"
        />
        <span v-else class="form-designer__title" @click="startEditName">
          {{ formName || '未命名表单' }}
          <ElIcon class="form-designer__edit-icon"><Edit /></ElIcon>
        </span>
        <ElTag :type="statusMeta[formStatus].type" size="small" round>
          {{ statusMeta[formStatus].text }}
        </ElTag>
      </div>

      <div class="form-designer__toolbar-center">
        <ElButtonGroup>
          <ElTooltip content="撤销 (Ctrl+Z)">
            <ElButton :icon="RefreshLeft" :disabled="!schema.canUndo.value" size="small" @click="schema.undo()" />
          </ElTooltip>
          <ElTooltip content="重做 (Ctrl+Shift+Z)">
            <ElButton :icon="RefreshRight" :disabled="!schema.canRedo.value" size="small" @click="schema.redo()" />
          </ElTooltip>
        </ElButtonGroup>
      </div>

      <div class="form-designer__toolbar-right">
        <ElButton :icon="View" size="small" @click="onPreview">预览</ElButton>
        <ElButton type="primary" size="small" :loading="saving" @click="onSave">保存</ElButton>
        <ElButton type="success" size="small" :icon="Promotion" :loading="publishing" @click="onPublish">
          发布
        </ElButton>
      </div>
    </header>

    <!-- 主体三栏 -->
    <ElContainer class="form-designer__body">
      <ElAside class="form-designer__aside form-designer__aside--left" width="240px">
        <FieldPalette @add-field="(onAddField as any)" />
      </ElAside>

      <ElMain class="form-designer__canvas" @click.self="onDeselectField">
        <FormCanvas
          :fields="schema.fields.value"
          :form-config="schema.formConfig.value"
          :selected-field-key="schema.selectedFieldKey.value"
          @select-field="onSelectField"
          @drop-field="onDropField"
          @remove-field="onRemoveField"
        />
      </ElMain>

      <ElAside class="form-designer__aside form-designer__aside--right" width="320px">
        <FieldPropertyPanel
          :field="schema.selectedField.value"
          :form-config="schema.formConfig.value"
          @update-field="onUpdateField"
          @update-config="onUpdateConfig"
        />
      </ElAside>
    </ElContainer>

    <!-- 预览对话框 -->
    <ElDialog v-model="previewVisible" title="表单 Schema 预览" width="680px" top="5vh">
      <pre class="form-designer__preview-json">{{ previewJson }}</pre>
    </ElDialog>
  </ElContainer>
</template>

<style lang="scss" scoped>
.form-designer {
  height: 100vh;
  overflow: hidden;

  &__toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 52px;
    padding: 0 16px;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-light);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }

  &__toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  &__edit-icon {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    opacity: 0;
    transition: opacity 0.2s;

    .form-designer__title:hover & {
      opacity: 1;
    }
  }

  &__name-input {
    width: 240px;
  }

  &__toolbar-center,
  &__toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__toolbar-right {
    justify-self: end;
  }

  &__body {
    flex: 1;
    overflow: hidden;
  }

  &__aside {
    overflow-y: auto;
    background: var(--el-bg-color);
    border-right: 1px solid var(--el-border-color-lighter);

    &--right {
      border-right: none;
      border-left: 1px solid var(--el-border-color-lighter);
    }
  }

  &__canvas {
    padding: 16px;
    background: #f5f7fa;
    overflow-y: auto;
  }

  &__preview-json {
    max-height: 65vh;
    overflow: auto;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 6px;
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
