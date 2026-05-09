<!--
  画布主组件 —— VueFlow 的薄包装。

  职责边界：
    - 这里只管「视觉渲染 + 交互事件接入」，不持有任何业务状态；
    - 所有状态（nodes/edges/selectedXxx）来自父组件透传的 useFlowGraph()
      实例，画布只是它的「视图层」；
    - 拖拽放置 / 连线 / 选中切换 这类事件统一调 useFlowGraph 的方法，
      避免组件直接 mutate ref 导致状态分裂。

  和「直接在 designer.vue 里塞 VueFlow」相比多一层包装的好处：
    1. 画布的 minimap/controls/background 配置集中在一个文件里，
       后期想换样式不用动主页面；
    2. 拖放逻辑（dragover/drop）有点繁琐，单独抽一个组件更清爽；
    3. 将来要做「只读预览模式」（流程详情页里看历史轨迹）只需复用本组件
       并传 readonly=true。
-->
<script setup lang="ts">
import { ref } from 'vue';
import {
  VueFlow,
  useVueFlow,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodePositionChange,
  type XYPosition,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { MiniMap } from '@vue-flow/minimap';
import { Controls } from '@vue-flow/controls';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { SMART_FLOW_NODE_TYPES } from './nodes';
import type { FlowNodeKind } from '@/types/flow';
import type {
  DesignerEdge,
  DesignerNode,
} from '@/composables/flow/use-flow-graph';
import {
  computeHelperLines,
  getNodeMeasuredSize,
  getOtherNodes,
} from '@/composables/flow/use-helper-lines';

interface Props {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  /**
   * 设计器页面唯一的 vueflow 实例 id。父组件必须传入并且保持稳定 ——
   * 这是 useVueFlow(id) 拿到正确 store 的唯一办法。命名上用 chartKey
   * 或固定字符串都行，不要拼时间戳那种会变的值。
   */
  vueflowId: string;
  /** 只读模式（流程详情页/版本对比对话框里复用本组件） */
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
});

const emit = defineEmits<{
  (e: 'add-node', kind: FlowNodeKind, position: XYPosition): void;
  (e: 'connect', connection: Connection): void;
  (e: 'nodes-change', changes: NodeChange[]): void;
  (e: 'edges-change', changes: EdgeChange[]): void;
  (e: 'select-node', id: string | null): void;
  (e: 'select-edge', id: string | null): void;
  (e: 'pane-click'): void;
  (e: 'edge-double-click', edgeId: string): void;
  /** 把 vue-flow store 里所有节点的最新 position 同步回 graph.nodes ref */
  (e: 'sync-positions', positions: Array<{ id: string; x: number; y: number }>): void;
}>();

/**
 * 通过显式 id 拿到对应的 VueFlow store —— 这种方式即使 setup 阶段
 * <VueFlow> 还没挂载也安全：useVueFlow(id) 会先创建 placeholder store，
 * 等 <VueFlow :id="id"> 真正 mount 时自动替换内部状态。
 *
 * 之前曾经写过「不传 id 直接 useVueFlow()」的版本，问题是：
 *   - 不传 id 时 composable 会找最近的 NodeIdInjection，画布根组件根本
 *     没有这个 inject，结果取到一个「孤儿 store」，screenToFlowCoordinate
 *     永远返回 (0,0)；
 *   - 拖放后所有节点叠在画布左上角，体验完全不可用。
 */
