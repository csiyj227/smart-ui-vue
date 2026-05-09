<!--
  表单字段渲染小部件 — 根据 FormFieldSchema 渲染单个字段控件。

  从 FormRenderer 中抽取出来，解决容器类型（GROUP/TABS/GRID）
  需要递归渲染子字段的问题。
-->
<script setup lang="ts">
import {
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElDatePicker,
  ElUpload,
  ElCascader,
  ElIcon,
} from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import type { FormFieldSchema } from '@/types/form';

interface Props {
  field: FormFieldSchema;
  modelValue: unknown;
  disabled: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
}>();

function onUpdate(value: unknown) {
  emit('update:modelValue', value);
}
</script>

<template>
  <!-- INPUT -->
  <ElInput
    v-if="field.fieldType === 'INPUT'"
    :model-value="(modelValue as string) ?? ''"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :maxlength="field.validation?.maxLength"
    show-word-limit
    clearable
    @update:model-value="onUpdate"
  />

  <!-- TEXTAREA -->
  <ElInput
    v-else-if="field.fieldType === 'TEXTAREA'"
    type="textarea"
    :model-value="(modelValue as string) ?? ''"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :maxlength="field.validation?.maxLength"
    :rows="4"
    show-word-limit
    @update:model-value="onUpdate"
  />

  <!-- NUMBER -->
  <ElInputNumber
    v-else-if="field.fieldType === 'NUMBER'"
    :model-value="(modelValue as number) ?? undefined"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :precision="field.precision"
    :step="field.step ?? 1"
    :min="field.validation?.min"
    :max="field.validation?.max"
    controls-position="right"
    style="width: 100%"
    @update:model-value="onUpdate"
  />

  <!-- SELECT -->
  <ElSelect
    v-else-if="field.fieldType === 'SELECT'"
    :model-value="modelValue"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :multiple="field.multiple"
    clearable
    filterable
    style="width: 100%"
    @update:model-value="onUpdate"
  >
    <ElOption
      v-for="opt in field.options"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
  </ElSelect>

  <!-- DATE -->
  <ElDatePicker
    v-else-if="field.fieldType === 'DATE'"
    :model-value="modelValue as string"
    :type="field.dateType ?? 'date'"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :format="field.dateFormat ?? 'YYYY-MM-DD'"
    :value-format="field.dateFormat ?? 'YYYY-MM-DD'"
    style="width: 100%"
    @update:model-value="onUpdate"
  />

  <!-- UPLOAD -->
  <ElUpload
    v-else-if="field.fieldType === 'UPLOAD'"
    :file-list="(modelValue as any[]) ?? []"
    :accept="field.acceptFileTypes"
    :limit="field.maxFileCount"
    :disabled="disabled"
    action=""
    :auto-upload="false"
    drag
    @update:file-list="onUpdate"
  >
    <ElIcon class="el-icon--upload"><UploadFilled /></ElIcon>
    <div class="el-upload__text">
      拖拽文件到此处或 <em>点击上传</em>
    </div>
  </ElUpload>

  <!-- RICH_TEXT -->
  <ElInput
    v-else-if="field.fieldType === 'RICH_TEXT'"
    type="textarea"
    :model-value="(modelValue as string) ?? ''"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :rows="Math.max(6, Math.round((field.editorHeight ?? 300) / 24))"
    @update:model-value="onUpdate"
  />

  <!-- CASCADER -->
  <ElCascader
    v-else-if="field.fieldType === 'CASCADER'"
    :model-value="modelValue as string[]"
    :options="field.cascaderOptions ?? []"
    :placeholder="field.placeholder"
    :disabled="disabled"
    clearable
    filterable
    style="width: 100%"
    @update:model-value="onUpdate"
  />

  <!-- USER_SELECT / DEPT_SELECT / ROLE_SELECT -->
  <ElSelect
    v-else-if="field.fieldType === 'USER_SELECT' || field.fieldType === 'DEPT_SELECT' || field.fieldType === 'ROLE_SELECT'"
    :model-value="modelValue"
    :placeholder="field.placeholder"
    :disabled="disabled"
    :multiple="field.multiple"
    clearable
    filterable
    remote
    style="width: 100%"
    @update:model-value="onUpdate"
  />

  <!-- 兜底 -->
  <ElInput
    v-else
    :model-value="(modelValue as string) ?? ''"
    :placeholder="field.placeholder"
    :disabled="disabled"
    @update:model-value="onUpdate"
  />
</template>
