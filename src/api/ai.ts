/**
 * smart-ai 模块前端 API 封装。
 *
 * ⚠️ 关于响应解包：
 * 项目的 utils/request.ts 拦截器**不会**自动剥掉 R<T>，业务层拿到的是完整 AxiosResponse。
 * 老的 flow 模块是在每个调用点手写 `axiosRes.data.data.records` —— 重复且易错。
 * 这里我们在 API 层一次性剥包：用 `unwrap` / `unwrapPage` 包装所有调用，
 * 让上层 vue 页面可以直接用 `result.records / result.data` 这种自然写法。
 *
 * 不动 utils/request.ts 是为了避免影响 flow / admin 等模块的现有调用方式。
 */
import request from '@/utils/request';
import type { AxiosResponse } from 'axios';
import type {
  AiModelProvider,
  AiModelConfig,
  AiConversation,
  AiMessage,
  ChatRequest,
  AiAgent,
  AgentSaveCmd,
  AiMcpServer,
  AiMcpTool,
  AiKnowledgeBase,
  AiKnowledgeDocument,
} from '@/types/ai';
import type { PageResult, R } from '@/types/api';

/**
 * 把 axios 响应剥到 R<T>.data。后端约定 code===0 才是成功，
 * 拦截器已经在非 0 时统一弹错并 reject，所以这里只关心成功路径。
 */
function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return (promise as unknown as Promise<AxiosResponse<R<T>>>).then((res) => res.data.data);
}

// ============================================================================
// 模型供应商
// ============================================================================

export function pageProviders(current = 1, size = 10, keyword?: string) {
  return unwrap<PageResult<AiModelProvider>>(
    request.get('/ai/model-provider/page', { params: { current, size, keyword } }),
  );
}

export function listProviders() {
  return unwrap<AiModelProvider[]>(request.get('/ai/model-provider/list'));
}

export function getProvider(id: number) {
  return unwrap<AiModelProvider>(request.get(`/ai/model-provider/${id}`));
}

export function saveProvider(data: Partial<AiModelProvider>) {
  return data.id
    ? unwrap<void>(request.put('/ai/model-provider', data))
    : unwrap<number>(request.post('/ai/model-provider', data));
}

export function deleteProvider(id: number) {
  return unwrap<void>(request.delete(`/ai/model-provider/${id}`));
}

// ============================================================================
// 模型配置
// ============================================================================

export function pageModelConfigs(current = 1, size = 10, providerId?: number, keyword?: string) {
  return unwrap<PageResult<AiModelConfig>>(
    request.get('/ai/model-config/page', { params: { current, size, providerId, keyword } }),
  );
}

export function listModelConfigs() {
  return unwrap<AiModelConfig[]>(request.get('/ai/model-config/list'));
}

export function getModelConfig(id: number) {
  return unwrap<AiModelConfig>(request.get(`/ai/model-config/${id}`));
}

export function saveModelConfig(data: Partial<AiModelConfig>) {
  return data.id
    ? unwrap<void>(request.put('/ai/model-config', data))
    : unwrap<number>(request.post('/ai/model-config', data));
}

export function deleteModelConfig(id: number) {
  return unwrap<void>(request.delete(`/ai/model-config/${id}`));
}

// ============================================================================
// 对话
// ============================================================================

export function pageConversations(current = 1, size = 20) {
  return unwrap<PageResult<AiConversation>>(
    request.get('/ai/chat/conversations', { params: { current, size } }),
  );
}

export function getConversation(id: number) {
  return unwrap<AiConversation>(request.get(`/ai/chat/conversations/${id}`));
}

export function listMessages(conversationId: number) {
  return unwrap<AiMessage[]>(request.get(`/ai/chat/conversations/${conversationId}/messages`));
}

export function renameConversation(id: number, title: string) {
  return unwrap<void>(
    request.put(`/ai/chat/conversations/${id}/title`, null, { params: { title } }),
  );
}

export function togglePinConversation(id: number) {
  return unwrap<void>(request.put(`/ai/chat/conversations/${id}/pin`));
}

export function deleteConversation(id: number) {
  return unwrap<void>(request.delete(`/ai/chat/conversations/${id}`));
}

/**
 * 发送对话消息（非流式兜底）。
 * SSE 流式由 ai-chat.vue 自己用 fetch + ReadableStream 调用 CHAT_SSE_URL，不走这里。
 */
export function sendMessage(data: ChatRequest) {
  return unwrap<AiMessage>(request.post('/ai/chat/send', data));
}

/**
 * SSE 流式对话的 URL（前端 fetch 直接拼接用）。
 * ⚠️ 必须带 `/api` 前缀，因为 fetch 不会走 axios 的 baseURL，
 * 否则 vite/nginx 不会把请求转给后端，会变成访问 vue 的静态资源 → 404。
 */
export const CHAT_SSE_URL = '/api/ai/chat/send';

// ============================================================================
// Agent 智能体
// ============================================================================

export function pageAgents(current = 1, size = 12, keyword?: string, category?: string) {
  return unwrap<PageResult<AiAgent>>(
    request.get('/ai/agent/page', { params: { current, size, keyword, category } }),
  );
}

