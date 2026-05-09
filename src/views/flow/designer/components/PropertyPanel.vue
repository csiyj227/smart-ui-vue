<!--
  右侧属性面板：根据当前选中对象（节点 / 边 / 无）切换不同表单。

  设计原则：
    1. 「单一数据源」—— 所有改动通过 emit 回到 useFlowGraph().patchNode/patchEdge，
       面板自己不持有「待提交」状态，避免「改了没保存」的认知负担；
    2. 「按需出表单」—— 不同 NodeKind 出不同字段，避免「APPROVE 节点的会签
       配置出现在 SCRIPT 节点上」这种困惑；
    3. 「空态友好」—— 没选中任何东西时显示 chart 元信息，让设计师能直接编辑
       chartName/chartKey，不用专门到工具栏里点「图属性」。
-->
<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { ElForm, ElFormItem, ElInput, ElDivider, ElTag, ElAlert, ElSelect, ElOption, ElButton, ElRadioGroup, ElRadioButton } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import AssigneeConfig from './panels/AssigneeConfig.vue';
import MultiModeConfig from './panels/MultiModeConfig.vue';
import BranchConditionEditor from './panels/BranchConditionEditor.vue';
import FormDesignerDialog from './dialogs/FormDesignerDialog.vue';
import {
  NODE_KIND_META,
  type AssigneeStrategy,
  type FlowChartDsl,
  type FlowEdgeDsl,
  type FlowNodeDsl,
  type FlowFormBinding,
  type MultiMode,
  type PassRule,
} from '@/types/flow';
import type {
  DesignerEdge,
  DesignerNode,
} from '@/composables/flow/use-flow-graph';
import { getFormPage, getFormById } from '@/api/form';
import type { SysFormView, FormFieldSchema, FieldRuleSpec } from '@/types/form';

interface Props {
  selectedNode: DesignerNode | null;
  selectedEdge: DesignerEdge | null;
  chartMeta: Pick<FlowChartDsl, 'chartKey' | 'chartName' | 'chartCategory' | 'description' | 'forms'>;
  /**
   * 校验报告里属于「当前选中节点 / 边」的错误列表。父组件传整张表 + 当前 id
   * 让面板自己过滤；这样属性面板可以在配置区域顶部直接亮红，设计师改完
   * 字段立刻看到错误是否消除。
   */
  nodeErrors?: Record<string, string[]>;
  edgeErrors?: Record<string, string[]>;
}

const props = withDefaults(defineProps<Props>(), {
  nodeErrors: () => ({}),
  edgeErrors: () => ({}),
});

const emit = defineEmits<{
  (e: 'patch-node', nodeId: string, patch: Partial<FlowNodeDsl>): void;
  (e: 'patch-edge', edgeId: string, patch: Partial<FlowEdgeDsl>): void;
  (e: 'patch-chart-meta', patch: Partial<Props['chartMeta']>): void;
}>();

/** 当前选中节点/边的错误信息（用于面板顶部红色提示条）。 */
const currentNodeErrors = computed<string[]>(() => {
  const id = props.selectedNode?.id;
  return id ? props.nodeErrors[id] ?? [] : [];
});
const currentEdgeErrors = computed<string[]>(() => {
  const id = props.selectedEdge?.id;
  return id ? props.edgeErrors[id] ?? [] : [];
});

// ============================================================================
// 选择态
// ============================================================================
const mode = computed<'node' | 'edge' | 'chart'>(() => {
  if (props.selectedNode) return 'node';
  if (props.selectedEdge) return 'edge';
  return 'chart';
});

// ============================================================================
// 节点字段双向绑定
// ============================================================================
const node = computed(() => props.selectedNode?.data?.dsl ?? null);
const nodeMeta = computed(() => (node.value ? NODE_KIND_META[node.value.kind] : null));

const patchNodeField = (patch: Partial<FlowNodeDsl>) => {
  if (props.selectedNode) emit('patch-node', props.selectedNode.id, patch);
};

const patchNodeProperty = (key: string, value: unknown) => {
  if (!node.value) return;
  patchNodeField({ properties: { [key]: value } });
};

// 审批人配置
const assigneeStrategy = computed(
  () => (node.value?.properties?.assigneeStrategy as AssigneeStrategy) ?? 'leader-of-starter',
);
const assigneeArgs = computed(
  () => (node.value?.properties?.assigneeArgs as Record<string, unknown>) ?? {},
);