// fitView：VueFlow 命令式方法，把所有节点居中 + 缩放到刚好装下视口。
// 只在首帧 ready 时调一次，避免用 :fit-view-on-init prop ——
// 那个 prop 在 vue-flow 1.x 里会在 nodes 数组从 0 → N 时再次触发，
// 用户拖入新节点的瞬间视口会被 zoom + pan 重算，造成「已有节点位置乱跳」
// 的视觉错觉。改用 onPaneReady 一次性回调最稳。
//
// getNodes：vue-flow 内部 store 里带 dimensions（真实测量尺寸）的节点数组。
//   props.nodes 是父组件传入的「逻辑节点」，dimensions 字段不一定同步；
//   helper-lines 算法依赖真实尺寸算节点中心点，必须用 vue-flow 内部 store 里的版本。
// findNode：根据 id 查带 dimensions 的 GraphNode，给被拖动节点用。
// viewport：Ref<ViewportTransform> —— 当前画布的 zoom + pan，**响应式**。
//   关键：vue-flow 的 <VueFlow> 默认 slot **不在** transformationpane 内
//   （已通过源码 vue-flow-core.mjs:9923 验证），所以辅助线必须自己做坐标转换：
//     screen_x = internal_x * zoom + viewport.x
//     screen_y = internal_y * zoom + viewport.y
//   而且必须放在 <VueFlow> 容器**外面**（即 .flow-canvas 内部），否则 slot 内
//   位置定位行为不可预测（slot 渲染顺序与 Background/Controls 等混在一起）。
const { screenToFlowCoordinate, fitView, onPaneReady, getNodes, findNode, viewport } = useVueFlow(
  props.vueflowId,
);

onPaneReady(() => {
  // padding 0.2 给视口四周 20% 留白，比默认 0.1 更不挤
  fitView({ padding: 0.2, duration: 0 });
});

// ============================================================================
// 对齐辅助线 state —— 拖动节点时实时计算 + 渲染穿过节点中心的蓝色虚线
//
// 设计要点（针对流程图的简化版，不照搬 figma）：
//   1. 只做「中心对齐」：流程图节点宽度不一（START 圆形 vs APPROVE 矩形），
//      左/右/上/下边对齐毫无视觉价值；只看「节点中心点」对齐对用户最直观。
//   2. **手动做 viewport 转换**：vue-flow 默认 slot 不在 transformationpane 内
//      （已通过源码 vue-flow-core.mjs:9923 验证），所以辅助线必须自己算
//      `screen = internal * zoom + viewport`，且渲染在 <VueFlow> 容器外面。
//   3. **覆盖两个场景**：
//      - 画布内拖动现有节点 → onNodesChange 处理
//      - 从左侧 palette 拖入新节点 → onDragOver 处理（HTML5 drag 事件）
//   4. **三个清空点**确保辅助线松手时一定消失：
//      - onNodeDragStop（vue-flow 拖动结束钩子，最可靠）
//      - onDrop（外部拖入完成）
//      - onDragLeave（外部拖动离开画布）
//      不能依赖 NodeChange.dragging===false —— 该字段类型是 `boolean | undefined`，
//      vue-flow 在某些场景（如 ESC 取消拖动）不会发该事件。
// ============================================================================
const helperLineVertical = ref<number | null>(null);
const helperLineHorizontal = ref<number | null>(null);

/**
 * 记住拖动中 snap 过的节点 ID → snap 后的位置。
 *
 * 解决的矛盾：
 *   - 拖动中（dragging=true）需要实时 snap + 显示辅助线 ✓
 *   - 松手时（dragging=false）vue-flow 发的 position 是"鼠标原始位置"（未 snap），
 *     如果直接用就会"跳回"原位 ✗
 *   - 但如果对 dragging=false 也重新跑 snap 算法，会影响其他节点（addNode 后
 *     vue-flow 可能对所有节点发 position change，全部被 snap 就乱了） ✗
 *
 * 方案：dragging=true 时把 snap 结果存到这个 Map；dragging=false 时直接读 Map
 * 还原 snap 位置，**不重新算**，也不影响其他节点。
 */
const lastSnapPositions = new Map<string, XYPosition>();

/** 清空辅助线（松手 / 离开画布 / drop 完成时调用） */
function clearHelperLines() {
  helperLineVertical.value = null;
  helperLineHorizontal.value = null;
  lastSnapPositions.clear();
}

