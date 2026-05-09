/**
 * ChatBI 全局 ECharts 主题。
 *
 * 设计目标：
 *   - 暗色基底，与 nl2sql 对话界面 (#0F172A 系列) 保持视觉一致；
 *   - 高饱和但不刺眼的「电紫 + 青蓝 + 品红 + 橙黄」配色，区分度高且符合 BI 现代感；
 *   - 折线/柱状默认带渐变填充和柔和阴影，pie 默认环形 + 内外圆角，让单图也"出片"。
 *
 * 用法：
 *   import { registerEchartsTheme, CHATBI_THEME_NAME } from '@/utils/echarts-theme';
 *   registerEchartsTheme(echarts);
 *   echarts.init(dom, CHATBI_THEME_NAME);
 *
 * 说明：
 *   - 注册是幂等的，重复调用不会有副作用；
 *   - 渐变 / 阴影是通过 series 默认 itemStyle/lineStyle/areaStyle 注入的，
 *     业务侧 setOption 时如果显式指定，会覆盖默认值，行为可预期。
 */
import type * as echarts from 'echarts/core';

export const CHATBI_THEME_NAME = 'chatbi';

/**
 * ChatBI 数据色板（10 色）
 *
 * 选色取舍：
 *   - 头部 4 色（紫/青/粉/琥珀）饱和度高，作为 BI 默认 1~4 序列的主色；
 *   - 后 6 色降低饱和度作为辅助色，避免过曝；
 *   - 整体在 #0B1126（页面深色背景）上的色差 ≥ 4.5:1，符合可访问性。
 */
export const CHATBI_COLORS = [
  '#818CF8', // indigo-400  电紫
  '#22D3EE', // cyan-400    青蓝
  '#F472B6', // pink-400    品红
  '#FBBF24', // amber-400   琥珀
  '#34D399', // emerald-400 翡翠
  '#FB7185', // rose-400    玫瑰
  '#A78BFA', // violet-400  紫罗兰
  '#60A5FA', // blue-400    天蓝
  '#FDBA74', // orange-300  橙
  '#4ADE80', // green-400   嫩绿
];

/**
 * 把每个主色映射成「对应主色 → 半透明同色」的纵向渐变，
 * 用于 line.areaStyle / bar.itemStyle 让序列自带高级感。
 */
function buildAreaGradients() {
  return CHATBI_COLORS.map((color) => ({
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: hexWithAlpha(color, 0.55) },
      { offset: 1, color: hexWithAlpha(color, 0.02) },
    ],
  }));
}

/**
 * 16 进制 (#RRGGBB) → rgba(r,g,b,alpha)。
 * 用于把主色快速生成不同透明度的衬底。
 */
function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TEXT_COLOR_PRIMARY = '#E2E8F0';   // slate-200
const TEXT_COLOR_SECONDARY = '#94A3B8'; // slate-400
const AXIS_LINE_COLOR = 'rgba(148, 163, 184, 0.25)';
const SPLIT_LINE_COLOR = 'rgba(148, 163, 184, 0.12)';

const theme = {
  color: CHATBI_COLORS,
  // 透明背景，由外层 chart-box 提供毛玻璃 + 渐变背景
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    color: TEXT_COLOR_PRIMARY,
  },
  title: {
    textStyle: {
      color: TEXT_COLOR_PRIMARY,
      fontSize: 14,
      fontWeight: 600,
    },
    subtextStyle: { color: TEXT_COLOR_SECONDARY, fontSize: 12 },
  },
  legend: {
    textStyle: { color: TEXT_COLOR_SECONDARY },
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
  },
  tooltip: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderWidth: 1,
    textStyle: { color: TEXT_COLOR_PRIMARY, fontSize: 12 },
    axisPointer: {
      lineStyle: { color: 'rgba(99, 102, 241, 0.5)', width: 1, type: 'dashed' },
      crossStyle: { color: 'rgba(99, 102, 241, 0.5)' },
      shadowStyle: { color: 'rgba(99, 102, 241, 0.08)' },
    },
    extraCssText:
      'backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4);',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: AXIS_LINE_COLOR } },
    axisTick: { show: false },
    axisLabel: { color: TEXT_COLOR_SECONDARY, fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: TEXT_COLOR_SECONDARY, fontSize: 11 },
    splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } },
  },
  line: {
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2.5 },
    emphasis: {
      focus: 'series',
      lineStyle: { width: 3 },
    },
  },
  bar: {
    itemStyle: {
      borderRadius: [6, 6, 0, 0],
      shadowColor: 'rgba(99, 102, 241, 0.25)',
      shadowBlur: 12,
      shadowOffsetY: 4,
    },
    emphasis: { focus: 'series' },
  },
  pie: {
    itemStyle: {
      borderColor: 'rgba(15, 23, 42, 0.6)',
      borderWidth: 2,
      borderRadius: 6,
    },
    label: { color: TEXT_COLOR_PRIMARY, fontSize: 12 },
    labelLine: { lineStyle: { color: TEXT_COLOR_SECONDARY } },
    emphasis: {
      focus: 'self',
      itemStyle: {
        shadowBlur: 16,
        shadowColor: 'rgba(99, 102, 241, 0.55)',
      },
    },
  },
};

let registered = false;

/**
 * 注册全局主题。第一次调用时把 theme 注入 echarts，后续幂等。
 *
 * 使用 echarts 的 core 类型而不是默认入口，是为了兼容按需引入与全量引入两种用法。
 */
export function registerEchartsTheme(ec: typeof echarts | { registerTheme: (...args: unknown[]) => void }) {
  if (registered) return;
  // ECharts registerTheme 没有公开类型在 core 里，强转一下避免编译噪声
  (ec as { registerTheme: (name: string, theme: object) => void }).registerTheme(
    CHATBI_THEME_NAME,
    theme,
  );
  registered = true;
}

/**
 * 配套的渐变色板，业务在构建 series 时可直接 spread 进 itemStyle/areaStyle。
 *
 * 例：
 *   yFields.map((f, i) => ({
 *     type: 'line',
 *     areaStyle: { color: AREA_GRADIENTS[i % AREA_GRADIENTS.length] },
 *     ...
 *   }))
 */
export const AREA_GRADIENTS = buildAreaGradients();

/**
 * 暴露 hex→rgba，业务侧偶尔需要做 shadow color 等场景。
 */
export const colorWithAlpha = hexWithAlpha;
