/**
 * smart-flow 设计器使用的领域类型集中定义。
 *
 * 与后端 com.smart.flow.api 包保持「字段名 + 字段含义」严格 1:1 对齐，因为前端
 * 直接 POST FlowChart DSL 给后端编译器，任何字段不一致都会导致编译失败。
 *
 * 这里没有把所有 DTO 都定义成 class，而是采用「interface + 常量数组」的写法：
 *   - interface 让 IDE 立即给出补全；
 *   - as const 数组让我们能从同一份枚举派生出 TS 类型 + 运行时下拉选项，
 *     避免「枚举改了但下拉没改」这种典型 bug。
 *
 * 注意：所有 key/id 字段都使用 string，是因为 BPMN 元素 id 必须以字母开头，
 * 而后端实体 id 才是 Long。这也避免了 JS 的 53-bit 整数精度问题。
 */

// ============================================================================
// 节点类型
// ============================================================================

/**
 * 与后端 FlowNodeKind 完全一致；新增节点类型时务必先改后端，否则编译失败。
 *
 * 顺序按「设计器面板从上到下」排列，这样 NODE_KIND_OPTIONS 派生出的下拉
 * 顺序就是设计师习惯的视觉顺序：开始 → 审批/通知/脚本 → 网关 → 结束。
 */
export const NODE_KINDS = [
  'START',
  'APPROVE',
  'NOTIFY',
  'SCRIPT',
  'BRANCH',
  'PARALLEL',
  'JOINT',
  'END',
] as const;

export type FlowNodeKind = (typeof NODE_KINDS)[number];

/**
 * 每种节点的元信息。组件渲染、左侧面板、属性面板都从这里读取，
 * 避免在 6 个节点组件里到处复制相同的 label/icon。
 */
export interface NodeKindMeta {
  /** 中文显示名 */
  label: string;
  /** 简短描述（hover tooltip 用） */
  description: string;
  /** Element Plus icon 组件名 */
  icon: string;
  /** 主色调（决定节点边框 / 面板高亮 / palette 角标颜色） */
  color: string;
  /**
   * 是否允许进入连线（START 不允许）。
   * 给画布的 isValidConnection 用，避免设计师误把箭头连到开始节点。
   */
  allowIncoming: boolean;
  /** 是否允许出连线（END 不允许）。 */
  allowOutgoing: boolean;
  /** 同一图中是否只能存在一个（START / END 都是 1 个）。 */
  singleton: boolean;
}

export const NODE_KIND_META: Record<FlowNodeKind, NodeKindMeta> = {
  START: {
    label: '开始',
    description: '流程入口，每个流程图必须有且仅有一个',
    icon: 'VideoPlay',
    color: '#67c23a',
    allowIncoming: false,
    allowOutgoing: true,
    singleton: true,
  },
  APPROVE: {
    label: '审批',
    description: '人工审批节点，由 AssigneeResolver 决定具体审批人',
    icon: 'User',
    color: '#409eff',
    allowIncoming: true,
    allowOutgoing: true,
    singleton: false,
  },
  NOTIFY: {
    label: '通知',
    description: '抄送 / 站内信 / 邮件，运行时不阻塞流程',
    icon: 'Bell',
    color: '#a78bfa',
    allowIncoming: true,
    allowOutgoing: true,
    singleton: false,
  },
  SCRIPT: {
    label: '脚本',
    description: '调用后端 Spring Bean，做自动化业务处理',
    icon: 'Cpu',
    color: '#e6a23c',
    allowIncoming: true,
    allowOutgoing: true,
    singleton: false,
  },
  BRANCH: {
    label: '条件分支',
    description: '排他网关，按条件表达式选择一条出边',
    icon: 'Share',
    color: '#f7ba2a',
    allowIncoming: true,
    allowOutgoing: true,
    singleton: false,
  },
  PARALLEL: {
    label: '并行分支',
    description: '并行网关，所有出边同时执行',
    icon: 'Connection',
    color: '#36cfc9',
    allowIncoming: true,
    allowOutgoing: true,
    singleton: false,
  },
  JOINT: {
    label: '汇聚',
    description: '并行汇聚网关，等待所有入边完成',
    icon: 'Aim',
    color: '#36cfc9',
    allowIncoming: true,
    allowOutgoing: true,
    singleton: false,
  },
  END: {
    label: '结束',
    description: '流程出口，可以有多个',
    icon: 'CircleClose',
    color: '#909399',
    allowIncoming: true,
    allowOutgoing: false,
    singleton: false,
  },
};