/**
 * 场景 A：画布内拖动现有节点的对齐吸附 + 辅助线计算。
 *
 * **严格只处理 dragging=true 的 position change**（用户正在拖的节点）：
 *   1. snap + 显示辅助线
 *   2. 把 snap 位置存入 lastSnapPositions
 *
 * **dragging=false 的最后一帧**（松手时 vue-flow 发的那一帧）：
 *   - 不重新跑 snap 算法（避免影响其他节点）
 *   - 从 lastSnapPositions 读回之前存的 snap 位置，覆盖到 change.position
 *   - 这样 designer.vue 拿到的就是 snap 后的最终位置
 *
 * **dragging=undefined 的 position change**（非拖动场景，比如 addNode 后重算）：
 *   - 完全跳过，不做任何处理
 */
function applyHelperLines(changes: NodeChange[]) {
  for (const change of changes) {
    if (change.type !== 'position' || !change.position) continue;
    const positionChange = change as NodePositionChange;

    if (positionChange.dragging === true) {
      // ---- 拖动中：实时 snap ----
      const draggingNode = findNode(positionChange.id);
      if (!draggingNode) continue;
      const draggingSize = getNodeMeasuredSize(draggingNode);
      const otherNodes = getOtherNodes(getNodes.value, positionChange.id);

      const result = computeHelperLines(
        positionChange.position,
        draggingSize,
        otherNodes,
      );

      positionChange.position = result.snapPosition;
      helperLineVertical.value = result.vertical;
      helperLineHorizontal.value = result.horizontal;

      // 记住 snap 位置 → 松手帧直接用
      lastSnapPositions.set(positionChange.id, { ...result.snapPosition });
    } else if (positionChange.dragging === false) {
      // ---- 松手帧：确保 position 被正确填充 ----
      // vue-flow 松手帧的 position 可能是 undefined（已通过 debug 日志验证），
      // 这会导致 designer.vue 的 `c.position && c.dragging === false` 条件
      // 不满足 → 位置不被同步回 graph.nodes ref → 后续 addNode 时 vue-flow
      // 重新同步 nodes prop 用旧值覆盖 → 已有节点位置被重置。
      //
      // 修复策略（优先级从高到低）：
      //   1. lastSnapPositions 有记忆 → 用 snap 后的精确位置
      //   2. findNode 从 vue-flow store 取当前真实位置
      //   3. 都没有 → 保持 undefined（原样，不做额外处理）
      const remembered = lastSnapPositions.get(positionChange.id);
      if (remembered) {
        positionChange.position = { ...remembered };
      } else {
        // 没有 snap 记忆（比如用户拖了一下但没触发对齐），
        // 从 vue-flow store 取当前真实位置，确保 designer.vue 能同步回去
        const storeNode = findNode(positionChange.id);
        if (storeNode) {
          positionChange.position = { x: storeNode.position.x, y: storeNode.position.y };
        }
      }
    }
    // dragging=undefined → 完全跳过（非拖动场景，不能 snap）
  }
}

/**
 * vue-flow 的 nodes-change 事件入口：先 snap 再 emit。
 * 顺序很关键 —— 父组件拿到的 change.position 必须已经是吸附后的最终值。
 */
function onNodesChange(changes: NodeChange[]) {
  applyHelperLines(changes);
  emit('nodes-change', changes);
}

// ============================================================================
// 节点尺寸映射：不同 kind 渲染出来的实际 CSS 尺寸差异很大
//
//   - circle（START/END/BRANCH/PARALLEL/JOINT）：CSS width:80px, height:80px
//   - rect（APPROVE/NOTIFY/SCRIPT）：CSS min-width:160px, 实测约 180×48
//
// 为什么要在这里维护这张表？
//   从 palette 拖入新节点时节点**还没渲染**，vue-flow store 里没有 dimensions。
//   如果用一个固定的 180px 估算所有节点的宽度，那圆形节点（实际 80px）的
//   center-X snap 会偏差 `(180-80)/2 = 50px`——这就是用户报告的
//   "条件分支松手后明显偏左"的根因。
//
// 如果将来增加了新节点类型或改了 CSS 尺寸，需要同步更新这里。
// ============================================================================
const CIRCLE_NODE_KINDS: Set<string> = new Set(['START', 'END', 'BRANCH', 'PARALLEL', 'JOINT']);

