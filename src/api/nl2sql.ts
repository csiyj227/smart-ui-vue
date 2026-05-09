/**
 * smart-nl2sql 模块前端 API 封装。
 *
 * ⚠️ 关于响应解包：
 * 项目的 utils/request.ts 拦截器**不会**自动剥掉 R<T>，业务层拿到的是完整 AxiosResponse。
 * 沿用 ai.ts 的做法：在 API 层用 `unwrap` 包装所有调用，让上层 vue 页面可以直接用
 * `result.records` / `result.data` 这种自然写法。
 */
import request from '@/utils/request';
import type { AxiosResponse } from 'axios';
import type { PageResult, R } from '@/types/api';
import type {
  Nl2sqlDatasource,
  DataSourceDTO,
  DataSourceTestCmd,
  TableMeta,
  ColumnMeta,
  Nl2sqlDataset,
  DataSetDetail,
  DataSetTable,
  DataSetColumn,
  DataSetRelation,
  Nl2sqlKnowledge,
  Nl2sqlSession,
  Nl2SqlSessionDTO,
  Nl2SqlChatCmd,
  Nl2SqlChatVO,
  ColumnAiEvaluateCmd,
  ColumnAiSuggestion,
} from '@/types/nl2sql';

function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return (promise as unknown as Promise<AxiosResponse<R<T>>>).then((res) => res.data.data);
}

// ============================================================================
// 数据源管理
// ============================================================================

export function pageDataSources(current = 1, size = 10, keyword?: string) {
  return unwrap<PageResult<Nl2sqlDatasource>>(
    request.get('/nl2sql/datasource/page', { params: { current, size, keyword } }),
  );
}

export function getDataSource(id: number) {
  return unwrap<Nl2sqlDatasource>(request.get(`/nl2sql/datasource/${id}`));
}

export function saveDataSource(data: DataSourceDTO) {
  return data.id
    ? unwrap<void>(request.put(`/nl2sql/datasource/${data.id}`, data))
    : unwrap<void>(request.post('/nl2sql/datasource', data));
}

export function deleteDataSource(id: number) {
  return unwrap<void>(request.delete(`/nl2sql/datasource/${id}`));
}

/** 用「未保存的配置」测连通性（表单"测试"按钮用） */
export function testDataSource(cmd: DataSourceTestCmd) {
  return unwrap<boolean>(request.post('/nl2sql/datasource/test', cmd));
}

/** 用「已保存的数据源」测连通性 */
export function testDataSourceById(id: number) {
  return unwrap<boolean>(request.post(`/nl2sql/datasource/${id}/test`));
}

export function listRemoteTables(id: number) {
  return unwrap<TableMeta[]>(request.get(`/nl2sql/datasource/${id}/tables`));
}

export function listRemoteColumns(id: number, tableName: string) {
  return unwrap<ColumnMeta[]>(
    request.get(`/nl2sql/datasource/${id}/tables/${tableName}/columns`),
  );
}

// ============================================================================
// 数据集管理
// ============================================================================

export function pageDataSets(current = 1, size = 10, keyword?: string) {
  return unwrap<PageResult<Nl2sqlDataset>>(
    request.get('/nl2sql/dataset/page', { params: { current, size, keyword } }),
  );
}

export function getDataSetDetail(id: number) {
  return unwrap<DataSetDetail>(request.get(`/nl2sql/dataset/${id}`));
}

export function createDataSet(data: Partial<DataSetDetail>) {
  return unwrap<number>(request.post('/nl2sql/dataset', data));
}

export function updateDataSet(id: number, data: Partial<DataSetDetail>) {
  return unwrap<void>(request.put(`/nl2sql/dataset/${id}`, data));
}

export function deleteDataSet(id: number) {
  return unwrap<void>(request.delete(`/nl2sql/dataset/${id}`));
}

/** 触发后端从 datasource 同步表结构到数据集 */
export function syncDataSetTables(id: number) {
  return unwrap<void>(request.post(`/nl2sql/dataset/${id}/sync`));
}

/** 全量替换数据集的表列表 */
export function replaceDataSetTables(id: number, tables: DataSetTable[]) {
  return unwrap<void>(request.put(`/nl2sql/dataset/${id}/tables`, tables));
}

/** 批量更新字段（核心：用户备注 / 维度 / 度量） */
export function updateDataSetColumns(id: number, columns: DataSetColumn[]) {
  return unwrap<void>(request.put(`/nl2sql/dataset/${id}/columns`, columns));
}

