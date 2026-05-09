/**
 * 图表渲染器统一入口。
 *
 * 设计要点：
 * 1. 所有渲染器统一签名：(source: string, container: HTMLElement) => Promise<void>
 *    渲染结果直接写入 container.innerHTML / appendChild，调用方无需关心 API 差异。
 * 2. 第三方库按需懒加载（动态 import），避免首屏把 mermaid/viz 的 ~1MB JS 全打进来。
 * 3. mermaid 实例全局只 init 一次（避免重复初始化警告 + 性能浪费）。
 * 4. Infographic 走 ECharts，约定 source 为 JSON 字符串（ECharts option），
 *    由用户/LLM 输出标准 ECharts 配置。
 */

/** 支持的图表语言（与 markdown.ts 的 DIAGRAM_LANGS 对齐） */
export type DiagramLang = 'mermaid' | 'plantuml' | 'dot' | 'flow' | 'infographic';

/* ---------------- Mermaid ---------------- */

let mermaidInited = false;

async function getMermaid() {
  const mod = await import('mermaid');
  const mermaid = mod.default;
  if (!mermaidInited) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose', // 允许 click 等交互；如需更严请改 strict
      flowchart: { htmlLabels: true, curve: 'basis' },
      themeVariables: { fontFamily: 'inherit' },
    });
    mermaidInited = true;
  }
  return mermaid;
}

async function renderMermaid(source: string, container: HTMLElement): Promise<void> {
  const mermaid = await getMermaid();
  // 每次渲染用唯一 id，避免 SVG id 冲突
  const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { svg } = await mermaid.render(id, source);
  container.innerHTML = svg;
}

/* ---------------- Graphviz / DOT ---------------- */

let vizInstance: { renderSVGElement: (src: string) => SVGSVGElement } | null = null;

async function getViz() {
  if (vizInstance) return vizInstance;
  const { instance } = await import('@viz-js/viz');
  vizInstance = (await instance()) as unknown as typeof vizInstance;
  return vizInstance!;
}

async function renderDot(source: string, container: HTMLElement): Promise<void> {
  const viz = await getViz();
  const svgElement = viz.renderSVGElement(source);
  container.innerHTML = '';
  container.appendChild(svgElement);
}

/* ---------------- Flowchart.js ---------------- */

async function renderFlow(source: string, container: HTMLElement): Promise<void> {
  // flowchart.js 依赖全局 Raphael
  await import('raphael');
  const flowchart = (await import('flowchart.js')).default as {
    parse: (src: string) => { drawSVG: (target: HTMLElement, opts?: unknown) => void };
  };
  container.innerHTML = '';
  const diagram = flowchart.parse(source);
  diagram.drawSVG(container, {
    'line-width': 2,
    'font-size': 14,
    'font-family': 'inherit',
  });
}

/* ---------------- Infographic（ECharts） ---------------- */

/** ECharts 中常见的"对象型"配置字段，AI 可能误写为布尔值 */
const ECHARTS_OBJECT_FIELDS = [
  'tooltip', 'legend', 'grid', 'dataZoom', 'visualMap',
  'toolbox', 'brush', 'geo', 'parallel', 'parallelAxis',
  'timeline', 'graphic', 'calendar', 'dataset', 'aria',
] as const;

/**
 * 修正 ECharts option 中常见的 AI 生成错误：
 * - 布尔值字段 → 空对象（如 tooltip: true → tooltip: {}）
 * - 布尔值 false → 移除该字段（等价于不启用）
 */
function sanitizeEChartsOption(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };
  for (const field of ECHARTS_OBJECT_FIELDS) {
    if (field in result) {
      if (result[field] === true) {
        result[field] = {};
      } else if (result[field] === false) {
        delete result[field];
      }
    }
  }
  return result;
}

/**
 * 判断 JSON 是否为自定义 Infographic 数据结构（非原生 ECharts option）。
 * 特征：包含 stages / layout / centerLabel 等自定义字段。
 */
function isCustomInfographicData(data: Record<string, unknown>): boolean {
  return 'stages' in data || 'layout' in data || 'centerLabel' in data || 'centerIcon' in data;
}

/**
 * 将自定义 Infographic 数据结构转换为 ECharts option。
 * 支持 PLC 生命周期图、阶段环图等常见 AI 生成格式。
 */