function getEstimatedNodeSize(kind?: FlowNodeKind | null): { width: number; height: number } {
  if (kind && CIRCLE_NODE_KINDS.has(kind)) {
    return { width: 80, height: 80 };
  }
  // 矩形节点（APPROVE/NOTIFY/SCRIPT）或 kind 未知时的 fallback
  // CSS min-width: 160px，实际渲染宽度通过 debug 日志验证为 160px
  return { width: 160, height: 60 };
}

/**
 * 从 HTML5 dragover 的 dataTransfer.types 数组中提取正在拖动的节点 kind。
 *
 * 浏览器安全限制：dragover 事件中 getData() 返回空字符串，只有 types 数组可读。
 * 我们在 NodePalette 的 dragstart 里额外注册了 `application/smart-flow-kind-{kind}`
 * 这个 MIME type，这里通过匹配 type name 还原 kind。
 */
function extractKindFromDragTypes(types: readonly string[]): FlowNodeKind | null {
  const prefix = 'application/smart-flow-kind-';
  for (const type of types) {
    if (type.startsWith(prefix)) {
      return type.slice(prefix.length).toUpperCase() as FlowNodeKind;
    }
  }
  return null;
}

/**
 * 用「假想新节点」跑 helper-lines 算法。
 *
 * @param flowPos 假想节点的左上角 vue-flow 内部坐标
 * @param kind    节点类型（可选，有则用精确尺寸，无则用 fallback）
 * @returns snap 后的左上角位置
 */
function computeNewNodeHelperLines(flowPos: XYPosition, kind?: FlowNodeKind | null): XYPosition {
  const draggingSize = getEstimatedNodeSize(kind);
  const otherNodes = getNodes.value;

  const result = computeHelperLines(flowPos, draggingSize, otherNodes);

  helperLineVertical.value = result.vertical;
  helperLineHorizontal.value = result.horizontal;
  return result.snapPosition;
}

/**
 * 把鼠标在屏幕的位置转换成「假想新节点」的左上角坐标（vue-flow 内部坐标）。
 *
 * 减去节点尺寸的一半 —— 让节点中心对齐鼠标位置（拖拽幽灵的中心跟鼠标对齐
 * 才直观，而不是让左上角跟鼠标对齐）。
 */
function mouseToNewNodePosition(clientX: number, clientY: number, kind?: FlowNodeKind | null): XYPosition {
  const size = getEstimatedNodeSize(kind);
  const flowPos = screenToFlowCoordinate({ x: clientX, y: clientY });
  return {
    x: flowPos.x - size.width / 2,
    y: flowPos.y - size.height / 2,
  };
}

/**
 * onDragOver：拖动外部节点经过画布时**每帧触发**。
 *
 * 双重职责：
 *   1. preventDefault + dropEffect：让浏览器允许 drop（HTML5 必须的）
 *   2. 实时计算辅助线 —— 让用户在拖动过程中就能看到对齐机会
 *
 * kind 提取：dragover 阶段 getData() 返回空（浏览器安全限制），但 types
 * 数组可读。NodePalette 的 dragstart 里注册了 `application/smart-flow-kind-{kind}`，
 * 通过 extractKindFromDragTypes() 还原 kind，查映射表得到正确尺寸。
 */
