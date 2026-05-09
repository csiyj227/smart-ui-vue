<script setup lang="ts">
import { computed } from 'vue';
import type { NodeProps } from '@vue-flow/core';
import BaseNode from './BaseNode.vue';
import type { DesignerNodeData } from '@/types/flow';

const props = defineProps<NodeProps<DesignerNodeData>>();

const subtitle = computed(() => {
  const handler = props.data?.dsl.properties?.handlerName;
  return handler ? `Bean: ${handler}` : '未指定处理 Bean';
});
</script>

<template>
  <BaseNode
    kind="SCRIPT"
    :label="data?.dsl.label"
    :subtitle="subtitle"
    :selected="selected"
    :errors="data?.validationErrors"
  />
</template>