// 会签
const multiMode = computed(() => (node.value?.properties?.multiMode as MultiMode) ?? 'none');
const passRule = computed(() => (node.value?.properties?.passRule as PassRule) ?? 'all');
const passRatio = computed(() => (node.value?.properties?.passRatio as number) ?? 0.5);

// ============================================================================
// 流程级多表单绑定
// ============================================================================
const chartForms = computed<FlowFormBinding[]>(() => props.chartMeta.forms ?? []);

/** 已发布的动态表单列表（供下拉选择用） */
const dynamicFormList = ref<SysFormView[]>([]);
const dynamicFormListLoading = ref(false);

async function loadDynamicFormList() {
  if (dynamicFormList.value.length > 0) return;
  dynamicFormListLoading.value = true;
  try {
    const axiosRes = await getFormPage({ pageNum: 1, pageSize: 200, status: '1' });
    const body = (axiosRes as any).data;
    const page = body?.data;
    dynamicFormList.value = page?.records ?? [];
  } catch (err) {
    console.error('[PropertyPanel] load form list failed', err);
  } finally {
    dynamicFormListLoading.value = false;
  }
}

onMounted(loadDynamicFormList);

// ── 添加表单 ──
const addFormType = ref<'DYNAMIC' | 'CUSTOM'>('DYNAMIC');
const addFormDynamicId = ref<number | null>(null);
const addFormCustomName = ref('');
const addFormSubmitUrl = ref('');
const addFormViewUrl = ref('');

function addForm() {
  const currentForms = [...chartForms.value];
  if (addFormType.value === 'DYNAMIC') {
    if (!addFormDynamicId.value) return;
    const found = dynamicFormList.value.find((f) => f.formId === addFormDynamicId.value);
    if (!found) return;
    // 避免重复添加
    if (currentForms.some((f) => f.type === 'DYNAMIC' && f.formId === found.formId)) return;
    currentForms.push({ type: 'DYNAMIC', name: found.formName, formId: found.formId });
    addFormDynamicId.value = null;
  } else {
    const name = addFormCustomName.value.trim();
    const viewUrl = addFormViewUrl.value.trim();
    if (!name || !viewUrl) return;
    currentForms.push({
      type: 'CUSTOM',
      name,
      submitUrl: addFormSubmitUrl.value.trim() || undefined,
      viewUrl,
    });
    addFormCustomName.value = '';
    addFormSubmitUrl.value = '';
    addFormViewUrl.value = '';
  }
  emit('patch-chart-meta', { forms: currentForms });
}

function removeForm(index: number) {
  const currentForms = [...chartForms.value];
  currentForms.splice(index, 1);
  emit('patch-chart-meta', { forms: currentForms });
}

// ============================================================================
// 快速创建表单（通过设计器对话框）
// ============================================================================
const formDesignerVisible = ref(false);

function openFormDesigner() {
  formDesignerVisible.value = true;
}

/** 快速创建的表单保存成功后：加入流程表单列表 + 刷新动态表单列表 */
function onFormDesignerSaved(payload: { formId: number; formName: string }) {
  const currentForms = [...chartForms.value];
  currentForms.push({ type: 'DYNAMIC', name: payload.formName, formId: payload.formId });
  emit('patch-chart-meta', { forms: currentForms });
  dynamicFormList.value.push({
    formId: payload.formId,
    formName: payload.formName,
    formKey: '',
    status: '1',
  } as SysFormView);
}

// ============================================================================
// 审批节点字段权限（仅对动态表单生效）
// ============================================================================

/** 流程中关联的动态表单列表 */
const chartDynamicForms = computed(() => chartForms.value.filter((f) => f.type === 'DYNAMIC'));

/** 当前审批节点选中要配置字段权限的动态表单 */
const selectedPermFormId = ref<number | null>(null);

/** 自动选中第一个动态表单 */
watch(chartDynamicForms, (forms) => {
  if (forms.length > 0 && !forms.some((f) => f.formId === selectedPermFormId.value)) {
    selectedPermFormId.value = forms[0].formId ?? null;
  }
  if (forms.length === 0) selectedPermFormId.value = null;
}, { immediate: true });

const boundFormFields = ref<FormFieldSchema[]>([]);
const boundFormFieldsLoading = ref(false);

/** 扁平化字段列表（排除容器类型，只取可填写字段） */
function flattenFields(fields: FormFieldSchema[]): FormFieldSchema[] {
  const result: FormFieldSchema[] = [];
  for (const field of fields) {
    if (['GROUP', 'TABS', 'GRID'].includes(field.fieldType)) {
      if (field.children) result.push(...flattenFields(field.children));
      if (field.tabs) field.tabs.forEach((tab) => result.push(...flattenFields(tab.children)));
      if (field.columns) field.columns.forEach((col) => result.push(...flattenFields(col.children)));
    } else {
      result.push(field);
    }
  }
  return result;
}

