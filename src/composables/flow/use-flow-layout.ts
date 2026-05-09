/**
 * 用 dagre 给 VueFlow 节点做有向图分层布局（自动排版）。
 *
 * 触发场景：
 *   1. 加载没有 x/y 的旧 chart（兜底）；
 *   2. 设计师点工具栏「整理」按钮；
 *   3. 「模拟运行」对话框里展示路径时强制重新布局。
 *
 * 实现思路：
 *   - 把 VueFlow 的 nodes/edges 喂给 dagre 算节点中心点；
 *   - 算完后「中心点 -> 左上角」转换回 VueFlow 的 position；
 *   - 不直接 mutate 原数组，返回新数组让调用方决定是否替换 —— 这样可以
 *     接 undo/redo 栈。
 *
 * 注意：dagre 的尺寸只能设全局 nodeWidth/nodeHeight，所以这里用「平均节点
 * 大小」估算（180×80），节点之间距离 60。如果设计师反映布局太拥挤，调
 * RANK_SEP / NODE_SEP 即可；不引入「按节点类型给不同尺寸」是因为审批流
 * 节点视觉差异不大，多一层复杂度收益小。
 */
import dagre from '@dagrejs/dagre';
import type { DesignerEdge, DesignerNode } from './use-flow-graph';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const RANK_SEP = 80;   // 同向上下层之间的距离
const NODE_SEP = 40;   // 同层节点之间的距离

export type LayoutDirection = 'TB' | 'LR';

export function useFlowLayout() {
  /**
   * 计算自动布局。
   * @param direction TB=上到下（默认，符合中文审批流阅读习惯）；LR=左到右
   */
  function layout(
    nodes: DesignerNode[],
    edges: DesignerEdge[],
    direction: LayoutDirection = 'TB',
  ): DesignerNode[] {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, ranksep: RANK_SEP, nodesep: NODE_SEP });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    return nodes.map((node) => {
      const pos = g.node(node.id);
      // dagre 算的是节点中心；VueFlow 用左上角坐标。
      return {
        ...node,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      };
    });
  }

  return { layout };
}