const onDragOver = (e: DragEvent) => {
  if (!e.dataTransfer) return;
  if (!e.dataTransfer.types.includes('application/smart-flow-node-kind')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const kind = extractKindFromDragTypes(e.dataTransfer.types);
  const newNodePos = mouseToNewNodePosition(e.clientX, e.clientY, kind);
  computeNewNodeHelperLines(newNodePos, kind);
};

/**
 * onDragLeave：拖动幽灵离开画布时清空辅助线。
 *
 * 注意 dragleave 在子元素之间也会触发（冒泡），但 drop / dragover 还会
 * 在新元素上立即触发，所以即便这里清空了，下一帧 dragover 还会重新算 ——
 * 整体表现是正确的：真正离开画布时线消失，画布内移动时线持续显示。
 */
const onDragLeave = (e: DragEvent) => {
  if (e.currentTarget === e.target) {
    clearHelperLines();
  }
};

/**
 * onDrop：松手放置新节点。
 *
 * 流程：
 *   1. 用精确的 kind 查尺寸映射表
 *   2. 算出鼠标对应的左上角位置（mouseToNewNodePosition）
 *   3. 用 helper-lines 算 snap —— 如果接近其他节点中心就吸附
 *   4. 清空辅助线（drop 完成）
 *   5. emit add-node 让父组件 graph.addNode
 */
const onDrop = (e: DragEvent) => {
  if (!e.dataTransfer) return;
  const kind = e.dataTransfer.getData('application/smart-flow-node-kind') as FlowNodeKind;
  if (!kind) return;
  e.preventDefault();

  const rawPos = mouseToNewNodePosition(e.clientX, e.clientY, kind);
  const snapPos = computeNewNodeHelperLines(rawPos, kind);

  clearHelperLines();

  // 关键：在 addNode 之前，把 vue-flow store 里所有节点的最新 position 同步回
  // graph.nodes ref。原因：vue-flow 拖动改的是内部 store 副本，不会反向同步
  // 到我们的 nodes ref。当 addNode push 新节点后，Vue 的 ref() 触发 vue-flow
  // watcher → vue-flow 用 ref 里的 position（可能是旧值）重新同步内部 store
  // → 已有节点被覆盖回旧位置。先 emit sync-positions 确保 ref 里是最新值。
  const positions = getNodes.value.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
  }));
  emit('sync-positions', positions);

  emit('add-node', kind, snapPos);
};

/**
 * VueFlow 的 minimap 节点配色：直接复用节点本身的色调，
 * 这样缩略图里也能一眼分清「绿点是开始 / 蓝条是审批 / 灰点是结束」。
 */
const minimapNodeColor = (node: DesignerNode): string => {
  // 圆形节点（START/END/网关）在缩略图里给 stroke-color；矩形给 fill。
  // 这里 VueFlow 默认是 fill，统一返回主色。
  const meta = node.data?.dsl;
  if (!meta) return '#909399';
  switch (meta.kind) {
    case 'START':
      return '#67c23a';
    case 'END':
      return '#909399';
    case 'APPROVE':
      return '#409eff';
    case 'NOTIFY':
      return '#a78bfa';
    case 'SCRIPT':
      return '#e6a23c';
    case 'BRANCH':
      return '#f7ba2a';
    case 'PARALLEL':
    case 'JOINT':
      return '#36cfc9';
    default:
      return '#909399';
  }
};

void props.readonly; // readonly 现在是占位，VueFlow nodes-draggable / edges-updatable 都接它
</script>

