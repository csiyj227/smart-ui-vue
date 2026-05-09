<!--
  审批节点：矩形带副标题。副标题动态展示「审批人策略 + 会签模式」让设计师
  差距的关键细节。
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { NodeProps } from '@vue-flow/core';
import BaseNode from './BaseNode.vue';
import {
  ASSIGNEE_STRATEGY_META,
  MULTI_MODE_LABEL,
  type AssigneeStrategy,
  type DesignerNodeData,
  type MultiMode,
} from '@/types/flow';

const props = defineProps<NodeProps<DesignerNodeData>>();

const subtitle = computed(() => {
  const props_ = props.data?.dsl.properties ?? {};
  const strategy = props_.assigneeStrategy as AssigneeStrategy | undefined;
  const multi = (props_.multiMode as MultiMode) ?? 'none';
  const strategyLabel = strategy ? ASSIGNEE_STRATEGY_META[strategy]?.label : '未配置审批人';
  const multiLabel = MULTI_MODE_LABEL[multi];
  return multi === 'none' ? strategyLabel : `${strategyLabel} · ${multiLabel}`;
});
</script>

<template>
  <BaseNode
    kind="APPROVE"
    :label="data?.dsl.label"
    :subtitle="subtitle"
    :selected="selected"
    :errors="data?.validationErrors"
  />
</template>
