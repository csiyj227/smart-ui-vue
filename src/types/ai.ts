/** AI 模型供应商 */
export interface AiModelProvider {
  id: number
  providerName: string
  providerType: string
  baseUrl: string
  apiKey?: string
  apiKeyMasked?: string
  status: string
  sortOrder: number
  remark?: string
  createTime?: string
}

/** AI 模型配置 */
export interface AiModelConfig {
  id: number
  providerId: number
  providerName?: string
  modelName: string
  modelCode: string
  maxTokens: number
  temperature: number
  topP: number
  contextWindow: number
  supportVision: boolean
  supportFunctionCall: boolean
  status: string
  isDefault: boolean
  remark?: string
  createTime?: string
}

/** 对话 */
export interface AiConversation {
  id: number
  title: string
  modelConfigId: number
  modelName?: string
  agentId?: number
  agentName?: string
  userId: number
  messageCount: number
  totalTokens: number
  pinned: boolean
  createTime?: string
  updateTime?: string
}

/** 消息 */
export interface AiMessage {
  id: number
  conversationId: number
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
  content: string
  reasoningContent?: string
  contentType: string
  tokenCount?: number
  modelCode?: string
  attachments?: string
  toolCalls?: string
  toolResult?: string
  searchResults?: string
  status: string
  errorMsg?: string
  createTime?: string
}

/** 聊天请求 */
export interface ChatRequest {
  conversationId?: number
  modelConfigId: number
  agentId?: number
  content: string
  enableDeepThinking?: boolean
  enableWebSearch?: boolean
  imageUrls?: string[]
}

/** Agent 智能体 */
export interface AiAgent {
  id: number
  agentName: string
  avatar?: string
  description?: string
  systemPrompt: string
  welcomeMessage?: string
  modelConfigId: number
  modelName?: string
  temperatureOverride?: number
  enableWebSearch: boolean
  enableDeepThinking: boolean
  isPublic: boolean
  category?: string
  sortOrder: number
  status: string
  toolIds?: number[]
  knowledgeBaseIds?: number[]
  createTime?: string
}

/** Agent 保存命令（与后端 AgentCmd 对齐：扁平结构） */
export interface AgentSaveCmd extends Partial<AiAgent> {
  toolIds?: number[]
  knowledgeBaseIds?: number[]
}

/** MCP 服务器 */
export interface AiMcpServer {
  id: number
  serverName: string
  transportType: string
  serverUrl?: string
  command?: string
  args?: string
  envVars?: string
  status: string
  remark?: string
  tools?: AiMcpTool[]
  createTime?: string
}

/** MCP 工具 */
export interface AiMcpTool {
  id: number
  serverId: number
  serverName?: string
  toolName: string
  toolDescription?: string
  inputSchema?: string
  status: string
  createTime?: string
}

/** 知识库 */
export interface AiKnowledgeBase {
  id: number
  kbName: string
  description?: string
  embeddingModelId?: number
  embeddingModelName?: string
  similarityThreshold: number
  topK: number
  chunkSize: number
  chunkOverlap: number
  documentCount: number
  segmentCount: number
  status: string
  createTime?: string
}

/** 知识库文档 */
export interface AiKnowledgeDocument {
  id: number
  kbId: number
  docName: string
  docType: string
  fileUrl?: string
  fileSize?: number
  segmentCount: number
  tokenCount: number
  parseStatus: string
  errorMsg?: string
  createTime?: string
}

/** 供应商类型选项 */
export const PROVIDER_TYPES = [
  { label: 'OpenAI', value: 'OPENAI' },
  { label: '通义千问', value: 'DASHSCOPE' },
  { label: 'DeepSeek', value: 'DEEPSEEK' },
  { label: 'Ollama', value: 'OLLAMA' },
  { label: '自定义', value: 'CUSTOM' },
] as const

/** 传输类型选项 */
export const TRANSPORT_TYPES = [
  { label: 'SSE', value: 'SSE' },
  { label: 'STDIO', value: 'STDIO' },
] as const