// ============================================================================
// 审批人解析策略
// ============================================================================

/**
 * 与后端内置的 AssigneeResolver SPI key 一一对应。
 * 自定义 resolver 也只需要在这里追加 key + ASSIGNEE_STRATEGY_META 配置。
 */
export const ASSIGNEE_STRATEGIES = [
  'user-fixed',
  'role',
  'dept',
  'leader-of-starter',
  'form-field',
  'spel',
] as const;

export type AssigneeStrategy = (typeof ASSIGNEE_STRATEGIES)[number];

/** 每种 strategy 对应的输入参数 schema —— 驱动 assignee-config.vue 自动渲染。 */
export interface AssigneeStrategyMeta {
  label: string;
  /** 简短帮助文字，显示在策略选择下拉框下方 */
  hint: string;
  /**
   * 该策略需要采集的字段；assignee-config.vue 会按这个数组自动出表单。
   * 字段比较少所以没有抽 component schema，直接 type 枚举驱动即可。
   */
  fields: AssigneeStrategyField[];
}

export interface AssigneeStrategyField {
  /** 字段名，会原样写到 FlowNodeDsl.properties.assigneeArgs 里 */
  key: string;
  /** 表单 label */
  label: string;
  /** 渲染控件类型；与 assignee-config.vue 里的 v-if 分支严格对齐 */
  type: 'text' | 'number' | 'multiUser' | 'multiRole' | 'multiDept' | 'select';
  required: boolean;
  /** type=select 时使用 */
  options?: { value: string; label: string }[];
  /** 占位提示 */
  placeholder?: string;
}

export const ASSIGNEE_STRATEGY_META: Record<AssigneeStrategy, AssigneeStrategyMeta> = {
  'user-fixed': {
    label: '指定用户',
    hint: '直接选择固定的几个用户作为审批人',
    fields: [
      { key: 'userIds', label: '用户列表', type: 'multiUser', required: true },
    ],
  },
  role: {
    label: '按角色',
    hint: '解析为「拥有指定角色的所有用户」',
    fields: [
      { key: 'roleIds', label: '角色列表', type: 'multiRole', required: true },
    ],
  },
  dept: {
    label: '按部门',
    hint: '解析为「指定部门下的所有成员」',
    fields: [
      { key: 'deptIds', label: '部门列表', type: 'multiDept', required: true },
      {
        key: 'includeChildren',
        label: '是否包含下级部门',
        type: 'select',
        required: false,
        options: [
          { value: 'true', label: '包含' },
          { value: 'false', label: '不包含' },
        ],
      },
    ],
  },
  'leader-of-starter': {
    label: '发起人的上级',
    hint: '沿组织架构向上追溯第 N 级直属上级',
    fields: [
      {
        key: 'level',
        label: '向上几级',
        type: 'number',
        required: true,
        placeholder: '默认 1',
      },
    ],
  },
  'form-field': {
    label: '取自表单字段',
    hint: '从启动表单的指定字段读取用户 id 列表',
    fields: [
      {
        key: 'field',
        label: '表单字段名',
        type: 'text',
        required: true,
        placeholder: '例如：approverIds',
      },
    ],
  },
  spel: {
    label: 'SpEL 表达式',
    hint: '高级用法：用 SpEL 自由表达，返回 List<Long>',
    fields: [
      {
        key: 'expression',
        label: '表达式',
        type: 'text',
        required: true,
        placeholder: "#starterId == 1 ? T(java.util.List).of(2L,3L) : ...",
      },
    ],
  },
};

// ============================================================================
// 多人审批模式
// ============================================================================

export const MULTI_MODES = ['none', 'sequential', 'parallel'] as const;
export type MultiMode = (typeof MULTI_MODES)[number];

export const MULTI_MODE_LABEL: Record<MultiMode, string> = {
  none: '单人审批',
  sequential: '会签（依次审批）',
  parallel: '会签（并行审批）',
};

export const PASS_RULES = ['all', 'any', 'ratio'] as const;
export type PassRule = (typeof PASS_RULES)[number];

export const PASS_RULE_LABEL: Record<PassRule, string> = {
  all: '全员通过',
  any: '任一通过',
  ratio: '按比例通过',
};

// ============================================================================
// FlowChart DSL —— 与后端 FlowChart / FlowNodeDsl / FlowEdgeDsl 严格对齐
// ============================================================================