/** 当选中的权限配置表单变化时，加载对应 schema */
async function loadBoundFormFields(formId: number | null | undefined) {
  if (!formId) {
    boundFormFields.value = [];
    return;
  }
  boundFormFieldsLoading.value = true;
  try {
    const axiosRes = await getFormById(formId) as any;
    const view = axiosRes?.data?.data as SysFormView | undefined;
    if (view?.schema) {
      const parsed = JSON.parse(view.schema);
      boundFormFields.value = flattenFields(parsed.fields ?? []);
    } else {
      boundFormFields.value = [];
    }
  } catch (err) {
    console.error('[PropertyPanel] load form schema failed', err);
    boundFormFields.value = [];
  } finally {
    boundFormFieldsLoading.value = false;
  }
}

watch(selectedPermFormId, loadBoundFormFields, { immediate: true });

/** 当前审批节点的字段权限规则 */
const nodeFieldRules = computed<FieldRuleSpec[]>(
  () => (node.value?.properties?.fieldRules as FieldRuleSpec[]) ?? [],
);

/** 获取某字段的当前权限，默认 rw */
function getFieldRule(fieldKey: string): 'rw' | 'r' | 'hidden' {
  const found = nodeFieldRules.value.find((r) => r.field === fieldKey);
  return found?.rule ?? 'rw';
}

/** 修改某字段的权限 */
function setFieldRule(fieldKey: string, rule: 'rw' | 'r' | 'hidden') {
  const existing = [...nodeFieldRules.value];
  const index = existing.findIndex((r) => r.field === fieldKey);
  if (index >= 0) {
    existing[index] = { field: fieldKey, rule };
  } else {
    existing.push({ field: fieldKey, rule });
  }
  patchNodeProperty('fieldRules', existing);
}

// ============================================================================
// 边字段双向绑定
// ============================================================================
const edgeDsl = computed(() => props.selectedEdge?.data?.dsl ?? null);

const patchEdgeField = (patch: Partial<FlowEdgeDsl>) => {
  if (props.selectedEdge) emit('patch-edge', props.selectedEdge.id, patch);
};
</script>