/** 全量替换数据集的表关系 */
export function replaceDataSetRelations(id: number, relations: DataSetRelation[]) {
  return unwrap<void>(request.put(`/nl2sql/dataset/${id}/relations`, relations));
}

/**
 * AI 评估字段含义。仅返回建议，不直接落库。
 * 用户在 UI 上单条/批量"采纳"后，前端拼装好新的 columns 数组再走 updateDataSetColumns 持久化。
 *
 * @param datasetId 数据集 id
 * @param cmd 可选，限定表/字段子集；不传则评估所有 user_remark 为空的字段
 */
export function evaluateDataSetColumns(datasetId: number, cmd?: ColumnAiEvaluateCmd) {
  return unwrap<ColumnAiSuggestion[]>(
    request.post(`/nl2sql/dataset/${datasetId}/columns/ai-evaluate`, cmd ?? {}),
  );
}

/**
 * 触发数据集「学习」。后端会做：
 *   1. 完备性校验（必须有表 + 有字段）
 *   2. AI 自动补全所有空 user_remark（autoFillRemark=true 时，**直接落库**）
 *   3. 更新 learn_status: 1(学习中) → 2(已学习) / 3(失败)
 * 学习成功后这个数据集才能在 NL2SQL 对话中被选用（推荐流程）。
 *
 * @param id 数据集 id
 * @param autoFillRemark 是否让 AI 自动补全空字段备注，默认 true
 */
export function learnDataset(id: number, autoFillRemark = true) {
  return unwrap<void>(
    request.post(`/nl2sql/dataset/${id}/learn`, null, { params: { autoFillRemark } }),
  );
}

// ============================================================================
// 知识库管理
// ============================================================================

export function pageKnowledge(
  current = 1,
  size = 10,
  datasetId: number,
  type?: string,
) {
  return unwrap<PageResult<Nl2sqlKnowledge>>(
    request.get('/nl2sql/knowledge/page', { params: { current, size, datasetId, type } }),
  );
}

export function saveKnowledge(data: Partial<Nl2sqlKnowledge>) {
  return data.id
    ? unwrap<void>(request.put(`/nl2sql/knowledge/${data.id}`, data))
    : unwrap<void>(request.post('/nl2sql/knowledge', data));
}

export function deleteKnowledge(id: number) {
  return unwrap<void>(request.delete(`/nl2sql/knowledge/${id}`));
}

// ============================================================================
// 对话 / 会话
// ============================================================================

export function pageSessions(current = 1, size = 20, datasetId?: number) {
  return unwrap<PageResult<Nl2sqlSession>>(
    request.get('/nl2sql/chat/session/page', { params: { current, size, datasetId } }),
  );
}

/**
 * 获取数据集的 AI 推荐问题（后端缓存 10 分钟）。
 * 前端在选择数据集或新建会话时调用，展示在欢迎页。
 */
export function getSuggestions(datasetId: number) {
  return unwrap<string[]>(request.get(`/nl2sql/chat/suggestions/${datasetId}`));
}

export function createSession(dto: Nl2SqlSessionDTO) {
  return unwrap<number>(request.post('/nl2sql/chat/session', dto));
}

export function getSessionDetail(id: number) {
  return unwrap<Nl2sqlSession>(request.get(`/nl2sql/chat/session/${id}`));
}

export function renameSession(id: number, title: string) {
  return unwrap<void>(
    request.put(`/nl2sql/chat/session/${id}/title`, null, { params: { title } }),
  );
}

export function deleteSession(id: number) {
  return unwrap<void>(request.delete(`/nl2sql/chat/session/${id}`));
}

export function listSessionMessages(sessionId: number) {
  return unwrap<Nl2SqlChatVO[]>(
    request.get('/nl2sql/chat/messages', { params: { sessionId } }),
  );
}

/**
 * 提问 - 普通（非流式）模式。
 * 后端会一次性返回 SQL → 执行 → 图表 → 洞察的完整结果。
 *
 * 后续会切换为 SSE 流式（参考 ai-chat.vue 的 CHAT_SSE_URL 用法），
 * 在每个阶段完成时即时推送给前端，提升体验。
 */
export function sendQuestion(cmd: Nl2SqlChatCmd) {
  return unwrap<Nl2SqlChatVO>(request.post('/nl2sql/chat/send', cmd));
}

