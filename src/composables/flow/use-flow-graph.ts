// @ts-nocheck - VueFlow nested generic types (DesignerNode/DesignerEdge) cause TS2589 "Type instantiation is excessively deep"
/**
 * VueFlow 图模型 ↔ FlowChart DSL 双向转换 + 增量编辑入口。
 *
 * 这层胶水的存在理由：VueFlow 的 Node/Edge 类型扁平、字段散在顶层（id /
 * position / type / data / sourceHandle...），而后端 DSL 是「nodes 数组 +
 * edges 数组」的纯数据结构。直接让画布组件去操作 DSL 会导致每次编辑都要
 * 整图重算，性能上不可行；反过来让属性面板直接改 VueFlow Node 又会让
 * DSL 字段散落到组件里，序列化/校验都很难写。
 *
 * 解决办法：把 DSL 整体作为 Node.data.dsl 存放，画布层只关心 VueFlow 视图
 * 模型，序列化/反序列化只在「打开 chart」「保存 chart」「导出 JSON」这
 * 几个边界点发生。
 *
 * 同时这层把所有「修改单个节点的某个属性」「删除节点」「改边条件」这种
 * 高频操作都封装成方法，让属性面板/工具栏直接调，避免组件里散落
 * findIndex + splice 这种容易出 off-by-one 的代码。
 */
import { ref, computed } from 'vue';
import { MarkerType, type Edge, type Node, type XYPosition } from '@vue-flow/core';
import {
  NODE_KIND_META,
  type DesignerEdgeData,
  type DesignerNodeData,
  type FlowChartDsl,
  type FlowEdgeDsl,
  type FlowNodeDsl,
  type FlowNodeKind,
} from '@/types/flow';

/** 给画布注入的 nodes/edges 类型别名，统一带上 designer data 泛型。 */
export type DesignerNode = Node<DesignerNodeData>;
export type DesignerEdge = Edge<DesignerEdgeData>;

/**
 * 设计器单例 Hook。整个设计器页面里只 useFlowGraph() 一次，
 * 所有子组件通过 provide/inject 共用同一份 ref，避免出现「左面板看到的
 * 节点和右面板看到的不一样」这种诡异 bug。
 */
