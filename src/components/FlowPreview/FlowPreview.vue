<!--
  流程图只读预览组件 —— 用于流程详情页展示流程图并高亮当前节点/已完成节点。

  使用方式：
    <FlowPreview
      :chart-dsl="chartDslString"
      :active-node-keys="['approve_1']"
      :completed-node-keys="['start_1', 'approve_1']"
    />

  功能：
    - 解析 chartDsl JSON 字符串，渲染只读流程图
    - 活跃节点（当前正在审批的）：红色边框 + 红色脉冲动画
    - 已完成节点：绿色边框
    - 已完成的连接线（from 和 to 都已完成或活跃）：绿色
    - 活跃节点的入边：红色
-->
<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue';
import {
  VueFlow,
  useVueFlow,
  MarkerType,
  type Node,
  type Edge,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import { SMART_FLOW_NODE_TYPES } from '@/views/flow/designer/components/nodes';
import {
  dslNodeToVueFlow,
  dslEdgeToVueFlow,
} from '@/composables/flow/use-flow-graph';
import type { FlowChartDsl, FlowNodeDsl, FlowEdgeDsl } from '@/types/flow';

interface Props {
  /** 流程定义 DSL（JSON 字符串） */
  chartDsl?: string;
  /** 当前活跃节点 key 列表 */
  activeNodeKeys?: string[];
  /** 已完成节点 key 列表 */
  completedNodeKeys?: string[];
  /** 容器高度 */
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  chartDsl: '',
  activeNodeKeys: () => [],
  completedNodeKeys: () => [],
  height: '360px',
});

const flowId = `flow-preview-${Date.now()}`;
const { fitView, onPaneReady } = useVueFlow(flowId);

onPaneReady(() => {
  fitView({ padding: 0.25, duration: 300 });
});

/** 解析 DSL */
const parsedDsl = computed<FlowChartDsl | null>(() => {
  if (!props.chartDsl) return null;
  try {
    return JSON.parse(props.chartDsl) as FlowChartDsl;
  } catch {
    return null;
  }
});

/** 活跃 + 已完成 key 的 Set（方便快速查找） */
const activeSet = computed(() => new Set(props.activeNodeKeys));
const completedSet = computed(() => new Set(props.completedNodeKeys));

/** 转换并标记节点 */
const nodes = computed<Node[]>(() => {
  if (!parsedDsl.value?.nodes) return [];
  return parsedDsl.value.nodes.map((dslNode: FlowNodeDsl) => {
    const node = dslNodeToVueFlow(dslNode);
    // 通过 CSS class 标记节点状态
    const classes: string[] = [];
    if (activeSet.value.has(dslNode.key)) {
      classes.push('flow-preview-node--active');
    } else if (completedSet.value.has(dslNode.key)) {
      classes.push('flow-preview-node--completed');
    }
    return { ...node, class: classes.join(' ') };
  });
});

/** 转换并标记边 */
const edges = computed<Edge[]>(() => {
  if (!parsedDsl.value?.edges) return [];
  const done = completedSet.value;
  const active = activeSet.value;

  return parsedDsl.value.edges.map((dslEdge: FlowEdgeDsl) => {
    const edge = dslEdgeToVueFlow(dslEdge);
    const fromDone = done.has(dslEdge.from) || active.has(dslEdge.from);
    const toDone = done.has(dslEdge.to) || active.has(dslEdge.to);
    const toActive = active.has(dslEdge.to);

    let edgeStyle: Record<string, string> = {};
    let markerColor = '';

    if (toActive && fromDone) {
      // 指向活跃节点的边：红色
      edgeStyle = { stroke: '#f56c6c', strokeWidth: '2.5' };
      markerColor = '#f56c6c';
    } else if (fromDone && toDone) {
      // 已完成路径的边：绿色
      edgeStyle = { stroke: '#67c23a', strokeWidth: '2' };
      markerColor = '#67c23a';
    }

    return {
      ...edge,
      animated: toActive && fromDone,
      style: Object.keys(edgeStyle).length > 0 ? edgeStyle : undefined,
      markerEnd: markerColor
        ? { type: MarkerType.ArrowClosed, color: markerColor }
        : MarkerType.ArrowClosed,
    };
  });
});
</script>

<template>
  <div class="flow-preview" :style="{ height }">
    <template v-if="parsedDsl">
      <VueFlow
        :id="flowId"
        :nodes="nodes"
        :edges="edges"
        :node-types="SMART_FLOW_NODE_TYPES"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :edges-updatable="false"
        :elements-selectable="false"
        :pan-on-drag="true"
        :zoom-on-scroll="true"
        :default-edge-options="{
          type: 'smoothstep',
          animated: false,
          markerEnd: MarkerType.ArrowClosed,
        }"
        :min-zoom="0.2"
        :max-zoom="2"
      >
        <Background pattern-color="#e8e8e8" :gap="16" />
        <Controls :show-interactive="false" />
      </VueFlow>
    </template>
    <div v-else class="flow-preview__empty">
      暂无流程图数据
    </div>
  </div>
</template>

<style lang="scss" scoped>
.flow-preview {
  position: relative;
  width: 100%;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-blank, #fff);

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--el-text-color-secondary, #909399);
    font-size: 14px;
  }
}

/* 活跃节点：红色边框 + 脉冲动画 */
:deep(.flow-preview-node--active) {
  .vue-flow__node {
    outline: none !important;
  }

  /* 通用外层包裹 —— 直接给 vue-flow 节点元素加样式 */
  &.vue-flow__node {
    box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.4);
    border-radius: 8px;
    animation: pulse-active 1.5s ease-in-out infinite;
  }
}

/* 已完成节点：绿色边框 */
:deep(.flow-preview-node--completed) {
  &.vue-flow__node {
    box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.5);
    border-radius: 8px;
  }
}

@keyframes pulse-active {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(245, 108, 108, 0.15);
  }
}

/* 隐藏预览模式下不需要的交互提示 */
:deep(.vue-flow__handle) {
  opacity: 0;
  pointer-events: none;
}

:deep(.vue-flow__controls) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  overflow: hidden;
}
</style>