/**
 * 节点 DSL。设计器画布上每个节点都有一个对应的 FlowNodeDsl。
 *
 * properties 是「自由扩展袋」：不同 kind 放不同的 key，约束由
 * AssigneeStrategyMeta + use-flow-validation.ts 共同保证。这样新增一种
 * 审批策略不需要改 DSL 类型本身，只需要追加 strategy meta。
 */
export interface FlowNodeDsl {
  /** 节点唯一 key，BPMN element id（必须字母开头） */
  key: string;
  /** 节点类型 */
  kind: FlowNodeKind;
  /** 节点显示名（中文 OK） */
  label?: string;
  /** 业务属性，结构因 kind 而异 */
  properties?: Record<string, unknown>;
  /**
   * 画布坐标。后端不关心，但保存到 chartDsl 里供下次加载时复原视觉位置。
   * 没有就走 use-flow-layout.ts 的 dagre 自动布局兜底。
   */
  x?: number;
  y?: number;
}

/** 边 DSL —— 与后端 FlowEdgeDsl 字段一致。 */
export interface FlowEdgeDsl {
  /** 边唯一 key（可空，编译器会自动补） */
  key?: string;
  from: string;
  to: string;
  /** 源节点的连接桩 ID，例如 "source-bottom" / "source-right" */
  sourceHandle?: string;
  /** 目标节点的连接桩 ID，例如 "target-top" / "target-left" */
  targetHandle?: string;
  /** Flowable 条件表达式，例如 ${approved} */
  condition?: string;
  /** BRANCH 节点出边的优先级，数字小的先匹配 */
  priority?: number;
  /** 边的显示文本，例如 "通过" / "驳回" */
  label?: string;
}

// ============================================================================
// 流程表单绑定
// ============================================================================

/** 表单绑定类型 */
export type FlowFormType = 'DYNAMIC' | 'CUSTOM';

/**
 * 流程关联的表单绑定。
 *
 * - DYNAMIC：通过可视化设计器维护的动态表单，关联 formId，支持字段权限。
 * - CUSTOM：自定义业务页面，需手动填写提交路径和查看路径。
 */
export interface FlowFormBinding {
  /** 绑定类型 */
  type: FlowFormType;
  /** 表单名称（用于展示） */
  name: string;
  /** 动态表单 ID（仅 DYNAMIC 类型） */
  formId?: number;
  /** 表单提交路径（CUSTOM 必填，DYNAMIC 可选覆盖） */
  submitUrl?: string;
  /** 表单查看路径（CUSTOM 必填，DYNAMIC 可选覆盖） */
  viewUrl?: string;
}

/** 整张流程图。后端的 FlowChart 域对象在 wire 上就是这个结构。 */
export interface FlowChartDsl {
  chartKey: string;
  chartName?: string;
  chartCategory?: string;
  description?: string;
  /** 流程关联的表单列表（发起时选择其一使用，各审批节点通过 fieldRules 控制动态表单字段权限） */
  forms?: FlowFormBinding[];
  nodes: FlowNodeDsl[];
  edges: FlowEdgeDsl[];
}

// ============================================================================
// 后端 API DTO
// ============================================================================

/**
 * POST/PUT /flow/definition/draft 用的请求体。
 * chartDsl 字段后端是 String（JSON 文本），前端 stringify 后再传，
 * 这样前后端各自维护自己的 schema 演化，互不影响。
 */
export interface FlowDefinitionDraftCmd {
  chartId?: number | null;
  chartKey: string;
  chartName: string;
  chartCategory?: string;
  chartDsl: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  boundFormId?: number | null;
}

/**
 * 与后端 FlowDefinitionView 一致的展示 DTO（com.smart.flow.api.definition.FlowDefinitionView）。
 *
 * 字段名严格对齐后端：
 *   - publishStatus 是字符串编码 "0"/"1"/"2"，在前端用 PUBLISH_STATUS_TEXT 翻译成中文 tag；
 *   - createTime/updateTime/createBy/updateBy 用驼峰对齐 BaseEntity；
 *   - chartDsl 在「列表/聚合查询」里**不返回**（后端为了减负 lean 掉），只在
 *     getDefinition(chartId) 详情接口里返回。所以这里声明为可选，避免列表页
 *     强制访问时报 undefined。
 */
