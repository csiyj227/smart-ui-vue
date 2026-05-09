<!--
  开始节点：圆形外观，绿色，单例。
  之所以让 START/END 走「圆形」、其他节点走「矩形」，是为了让设计师在
  缩略图里也能一眼分清「这是入口/出口」vs「这是业务节点」，符合 BPMN
  的视觉惯例。
-->
<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core';
import BaseNode from './BaseNode.vue';
import type { DesignerNodeData } from '@/types/flow';

defineProps<NodeProps<DesignerNodeData>>();
</script>

<template>
  <BaseNode
    kind="START"
    shape="circle"
    :label="data?.dsl.label"
    :selected="selected"
    :errors="data?.validationErrors"
  />
</template>