<template>
  <div
    class="flow-canvas"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <VueFlow
      :id="vueflowId"
      :nodes="nodes"
      :edges="edges"
      :node-types="SMART_FLOW_NODE_TYPES"
      :nodes-draggable="!readonly"
      :nodes-connectable="!readonly"
      :edges-updatable="!readonly"
      :elements-selectable="true"
      :default-edge-options="{
        type: 'smoothstep',
        animated: false,
        markerEnd: MarkerType.ArrowClosed,
      }"
      :min-zoom="0.3"
      :max-zoom="2"
      @connect="(c) => emit('connect', c)"
      @nodes-change="onNodesChange"
      @edges-change="(c) => emit('edges-change', c)"
      @node-click="(e) => emit('select-node', e.node.id)"
      @edge-click="(e) => emit('select-edge', e.edge.id)"
      @edge-double-click="(e) => emit('edge-double-click', e.edge.id)"
      @pane-click="emit('pane-click')"
      @node-drag-stop="clearHelperLines"
    >
      <Background pattern-color="#dcdfe6" :gap="16" />
      <Controls />
      <MiniMap
        pannable
        zoomable
        :node-color="minimapNodeColor"
        node-stroke-width="2"
        mask-color="rgba(245, 247, 250, 0.6)"
      />
    </VueFlow>

    <!--
      对齐辅助线覆盖层 —— 必须放在 <VueFlow> 容器外面（同级）。

      为什么不能放 VueFlow 默认 slot 里？
        我们查了 vue-flow 源码（vue-flow-core.mjs:9923）：默认 slot 渲染在
        `.vue-flow__viewport` 之外，不在 transformationpane 内，所以不会被
        viewport transform 自动应用 —— 之前用 div 放 slot 内位置完全不对。

      为什么不用全屏 SVG？
        SVG line 在 zoom=0.5 时会模糊（subpixel rendering），div + border
        渲染更稳定。

      坐标转换公式：
        screen_x = internal_x * viewport.zoom + viewport.x
        screen_y = internal_y * viewport.zoom + viewport.y
      （viewport 是从 useVueFlow 解构出来的 Ref<ViewportTransform>，
       模板里通过 reactive 自动解包，可以直接 viewport.x 这样访问）

      pointer-events:none：让鼠标穿透到 VueFlow 节点。
    -->
    <div
      v-if="helperLineVertical !== null"
      class="helper-line helper-line--vertical"
      :style="{
        transform: `translateX(${helperLineVertical * viewport.zoom + viewport.x}px)`,
      }"
    />
    <div
      v-if="helperLineHorizontal !== null"
      class="helper-line helper-line--horizontal"
      :style="{
        transform: `translateY(${helperLineHorizontal * viewport.zoom + viewport.y}px)`,
      }"
    />
  </div>
</template>

<style lang="scss" scoped>
.flow-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--el-fill-color-blank);
}

// VueFlow 默认 minimap 在右下，控制按钮在左下；让它们更贴合主题
:deep(.vue-flow__minimap) {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}

:deep(.vue-flow__controls) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  overflow: hidden;
}

/*
 * 对齐辅助线样式：
 *   - position absolute + top/left 0：相对父容器 .flow-canvas 的左上角
 *     （.flow-canvas 是 position:relative，这里 absolute 会以它为基准）
 *   - transform: translateX/Y：通过 :style 传入，把"vue-flow 内部坐标"
 *     转换后的"屏幕坐标"应用上去
 *   - 垂直线：top:0 + height:100% → 跨整个画布高度；width:0 + border-left:1px
 *     来画线（border 在 transform 下渲染比 background 稳定）
 *   - 水平线：left:0 + width:100% → 跨整个画布宽度；height:0 + border-top
 *   - pointer-events:none：鼠标穿透到 VueFlow 节点
 *   - z-index:10：高于 VueFlow 节点（默认 z-index 1-5）确保可见
 *   - will-change: transform：提示浏览器开启 GPU 加速，拖动时不掉帧
 */
.helper-line {
  position: absolute;
  pointer-events: none;
  z-index: 10;
  will-change: transform;
}

.helper-line--vertical {
  top: 0;
  left: 0;
  width: 0;
  height: 100%;
  border-left: 1px dashed var(--el-color-primary, #409eff);
}

.helper-line--horizontal {
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
  border-top: 1px dashed var(--el-color-primary, #409eff);
}
</style>