export interface FlowDefinitionView {
  chartId: number;
  chartKey: string;
  chartName: string;
  chartCategory?: string;
  /** 仅详情接口返回 */
  chartDsl?: string;
  chartVersion: number;
  /** 后端编码：'0' DRAFT / '1' PUBLISHED / '2' ARCHIVED */
  publishStatus: '0' | '1' | '2';
  description?: string;
  icon?: string;
  boundFormId?: number;
  deploymentId?: string;
  processDefinitionId?: string;
  sortOrder?: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

/** 后端 publishStatus 编码 → 前端业务语义。集中在这里，避免到处散落 magic string。 */
export const PUBLISH_STATUS_CODE = {
  DRAFT: '0',
  PUBLISHED: '1',
  ARCHIVED: '2',
} as const;

export type PublishStatusCode = (typeof PUBLISH_STATUS_CODE)[keyof typeof PUBLISH_STATUS_CODE];

export const PUBLISH_STATUS_TEXT: Record<PublishStatusCode, string> = {
  '0': '草稿',
  '1': '已发布',
  '2': '已归档',
};

// ============================================================================
// 设计器内部类型
// ============================================================================

/**
 * 设计器自己用的统一节点数据 —— 直接挂在 VueFlow Node.data 上。
 * 把 dsl 整体作为 data 字段，是为了避免 VueFlow 内置字段（id/position）和 DSL 字段
 * 互相覆盖：DSL 里的 key 映射到 Node.id，DSL 里的 x/y 映射到 Node.position，
 * 其他属性都收敛进 data.dsl，保持单一数据源。
 */
export interface DesignerNodeData {
  dsl: FlowNodeDsl;
  /** 校验失败时挂在节点上，红角标 + 列表显示用 */
  validationErrors?: string[];
}

export interface DesignerEdgeData {
  dsl: FlowEdgeDsl;
  validationErrors?: string[];
}

/** 校验报告，给工具栏的「校验」按钮和保存前自动校验复用。 */
export interface ValidationReport {
  passed: boolean;
  /** 节点级错误，按节点 key 聚合 */
  nodeErrors: Record<string, string[]>;
  /** 边级错误 */
  edgeErrors: Record<string, string[]>;
  /** 全图级错误（如「没有 START 节点」） */
  globalErrors: string[];
}

// ============================================================================
// 任务中心 DTO —— 与后端 com.smart.flow.api.taskcenter 包 1:1 对齐
// ============================================================================

/** 任务中心列表查询参数 */
export interface TaskCenterQuery {
  pageNum?: number;
  pageSize?: number;
  chartKey?: string;
  keyword?: string;
}

/** 任务中心列表单行数据（与后端 TaskCenterItem 对齐） */
export interface TaskCenterItem {
  taskId?: string;
  processInstanceId?: string;
  chartKey?: string;
  chartName?: string;
  bizNo?: string;
  title?: string;
  nodeKey?: string;
  nodeName?: string;
  viewStatus?: string;
  starterId?: number;
  starterName?: string;
  receivedAt?: string;
  finishedAt?: string;
  formId?: number;
}

/** 任务中心分页响应（与后端 TaskCenterPage 对齐） */
export interface TaskCenterPage {
  records: TaskCenterItem[];
  total: number;
  pageNum: number;
  pageSize: number;
}

/** 待办任务的 viewStatus 枚举 */
export const TASK_VIEW_STATUS = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  COMPLETED: 'completed',
  WITHDRAWN: 'withdrawn',
  TERMINATED: 'terminated',
} as const;

/** 待办任务 viewStatus → 中文标签 */
export const TASK_VIEW_STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  claimed: '已认领',
  completed: '已完成',
  withdrawn: '已撤回',
  terminated: '已终止',
};

/** 待办任务 viewStatus → Element Plus tag 类型 */
export const TASK_VIEW_STATUS_TAG: Record<string, 'warning' | 'primary' | 'success' | 'info' | 'danger'> = {
  pending: 'warning',
  claimed: 'primary',
  completed: 'success',
  withdrawn: 'info',
  terminated: 'danger',
};

/** 流程实例 bizStatus 编码 → 中文标签 */
export const BIZ_STATUS_TEXT: Record<string, string> = {
  '0': '进行中',
  '1': '已通过',
  '2': '已拒绝',
  '3': '已撤回',
  '4': '已终止',
};