/** SSE 流式提问的 URL（前端 fetch 直接拼接用，必须带 /api 前缀） */
export const NL2SQL_CHAT_SSE_URL = '/api/nl2sql/chat/send-stream';

/**
 * SSE 流式提问的事件类型。与后端 {@code Nl2SqlEngine.Stage} 严格对应（小写）。
 * - `session`：首问时后端建会话后立刻推送 `{sessionId}`
 * - `message`：助手 messageId 占位，后续每个阶段都会带这个 messageId
 * - `prompt_built`：Prompt 已构造（仅状态）
 * - `sql_generated`：SQL 已生成（payload.sql 可用）
 * - `sql_executed`：SQL 已执行（payload.rows / columns / rowCount / executionTime 可用）
 * - `analyzed`：维度/度量已解析（payload.dimensions / measures）
 * - `chart_recommended`：图表推荐已就绪（payload.chartType / chartConfig）
 * - `insight_generated`：数据洞察文本已生成（payload.dataInsight）
 * - `done`：完整 VO，可用于最终落库展示
 * - `failed` / `error`：异常
 */
export type Nl2SqlSseEvent =
  | 'session'
  | 'message'
  | 'prompt_built'
  | 'sql_generated'
  | 'sql_executed'
  | 'analyzed'
  | 'chart_recommended'
  | 'insight_generated'
  | 'done'
  | 'failed'
  | 'error';

export interface Nl2SqlStreamPayload {
  sessionId?: number;
  messageId?: number;
  sql?: string;
  rows?: Record<string, unknown>[];
  columns?: Array<{ name: string; jdbcType?: string }>;
  rowCount?: number;
  executionTime?: number;
  chartType?: string;
  chartConfig?: string;
  dimensions?: string;
  measures?: string;
  dataInsight?: string;
  errorMessage?: string;
  // done 阶段会带完整 VO 的所有字段
  [k: string]: unknown;
}

/**
 * 调用 SSE 流式提问。基于 fetch + ReadableStream 解析 `event:`/`data:` 协议，
 * 每个阶段触发 `onEvent`。用 AbortController 可在用户离开页面时取消。
 *
 * 该实现是手写的最小 SSE 解析器（而非浏览器原生 EventSource），原因是：
 *   1. 原生 EventSource 不支持 POST，无法在 body 里传 cmd
 *   2. 原生 EventSource 不能携带 Authorization header
 *
 * @param cmd 提问命令（同 sendQuestion）
 * @param onEvent 每收到一个 SSE 事件触发
 * @param signal 用于中途取消
 */
export async function sendQuestionStream(
  cmd: Nl2SqlChatCmd,
  onEvent: (event: Nl2SqlSseEvent, payload: Nl2SqlStreamPayload) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('token') ?? '';
  const resp = await fetch(NL2SQL_CHAT_SSE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(cmd),
    signal,
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`SSE 连接失败：HTTP ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // SSE 协议：事件块以空行分隔，每行可能是 "event: xxx" 或 "data: xxx"
  // 单个事件的多行 data 需要按换行拼接
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按事件块切分（空行分隔）
    let sepIdx;
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);

      let eventName: Nl2SqlSseEvent = 'done';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() as Nl2SqlSseEvent;
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) continue;
      const dataStr = dataLines.join('\n');
      try {
        const payload = JSON.parse(dataStr) as Nl2SqlStreamPayload;
        onEvent(eventName, payload);
      } catch {
        // 非 JSON 数据，原样塞进去
        onEvent(eventName, { raw: dataStr } as Nl2SqlStreamPayload);
      }
    }
  }
}

/** 编辑 SQL 并重新执行（图表/洞察会重新生成） */
export function editAndRerun(messageId: number, sql: string) {
  return unwrap<Nl2SqlChatVO>(
    request.post(`/nl2sql/chat/message/${messageId}/edit-sql`, { sql }),
  );
}

/** 仅切换图表类型（不重跑 SQL） */
export function switchChart(messageId: number, chartType?: string) {
  return unwrap<Nl2SqlChatVO>(
    request.post(`/nl2sql/chat/message/${messageId}/re-chart`, null, {
      params: chartType ? { chartType } : {},
    }),
  );
}

// ============================================================================
// 工具：解析后端返回的 JSON 字符串字段
// ============================================================================

/** chartConfig 为 JSON 字符串，安全 parse */
export function parseJsonField<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
