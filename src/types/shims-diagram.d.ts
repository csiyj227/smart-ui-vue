/**
 * 为没有官方/社区 @types 包的图表渲染依赖补 ambient 类型声明，
 * 让 vue-tsc 不报「Could not find a declaration file for module ...」。
 *
 * 这些库在 utils/diagram-renderers.ts 中通过动态 import 使用，
 * 运行时正常，只是类型层面缺声明。
 */

declare module 'raphael';

declare module 'flowchart.js' {
  /** flowchart.js 仅用到 parse(...).drawSVG(target, options?) 这一小部分 API */
  export interface FlowChartDiagram {
    drawSVG(target: HTMLElement | string, options?: Record<string, unknown>): void;
    clean(): void;
  }
  const flowchart: {
    parse(source: string): FlowChartDiagram;
  };
  export default flowchart;
}
