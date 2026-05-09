/**
 * 文生图 / 图表渲染相关 API。
 *
 * 目前仅 PlantUML 走后端代理（Kroki 服务在公网，前端直连有 CORS 风险，
 * 而且后续可能切换为内网部署的 Kroki，所以统一收口到后端）。
 * 其他图表（Mermaid / Graphviz / Flowchart / Infographic）均在前端直接渲染。
 */
import request from '@/utils/request';
import type { AxiosResponse } from 'axios';
import type { R } from '@/types/api';

function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return (promise as unknown as Promise<AxiosResponse<R<T>>>).then((res) => res.data.data);
}

/**
 * 渲染 PlantUML 源码为 SVG 字符串。
 * 后端会调用 Kroki（或私有 PlantUML Server）完成渲染，并把 SVG 内容透传回来。
 *
 * @param source PlantUML DSL 文本（不含 @startuml/@enduml 时后端会自动补齐）
 * @returns SVG 字符串（已是合法的 <svg>...</svg>，可直接 v-html 渲染）
 */
export function renderPlantUml(source: string) {
  return unwrap<string>(
    request.post('/ai/diagram/plantuml', { source }, { headers: { 'Content-Type': 'application/json' } }),
  );
}
