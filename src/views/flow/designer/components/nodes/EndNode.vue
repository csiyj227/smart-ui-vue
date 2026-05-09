<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core';
import BaseNode from './BaseNode.vue';
import type { DesignerNodeData } from '@/types/flow';

defineProps<NodeProps<DesignerNodeData>>();
</script>

<template>
  <BaseNode
    kind="END"
    shape="circle"
    :label="data?.dsl.label"
    :selected="selected"
    :errors="data?.validationErrors"
  />
</template>