function convertCustomToEChartsOption(data: Record<string, unknown>): Record<string, unknown> {
  const title = (data.title as string) ?? '';
  const subtitle = (data.subtitle as string) ?? '';
  const stages = (data.stages as Array<Record<string, unknown>>) ?? [];
  const centerLabel = (data.centerLabel as string) ?? '';
  const centerIcon = (data.centerIcon as string) ?? '';

  // 构建饼图 + 富文本标签展示各阶段
  const pieData = stages.map((stage) => {
    const metrics = (stage.metrics as Array<Record<string, unknown>>) ?? [];
    const metricsText = metrics.map((m) => `${m.label}: ${m.value}${m.unit ?? ''}`).join('\n');
    const strategy = (stage.strategy as string) ?? '';
    return {
      name: stage.name as string,
      value: (stage.duration as number) ?? 1,
      itemStyle: { color: stage.color as string },
      label: {
        show: true,
        formatter: `{name|${stage.name}}\n{hr|}\n{metrics|${metricsText}}`,
        rich: {
          name: { fontSize: 14, fontWeight: 'bold', color: stage.color as string, lineHeight: 22 },
          hr: { borderColor: '#e4e7ed', width: '100%', borderWidth: 0.5, height: 0, lineHeight: 8 },
          metrics: { fontSize: 11, color: '#606266', lineHeight: 18 },
        },
      },
      tooltip: {
        formatter: `<b>${stage.name}</b><br/>${metricsText.replace(/\n/g, '<br/>')}<br/><br/>策略: ${strategy.replace(/\n/g, ', ')}`,
      },
    };
  });

  return {
    title: {
      text: `${centerIcon} ${title}`.trim(),
      subtext: subtitle,
      left: 'center',
      top: 10,
      textStyle: { fontSize: 18, fontWeight: 'bold', color: '#303133' },
      subtextStyle: { fontSize: 13, color: '#909399' },
    },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['30%', '55%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 6 },
        label: {
          show: true,
          position: 'outside',
          overflow: 'break',
          width: 140,
        },
        labelLine: { length: 20, length2: 30 },
        emphasis: {
          label: { fontSize: 14, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
        },
        data: pieData,
      },
    ],
    graphic: centerLabel
      ? [
          {
            type: 'text',
            left: 'center',
            top: '52%',
            style: {
              text: `${centerIcon}\n${centerLabel}`,
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 'bold',
              fill: '#303133',
              lineHeight: 24,
            },
          },
        ]
      : [],
  };
}

async function renderInfographic(source: string, container: HTMLElement): Promise<void> {
  const echarts = await import('echarts');
  let rawOption: Record<string, unknown>;
  try {
    rawOption = JSON.parse(source) as Record<string, unknown>;
  } catch {
    throw new Error('Infographic 源码必须是合法的 JSON');
  }

  // 判断是自定义数据结构还是原生 ECharts option，分别处理
  let option: Record<string, unknown>;
  if (isCustomInfographicData(rawOption)) {
    option = convertCustomToEChartsOption(rawOption);
  } else {
    option = sanitizeEChartsOption(rawOption);
  }

  // ECharts 需要明确的容器尺寸（仅当调用方未预设像素尺寸时才赋默认值）
  const hasExplicitWidth = container.style.width && container.style.width.endsWith('px');
  const hasExplicitHeight = container.style.height && container.style.height.endsWith('px');
  if (!hasExplicitWidth) container.style.width = '100%';
  if (!hasExplicitHeight) {
    container.style.height = isCustomInfographicData(rawOption) ? '520px' : '400px';
  }

  // 防止重复 init：先清掉旧实例
  const existing = echarts.getInstanceByDom(container);
  if (existing) existing.dispose();
  const chart = echarts.init(container);
  chart.setOption(option as echarts.EChartsCoreOption);
}

/* ---------------- PlantUML（后端代理） ---------------- */

async function renderPlantUmlOnFrontend(source: string, container: HTMLElement): Promise<void> {
  const { renderPlantUml } = await import('@/api/diagram');
  const svg = await renderPlantUml(source);
  container.innerHTML = svg;
}

/* ---------------- 统一入口 ---------------- */

export const DIAGRAM_LABELS: Record<DiagramLang, string> = {
  mermaid: 'Mermaid 流程图/思维导图',
  plantuml: 'PlantUML',
  dot: 'Graphviz (DOT)',
  flow: 'Flowchart',
  infographic: 'Infographic (ECharts)',
};

/**
 * 根据语言渲染对应图表到 container 中。
 * 调用方负责捕获异常并展示错误 UI（DiagramBlock.vue 已处理）。
 */
export async function renderDiagram(
  lang: DiagramLang,
  source: string,
  container: HTMLElement,
): Promise<void> {
  switch (lang) {
    case 'mermaid':
      return renderMermaid(source, container);
    case 'plantuml':
      return renderPlantUmlOnFrontend(source, container);
    case 'dot':
      return renderDot(source, container);
    case 'flow':
      return renderFlow(source, container);
    case 'infographic':
      return renderInfographic(source, container);
    default:
      throw new Error(`不支持的图表类型: ${lang as string}`);
  }
}

/**
 * 各图表语言的快捷模板，供「📊 图表」按钮一键插入。
 */
export const DIAGRAM_TEMPLATES: Record<DiagramLang, string> = {
  mermaid: `\`\`\`mermaid
flowchart LR
  A[开始] --> B{判断}
  B -- 是 --> C[处理1]
  B -- 否 --> D[处理2]
  C --> E[结束]
  D --> E
\`\`\``,
  plantuml: `\`\`\`plantuml
@startuml
Alice -> Bob: 你好
Bob --> Alice: 你好，Alice
@enduml
\`\`\``,
  dot: `\`\`\`dot
digraph G {
  rankdir=LR;
  A -> B -> C;
  B -> D;
}
\`\`\``,
  flow: `\`\`\`flow
st=>start: 开始
op=>operation: 处理
cond=>condition: 判断?
e=>end: 结束
st->op->cond
cond(yes)->e
cond(no)->op
\`\`\``,
  infographic: `\`\`\`infographic
{
  "title": { "text": "示例柱状图" },
  "tooltip": {},
  "xAxis": { "data": ["A","B","C","D","E"] },
  "yAxis": {},
  "series": [{ "type": "bar", "data": [5, 20, 36, 10, 18] }]
}
\`\`\``,
};
