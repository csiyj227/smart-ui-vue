<!--
  表单渲染器组件 — 根据 FormSchema JSON 动态渲染表单。

  使用场景：
    1. 流程发起时渲染启动表单
    2. 审批节点渲染审批表单（可配合字段权限规则控制可见/只读/必填）
    3. 表单设计器的预览模式
    4. 独立表单数据收集

  Props:
    - schema: FormSchema JSON 字符串或对象
    - modelValue: 表单数据 Record<string, unknown>
    - fieldRules: 字段权限规则列表（可选，用于流程节点中覆盖字段可见/编辑状态）
    - disabled: 是否禁用整个表单
    - readonly: 是否只读模式

  Emit:
    - update:modelValue: 表单数据变更
    - submit: 表单验证通过后提交
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElDatePicker,
  ElUpload,
  ElCascader,
  ElTabs,
  ElTabPane,
  ElRow,
  ElCol,
  ElIcon,
  ElCard,
  type FormInstance,
  type FormRules,
} from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import type {
  FormSchema,
  FormFieldSchema,
  FormGlobalConfig,
  FieldPermissionRule,
} from '@/types/form';
import FormFieldWidget from './FormFieldWidget.vue';

interface Props {
  schema: string | FormSchema;
  modelValue?: Record<string, unknown>;
  fieldRules?: FieldPermissionRule[];
  disabled?: boolean;
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  fieldRules: () => [],
  disabled: false,
  readonly: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void;
  (e: 'submit', value: Record<string, unknown>): void;
}>();

const formRef = ref<FormInstance | null>(null);

/** 解析 schema */
const parsedSchema = computed<FormSchema>(() => {
  if (typeof props.schema === 'string') {
    try {
      return JSON.parse(props.schema);
    } catch {
      return { version: 1, fields: [] };
    }
  }
  return props.schema;
});

const formFields = computed(() => parsedSchema.value.fields ?? []);
const formConfig = computed<FormGlobalConfig>(() => parsedSchema.value.formConfig ?? {
  labelPosition: 'top',
  labelWidth: '100px',
  size: 'default',
});

/** 字段权限规则索引 */
const rulesIndex = computed(() => {
  const map = new Map<string, FieldPermissionRule>();
  for (const rule of props.fieldRules) {
    map.set(rule.fieldKey, rule);
  }
  return map;
});

/** 表单数据模型 */
const formData = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

/** 更新单个字段值 */
function updateFieldValue(fieldKey: string, value: unknown) {
  const updated = { ...formData.value, [fieldKey]: value };
  emit('update:modelValue', updated);
}

/** 获取字段值 */
function getFieldValue(fieldKey: string): unknown {
  return formData.value[fieldKey];
}

/** 判断字段是否可见 */
function isFieldVisible(field: FormFieldSchema): boolean {
  if (field.hidden) return false;
  const rule = rulesIndex.value.get(field.fieldKey);
  if (rule && rule.visibility === 'hidden') return false;
  return true;
}

/** 判断字段是否只读 */
function isFieldReadonly(field: FormFieldSchema): boolean {
  if (props.readonly || props.disabled) return true;
  if (field.readonly) return true;
  const rule = rulesIndex.value.get(field.fieldKey);
  if (rule && rule.editability === 'readonly') return true;
  return false;
}

/** 判断字段是否必填 */
function isFieldRequired(field: FormFieldSchema): boolean {
  const rule = rulesIndex.value.get(field.fieldKey);
  if (rule?.required !== undefined) return rule.required;
  return field.validation?.required ?? false;
}

