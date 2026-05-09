/**
 * 拖动节点时的「中心对齐辅助线 + 自动吸附」算法。
 *
 * 类比：figma / draw.io 表单设计器里那种「拖到接近对齐位置时
 * 出现蓝色虚线 + 节点自动吸过去」的体验。
 *
 * 设计哲学（针对**流程图**的简化版，刻意不照搬 figma）：
 *   - **只做中心对齐**：流程图节点宽度不一（START 圆形 32px、APPROVE 矩形 180px），
 *     左/右/上/下边对齐毫无视觉价值，只有"中心点对齐"对用户有意义。
 *     早期版本曾经做过 6 种对齐规则（中心+左+右+上+下+边）—— 实测发现节点不同
 *     宽度时，对齐边缘的辅助线会指向"半空中"，体验比没辅助线还差。
 *   - **辅助线穿过节点中心**：vertical 辅助线 x = 对齐节点的 centerX，
 *     horizontal 辅助线 y = 对齐节点的 centerY，确保线条**视觉上穿过两个对齐节点**。
 *   - **5px 吸附阈值**：业界通用值（figma=4, miro=5, vue-flow 官方示例=5），
 *     太小感受不到吸附，太大会"突然跳过去"很突兀。
 *
 * 重要：本算法返回的所有坐标都是 **vue-flow 内部坐标系**，调用方应该把辅助线
 * 渲染在 `<VueFlow>` 的默认 slot 里 —— vue-flow 的 `transformationpane` 会
 * 自动应用 viewport transform，**不需要也不应该自己做 zoom/pan 转换**。
 */
import type { Node, XYPosition } from '@vue-flow/core';

/** 中心对齐吸附阈值（像素）—— 拖动节点的中心点离其他节点中心 < 这个值就吸附。 */
export const SNAP_THRESHOLD = 5;

/** 节点尺寸 fallback（VueFlow 首帧 measured 还没出来时用） */
const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;

/**
 * 辅助线计算结果（坐标都是 vue-flow 内部坐标系）：
 *   - vertical：垂直辅助线的 x 坐标（= 对齐目标节点的 centerX），null 表示无垂直对齐
 *   - horizontal：水平辅助线的 y 坐标（= 对齐目标节点的 centerY），null 表示无水平对齐
 *   - snapPosition：吸附后的节点位置（左上角坐标），未吸附时原样返回
 */
export interface HelperLinesResult {
  vertical: number | null;
  horizontal: number | null;
  snapPosition: XYPosition;
}

interface NodeDimensions {
  width: number;
  height: number;
}

function getNodeSize(node: Node): NodeDimensions {
  const dim = (node as Node & { dimensions?: NodeDimensions }).dimensions;
  return {
    width: dim?.width || DEFAULT_NODE_WIDTH,
    height: dim?.height || DEFAULT_NODE_HEIGHT,
  };
}

/**
 * 核心算法：只做中心对齐。
 *
 * @param draggingPosition 被拖动节点的当前位置（左上角 x/y，vue-flow 内部坐标）
 * @param draggingSize     被拖动节点的真实测量尺寸（width/height）
 * @param otherNodes       画布上其他所有节点（**不**包括被拖动的那个）
 * @returns 辅助线 vue-flow 内部坐标 + 吸附后的左上角位置
 */
export function computeHelperLines(
  draggingPosition: XYPosition,
  draggingSize: NodeDimensions,
  otherNodes: Node[],
): HelperLinesResult {
  const result: HelperLinesResult = {
    vertical: null,
    horizontal: null,
    snapPosition: { ...draggingPosition },
  };

  // 被拖动节点的中心点
  const draggingCenterX = draggingPosition.x + draggingSize.width / 2;
  const draggingCenterY = draggingPosition.y + draggingSize.height / 2;

  // 维护"当前最近的对齐目标"—— 每个方向只取距离最近的那条线
  let bestVDist = SNAP_THRESHOLD;
  let bestHDist = SNAP_THRESHOLD;

  for (const other of otherNodes) {
    const otherSize = getNodeSize(other);
    const otherCenterX = other.position.x + otherSize.width / 2;
    const otherCenterY = other.position.y + otherSize.height / 2;

    // 垂直辅助线（X 轴中心对齐）：辅助线穿过两个节点的 centerX
    const dx = Math.abs(draggingCenterX - otherCenterX);
    if (dx < bestVDist) {
      bestVDist = dx;
      result.vertical = otherCenterX;
      // 把被拖动节点的中心对齐到 otherCenterX → 左上角 x = centerX - 半宽
      result.snapPosition.x = otherCenterX - draggingSize.width / 2;
    }

    // 水平辅助线（Y 轴中心对齐）
    const dy = Math.abs(draggingCenterY - otherCenterY);
    if (dy < bestHDist) {
      bestHDist = dy;
      result.horizontal = otherCenterY;
      result.snapPosition.y = otherCenterY - draggingSize.height / 2;
    }
  }

  return result;
}

/** 过滤掉被拖动的节点，返回其他所有节点。 */
export function getOtherNodes<T extends Node>(allNodes: T[], draggingId: string): T[] {
  return allNodes.filter((n) => n.id !== draggingId);
}

/** 取节点真实测量尺寸（带 fallback）。 */
export function getNodeMeasuredSize(node: Node): NodeDimensions {
  return getNodeSize(node);
}
