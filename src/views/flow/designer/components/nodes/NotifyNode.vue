<script setup lang="ts">
import { computed } from 'vue';
import type { NodeProps } from '@vue-flow/core';
import BaseNode from './BaseNode.vue';
import type { DesignerNodeData } from '@/types/flow';

const props = defineProps<NodeProps<DesignerNodeData>>();

const subtitle = computed(() => {
  const channels = (props.data?.dsl.properties?.channels as string[]) ?? [];
  return channels.length > 0 ? `渠道：${channels.join(' / ')}` : '抄送通知';
});
</script>

<template>
  <BaseNode
    kind="NOTIFY"
    :label="data?.dsl.label"
    :subtitle="subtitle"
    :selected="selected"
    :errors="data?.validationErrors"
  />
</template>
