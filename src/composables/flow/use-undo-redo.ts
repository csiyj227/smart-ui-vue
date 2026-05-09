/**
 * 设计器撤销/重做栈。
 *
 * 实现策略：粗粒度快照 —— 每次「有意义的编辑」（增节点/删节点/改属性/连线）
 * 都把整个 DSL 序列化压栈。不做「diff 增量」是因为：
 *   1. 一张审批流通常 ≤30 个节点，整图序列化也就几 KB，性能可忽略；
 *   2. 增量恢复要写一堆「反向操作」，bug 多到不值得；
 *   3. 粗粒度快照天然支持「编辑器关掉再开还在原状态」（持久化到 localStorage）。
 *
 * 防抖：连续打字改 label 时不希望每个字符都成为一个撤销点 —— 调用方需要
 * 自己判断「编辑会话结束」再调 push。属性面板里典型做法是 onBlur 时 push。
 */
import { computed, ref } from 'vue';
import type { FlowChartDsl } from '@/types/flow';

const STACK_LIMIT = 50;

export function useUndoRedo() {
  const past = ref<string[]>([]);
  const future = ref<string[]>([]);

  function push(snapshot: FlowChartDsl) {
    const text = JSON.stringify(snapshot);
    // 避免「点了 undo 然后立刻点回原状态」也算一次 push 导致死循环
    if (past.value[past.value.length - 1] === text) return;
    past.value.push(text);
    if (past.value.length > STACK_LIMIT) past.value.shift();
    // 任何新编辑都会清空 redo 栈 —— 标准编辑器语义
    future.value = [];
  }

  function undo(): FlowChartDsl | null {
    // 至少保留一个状态作为「当前」，所以 length 必须 > 1
    if (past.value.length <= 1) return null;
    const current = past.value.pop()!;
    future.value.push(current);
    return JSON.parse(past.value[past.value.length - 1]) as FlowChartDsl;
  }

  function redo(): FlowChartDsl | null {
    const next = future.value.pop();
    if (!next) return null;
    past.value.push(next);
    return JSON.parse(next) as FlowChartDsl;
  }

  function reset() {
    past.value = [];
    future.value = [];
  }

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: computed(() => past.value.length > 1),
    canRedo: computed(() => future.value.length > 0),
  };
}
