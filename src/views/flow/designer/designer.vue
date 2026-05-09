<!--
  流程设计器主页面 —— 三栏布局 + 顶部工具栏（钉钉/飞书审批 经典布局）。

  这个组件本身是一个**纯协调器**，把所有真实工作都委托给：
    - useFlowGraph()       图模型 + 增删改方法
    - useFlowValidation()  保存前的兜底校验
    - useFlowLayout()      dagre 自动布局
    - useUndoRedo()        撤销重做栈
    - api/flow.ts          与后端通信

  自身只负责：
    1. 路由参数 → 拉取已有 chart → loadDsl 装载视图
    2. 子组件之间的事件转发（toolbar 的 save 按钮 → exportDsl + 后端调用）
    3. 全局对话框开关（JSON 预览 / 版本对比 / 模拟运行）
    4. 撤销栈的 push 时机（每次有效编辑后）

  设计上故意把所有「业务规则」（怎么校验、怎么生成 key、怎么换坐标）都
  推到 composable 层，主页面只剩 layout 与事件总线，这样后续做"流程模板
  另存为"、"批量导入 chart"等功能时，复用同样的 composable 即可。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElContainer, ElAside, ElMain, ElMessage, ElMessageBox } from 'element-plus';
import type { Connection, EdgeChange, NodeChange } from '@vue-flow/core';

import { useFlowGraph } from '@/composables/flow/use-flow-graph';
import { useFlowValidation } from '@/composables/flow/use-flow-validation';
import { useFlowLayout } from '@/composables/flow/use-flow-layout';
import { useUndoRedo } from '@/composables/flow/use-undo-redo';
import {
  getDefinition,
  saveDraft,
  publishDefinition,
  listVersions,
} from '@/api/flow';
import {
  PUBLISH_STATUS_CODE,
  type FlowChartDsl,
  type FlowDefinitionDraftCmd,
  type FlowDefinitionView,
  type FlowNodeKind,
  type ValidationReport,
} from '@/types/flow';

import DesignerToolbar from './components/DesignerToolbar.vue';
import NodePalette from './components/NodePalette.vue';
import FlowCanvas from './components/FlowCanvas.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import JsonPreviewDialog from './components/dialogs/JsonPreviewDialog.vue';

const { t } = useI18n();
import VersionCompareDialog from './components/dialogs/VersionCompareDialog.vue';
import SimulationDialog from './components/dialogs/SimulationDialog.vue';

const route = useRoute();
const router = useRouter();

// ============================================================================
// 业务状态
// ============================================================================

const graph = useFlowGraph();
const { validate } = useFlowValidation();
const { layout } = useFlowLayout();
const undoRedo = useUndoRedo();

const chartId = ref<number | null>(null);
const status = ref<'NEW' | 'DRAFT' | 'PUBLISHED'>('NEW');
const saving = ref(false);
const publishing = ref(false);

const validationReport = ref<ValidationReport | null>(null);

// 对话框
const jsonDialogVisible = ref(false);
const versionDialogVisible = ref(false);
const simulationDialogVisible = ref(false);

// 当前要预览/对比的 dsl 快照（每次打开对话框时刷新）
const previewDsl = ref<FlowChartDsl>({ chartKey: '', nodes: [], edges: [] });

// ============================================================================
// 加载 / 初始化
// ============================================================================

/**
 * 路由形如 /flow/designer/:chartId? —— chartId 可空，表示「新建」。
 * 新建时给一个最小骨架（START 节点 + 空白 chartKey），让设计师能立刻拖东西。
 */
async function bootstrap() {
  const idParam = route.params.chartId as string | undefined;
  if (idParam && idParam !== 'new') {
    chartId.value = Number(idParam);
    await loadFromBackend(chartId.value);
  } else {
    initBlankChart();
  }
  // 初始状态压栈一次，作为「最早的可恢复状态」
  undoRedo.push(graph.exportDsl());
}