/** 构建 ElForm 校验规则 */
const elFormRules = computed<FormRules>(() => {
  const rules: FormRules = {};

  function collectRules(fields: FormFieldSchema[]) {
    for (const field of fields) {
      if (!isFieldVisible(field)) continue;

      const fieldRules: any[] = [];
      const required = isFieldRequired(field);

      if (required) {
        fieldRules.push({
          required: true,
          message: field.validation?.requiredMessage || `请输入${field.label}`,
          trigger: ['blur', 'change'],
        });
      }

      if (field.validation?.minLength) {
        fieldRules.push({
          min: field.validation.minLength,
          message: `最少输入 ${field.validation.minLength} 个字符`,
          trigger: 'blur',
        });
      }

      if (field.validation?.maxLength) {
        fieldRules.push({
          max: field.validation.maxLength,
          message: `最多输入 ${field.validation.maxLength} 个字符`,
          trigger: 'blur',
        });
      }

      if (field.validation?.pattern) {
        fieldRules.push({
          pattern: new RegExp(field.validation.pattern),
          message: field.validation.patternMessage || '格式不正确',
          trigger: 'blur',
        });
      }

      if (fieldRules.length > 0) {
        rules[field.fieldKey] = fieldRules;
      }

      // 递归处理容器
      if (field.children) collectRules(field.children);
      if (field.tabs) field.tabs.forEach((tab) => collectRules(tab.children));
      if (field.columns) field.columns.forEach((col) => collectRules(col.children));
    }
  }

  collectRules(formFields.value);
  return rules;
});

/** 提交表单 */
async function handleSubmit() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
    emit('submit', { ...formData.value });
  } catch {
    /* 校验失败，ElForm 会自动滚动到第一个错误字段 */
  }
}

/** 暴露给父组件 */
defineExpose({
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
  submit: handleSubmit,
});
</script>

