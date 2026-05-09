/**
 * 前端兜底校验：在「保存草稿」「点击校验按钮」「发布前」三个时机调用。
 *
 * 后端编译器有一份完整的 ChartValidator，是真正的权威；前端这一份只是
 * 「提前告诉设计师哪里有问题」的体验加成 —— 不依赖网络，秒级反馈。
 * 因此这里的规则要求是「准确率优先于召回率」：宁可漏报后端再兜底，
 * 也不要误报让设计师困惑。
 *
 * 规则集：
 *   G1  必须有 1 个 START
 *   G2  必须有 ≥1 个 END
 *   G3  chart_key/chart_name 不能为空，chart_key 必须是合法 BPMN id
 *   N1  节点 label 不能为空
 *   N2  APPROVE 节点必须配置 assigneeStrategy；user-fixed 还要有 userIds
 *   N3  SCRIPT 节点必须配置 handlerName
 *   N4  非 START 节点必须有入边
 *   N5  非 END 节点必须有出边
 *   N6  BRANCH 节点出边数 ≥ 2，且最多一条「无条件」兜底边
 *   E1  边的 source/target 必须存在
 *   E2  从 BRANCH 出来的边必须填条件（最后一条可空，作为 default）
 */
import type { DesignerEdge, DesignerNode } from './use-flow-graph';
import type { FlowChartDsl, ValidationReport } from '@/types/flow';

const BPMN_ID_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

export function useFlowValidation() {
  function validate(dsl: FlowChartDsl, nodes: DesignerNode[], edges: DesignerEdge[]): ValidationReport {
    const nodeErrors: Record<string, string[]> = {};
    const edgeErrors: Record<string, string[]> = {};
    const globalErrors: string[] = [];

    const pushNodeErr = (key: string, msg: string) => {
      (nodeErrors[key] ??= []).push(msg);
    };
    const pushEdgeErr = (key: string, msg: string) => {
      (edgeErrors[key] ??= []).push(msg);
    };

    // ---------- G1/G2/G3：全图层级 ----------
    if (!dsl.chartKey?.trim()) {
      globalErrors.push('流程标识 chartKey 不能为空');
    } else if (!BPMN_ID_REGEX.test(dsl.chartKey)) {
      globalErrors.push('流程标识 chartKey 必须以字母或下划线开头，仅含字母数字 _ -');
    }
    if (!dsl.chartName?.trim()) {
      globalErrors.push('流程名称 chartName 不能为空');
    }
    const startNodes = dsl.nodes.filter((n) => n.kind === 'START');
    if (startNodes.length === 0) {
      globalErrors.push('缺少开始节点');
    } else if (startNodes.length > 1) {
      globalErrors.push('只能有一个开始节点');
    }
    if (!dsl.nodes.some((n) => n.kind === 'END')) {
      globalErrors.push('至少需要一个结束节点');
    }

    // 提前算好「每个节点的入/出边数」，后面 N4/N5 复用，避免每个节点 O(E)
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const e of edges) {
      outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
    const nodeKeySet = new Set(dsl.nodes.map((n) => n.key));

    // ---------- N1～N6：节点级 ----------
    for (const node of dsl.nodes) {
      if (!node.label?.trim()) {
        pushNodeErr(node.key, '节点名称不能为空');
      }
      if (node.kind !== 'START' && (inDegree.get(node.key) ?? 0) === 0) {
        pushNodeErr(node.key, '节点没有入边，不可达');
      }
      if (node.kind !== 'END' && (outDegree.get(node.key) ?? 0) === 0) {
        pushNodeErr(node.key, '节点没有出边，流程会卡住');
      }
      if (node.kind === 'APPROVE') {
        const props = node.properties ?? {};
        const strategy = String(props.assigneeStrategy ?? '');
        if (!strategy) {
          pushNodeErr(node.key, '审批节点必须选择审批人策略');
        } else if (strategy === 'user-fixed') {
          // user-fixed 是唯一一个「不配 args 一定不能跑」的策略 —— 其他策略
          // 即使 args 为空也可能通过 SpEL/默认值兜底，前端不抢着报错。
          const args = (props.assigneeArgs as Record<string, unknown>) ?? {};
          const ids = args.userIds;
          if (!Array.isArray(ids) || ids.length === 0) {
            pushNodeErr(node.key, '指定用户策略必须选择至少一个用户');
          }
        }
      }
      if (node.kind === 'SCRIPT') {
        const handler = (node.properties ?? {}).handlerName;
        if (!handler || !String(handler).trim()) {
          pushNodeErr(node.key, '脚本节点必须配置 handlerName');
        }
      }
      if (node.kind === 'BRANCH') {
        const out = edges.filter((e) => e.source === node.key);
        if (out.length < 2) {
          pushNodeErr(node.key, '条件分支节点至少要有 2 条出边');
        }
        const fallbackCount = out.filter(
          (e) => !e.data?.dsl.condition || !String(e.data.dsl.condition).trim(),
        ).length;
        if (fallbackCount > 1) {
          pushNodeErr(node.key, '条件分支最多允许 1 条无条件出边作为默认分支');
        }
      }
    }

    // ---------- E1/E2：边级 ----------
    for (const edge of edges) {
      const dslEdge = edge.data?.dsl;
      if (!dslEdge) continue;
      if (!nodeKeySet.has(dslEdge.from) || !nodeKeySet.has(dslEdge.to)) {
        pushEdgeErr(edge.id, '边的源或目标节点不存在');
      }
      // 从 BRANCH 出来的边校验放在节点 N6 里更精准（能识别「最后一条 default」）
      // 这里只兜「明显不合法」的情况
    }

    return {
      passed:
        globalErrors.length === 0 &&
        Object.keys(nodeErrors).length === 0 &&
        Object.keys(edgeErrors).length === 0,
      nodeErrors,
      edgeErrors,
      globalErrors,
    };
  }

  return { validate };
}
