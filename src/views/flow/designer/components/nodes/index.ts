/**
 * 节点类型集中注册表 —— 喂给 VueFlow 的 nodeTypes prop。
 *
 * key 必须与 use-flow-graph.ts 里 dslNodeToVueFlow 算出的 type 字段
 * （`smart-${kind.toLowerCase()}`）严格对齐，不一致 VueFlow 会回退到
 * default 节点导致显示异常。
 */
import type { Component } from 'vue';
import StartNode from './StartNode.vue';
import EndNode from './EndNode.vue';
import ApproveNode from './ApproveNode.vue';
import NotifyNode from './NotifyNode.vue';
import ScriptNode from './ScriptNode.vue';
import BranchNode from './BranchNode.vue';
import ParallelNode from './ParallelNode.vue';
import JointNode from './JointNode.vue';

export const SMART_FLOW_NODE_TYPES: Record<string, Component> = {
  'smart-start': StartNode,
  'smart-end': EndNode,
  'smart-approve': ApproveNode,
  'smart-notify': NotifyNode,
  'smart-script': ScriptNode,
  'smart-branch': BranchNode,
  'smart-parallel': ParallelNode,
  'smart-joint': JointNode,
};
