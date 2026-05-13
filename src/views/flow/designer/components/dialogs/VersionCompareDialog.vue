<!--
  多版本对比对话框：左右两列分别选一个版本，下方展示两侧 DSL 的字段级差异。

  为什么自己实现 diff 而不接入 monaco-diff？
    - 整张 chart 通常 < 30 个节点，「按节点 key 求差集」的语义对设计师
      更直观（"3 个节点新增 / 1 个节点修改 / 1 个节点删除"），比逐行
      文本 diff 更易读；
    - 不引 monaco 可以省 ~3MB bundle。

  对比维度：
    - 节点：新增/删除/修改（label/properties 任一不同视为修改）
    - 边：新增/删除（边的字段少，不区分修改）
    - chart 元信息：name/category/description 任一不同
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElDialog, ElSelect, ElOption, ElTag, ElEmpty, ElTabs, ElTabPane } from 'element-plus';
import type { FlowChartDsl, FlowDefinitionView, FlowNodeDsl } from '@/types/flow';

interface Props {
  modelValue: boolean;
  versions: FlowDefinitionView[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const leftVersionId = ref<number | null>(null);
const rightVersionId = ref<number | null>(null);

// 默认选中「最近 2 个版本」用于对比 —— 这是最常见的「比一下我刚改了啥」场景
watch(
  () => props.versions,
  (vs) => {
    if (vs.length >= 2) {
      leftVersionId.value = vs[1].chartId;
      rightVersionId.value = vs[0].chartId;
    } else if (vs.length === 1) {
      leftVersionId.value = vs[0].chartId;
      rightVersionId.value = vs[0].chartId;
    }
  },
  { immediate: true },
);

const leftDsl = computed<FlowChartDsl | null>(() => parseDsl(leftVersionId.value));
const rightDsl = computed<FlowChartDsl | null>(() => parseDsl(rightVersionId.value));

function parseDsl(id: number | null): FlowChartDsl | null {
  if (id == null) return null;
  const v = props.versions.find((x) => x.chartId === id);
  if (!v?.chartDsl) return null;
  try {
    return JSON.parse(v.chartDsl) as FlowChartDsl;
  } catch {
    return null;
  }
}

interface DiffItem {
  key: string;
  type: 'added' | 'removed' | 'modified';
  label?: string;
  detail?: string;
}

const nodeDiffs = computed<DiffItem[]>(() => {
  if (!leftDsl.value || !rightDsl.value) return [];
  const left = new Map(leftDsl.value.nodes.map((n) => [n.key, n]));
  const right = new Map(rightDsl.value.nodes.map((n) => [n.key, n]));
  const out: DiffItem[] = [];
  for (const [key, node] of right) {
    if (!left.has(key)) {
      out.push({ key, type: 'added', label: node.label });
    } else if (!isNodeEqual(left.get(key)!, node)) {
      out.push({ key, type: 'modified', label: node.label, detail: nodeDiffDetail(left.get(key)!, node) });
    }
  }
  for (const [key, node] of left) {
    if (!right.has(key)) {
      out.push({ key, type: 'removed', label: node.label });
    }
  }
  return out;
});

const edgeDiffs = computed<DiffItem[]>(() => {
  if (!leftDsl.value || !rightDsl.value) return [];
  const keyOf = (e: { from: string; to: string }) => `${e.from} → ${e.to}`;
  const left = new Set(leftDsl.value.edges.map(keyOf));
  const right = new Set(rightDsl.value.edges.map(keyOf));
  const out: DiffItem[] = [];
  for (const k of right) if (!left.has(k)) out.push({ key: k, type: 'added' });
  for (const k of left) if (!right.has(k)) out.push({ key: k, type: 'removed' });
  return out;
});

const metaDiffs = computed<DiffItem[]>(() => {
  if (!leftDsl.value || !rightDsl.value) return [];
  const keys: (keyof FlowChartDsl)[] = ['chartName', 'chartCategory', 'description'];
  const out: DiffItem[] = [];
  for (const k of keys) {
    if (leftDsl.value[k] !== rightDsl.value[k]) {
      out.push({
        key: String(k),
        type: 'modified',
        detail: `${leftDsl.value[k] ?? '(空)'} → ${rightDsl.value[k] ?? '(空)'}`,
      });
    }
  }
  return out;
});

function isNodeEqual(a: FlowNodeDsl, b: FlowNodeDsl): boolean {
  if (a.label !== b.label) return false;
  if (JSON.stringify(a.properties ?? {}) !== JSON.stringify(b.properties ?? {})) return false;
  return true;
}

function nodeDiffDetail(a: FlowNodeDsl, b: FlowNodeDsl): string {
  const parts: string[] = [];
  if (a.label !== b.label) parts.push(`名称: ${a.label} → ${b.label}`);
  if (JSON.stringify(a.properties) !== JSON.stringify(b.properties)) parts.push('属性已变更');
  return parts.join('; ');
}

const tagType = (type: DiffItem['type']) =>
  ({ added: 'success', removed: 'danger', modified: 'warning' } as const)[type];

const tagText = (type: DiffItem['type']) =>
  ({ added: '新增', removed: '删除', modified: '修改' })[type];
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    title="版本对比"
    width="820px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="version-compare__select">
      <div class="version-compare__select-col">
        <span class="version-compare__select-label">基准版本</span>
        <ElSelect v-model="leftVersionId" size="small" style="width: 100%">
          <ElOption
            v-for="v in versions"
            :key="v.chartId"
            :value="v.chartId"
            :label="`v${v.chartVersion} · ${(v as any).status}`"
          />
        </ElSelect>
      </div>
      <div class="version-compare__select-col">
        <span class="version-compare__select-label">对比版本</span>
        <ElSelect v-model="rightVersionId" size="small" style="width: 100%">
          <ElOption
            v-for="v in versions"
            :key="v.chartId"
            :value="v.chartId"
            :label="`v${v.chartVersion} · ${(v as any).status}`"
          />
        </ElSelect>
      </div>
    </div>

    <ElTabs class="version-compare__tabs">
      <ElTabPane :label="`节点变更 (${nodeDiffs.length})`">
        <ElEmpty v-if="nodeDiffs.length === 0" description="节点无变更" />
        <ul v-else class="version-compare__list">
          <li v-for="item in nodeDiffs" :key="item.key">
            <ElTag :type="tagType(item.type)" size="small">{{ tagText(item.type) }}</ElTag>
            <span class="version-compare__list-key">{{ item.key }}</span>
            <span v-if="item.label">（{{ item.label }}）</span>
            <span v-if="item.detail" class="version-compare__list-detail">{{ item.detail }}</span>
          </li>
        </ul>
      </ElTabPane>
      <ElTabPane :label="`连线变更 (${edgeDiffs.length})`">
        <ElEmpty v-if="edgeDiffs.length === 0" description="连线无变更" />
        <ul v-else class="version-compare__list">
          <li v-for="item in edgeDiffs" :key="item.key">
            <ElTag :type="tagType(item.type)" size="small">{{ tagText(item.type) }}</ElTag>
            <span class="version-compare__list-key">{{ item.key }}</span>
          </li>
        </ul>
      </ElTabPane>
      <ElTabPane :label="`元信息变更 (${metaDiffs.length})`">
        <ElEmpty v-if="metaDiffs.length === 0" description="元信息无变更" />
        <ul v-else class="version-compare__list">
          <li v-for="item in metaDiffs" :key="item.key">
            <ElTag :type="tagType(item.type)" size="small">{{ tagText(item.type) }}</ElTag>
            <span class="version-compare__list-key">{{ item.key }}</span>
            <span class="version-compare__list-detail">{{ item.detail }}</span>
          </li>
        </ul>
      </ElTabPane>
    </ElTabs>
  </ElDialog>
</template>

<style lang="scss" scoped>
.version-compare {
  &__select {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__select-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__select-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 360px;
    overflow-y: auto;

    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--el-border-color-lighter);
      font-size: 13px;
    }
  }

  &__list-key {
    font-family: var(--el-font-family-monospace, monospace);
    color: var(--el-text-color-primary);
  }

  &__list-detail {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__tabs {
    margin-top: 12px;
  }
}
</style>
