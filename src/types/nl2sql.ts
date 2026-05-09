/**
 * NL2SQL 模块类型定义。
 * 与后端 smart-nl2sql-api 的 DTO 严格对应（字段名 camelCase）。
 */

// ============================================================================
// 枚举（与后端 enum 的 code 一致）
// ============================================================================

/** 数据源类型 */
export type DataSourceType = 'mysql' | 'postgresql' | 'oracle' | 'gaussdb';

/** 图表类型 */
export type ChartType = 'table' | 'bar' | 'line' | 'pie';

/** 数据集学习状态：0=未学习 1=学习中 2=已学习 3=失败 */
export type LearnStatus = 0 | 1 | 2 | 3;

/** 知识类型 */
export type KnowledgeType = 'sql_example' | 'term' | 'rule' | 'mapping';

// ============================================================================
// 数据源
// ============================================================================

export interface Nl2sqlDatasource {
  id: number;
  name: string;
  type: DataSourceType | string;
  host: string;
  port: number;
  databaseName?: string;
  schemaName?: string;
  username: string;
  /** 密码：列表接口为安全考虑通常返回空字符串；保存时必填 */
  password?: string;
  extraParams?: string;
  status?: number;
  description?: string;
  lastTestTime?: string;
  lastTestStatus?: number;
  createTime?: string;
  updateTime?: string;
}

/** 创建/更新 表单提交结构 */
export type DataSourceDTO = Partial<Nl2sqlDatasource>;

/** 仅用于「未保存的连接测试」（表单上的"测试连接"按钮） */
export interface DataSourceTestCmd {
  type: string;
  host: string;
  port: number;
  databaseName?: string;
  schemaName?: string;
  username: string;
  password: string;
}

/** 远端表的元数据（数据源 → 表列表） */
export interface TableMeta {
  tableName: string;
  tableComment?: string;
  /** TABLE or VIEW */
  tableType?: string;
}

/** 远端列的元数据（数据源 → 表 → 列） */
export interface ColumnMeta {
  columnName: string;
  columnType: string;
  columnComment?: string;
  isNullable?: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
}

// ============================================================================
// 数据集
// ============================================================================

export interface Nl2sqlDataset {
  id: number;
  name: string;
  datasourceId: number;
  description?: string;
  /** 0=未学 1=学习中 2=已学 3=失败 */
  learnStatus?: LearnStatus;
  learnTime?: string;
  status?: number;
  createTime?: string;
  updateTime?: string;
}

export interface DataSetTable {
  id?: number;
  datasetId?: number;
  tableName: string;
  tableComment?: string;
  tableAlias?: string;
}

export interface DataSetColumn {
  id?: number;
  datasetId?: number;
  tableName: string;
  columnName: string;
  columnType?: string;
  columnComment?: string;
  /** 用户自定义备注 —— NL2SQL 准确率的核心 */
  userRemark?: string;
  sampleValues?: string;
  isDimension?: boolean;
  isMeasure?: boolean;
  isPrimaryKey?: boolean;
  sortOrder?: number;
}

/** AI 字段评估命令（与后端 ColumnAiEvaluateCmd 对应） */
export interface ColumnAiEvaluateCmd {
  /** 限定表；为空表示所有表 */
  tableNames?: string[];
  /** 限定字段 id；为空表示所有字段 */
  columnIds?: number[];
  /** 是否只评估 user_remark 为空的字段，默认 true */
  onlyEmptyRemark?: boolean;
}

/** AI 字段评估建议（与后端 ColumnAiSuggestionVO 对应） */
export interface ColumnAiSuggestion {
  columnId: number;
  tableName: string;
  columnName: string;
  columnType?: string;
  /** 当前已存在的用户备注（用于判断是否高亮"已维护"） */
  currentUserRemark?: string;
  /** AI 建议的备注 */
  suggestedRemark?: string;
  /** AI 建议的维度标记 */
  suggestedIsDimension?: boolean;
  /** AI 建议的度量标记 */
  suggestedIsMeasure?: boolean;
}

export interface DataSetRelation {
  id?: number;
  datasetId?: number;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  /** LEFT JOIN / INNER JOIN / RIGHT JOIN */
  relationType?: string;
}

/** 数据集详情（含子项） */
export interface DataSetDetail extends Nl2sqlDataset {
  tables?: DataSetTable[];
  columns?: DataSetColumn[];
  relations?: DataSetRelation[];
}

// ============================================================================
// 知识库
// ============================================================================

export interface Nl2sqlKnowledge {
  id: number;
  datasetId: number;
  type: KnowledgeType | string;
  title?: string;
  content: string;
  status?: number;
  createTime?: string;
  updateTime?: string;
}

// ============================================================================
// 对话 / 会话
// ============================================================================

export interface Nl2sqlSession {
  id: number;
  title?: string;
  datasetId: number;
  modelId?: number;
  userId?: number;
  createTime?: string;
  updateTime?: string;
}

/** 创建会话表单 */
export interface Nl2SqlSessionDTO {
  id?: number;
  title?: string;
  datasetId: number;
  modelId?: number;
}

/** 提问命令 */
export interface Nl2SqlChatCmd {
  /** 不传则自动创建会话 */
  sessionId?: number;
  datasetId: number;
  modelId?: number;
  question: string;
}

/** 单条消息 / 一次问答的完整结果 */
export interface Nl2SqlChatVO {
  type?: string;
  content?: string;
  sql?: string;
  /** 后端 query_result 字段，是 JSON 字符串 */
  queryResult?: string;
  resultCount?: number;
  executionTime?: number;
  chartType?: string;
  /** ECharts 推荐配置 JSON 字符串 */
  chartConfig?: string;
  /** 维度字段元数据 JSON 字符串 */
  dimensions?: string;
  /** 度量字段元数据 JSON 字符串 */
  measures?: string;
  dataInsight?: string;
  errorMessage?: string;
  sessionId?: number;
  messageId?: number;
}

/** SQL 编辑命令 */
export interface SqlEditCmd {
  sql: string;
}

// ============================================================================
// 图表配置（前端从 chartConfig JSON 解析后用于 ECharts option 构造）
// ============================================================================

export interface ChartRecommendConfig {
  title?: string;
  xAxisField?: string;
  yAxisFields?: string[];
  /** pie 图用的分组字段 */
  groupField?: string;
  /** pie 图用的数值字段 */
  valueField?: string;
}

/** 字段元数据（dimensions / measures JSON 解析后） */
export interface FieldInfo {
  alias: string;
  expression: string;
}