export function getAgent(id: number) {
  return unwrap<AiAgent>(request.get(`/ai/agent/${id}`));
}

export function saveAgent(cmd: AgentSaveCmd) {
  return cmd.id
    ? unwrap<void>(request.put('/ai/agent', cmd))
    : unwrap<number>(request.post('/ai/agent', cmd));
}

export function deleteAgent(id: number) {
  return unwrap<void>(request.delete(`/ai/agent/${id}`));
}

/** 查询某个 Agent 已绑定的 MCP 工具 ID 列表（编辑表单回填用） */
export function getAgentToolIds(id: number) {
  return unwrap<number[]>(request.get(`/ai/agent/${id}/tools`));
}

/** 查询某个 Agent 已绑定的知识库 ID 列表（编辑表单回填用） */
export function getAgentKnowledgeBaseIds(id: number) {
  return unwrap<number[]>(request.get(`/ai/agent/${id}/knowledge-bases`));
}

// ============================================================================
// MCP 服务器 & 工具
// ============================================================================

export function pageMcpServers(current = 1, size = 10, keyword?: string) {
  return unwrap<PageResult<AiMcpServer>>(
    request.get('/ai/mcp/server/page', { params: { current, size, keyword } }),
  );
}

export function getMcpServer(id: number) {
  return unwrap<AiMcpServer>(request.get(`/ai/mcp/server/${id}`));
}

export function saveMcpServer(data: Partial<AiMcpServer>) {
  return data.id
    ? unwrap<void>(request.put('/ai/mcp/server', data))
    : unwrap<number>(request.post('/ai/mcp/server', data));
}

export function deleteMcpServer(id: number) {
  return unwrap<void>(request.delete(`/ai/mcp/server/${id}`));
}

export function listMcpTools(serverId: number) {
  return unwrap<AiMcpTool[]>(request.get(`/ai/mcp/server/${serverId}/tools`));
}

/** 列出所有启用的 MCP 工具（用于 Agent 绑定下拉选择） */
export function listAllMcpTools() {
  return unwrap<AiMcpTool[]>(request.get('/ai/mcp/tool/list'));
}

/**
 * 同步指定 MCP server 的工具列表（后端会调 server 的 JSON-RPC tools/list 并写入 ai_mcp_tool 表）。
 * 新增 server 后必须先同步，才能在 Agent 编辑下拉里看到工具。
 * 返回值是本次同步成功写入/更新的工具数量。
 */
export function syncMcpTools(serverId: number) {
  return unwrap<number>(request.post(`/ai/mcp/server/${serverId}/sync-tools`));
}

// ============================================================================
// RAG 知识库
// ============================================================================

export function pageKnowledgeBases(current = 1, size = 10, keyword?: string) {
  return unwrap<PageResult<AiKnowledgeBase>>(
    request.get('/ai/knowledge/page', { params: { current, size, keyword } }),
  );
}

export function getKnowledgeBase(id: number) {
  return unwrap<AiKnowledgeBase>(request.get(`/ai/knowledge/${id}`));
}

export function saveKnowledgeBase(data: Partial<AiKnowledgeBase>) {
  return data.id
    ? unwrap<void>(request.put('/ai/knowledge', data))
    : unwrap<number>(request.post('/ai/knowledge', data));
}

export function deleteKnowledgeBase(id: number) {
  return unwrap<void>(request.delete(`/ai/knowledge/${id}`));
}

export function pageKnowledgeDocuments(kbId: number, current = 1, size = 10) {
  return unwrap<PageResult<AiKnowledgeDocument>>(
    request.get(`/ai/knowledge/${kbId}/documents`, { params: { current, size } }),
  );
}

export function deleteKnowledgeDocument(id: number) {
  return unwrap<void>(request.delete(`/ai/knowledge/documents/${id}`));
}

/** 添加文档到知识库（以已上传文件 URL 创建文档记录） */
export function addKnowledgeDocument(params: {
  kbId: number;
  docName: string;
  docType: string;
  fileUrl: string;
  fileSize?: number;
}) {
  return unwrap<number>(request.post('/ai/knowledge/documents', null, { params }));
}

/** 触发文档异步解析 */
export function parseKnowledgeDocument(id: number) {
  return unwrap<string>(request.post(`/ai/knowledge/documents/${id}/parse`));
}

/**
 * 重新索引整个知识库 —— 重新解析所有文档并生成 embedding 向量。
 * 适用场景：① 新配置了 embedding 模型；② 切换了 embedding 模型；③ 调整了分片参数。
 */
export function reindexKnowledgeBase(id: number) {
  return unwrap<string>(request.post(`/ai/knowledge/bases/${id}/reindex`));
}

/** 文件上传响应 */
export interface FileUploadResult {
  originalName: string;
  fileName: string;
  relativePath: string;
  url: string;
  size: number;
  contentType: string;
}

/** 上传文件到 AI 模块（知识库文档、Agent 头像、多模态图片） */
export function uploadAiFile(file: File, category = 'default') {
  return unwrap<FileUploadResult>(
    (() => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      return request.post('/ai/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    })(),
  );
}