/** 流程实例 bizStatus → Element Plus tag 类型 */
export const BIZ_STATUS_TAG: Record<string, 'primary' | 'success' | 'danger' | 'info' | 'warning'> = {
  '0': 'primary',
  '1': 'success',
  '2': 'danger',
  '3': 'info',
  '4': 'warning',
};

/** 抄送状态 → 中文标签 */
export const CC_STATUS_TEXT: Record<string, string> = {
  unread: '未读',
  read: '已读',
};

/** 抄送状态 → Element Plus tag 类型 */
export const CC_STATUS_TAG: Record<string, 'danger' | 'info'> = {
  unread: 'danger',
  read: 'info',
};

// ============================================================================
// 发起流程
// ============================================================================

/** 发起流程请求参数 */
export interface StartFlowCmd {
  chartKey: string;
  chartVersion?: number;
  title?: string;
  bizNoPrefix?: string;
  formData?: Record<string, unknown>;
}

// ============================================================================
// 任务审批
// ============================================================================

/** 审批动作（与后端 ApprovalAction 枚举 wire 值对齐） */
export type ApprovalAction = 'approve' | 'reject' | 'transfer' | 'delegate' | 'withdraw' | 'terminate' | 'comment';

/** 任务完成请求参数（与后端 CompleteTaskCmd 对齐） */
export interface CompleteTaskCmd {
  taskId: string;
  action: ApprovalAction;
  comment?: string;
  formData?: Record<string, unknown>;
  attachments?: unknown[];
}

// ============================================================================
// 流程详情
// ============================================================================

/** 审批记录（与后端 ApprovalRecordVO 对齐） */
export interface ApprovalRecordVO {
  recordId?: number;
  taskId?: string;
  nodeKey?: string;
  nodeName?: string;
  actionType?: string;
  actorId?: number;
  actorName?: string;
  targetUserId?: number;
  targetUserName?: string;
  comment?: string;
  occurredAt?: unknown; // Jackson 数组或 ISO 字符串
}

/** 流程实例详情（与后端 FlowInstanceDetailVO 对齐） */
export interface FlowInstanceDetailVO {
  processInstanceId?: string;
  chartKey?: string;
  chartName?: string;
  bizNo?: string;
  title?: string;
  starterId?: number;
  starterName?: string;
  bizStatus?: string;
  startTime?: unknown;
  endTime?: unknown;
  /** 流程定义 DSL（JSON 字符串，前端解析后渲染流程图） */
  chartDsl?: string;
  /** 当前活跃节点 key 列表（流程运行中时非空，用于流程图高亮当前节点） */
  activeNodeKeys?: string[];
  /** 已完成节点 key 列表（用于流程图标记已走过的节点） */
  completedNodeKeys?: string[];
  /** 绑定的表单类型：DYNAMIC / CUSTOM */
  formType?: string;
  /** 自定义表单查看路径（仅 CUSTOM 类型有值） */
  formViewUrl?: string;
  /** 自定义表单提交路径（仅 CUSTOM 类型有值） */
  formSubmitUrl?: string;
  /** 绑定的表单名称 */
  formName?: string;
  formData?: Record<string, unknown>;
  /** 字段标识 → 字段标签映射（用于展示表单数据时翻译 fieldKey） */
  fieldLabelMap?: Record<string, string>;
  records?: ApprovalRecordVO[];
}

/** 审批动作 → 中文标签 */
export const ACTION_TYPE_TEXT: Record<string, string> = {
  submit: '提交',
  approve: '同意',
  reject: '驳回',
  transfer: '转办',
  delegate: '委托',
  withdraw: '撤回',
  terminate: '终止',
  comment: '评论',
  ccRead: '阅读抄送',
};

/** 审批动作 → ElTag type */
export const ACTION_TYPE_TAG: Record<string, string> = {
  submit: '',
  approve: 'success',
  reject: 'danger',
  transfer: 'warning',
  delegate: 'warning',
  withdraw: 'info',
  terminate: 'info',
  comment: '',
  ccRead: '',
};

/** 业务状态 → 中文标签 */
export const BIZ_STATUS_LABEL: Record<string, string> = {
  '0': '运行中',
  '1': '已通过',
  '2': '已驳回',
  '3': '已撤回',
  '4': '已终止',
};

/** 业务状态 → ElTag type */
export const BIZ_STATUS_TAG_TYPE: Record<string, string> = {
  '0': 'primary',
  '1': 'success',
  '2': 'danger',
  '3': 'warning',
  '4': 'info',
};