<template>
  <ElForm
    ref="formRef"
    :model="formData"
    :rules="elFormRules"
    :label-position="formConfig.labelPosition"
    :label-width="formConfig.labelWidth"
    :size="formConfig.size"
    :disabled="disabled"
    class="form-renderer"
  >
    <template v-for="field in formFields" :key="field.fieldKey">
      <!-- 跳过隐藏字段 -->
      <template v-if="isFieldVisible(field)">
        <!-- ── 布局组件：分组 ── -->
        <ElCard
          v-if="field.fieldType === 'GROUP'"
          shadow="never"
          class="form-renderer__group"
        >
          <template #header>
            <span class="form-renderer__group-title">{{ field.label }}</span>
          </template>
          <template v-for="child in field.children" :key="child.fieldKey">
            <ElFormItem
              v-if="isFieldVisible(child)"
              :label="child.label"
              :prop="child.fieldKey"
              :required="isFieldRequired(child)"
            >
              <FormFieldWidget
                :field="child"
                :model-value="getFieldValue(child.fieldKey)"
                :disabled="isFieldReadonly(child)"
                @update:model-value="(val: unknown) => updateFieldValue(child.fieldKey, val)"
              />
            </ElFormItem>
          </template>
        </ElCard>

        <!-- ── 布局组件：标签页 ── -->
        <ElTabs
          v-else-if="field.fieldType === 'TABS'"
          class="form-renderer__tabs"
        >
          <ElTabPane
            v-for="tab in field.tabs"
            :key="tab.key"
            :label="tab.label"
          >
            <template v-for="child in tab.children" :key="child.fieldKey">
              <ElFormItem
                v-if="isFieldVisible(child)"
                :label="child.label"
                :prop="child.fieldKey"
                :required="isFieldRequired(child)"
              >
                <FormFieldWidget
                  :field="child"
                  :model-value="getFieldValue(child.fieldKey)"
                  :disabled="isFieldReadonly(child)"
                  @update:model-value="(val: unknown) => updateFieldValue(child.fieldKey, val)"
                />
              </ElFormItem>
            </template>
          </ElTabPane>
        </ElTabs>

        <!-- ── 布局组件：分栏 ── -->
        <ElRow
          v-else-if="field.fieldType === 'GRID'"
          :gutter="16"
          class="form-renderer__grid"
        >
          <ElCol
            v-for="(col, colIdx) in field.columns"
            :key="colIdx"
            :span="col.span"
          >
            <template v-for="child in col.children" :key="child.fieldKey">
              <ElFormItem
                v-if="isFieldVisible(child)"
                :label="child.label"
                :prop="child.fieldKey"
                :required="isFieldRequired(child)"
              >
                <FormFieldWidget
                  :field="child"
                  :model-value="getFieldValue(child.fieldKey)"
                  :disabled="isFieldReadonly(child)"
                  @update:model-value="(val: unknown) => updateFieldValue(child.fieldKey, val)"
                />
              </ElFormItem>
            </template>
          </ElCol>
        </ElRow>

        <!-- ── 普通字段 ── -->
        <ElFormItem
          v-else
          :label="field.label"
          :prop="field.fieldKey"
          :required="isFieldRequired(field)"
        >
          <!-- INPUT -->
          <ElInput
            v-if="field.fieldType === 'INPUT'"
            :model-value="(getFieldValue(field.fieldKey) as string) ?? ''"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :maxlength="field.validation?.maxLength"
            show-word-limit
            clearable
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />

          <!-- TEXTAREA -->
          <ElInput
            v-else-if="field.fieldType === 'TEXTAREA'"
            type="textarea"
            :model-value="(getFieldValue(field.fieldKey) as string) ?? ''"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :maxlength="field.validation?.maxLength"
            :rows="4"
            show-word-limit
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />

          <!-- NUMBER -->
          <ElInputNumber
            v-else-if="field.fieldType === 'NUMBER'"
            :model-value="(getFieldValue(field.fieldKey) as number) ?? undefined"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :precision="field.precision"
            :step="field.step ?? 1"
            :min="field.validation?.min"
            :max="field.validation?.max"
            controls-position="right"
            style="width: 100%"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />

          <!-- SELECT -->
          <ElSelect
            v-else-if="field.fieldType === 'SELECT'"
            :model-value="(getFieldValue(field.fieldKey) as any)"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :multiple="field.multiple"
            clearable
            filterable
            style="width: 100%"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
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
            :model-value="getFieldValue(field.fieldKey) as string"
            :type="field.dateType ?? 'date'"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :format="field.dateFormat ?? 'YYYY-MM-DD'"
            :value-format="field.dateFormat ?? 'YYYY-MM-DD'"
            style="width: 100%"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />

          <!-- UPLOAD -->
          <ElUpload
            v-else-if="field.fieldType === 'UPLOAD'"
            :file-list="(getFieldValue(field.fieldKey) as any[]) ?? []"
            :accept="field.acceptFileTypes"
            :limit="field.maxFileCount"
            :disabled="isFieldReadonly(field)"
            action=""
            :auto-upload="false"
            drag
            @update:file-list="(val) => updateFieldValue(field.fieldKey, val)"
          >
            <ElIcon class="el-icon--upload"><UploadFilled /></ElIcon>
            <div class="el-upload__text">
              拖拽文件到此处或 <em>点击上传</em>
            </div>
          </ElUpload>

          <!-- RICH_TEXT（简化为 textarea，实际项目可替换为 wangeditor/tiptap） -->
          <ElInput
            v-else-if="field.fieldType === 'RICH_TEXT'"
            type="textarea"
            :model-value="(getFieldValue(field.fieldKey) as string) ?? ''"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :rows="Math.max(6, Math.round((field.editorHeight ?? 300) / 24))"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />

          <!-- CASCADER -->
          <ElCascader
            v-else-if="field.fieldType === 'CASCADER'"
            :model-value="getFieldValue(field.fieldKey) as string[]"
            :options="(field.cascaderOptions ?? []) as any"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            clearable
            filterable
            style="width: 100%"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />

          <!-- USER_SELECT / DEPT_SELECT / ROLE_SELECT（简化为 ElSelect，实际项目可接入组织架构接口） -->
          <ElSelect
            v-else-if="field.fieldType === 'USER_SELECT' || field.fieldType === 'DEPT_SELECT' || field.fieldType === 'ROLE_SELECT'"
            :model-value="(getFieldValue(field.fieldKey) as any)"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            :multiple="field.multiple"
            clearable
            filterable
            remote
            style="width: 100%"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          >
            <!-- 选项由运行时数据加载 -->
          </ElSelect>

          <!-- 兜底 -->
          <ElInput
            v-else
            :model-value="(getFieldValue(field.fieldKey) as string) ?? ''"
            :placeholder="field.placeholder"
            :disabled="isFieldReadonly(field)"
            @update:model-value="(val) => updateFieldValue(field.fieldKey, val)"
          />
        </ElFormItem>
      </template>
    </template>
  </ElForm>
</template>

<style lang="scss" scoped>
.form-renderer {
  max-width: 800px;
  margin: 0 auto;

  &__group {
    margin-bottom: 16px;

    :deep(.el-card__header) {
      padding: 12px 16px;
      background: var(--el-fill-color-light);
    }
  }

  &__group-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__tabs {
    margin-bottom: 16px;
  }

  &__grid {
    margin-bottom: 8px;
  }
}
</style>
