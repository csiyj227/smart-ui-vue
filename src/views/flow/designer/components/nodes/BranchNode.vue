<!--
  条件分支：圆形 / 菱形 二选一这里走圆形 —— 矩形不够「网关感」，
  菱形又会带来文字旋转的麻烦，圆形是 trade-off 后最干净的选择。
-->
<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core';
import BaseNode from './BaseNode.vue';
import type { DesignerNodeData } from '@/types/flow';

defineProps<NodeProps<DesignerNodeData>>();
</script>

<template>
  <BaseNode
    kind="BRANCH"
    shape="diamond"
    :label="data?.dsl.label"
    :selected="selected"
    :errors="data?.validationErrors"
  />
</template>
