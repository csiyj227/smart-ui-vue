<!--
  抽象节点基组件 —— 所有具体节点的视觉骨架。

  每种 kind 的节点视觉差异其实只有 3 处：主色调、图标、副标题。这里把
  这 3 处抽成 props，再加上「头部 slot / 内容 slot / 连接桩 slot」三个
  插槽，就能让 8 个具体节点文件每个只有 ~10 行。

  直接渲染 VueFlow 的 Handle 是为了让连接桩能感知节点 type —— 我们用
  isValidConnection 校验「不能连进 START / 不能连出 END」，那个 prop
  必须挂在 Handle 上才生效。
-->
<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position, type Connection } from '@vue-flow/core';
import { ElIcon, ElTooltip } from 'element-plus';
import { Warning } from '@element-plus/icons-vue';
import type { Component } from 'vue';
import { NODE_KIND_META, type FlowNodeKind } from '@/types/flow';

interface Props {
  kind: FlowNodeKind;
  label?: string;
  subtitle?: string;
  selected?: boolean;
  errors?: string[];
  /** 节点外观：rect（默认矩形）/ circle（圆形）/ diamond（菱形） */
  shape?: 'rect' | 'circle' | 'diamond';
  /** 自定义图标组件，不传走 NODE_KIND_META 的默认 */
  icon?: Component;
}

const props = withDefaults(defineProps<Props>(), {
  shape: 'rect',
  selected: false,
});

const meta = computed(() => NODE_KIND_META[props.kind]);
const hasErrors = computed(() => (props.errors?.length ?? 0) > 0);

const cssVars = computed(() => ({
  '--kind-color': meta.value.color,
}));

/**
 * 连接合法性兜底：
 *   - START 不能作为目标（不能连进开始）；
 *   - END 不能作为源（不能从结束发出）。
 */
const validateConnection = (conn: Connection): boolean => {
  if (props.kind === 'START' && conn.target === conn.source) return false;
  if (props.kind === 'END' && conn.source === conn.target) return false;
  return true;
};
</script>

<template>
  <div
    class="smart-flow-node"
    :class="[
      shape === 'circle' ? 'smart-flow-node--circle' : '',
      shape === 'diamond' ? 'smart-flow-node--diamond' : '',
      selected ? 'is-selected' : '',
      hasErrors ? 'is-invalid' : '',
    ]"
    :style="cssVars"
  >
    <!-- 入边连接桩：上 + 左（除了 START） -->
    <Handle
      v-if="meta.allowIncoming"
      type="target"
      :position="Position.Top"
      id="target-top"
      :is-valid-connection="validateConnection"
    />
    <Handle
      v-if="meta.allowIncoming"
      type="target"
      :position="Position.Left"
      id="target-left"
      :is-valid-connection="validateConnection"
    />

    <div class="smart-flow-node__header">
      <ElIcon class="smart-flow-node__icon">
        <component :is="icon" v-if="icon" />
        <component :is="meta.icon" v-else />
      </ElIcon>
      <span class="smart-flow-node__label">{{ label || meta.label }}</span>
    </div>

    <div v-if="subtitle && shape !== 'circle' && shape !== 'diamond'" class="smart-flow-node__subtitle">
      {{ subtitle }}
    </div>

    <!-- 出边连接桩：下 + 右（除了 END） -->
    <Handle
      v-if="meta.allowOutgoing"
      type="source"
      :position="Position.Bottom"
      id="source-bottom"
      :is-valid-connection="validateConnection"
    />
    <Handle
      v-if="meta.allowOutgoing"
      type="source"
      :position="Position.Right"
      id="source-right"
      :is-valid-connection="validateConnection"
    />

    <ElTooltip
      v-if="hasErrors"
      :content="errors!.join('\n')"
      placement="top"
      effect="dark"
    >
      <span class="smart-flow-node__error-badge">
        <ElIcon><Warning /></ElIcon>
      </span>
    </ElTooltip>
  </div>
</template>

<style lang="scss">
@use './node-base.scss';
</style>