async function loadFromBackend(id: number) {
  try {
    // axios 响应拦截器返回完整 response，需要 response.data 得到 R<T>，再 .data 得到业务对象
    const axiosRes = await getDefinition(id);
    const view = (axiosRes as any)?.data?.data as FlowDefinitionView | undefined;
    if (!view) {
      ElMessage.error(t('flow.designer.definitionNotFound'));
      router.replace('/flow/list');
      return;
    }
    const dsl = parseDsl(view.chartDsl ?? '', view.chartKey, view.chartName);
    graph.loadDsl(dsl);
    status.value =
      view.publishStatus === PUBLISH_STATUS_CODE.PUBLISHED ? 'PUBLISHED' : 'DRAFT';
    // 兜底：旧 chart 没有坐标 → 自动布局
    if (graph.nodes.value.some((n) => !n.position.x && !n.position.y)) {
      graph.nodes.value = layout(graph.nodes.value, graph.edges.value);
    }
  } catch (err) {
    console.error('[designer] load failed', err);
    ElMessage.error(t('flow.designer.loadDefinitionFailed'));
  }
}

function initBlankChart() {
  // 新建空白流程：干净画布，用户从节点面板自行拖入所需节点
  graph.loadDsl({
    chartKey: 'newFlow_' + Date.now().toString(36),
    chartName: t('flow.designer.unnamedProcess'),
    nodes: [],
    edges: [],
  });
  status.value = 'NEW';
}

/**
 * 后端 chartDsl 是 JSON 字符串；解析时容错 —— 老数据有可能是历史脏格式，
 * 解析失败就退化为空 chart 让设计师重画，不直接 throw 影响页面打开。
 */
function parseDsl(raw: string, fallbackKey: string, fallbackName?: string): FlowChartDsl {
  try {
    const obj = JSON.parse(raw ?? '');
    return {
      chartKey: obj.chartKey ?? fallbackKey,
      chartName: obj.chartName ?? fallbackName,
      chartCategory: obj.chartCategory,
      description: obj.description,
      forms: Array.isArray(obj.forms) ? obj.forms : [],
      nodes: Array.isArray(obj.nodes) ? obj.nodes : [],
      edges: Array.isArray(obj.edges) ? obj.edges : [],
    };
  } catch {
    return { chartKey: fallbackKey, chartName: fallbackName, nodes: [], edges: [] };
  }
}

onMounted(bootstrap);

// ============================================================================
// 撤销栈策略：watchEffect 太频繁；这里用「每次显式编辑后调 commit()」
// ============================================================================

/**
 * 编辑完成后调一次。设计上**不**用 deep watch，因为 deep watch 会
 * 在「拖动节点的连续位置变化」里产生几十个快照，把撤销栈污染。
 */
function commit() {
  undoRedo.push(graph.exportDsl());
}

// ============================================================================
// Toolbar 事件处理
// ============================================================================

function onUndo() {
  const prev = undoRedo.undo();
  if (prev) graph.loadDsl(prev);
}

function onRedo() {
  const next = undoRedo.redo();
  if (next) graph.loadDsl(next);
}

function onAutoLayout() {
  graph.nodes.value = layout(graph.nodes.value, graph.edges.value);
  commit();
  ElMessage.success(t('flow.designer.layoutSuccess'));
}

function onValidate(): boolean {
  const dsl = graph.exportDsl();
  const report = validate(dsl, graph.nodes.value, graph.edges.value);
  validationReport.value = report;
  if (report.passed) {
    ElMessage.success(t('flow.common.validationPassed'));
    return true;
  }
  const errCount =
    report.globalErrors.length +
    Object.values(report.nodeErrors).reduce((s, arr) => s + arr.length, 0) +
    Object.values(report.edgeErrors).reduce((s, arr) => s + arr.length, 0);
  ElMessage.warning(t('flow.designer.validationFailed', { count: errCount }));
  return false;
}

function onPreviewJson() {
  previewDsl.value = graph.exportDsl();
  jsonDialogVisible.value = true;
}

function onSimulate() {
  previewDsl.value = graph.exportDsl();
  simulationDialogVisible.value = true;
}

async function onCompareVersions() {
  if (!chartId.value) {
    ElMessage.info('未保存的流程没有版本可对比');
    return;
  }
  await ensureVersionList();
  if (versionList.value.length === 0) {
    ElMessage.info('当前流程暂无可对比的历史版本');
    return;
  }
  versionDialogVisible.value = true;
}