// @ts-ignore TS2589 - VueFlow nested generic types cause excessively deep instantiation
export function useFlowGraph() {
  // ============================================================================
  // 视图模型：VueFlow 直接消费这两个 ref
  // ============================================================================

  const nodes = ref<DesignerNode[]>([]);
  const edges = ref<DesignerEdge[]>([]);

  /** chart 元信息（key/name/category/description） */
  const chartMeta = ref<Pick<FlowChartDsl, 'chartKey' | 'chartName' | 'chartCategory' | 'description' | 'forms'>>({
    chartKey: '',
    chartName: '',
  });

  /** 当前选中的节点 / 边 id。由画布的 selection-change 事件回写。 */
  const selectedNodeId = ref<string | null>(null);
  const selectedEdgeId = ref<string | null>(null);

  const selectedNode = computed((): DesignerNode | null =>
    selectedNodeId.value
      ? (nodes.value.find((n) => n.id === selectedNodeId.value) as DesignerNode | undefined) ?? null
      : null,
  );
  const selectedEdge = computed(() => {
    return selectedEdgeId.value
      ? (edges.value.find((e: any) => e.id === selectedEdgeId.value) ?? null)
      : null;
  });

  // ============================================================================
  // DSL → 视图模型：加载 chart 时调用一次
  // ============================================================================

  function loadDsl(dsl: FlowChartDsl) {
    chartMeta.value = {
      chartKey: dsl.chartKey,
      chartName: dsl.chartName,
      chartCategory: dsl.chartCategory,
      description: dsl.description,
      forms: dsl.forms,
    };
    nodes.value = (dsl.nodes ?? []).map((n: any) => dslNodeToVueFlow(n));
    edges.value = (dsl.edges ?? []).map((e: any) => dslEdgeToVueFlow(e));
    selectedNodeId.value = null;
    selectedEdgeId.value = null;
  }

  /** 视图模型 → DSL：保存/导出/校验前调用。  */
  function exportDsl(): FlowChartDsl {
    return {
      chartKey: chartMeta.value.chartKey,
      chartName: chartMeta.value.chartName,
      chartCategory: chartMeta.value.chartCategory,
      description: chartMeta.value.description,
      forms: chartMeta.value.forms,
      // 用 vueflow 当前坐标覆盖 dsl 里的 x/y，这样「拖动后保存」能持久化位置
      nodes: nodes.value.map((n: any) => ({
        ...n.data!.dsl,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      })),
      edges: edges.value.map((e: any) => e.data!.dsl),
    };
  }

  // ============================================================================
  // 节点：增 / 改 / 删
  // ============================================================================

  /**
   * 在指定坐标新建一个节点。从 palette 拖到画布的 onDrop 回调里调。
   *
   * 自动生成的 key 形如 `approve_3a4f`，前缀用 kind 全小写，后缀用 4 位
   * 随机字符（足够避碰但不会让节点 id 长得吓人）。这种 key 同时也是 BPMN
   * 元素 id —— 必须字母开头，所以这里加上前缀而不是裸 UUID。
   */
  function addNode(kind: FlowNodeKind, position: XYPosition): DesignerNode {
    if (NODE_KIND_META[kind].singleton) {
      const existing = (nodes.value as any).find((n: any) => n.data?.dsl.kind === kind);
      if (existing) {
        // 强制策略：单例节点（START/END）只允许一个，再次拖入直接拒绝。
        // 这里不抛 throw 是因为 onDrop 抛错会让 VueFlow 进入诡异状态，
        // 调用方拿到 null 自己决定怎么提示就好。
        return existing;
      }
    }
    const key = nextKey(kind);
    // 一次性把坐标写进 DSL —— 不要在 dslNodeToVueFlow 之后再外部覆盖 node.position！
    //
    // 之前的写法是「先 dslNodeToVueFlow（此时 dsl.x/y 是 undefined，position 落到
    // (0,0)）→ 再 node.position = position」，VueFlow 在响应式 push 节点时会先
    // 拿 (0,0) 渲染一帧，下一帧才能感知到外部的 position 覆盖，于是用户视觉
    // 上看到「节点先闪在左上角，再跳到鼠标位置」。这就是用户反馈的「位置又回
    // 重新更新一下」的根因。
    //
    // 正确做法：在构造 DSL 时就把 x/y 填好，dslNodeToVueFlow 直接拿 dsl.x/y 转 position，
    // 整个节点对象一次性就位，push 后第一帧渲染就在正确位置。
    const dsl: FlowNodeDsl = {
      key,
      kind,
      label: NODE_KIND_META[kind].label,
      properties: defaultPropertiesOf(kind),
      x: position.x,
      y: position.y,
    };
    const node = dslNodeToVueFlow(dsl);
    (nodes.value as any[]).push(node);
    return node;
  }

  /** 修改节点的 label / properties，属性面板里的 v-model 都过这里。 */
  function patchNode(nodeId: string, patch: Partial<FlowNodeDsl>) {
    const target = (nodes.value as any[]).find((n: any) => n.id === nodeId);
    if (!target?.data) return;
    // 显式分离 properties：避免「属性面板只想改一个字段，结果把其他清空了」。
    // 不直接 spread patch，是因为 patch 可能携带 properties 这个嵌套对象
    // —— 浅 spread 会把整个 properties 替换，导致丢字段。
    const { properties: patchProps, ...patchTop } = patch;
    target.data.dsl = {
      ...target.data.dsl,
      ...patchTop,
      properties: {
        ...(target.data.dsl.properties ?? {}),
        ...(patchProps ?? {}),
      },
    };
    // 节点 label 影响展示，触发响应式更新
    target.label = target.data.dsl.label;
  }

  function removeNode(nodeId: string) {
    (nodes as any).value = (nodes.value as any[]).filter((n: any) => n.id !== nodeId);
    // 同时删掉所有相邻边，否则会留下「源/目标已不存在」的悬挂边
    (edges as any).value = (edges.value as any[]).filter((e: any) => e.source !== nodeId && e.target !== nodeId);
    if (selectedNodeId.value === nodeId) selectedNodeId.value = null;
  }

  // ============================================================================
  // 边：增 / 改 / 删
  // ============================================================================

  /** 画布上拖出新连线时调用。VueFlow 的 onConnect 回调里转发即可。 */
  function addEdge(
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ): DesignerEdge | null {
    if (source === target) return null; // 禁止自环
    // 同对节点之间已有同向边？不重复添加（VueFlow 不会自动去重）
    const dup = (edges.value as any[]).find((e: any) => e.source === source && e.target === target);
    if (dup) return dup;
    const dsl: FlowEdgeDsl = {
      key: nextEdgeKey(),
      from: source,
      to: target,
      sourceHandle: sourceHandle ?? undefined,
      targetHandle: targetHandle ?? undefined,
    };
    const edge = dslEdgeToVueFlow(dsl);
    (edges.value as any[]).push(edge);
    return edge;
  }

  function patchEdge(edgeId: string, patch: Partial<FlowEdgeDsl>) {
    const target = edges.value.find((e) => e.id === edgeId);
    if (!target?.data) return;
    target.data.dsl = { ...target.data.dsl, ...patch };
    if (patch.label !== undefined) target.label = patch.label;
  }

  function removeEdge(edgeId: string) {
    edges.value = edges.value.filter((e) => e.id !== edgeId);
    if (selectedEdgeId.value === edgeId) selectedEdgeId.value = null;
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /** 给节点起一个不冲突的 key，规则：`<kind>_<seq>`。 */
  function nextKey(kind: FlowNodeKind): string {
    const prefix = kind.toLowerCase();
    let seq = 1;
    while (nodes.value.some((n) => n.id === `${prefix}_${seq}`)) seq += 1;
    return `${prefix}_${seq}`;
  }

  function nextEdgeKey(): string {
    let seq = 1;
    while (edges.value.some((e) => e.id === `e_${seq}`)) seq += 1;
    return `e_${seq}`;
  }

  /**
   * 给新节点初始化合理的默认 properties，避免「拖出来一个 APPROVE 节点
   * 但属性面板全是空的」这种体验。默认值刻意保守：要么明显是占位（需要
   * 设计师改），要么是最常见的选项。
   */
  function defaultPropertiesOf(kind: FlowNodeKind): Record<string, unknown> {
    switch (kind) {
      case 'APPROVE':
        return {
          assigneeStrategy: 'leader-of-starter',
          assigneeArgs: { level: 1 },
          multiMode: 'none',
          passRule: 'all',
        };
      case 'NOTIFY':
        return { recipients: [], channels: ['STATION'] };
      case 'SCRIPT':
        return { handlerName: '' };
      case 'BRANCH':
      case 'PARALLEL':
      case 'JOINT':
      case 'START':
      case 'END':
        return {};
      default:
        return {};
    }
  }

  return {
    // state
    nodes,
    edges,
    chartMeta,
    selectedNodeId,
    selectedEdgeId,
    selectedNode,
    selectedEdge,
    // dsl
    loadDsl,
    exportDsl,
    // mutations
    addNode,
    patchNode,
    removeNode,
    addEdge,
    patchEdge,
    removeEdge,
  };
}

// ============================================================================
// 纯函数转换层（导出供测试 / 其他场景复用）
// ============================================================================

export function dslNodeToVueFlow(dsl: FlowNodeDsl): DesignerNode {
  return {
    id: dsl.key,
    // 自定义节点类型名与 nodes/*.vue 文件注册的 key 一致；命名空间用 `smart-`
    // 前缀避免和未来插件可能注册的 default/custom 冲突。
    type: `smart-${dsl.kind.toLowerCase()}`,
    position: { x: dsl.x ?? 0, y: dsl.y ?? 0 },
    label: dsl.label,
    data: { dsl },
  };
}

export function dslEdgeToVueFlow(dsl: FlowEdgeDsl): DesignerEdge {
  return {
    id: dsl.key ?? `${dsl.from}->${dsl.to}`,
    source: dsl.from,
    target: dsl.to,
    sourceHandle: dsl.sourceHandle,
    targetHandle: dsl.targetHandle,
    label: dsl.label ?? (dsl.condition ? '条件' : ''),
    type: 'smoothstep',
    markerEnd: MarkerType.ArrowClosed,
    // 连接线上的标注文字样式：白底圆角小标签，和节点描述文字明显区分
    labelStyle: { fontSize: '12px', fontWeight: 500, fill: '#606266' },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
    labelBgPadding: [4, 8] as [number, number],
    labelBgBorderRadius: 4,
    labelShowBg: true,
    data: { dsl },
  };
}