<template>
  <aside class="flow-property-panel">
    <!-- ====================== 节点模式 ====================== -->
    <template v-if="mode === 'node' && node && nodeMeta">
      <header class="flow-property-panel__header">
        <ElTag :color="nodeMeta.color" effect="dark" round>{{ nodeMeta.label }}</ElTag>
        <span class="flow-property-panel__node-key">{{ node.key }}</span>
      </header>

      <ElAlert
        v-if="currentNodeErrors.length"
        type="error"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      >
        <template #title>该节点有 {{ currentNodeErrors.length }} 项校验错误</template>
        <ul class="flow-property-panel__error-list">
          <li v-for="(msg, i) in currentNodeErrors" :key="i">{{ msg }}</li>
        </ul>
      </ElAlert>

      <ElForm label-position="top" size="small">
        <ElFormItem label="节点名称" required>
          <ElInput
            :model-value="node.label ?? ''"
            placeholder="给节点起一个好记的名字"
            @update:model-value="(v: string) => patchNodeField({ label: v })"
          />
        </ElFormItem>

        <!-- APPROVE 专属：审批人 + 会签 -->
        <template v-if="node.kind === 'APPROVE'">
          <ElDivider content-position="left">审批人</ElDivider>
          <AssigneeConfig
            :strategy="assigneeStrategy"
            :args="assigneeArgs"
            @update:strategy="(v) => patchNodeProperty('assigneeStrategy', v)"
            @update:args="(v) => patchNodeProperty('assigneeArgs', v)"
          />
          <ElDivider content-position="left">会签设置</ElDivider>
          <MultiModeConfig
            :multi-mode="multiMode"
            :pass-rule="passRule"
            :pass-ratio="passRatio"
            @update:multi-mode="(v) => patchNodeProperty('multiMode', v)"
            @update:pass-rule="(v) => patchNodeProperty('passRule', v)"
            @update:pass-ratio="(v) => patchNodeProperty('passRatio', v)"
          />
          <ElDivider content-position="left">字段权限</ElDivider>
          <template v-if="chartDynamicForms.length === 0">
            <p class="flow-property-panel__hint">
              请先在「流程图属性」面板中关联动态表单，再配置字段权限。
            </p>
          </template>
          <template v-else>
            <!-- 多个动态表单时需选择要配置的表单 -->
            <ElFormItem v-if="chartDynamicForms.length > 1" label="选择表单">
              <ElSelect v-model="selectedPermFormId" size="small" style="width: 100%">
                <ElOption
                  v-for="form in chartDynamicForms"
                  :key="form.formId"
                  :label="form.name"
                  :value="form.formId"
                />
              </ElSelect>
            </ElFormItem>

            <template v-if="boundFormFieldsLoading">
              <p class="flow-property-panel__hint">加载字段列表中…</p>
            </template>
            <template v-else-if="boundFormFields.length === 0">
              <p class="flow-property-panel__hint">当前表单没有可配置的字段。</p>
            </template>
            <template v-else>
              <div
                v-for="field in boundFormFields"
                :key="field.fieldKey"
                class="flow-property-panel__field-rule"
              >
                <span class="flow-property-panel__field-label" :title="field.fieldKey">
                  {{ field.label || field.fieldKey }}
                </span>
                <ElRadioGroup
                  :model-value="getFieldRule(field.fieldKey)"
                  size="small"
                  @update:model-value="(v: string) => setFieldRule(field.fieldKey, v as 'rw' | 'r' | 'hidden')"
                >
                  <ElRadioButton value="rw">可编辑</ElRadioButton>
                  <ElRadioButton value="r">只读</ElRadioButton>
                  <ElRadioButton value="hidden">隐藏</ElRadioButton>
                </ElRadioGroup>
              </div>
            </template>
          </template>
        </template>

        <!-- NOTIFY 专属 -->
        <template v-else-if="node.kind === 'NOTIFY'">
          <ElDivider content-position="left">通知配置</ElDivider>
          <ElFormItem label="通知渠道">
            <ElInput
              :model-value="((node.properties?.channels as string[]) ?? []).join(',')"
              placeholder="STATION,EMAIL,SMS"
              @update:model-value="
                (v: string) =>
                  patchNodeProperty(
                    'channels',
                    v.split(',').map((s) => s.trim()).filter(Boolean),
                  )
              "
            />
          </ElFormItem>
        </template>

        <!-- SCRIPT 专属 -->
        <template v-else-if="node.kind === 'SCRIPT'">
          <ElDivider content-position="left">脚本配置</ElDivider>
          <ElFormItem label="处理 Bean 名称" required>
            <ElInput
              :model-value="(node.properties?.handlerName as string) ?? ''"
              placeholder="Spring Bean 名，例如 leaveAutoApprover"
              @update:model-value="(v: string) => patchNodeProperty('handlerName', v)"
            />
          </ElFormItem>
        </template>

        <!-- 其他节点（START/END/BRANCH/PARALLEL/JOINT）只展示说明 -->
        <template v-else>
          <ElDivider content-position="left">说明</ElDivider>
          <p class="flow-property-panel__hint">{{ nodeMeta.description }}</p>
        </template>
      </ElForm>
    </template>

    <!-- ====================== 边模式 ====================== -->
    <template v-else-if="mode === 'edge' && edgeDsl">
      <header class="flow-property-panel__header">
        <ElTag type="warning" effect="dark" round>连线</ElTag>
        <span class="flow-property-panel__node-key">
          {{ edgeDsl.from }} → {{ edgeDsl.to }}
        </span>
      </header>

      <ElAlert
        v-if="currentEdgeErrors.length"
        type="error"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      >
        <template #title>该连线有 {{ currentEdgeErrors.length }} 项校验错误</template>
        <ul class="flow-property-panel__error-list">
          <li v-for="(msg, i) in currentEdgeErrors" :key="i">{{ msg }}</li>
        </ul>
      </ElAlert>

      <ElForm label-position="top" size="small">
        <BranchConditionEditor
          :condition="edgeDsl.condition"
          :priority="edgeDsl.priority"
          :label="edgeDsl.label"
          @update:condition="(v) => patchEdgeField({ condition: v })"
          @update:priority="(v) => patchEdgeField({ priority: v })"
          @update:label="(v) => patchEdgeField({ label: v })"
        />
      </ElForm>
    </template>

    <!-- ====================== 空态：图元信息 ====================== -->
    <template v-else>
      <header class="flow-property-panel__header">
        <ElTag type="info" effect="plain" round>流程图属性</ElTag>
      </header>

      <ElForm label-position="top" size="small">
        <ElFormItem label="流程标识 (chartKey)" required>
          <ElInput
            :model-value="chartMeta.chartKey"
            placeholder="leave-approval"
            @update:model-value="(v: string) => emit('patch-chart-meta', { chartKey: v })"
          />
        </ElFormItem>
        <ElFormItem label="流程名称" required>
          <ElInput
            :model-value="chartMeta.chartName ?? ''"
            placeholder="请假审批"
            @update:model-value="(v: string) => emit('patch-chart-meta', { chartName: v })"
          />
        </ElFormItem>
        <ElFormItem label="分类">
          <ElInput
            :model-value="chartMeta.chartCategory ?? ''"
            placeholder="行政 / 财务 / 人事 ..."
            @update:model-value="(v: string) => emit('patch-chart-meta', { chartCategory: v })"
          />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput
            :model-value="chartMeta.description ?? ''"
            type="textarea"
            :rows="3"
            placeholder="简要描述流程用途"
            @update:model-value="(v: string) => emit('patch-chart-meta', { description: v })"
          />
        </ElFormItem>

        <ElDivider content-position="left">流程表单</ElDivider>
        <p class="flow-property-panel__hint" style="margin-bottom: 8px">
          发起流程时从下列表单中选择一个使用。
        </p>

        <!-- 已关联的表单列表 -->
        <div
          v-for="(form, index) in chartForms"
          :key="index"
          class="flow-property-panel__form-item"
        >
          <ElTag :type="form.type === 'DYNAMIC' ? 'success' : 'warning'" size="small" round>
            {{ form.type === 'DYNAMIC' ? '动态' : '自定义' }}
          </ElTag>
          <span class="flow-property-panel__form-name" :title="form.name">{{ form.name }}</span>
          <ElButton type="danger" text size="small" @click="removeForm(index)">删除</ElButton>
        </div>

        <!-- 添加表单 -->
        <ElDivider content-position="left" style="margin: 12px 0 8px">添加表单</ElDivider>
        <ElFormItem label="表单类型">
          <ElRadioGroup v-model="addFormType" size="small">
            <ElRadioButton value="DYNAMIC">动态表单</ElRadioButton>
            <ElRadioButton value="CUSTOM">自定义表单</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>

        <template v-if="addFormType === 'DYNAMIC'">
          <ElFormItem label="选择已有表单">
            <div style="display: flex; gap: 8px; width: 100%">
              <ElSelect
                v-model="addFormDynamicId"
                placeholder="请选择表单"
                clearable
                filterable
                :loading="dynamicFormListLoading"
                style="flex: 1"
              >
                <ElOption
                  v-for="form in dynamicFormList"
                  :key="form.formId"
                  :label="form.formName"
                  :value="form.formId"
                />
              </ElSelect>
              <ElButton type="primary" size="small" :disabled="!addFormDynamicId" @click="addForm">
                添加
              </ElButton>
            </div>
          </ElFormItem>
          <ElButton :icon="Plus" type="primary" plain size="small" style="width: 100%" @click="openFormDesigner">
            快速创建动态表单
          </ElButton>
        </template>

        <template v-else>
          <ElFormItem label="表单名称" required>
            <ElInput v-model="addFormCustomName" placeholder="如：出差申请单" />
          </ElFormItem>
          <ElFormItem label="表单查看路径" required>
            <ElInput v-model="addFormViewUrl" placeholder="如：/leave/detail" />
          </ElFormItem>
          <ElFormItem label="表单提交路径">
            <ElInput v-model="addFormSubmitUrl" placeholder="如：/leave/apply" />
          </ElFormItem>
          <ElButton
            type="primary"
            size="small"
            style="width: 100%"
            :disabled="!addFormCustomName.trim() || !addFormViewUrl.trim()"
            @click="addForm"
          >
            添加自定义表单
          </ElButton>
        </template>
      </ElForm>
    </template>
    <!-- 快速创建表单对话框 -->
    <FormDesignerDialog
      v-model:visible="formDesignerVisible"
      @saved="onFormDesignerSaved"
    />
  </aside>
</template>

<style lang="scss" scoped>
.flow-property-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color-light);
  padding: 16px 16px 24px;
  overflow-y: auto;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__node-key {
    font-family: var(--el-font-family-monospace, monospace);
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__hint {
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }

  &__error-list {
    margin: 4px 0 0 16px;
    padding: 0;
    font-size: 12px;
    line-height: 1.7;
  }

  &__field-rule {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--el-border-color-extra-light);

    &:last-child {
      border-bottom: none;
    }
  }

  &__field-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
    min-width: 0;
  }

  &__form-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 6px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
  }

  &__form-name {
    flex: 1;
    font-size: 13px;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