async function onSave() {
  // 保存允许在校验未通过时进行（草稿就是允许半成品），但要给出警告
  if (!graph.chartMeta.value.chartKey?.trim() || !graph.chartMeta.value.chartName?.trim()) {
    ElMessage.error(t('flow.designer.fillKeyAndName'));
    return;
  }
  saving.value = true;
  try {
    const dsl = graph.exportDsl();
    const cmd: FlowDefinitionDraftCmd = {
      chartId: chartId.value,
      chartKey: dsl.chartKey,
      chartName: dsl.chartName ?? t('flow.designer.unnamedProcess'),
      chartCategory: dsl.chartCategory,
      chartDsl: JSON.stringify(dsl),
      description: dsl.description,
    };
    const newId = (await saveDraft(cmd)) as unknown as number;
    if (!chartId.value && typeof newId === 'number') {
      chartId.value = newId;
      // 更新地址栏，避免「保存后刷新页面变成新建」
      router.replace(`/flow/designer/${newId}`);
    }
    status.value = 'DRAFT';
    ElMessage.success(t('flow.designer.draftSaved'));
  } catch (err) {
    console.error('[designer] save failed', err);
    ElMessage.error(t('flow.designer.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function onPublish() {
  if (!onValidate()) {
    ElMessage.warning(t('flow.designer.validationFailedCannotPublish'));
    return;
  }
  if (!chartId.value) {
    // 发布前必须先保存草稿，确保后端有持久化记录
    await onSave();
    if (!chartId.value) return;
  }
  try {
    await ElMessageBox.confirm(
      t('flow.designer.publishConfirmMessage'),
      t('flow.designer.publishConfirmTitle'),
      { type: 'warning' },
    );
  } catch {
    return; // 用户取消
  }
  publishing.value = true;
  try {
    await publishDefinition(chartId.value!);
    status.value = 'PUBLISHED';
    ElMessage.success(t('flow.designer.publishSuccess'));
  } catch (err) {
    console.error('[designer] publish failed', err);
    ElMessage.error(t('flow.designer.publishFailed'));
  } finally {
    publishing.value = false;
  }
}

function onBack() {
  router.push('/flow/list');
}

// ============================================================================
// 画布事件
//
// VueFlow 把所有 node/edge 变更（拖动/选中/移除...）都收敛到 nodes-change /
// edges-change 两个事件，change 数组里每项有自己的 type。我们这里只关心
// 「remove」（其他 type 由 VueFlow 内部已经直接 mutate 我们的 nodes/edges
// ref，不需要额外处理）。
// ============================================================================

/**
 * 把 vue-flow store 里所有节点的最新 position 同步回 graph.nodes ref。
 *
 * 为什么需要？vue-flow 拖动改的是内部 store 副本，不会反向同步到我们的
 * nodes ref。当 addNode push 新节点后，Vue 的 ref() 触发 vue-flow watcher
 * → vue-flow 用 ref 里的 position（可能是旧值）重新同步内部 store → 已有
 * 节点被覆盖回旧位置。
 *
 * 这个方法在 addNode 之前调用，确保 ref 里是最新值。
 */
function onSyncPositions(positions: Array<{ id: string; x: number; y: number }>) {
  for (const { id, x, y } of positions) {
    const target = graph.nodes.value.find((n) => n.id === id);
    if (target) {
      target.position = { x, y };
    }
  }
}

function onCanvasAddNode(kind: FlowNodeKind, position: { x: number; y: number }) {
  graph.addNode(kind, position);
  commit();
}

/** 双击边 → 弹出输入框让用户编辑边的文本描述 */
async function onEdgeDoubleClick(edgeId: string) {
  const edge = graph.edges.value.find((e) => e.id === edgeId);
  if (!edge) return;
  const currentLabel = (edge.data?.dsl?.label as string) ?? '';
  try {
    const { value } = await ElMessageBox.prompt(t('flow.designer.editConnectionPrompt'), t('flow.designer.editConnectionTitle'), {
      inputValue: currentLabel,
      confirmButtonText: t('flow.common.actions'),
      cancelButtonText: t('flow.common.cancel'),
      inputPlaceholder: t('flow.designer.editConnectionPlaceholder'),
    });
    graph.patchEdge(edgeId, { label: value || '' });
    // 强制触发 edges ref 的整体替换，让 vue-flow 重新同步内部 store。
    // 和 nodes 一样的问题：vue-flow 把 edges ref 拷贝到内部 store，
    // patchEdge 修改的是 ref 内部对象的属性，vue-flow 不感知。
    graph.edges.value = [...graph.edges.value];
    commit();
  } catch {
    // 用户点了取消，不做任何处理
  }
}

function onCanvasConnect(conn: Connection) {
  if (!conn.source || !conn.target) return;

  let { source, target, sourceHandle, targetHandle } = conn;

  // Vue Flow 允许从 target Handle 反向拖线，此时 source/target 会反转。
  // 根据 handle ID 前缀检测并修正方向：source-* 是出口，target-* 是入口。
  const sourceIsActuallyTarget = sourceHandle?.startsWith('target-');
  const targetIsActuallySource = targetHandle?.startsWith('source-');

  if (sourceIsActuallyTarget || targetIsActuallySource) {
    [source, target] = [target, source];
    [sourceHandle, targetHandle] = [targetHandle, sourceHandle];
  }

  graph.addEdge(source, target, sourceHandle, targetHandle);
  commit();
}

/**
 * VueFlow 节点变更分发。需要处理三类 type：
 *
 * 1. 'remove'（按 Delete / 右键删节点）→ 从 nodes ref 里删除 + 同步删边
 *
 * 2. 'position'（拖动节点松手时）→ ⚠️ 关键：必须把新坐标同步回 nodes ref。
 *    之前的版本写错了，注释说"VueFlow 内部直接更新 ref，不需要走 useFlowGraph"，
 *    实际上 VueFlow 接收 `:nodes` props 后会拷贝到自己的内部 store，
 *    拖动改的是 store 副本，不会反向同步到我们的 ref。
 *    这就导致 bug：用户拖动「结束」节点到下方 → 视觉上看到位置变了 → 但下次
 *    任何操作（拖入新节点等）触发 props.nodes 响应式 → VueFlow 用旧 props
 *    重新渲染 → 「结束」节点跳回原位。
 *    修复：监听 dragging=false（拖动松手）的 position 事件，写回 nodes ref。
 *    用 dragging 过滤是因为拖动过程中每帧都会触发 position 事件，只在
 *    松手时同步可以避免高频写入。
 *
 * 3. 'dimensions' / 'select' → 不需要处理，对 DSL 状态没影响。
 *
 * commit 策略：
 *   - remove 必须 commit（结构变化）
 *   - position 也要 commit（位置是 DSL 的一部分，要进撤销栈），但只在拖动
 *     松手时 commit 一次，拖动过程中不 commit 避免污染撤销栈。
 */
function onCanvasNodesChange(changes: NodeChange[]) {
  let needCommit = false;
  for (const c of changes) {
    if (c.type === 'remove') {
      graph.removeNode(c.id);
      needCommit = true;
    } else if (c.type === 'position' && c.position && c.dragging === false) {
      // 拖动松手：把 VueFlow 内部的新坐标同步回 useFlowGraph 的 nodes ref
      const target = graph.nodes.value.find((n) => n.id === c.id);
      if (target) {
        target.position = { x: c.position.x, y: c.position.y };
        needCommit = true;
      }
    }
  }
  if (needCommit) commit();
}

function onCanvasEdgesChange(changes: EdgeChange[]) {
  let needCommit = false;
  for (const c of changes) {
    if (c.type === 'remove') {
      graph.removeEdge(c.id);
      needCommit = true;
    }
  }
  if (needCommit) commit();
}

// ============================================================================
// 属性面板事件 —— 改属性也算编辑，需 commit
// ============================================================================

/**
 * PropertyPanel emit 签名是 ('patch-node', nodeId, patch) —— 两个参数。
 * 这里直接接收 nodeId + patch，用 PropertyPanel 传来的 nodeId 而不是
 * graph.selectedNodeId，确保参数对齐。
 */
function onPatchSelectedNode(nodeId: string, patch: Parameters<typeof graph.patchNode>[1]) {
  graph.patchNode(nodeId, patch);
  // 强制触发 nodes ref 整体替换，让 selectedNode computed 重新计算。
  // patchNode 修改的是数组内部对象的深层属性，computed 不感知。
  graph.nodes.value = [...graph.nodes.value];
  commit();
}

/**
 * PropertyPanel emit 签名是 ('patch-edge', edgeId, patch) —— 两个参数。
 */
function onPatchSelectedEdge(edgeId: string, patch: Parameters<typeof graph.patchEdge>[1]) {
  graph.patchEdge(edgeId, patch);
  graph.edges.value = [...graph.edges.value];
  commit();
}

function onPatchChartMeta(patch: Partial<typeof graph.chartMeta.value>) {
  graph.chartMeta.value = { ...graph.chartMeta.value, ...patch };
  commit();
}

// 节点级错误：把校验报告下发给画布做红角标
const nodeErrorMap = computed(() => validationReport.value?.nodeErrors ?? {});
const edgeErrorMap = computed(() => validationReport.value?.edgeErrors ?? {});

// 校验报告每次变化时同步挂到节点 data 上，画布可以渲染角标
watch(validationReport, (report) => {
  if (!report) return;
  for (const node of graph.nodes.value) {
    if (node.data) node.data.validationErrors = report.nodeErrors[node.id];
  }
  for (const edge of graph.edges.value) {
    if (edge.data) edge.data.validationErrors = report.edgeErrors[edge.id];
  }
});

const chartName = computed(() => graph.chartMeta.value.chartName ?? '');

function onChartNameChange(name: string) {
  graph.chartMeta.value = { ...graph.chartMeta.value, chartName: name };
  commit();
}

// ============================================================================
// 版本对比对话框需要的版本列表 —— listVersions 是按 chartKey 查的，
// 父组件在打开对话框前一次性加载好整个数组传给子组件。
// ============================================================================

const versionList = ref<FlowDefinitionView[]>([]);
const versionLoading = ref(false);

async function ensureVersionList() {
  const key = graph.chartMeta.value.chartKey;
  if (!key?.trim()) {
    versionList.value = [];
    return;
  }
  versionLoading.value = true;
  try {
    versionList.value = (await listVersions(key)) as unknown as FlowDefinitionView[];
  } catch (err) {
    console.error('[designer] load versions failed', err);
    versionList.value = [];
    ElMessage.error('加载版本列表失败');
  } finally {
    versionLoading.value = false;
  }
}
</script>

<template>
  <ElContainer class="designer">
    <DesignerToolbar
      :chart-name="chartName"
      :status="status"
      :can-undo="undoRedo.canUndo.value"
      :can-redo="undoRedo.canRedo.value"
      :saving="saving"
      :publishing="publishing"
      @back="onBack"
      @undo="onUndo"
      @redo="onRedo"
      @auto-layout="onAutoLayout"
      @validate="onValidate"
      @preview-json="onPreviewJson"
      @simulate="onSimulate"
      @compare-versions="onCompareVersions"
      @save="onSave"
      @publish="onPublish"
      @update:chart-name="onChartNameChange"
    />

    <ElContainer class="designer__body">
      <ElAside class="designer__aside designer__aside--left" width="240px">
        <NodePalette />
      </ElAside>

      <ElMain class="designer__canvas">
        <FlowCanvas
          vueflow-id="smart-flow-designer"
          :nodes="graph.nodes.value"
          :edges="graph.edges.value"
          @add-node="onCanvasAddNode"
          @sync-positions="onSyncPositions"
          @edge-double-click="onEdgeDoubleClick"
          @connect="onCanvasConnect"
          @nodes-change="onCanvasNodesChange"
          @edges-change="onCanvasEdgesChange"
          @select-node="(id: string | null) => (graph.selectedNodeId.value = id)"
          @select-edge="(id: string | null) => (graph.selectedEdgeId.value = id)"
          @pane-click="() => { graph.selectedNodeId.value = null; graph.selectedEdgeId.value = null; }"
        />
      </ElMain>

      <ElAside class="designer__aside designer__aside--right" width="340px">
        <PropertyPanel
          :chart-meta="graph.chartMeta.value"
          :selected-node="graph.selectedNode.value"
          :selected-edge="graph.selectedEdge.value"
          :node-errors="nodeErrorMap"
          :edge-errors="edgeErrorMap"
          @patch-node="onPatchSelectedNode"
          @patch-edge="onPatchSelectedEdge"
          @patch-chart-meta="onPatchChartMeta"
        />
      </ElAside>
    </ElContainer>

    <!-- 全局对话框 -->
    <JsonPreviewDialog
      v-model:visible="jsonDialogVisible"
      :dsl="previewDsl"
    />
    <VersionCompareDialog
      :model-value="versionDialogVisible"
      :versions="versionList"
      @update:model-value="(v: boolean) => (versionDialogVisible = v)"
    />
    <SimulationDialog
      v-model:visible="simulationDialogVisible"
      :dsl="previewDsl"
    />
  </ElContainer>
</template>

<style lang="scss" scoped>
.designer {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);

  &__body {
    flex: 1;
    overflow: hidden;
  }

  &__aside {
    background: var(--el-bg-color);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    &--left {
      border-right: 1px solid var(--el-border-color-light);
    }
    &--right {
      border-left: 1px solid var(--el-border-color-light);
    }
  }

  &__canvas {
    padding: 0;
    overflow: hidden;
    background: var(--el-fill-color-lighter);
  }
}
</style>
