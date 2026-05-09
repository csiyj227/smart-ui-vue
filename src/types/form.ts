/**
 * 表单设计器 & 运行时渲染所需的类型定义。
 *
 * 与后端 SysForm / SysFormData 实体严格对齐，同时增加了前端设计器
 * 专用的元数据（NODE_KIND_META 等），方便画布和属性面板直接消费。
 */

// ─────────── 表单字段类型枚举 ───────────

/** 所有支持的表单字段类型 */
export type FormFieldType =
  // 基础字段
  | 'INPUT'
  | 'TEXTAREA'
  | 'PASSWORD'
  | 'NUMBER'
  | 'SELECT'
  | 'RADIO'
  | 'CHECKBOX'
  | 'SWITCH'
  | 'RATE'
  | 'TIME'
  | 'TIME_RANGE'
  | 'SLIDER'
  | 'DATE'
  | 'DATE_RANGE'
  | 'COLOR_PICKER'
  // 进阶字段
  | 'UPLOAD'
  | 'RICH_TEXT'
  | 'CASCADER'
  | 'TRANSFER'
  | 'TREE'
  | 'TREE_SELECT'
  | 'SIGNATURE'
  // 组织字段
  | 'USER_SELECT'
  | 'DEPT_SELECT'
  | 'ROLE_SELECT'
  // 子表单组件
  | 'SUB_FORM'
  | 'TABLE_FORM'
  // 辅助组件
  | 'ALERT'
  | 'BUTTON'
  | 'TEXT'
  | 'TITLE'
  | 'HTML'
  | 'DIVIDER'
  | 'TAG'
  | 'IMAGE'
  // 布局组件
  | 'GROUP'
  | 'TABS'
  | 'GRID'
  | 'TABLE_LAYOUT'
  | 'SPACER'
  | 'CARD'
  | 'COLLAPSE';

/** 字段类型分类（用于设计器左侧面板分组） */
export type FormFieldCategory = 'basic' | 'advanced' | 'org' | 'subform' | 'auxiliary' | 'layout';

/** 字段类型元数据 */
export interface FormFieldTypeMeta {
  type: FormFieldType;
  label: string;
  icon: string;
  category: FormFieldCategory;
  /** 是否为布局容器（可以嵌套子字段） */
  isContainer: boolean;
}

/** 所有字段类型的元数据注册表 */
export const FORM_FIELD_TYPE_META: Record<FormFieldType, FormFieldTypeMeta> = {
  // 基础字段
  INPUT:        { type: 'INPUT',        label: '输入框',     icon: 'EditPen',       category: 'basic',     isContainer: false },
  TEXTAREA:     { type: 'TEXTAREA',     label: '多行输入框', icon: 'Document',      category: 'basic',     isContainer: false },
  PASSWORD:     { type: 'PASSWORD',     label: '密码输入框', icon: 'Lock',          category: 'basic',     isContainer: false },
  NUMBER:       { type: 'NUMBER',       label: '计数器',     icon: 'Odometer',      category: 'basic',     isContainer: false },
  RADIO:        { type: 'RADIO',        label: '单选框',     icon: 'CircleCheck',   category: 'basic',     isContainer: false },
  CHECKBOX:     { type: 'CHECKBOX',     label: '多选框',     icon: 'Check',         category: 'basic',     isContainer: false },
  SELECT:       { type: 'SELECT',       label: '选择器',     icon: 'ArrowDown',     category: 'basic',     isContainer: false },
  SWITCH:       { type: 'SWITCH',       label: '开关',       icon: 'Open',          category: 'basic',     isContainer: false },
  RATE:         { type: 'RATE',         label: '评分',       icon: 'StarFilled',    category: 'basic',     isContainer: false },
  TIME:         { type: 'TIME',         label: '时间',       icon: 'Clock',         category: 'basic',     isContainer: false },
  TIME_RANGE:   { type: 'TIME_RANGE',   label: '时间区间',   icon: 'Timer',         category: 'basic',     isContainer: false },
  SLIDER:       { type: 'SLIDER',       label: '滑块',       icon: 'Operation',     category: 'basic',     isContainer: false },
  DATE:         { type: 'DATE',         label: '日期',       icon: 'Calendar',      category: 'basic',     isContainer: false },
  DATE_RANGE:   { type: 'DATE_RANGE',   label: '日期区间',   icon: 'Calendar',      category: 'basic',     isContainer: false },
  COLOR_PICKER: { type: 'COLOR_PICKER', label: '颜色选择器', icon: 'Brush',         category: 'basic',     isContainer: false },
  // 进阶字段
  UPLOAD:       { type: 'UPLOAD',       label: '附件上传',   icon: 'UploadFilled',  category: 'advanced',  isContainer: false },
  RICH_TEXT:    { type: 'RICH_TEXT',     label: '富文本框',   icon: 'Memo',          category: 'advanced',  isContainer: false },
  CASCADER:     { type: 'CASCADER',     label: '级联选择器', icon: 'Share',         category: 'advanced',  isContainer: false },
  TRANSFER:     { type: 'TRANSFER',     label: '穿梭框',     icon: 'Sort',          category: 'advanced',  isContainer: false },
  TREE:         { type: 'TREE',         label: '树形控件',   icon: 'Connection',    category: 'advanced',  isContainer: false },
  TREE_SELECT:  { type: 'TREE_SELECT',  label: '树形选择',   icon: 'SetUp',         category: 'advanced',  isContainer: false },
  SIGNATURE:    { type: 'SIGNATURE',    label: '手写签名',   icon: 'Edit',          category: 'advanced',  isContainer: false },
  // 组织字段
  USER_SELECT:  { type: 'USER_SELECT',  label: '人员选择',   icon: 'User',          category: 'org',       isContainer: false },
  DEPT_SELECT:  { type: 'DEPT_SELECT',  label: '部门选择',   icon: 'OfficeBuilding',category: 'org',       isContainer: false },
  ROLE_SELECT:  { type: 'ROLE_SELECT',  label: '角色选择',   icon: 'Key',           category: 'org',       isContainer: false },
  // 子表单组件
  SUB_FORM:     { type: 'SUB_FORM',     label: '子表单',     icon: 'Notebook',      category: 'subform',   isContainer: true  },
  TABLE_FORM:   { type: 'TABLE_FORM',   label: '表格表单',   icon: 'List',          category: 'subform',   isContainer: true  },
  // 辅助组件
  ALERT:        { type: 'ALERT',        label: '提示',       icon: 'InfoFilled',    category: 'auxiliary', isContainer: false },
  BUTTON:       { type: 'BUTTON',       label: '按钮',       icon: 'Pointer',       category: 'auxiliary', isContainer: false },
  TEXT:         { type: 'TEXT',          label: '文字',       icon: 'Reading',       category: 'auxiliary', isContainer: false },
  TITLE:        { type: 'TITLE',        label: '标题',       icon: 'Tickets',       category: 'auxiliary', isContainer: false },
  HTML:         { type: 'HTML',          label: 'HTML',       icon: 'ChromeFilled',  category: 'auxiliary', isContainer: false },
  DIVIDER:      { type: 'DIVIDER',      label: '分割线',     icon: 'Minus',         category: 'auxiliary', isContainer: false },
  TAG:          { type: 'TAG',           label: '标签',       icon: 'PriceTag',      category: 'auxiliary', isContainer: false },
  IMAGE:        { type: 'IMAGE',         label: '图片',       icon: 'Picture',       category: 'auxiliary', isContainer: false },
  // 布局组件
  GROUP:        { type: 'GROUP',        label: '分组',       icon: 'FolderOpened',  category: 'layout',    isContainer: true  },
  TABS:         { type: 'TABS',         label: '标签页',     icon: 'Files',         category: 'layout',    isContainer: true  },
  GRID:         { type: 'GRID',         label: '栅格布局',   icon: 'Grid',          category: 'layout',    isContainer: true  },
  TABLE_LAYOUT: { type: 'TABLE_LAYOUT', label: '表格布局',   icon: 'Grid',          category: 'layout',    isContainer: true  },
  SPACER:       { type: 'SPACER',       label: '间距',       icon: 'DArrowRight',   category: 'layout',    isContainer: false },
  CARD:         { type: 'CARD',         label: '卡片',       icon: 'Postcard',      category: 'layout',    isContainer: true  },
  COLLAPSE:     { type: 'COLLAPSE',     label: '折叠面板',   icon: 'DArrowLeft',    category: 'layout',    isContainer: true  },
};

/** 字段分类标签 */
export const FORM_FIELD_CATEGORY_LABELS: Record<FormFieldCategory, string> = {
  basic: '基础字段',
  advanced: '进阶字段',
  org: '组织字段',
  subform: '子表单组件',
  auxiliary: '辅助组件',
  layout: '布局组件',
};

// ─────────── 字段选项 ───────────

/** 下拉/单选/多选等的选项 */
export interface SelectOption {
  label: string;
  value: string;
}

/** 级联选项（树形） */
export interface CascaderOption {
  label: string;
  value: string;
  children?: CascaderOption[];
}

// ─────────── 校验规则 ───────────

export interface FormFieldValidation {
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

// ─────────── 表单字段 Schema ───────────

/** 单个表单字段定义（设计器持久化的最小单元） */
export interface FormFieldSchema {
  /** 字段唯一标识（自动生成，如 field_aB3x） */
  fieldKey: string;
  /** 字段类型 */
  fieldType: FormFieldType;
  /** 字段标签 */
  label: string;
  /** 占位提示 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: unknown;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
  /** 校验规则 */
  validation?: FormFieldValidation;
  /** 宽度（Element Plus 的 span，1-24） */
  span?: number;

  // ── 特定字段类型的配置 ──

  /** SELECT / CASCADER 的选项来源 */
  options?: SelectOption[];
  /** CASCADER 的树形选项 */
  cascaderOptions?: CascaderOption[];
  /** SELECT 是否多选 */
  multiple?: boolean;
  /** DATE 的日期格式 */
  dateFormat?: string;
  /** DATE 的类型：date / datetime / daterange 等 */
  dateType?: 'date' | 'datetime' | 'daterange' | 'datetimerange' | 'month' | 'year';
  /** UPLOAD 允许的文件类型 */
  acceptFileTypes?: string;
  /** UPLOAD 最大文件数 */
  maxFileCount?: number;
  /** UPLOAD 单文件最大大小（MB） */
  maxFileSizeMb?: number;
  /** NUMBER 精度（小数位数） */
  precision?: number;
  /** NUMBER 步进值 */
  step?: number;
  /** RICH_TEXT 编辑器高度 */
  editorHeight?: number;

  // ── 布局容器的子字段 ──

  /** GROUP 的子字段 */
  children?: FormFieldSchema[];
  /** TABS 的标签页定义 */
  tabs?: FormTabPane[];
  /** GRID 的列定义 */
  columns?: FormGridColumn[];
}

/** 标签页面板 */
export interface FormTabPane {
  key: string;
  label: string;
  children: FormFieldSchema[];
}

/** 分栏列 */
export interface FormGridColumn {
  span: number;
  children: FormFieldSchema[];
}

// ─────────── 表单 Schema（整体） ───────────

/**
 * 完整的表单 Schema 定义。
 * 对应后端 SysForm.schema 字段（JSON 序列化存储）。
 */
export interface FormSchema {
  /** Schema 版本号（用于后续迁移） */
  version: number;
  /** 表单字段列表（有序） */
  fields: FormFieldSchema[];
  /** 表单全局配置 */
  formConfig?: FormGlobalConfig;
}

/** 表单全局配置 */
export interface FormGlobalConfig {
  /** 标签位置 */
  labelPosition?: 'top' | 'left' | 'right';
  /** 标签宽度 */
  labelWidth?: string;
  /** 表单尺寸 */
  size?: 'large' | 'default' | 'small';
  /** 是否禁用整个表单 */
  disabled?: boolean;
}

// ─────────── 表单布局 ───────────

/**
 * 表单布局定义（可选）。
 * 对应后端 SysForm.layout 字段（JSON 序列化存储）。
 * 目前暂时不使用独立布局，字段的布局信息内嵌在 FormFieldSchema 中。
 */
export interface FormLayout {
  type: 'default';
}

// ─────────── SysForm 实体视图 ───────────

/** 与后端 SysForm 对齐的前端视图类型 */
export interface SysFormView {
  formId: number;
  formName: string;
  formKey: string;
  /** JSON 字符串，解析后为 FormSchema */
  schema: string;
  /** JSON 字符串，解析后为 FormLayout */
  layout?: string;
  description?: string;
  category?: string;
  /** "0"=草稿, "1"=已发布 */
  status: string;
  version: number;
  /** 可选的数据存储表名 */
  tableName?: string;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

/** 表单状态码 */
export const FORM_STATUS_CODE = {
  DRAFT: '0',
  PUBLISHED: '1',
} as const;

export type FormStatusCode = (typeof FORM_STATUS_CODE)[keyof typeof FORM_STATUS_CODE];

export const FORM_STATUS_TEXT: Record<FormStatusCode, string> = {
  [FORM_STATUS_CODE.DRAFT]: '草稿',
  [FORM_STATUS_CODE.PUBLISHED]: '已发布',
};

export const FORM_STATUS_TAG_TYPE: Record<FormStatusCode, 'warning' | 'success'> = {
  [FORM_STATUS_CODE.DRAFT]: 'warning',
  [FORM_STATUS_CODE.PUBLISHED]: 'success',
};

// ─────────── SysFormData 视图 ───────────

/** 与后端 SysFormData 对齐的前端视图类型 */
export interface SysFormDataView {
  id: number;
  formId: number;
  formKey: string;
  userId?: number;
  /** JSON 字符串，解析后为 Record<string, unknown> */
  formData: string;
  ip?: string;
  userAgent?: string;
  status?: string;
  createBy?: string;
  createTime?: string;
}

// ─────────── 表单创建/更新命令 ───────────

/** 创建表单的命令 */
export interface CreateFormCmd {
  formName: string;
  formKey: string;
  schema: string;
  layout?: string;
  description?: string;
  category?: string;
  tableName?: string;
}

/** 更新表单的命令 */
export interface UpdateFormCmd {
  formId: number;
  formName: string;
  formKey: string;
  schema: string;
  layout?: string;
  description?: string;
  category?: string;
  tableName?: string;
}

// ─────────── 表单绑定（流程关联） ───────────

/** 表单绑定视图（来自 flow_form_binding 表） */
export interface FormBindingView {
  bindingId: number;
  chartId: number;
  /** null = 图表级默认绑定，非 null = 节点级覆盖 */
  nodeKey?: string | null;
  formId: number;
  /** JSON 字符串，解析后为字段权限规则列表 */
  fieldRules?: string;
}

/** 绑定表单的命令（对齐后端 BindFormCmd） */
export interface BindFormCmd {
  chartId: number;
  nodeKey?: string | null;
  formId: number;
  /** 字段权限规则列表 */
  fieldRules?: FieldRuleSpec[];
}

/** 单条字段权限规则（对齐后端 FieldRuleSpec） */
export interface FieldRuleSpec {
  field: string;
  /** "r" = 只读, "rw" = 可读写, "hidden" = 隐藏 */
  rule: 'r' | 'rw' | 'hidden';
}

/** 有效绑定视图（对齐后端 BoundFormView） */
export interface BoundFormView {
  formId: number;
  formName: string;
  formKey: string;
  /** 表单 Schema JSON（对应后端 schemaJson） */
  schemaJson: string;
  /** 表单布局 JSON（对应后端 layoutJson） */
  layoutJson?: string;
  /** 有效字段权限规则（对应后端 effectiveRules） */
  effectiveRules?: FieldRuleSpec[];
}

// ─────────── 字段权限规则 ───────────

/** 单个字段的权限规则 */
export interface FieldPermissionRule {
  fieldKey: string;
  /** 可见性：visible / hidden */
  visibility: 'visible' | 'hidden';
  /** 可编辑性：editable / readonly */
  editability: 'editable' | 'readonly';
  /** 是否必填（覆盖字段本身的 required） */
  required?: boolean;
}

// ─────────── 表单快照 ───────────

/** 表单快照视图 */
export interface FormSnapshotView {
  snapshotId: number;
  processInstanceId: string;
  taskId?: string;
  nodeKey?: string;
  formId: number;
  /** "0"=发起人, "1"=审批, "2"=会签, "3"=系统补丁 */
  snapshotType: string;
  /** JSON 字符串，解析后为表单数据 */
  payload: string;
  capturedBy?: number;
  capturedAt?: string;
}

// ─────────── 设计器状态相关 ───────────

/** 设计器中被选中的字段信息 */
export interface SelectedField {
  fieldKey: string;
  parentKey?: string;
  /** 在父容器中的索引 */
  index: number;
}

/** 拖拽事件的数据 */
export interface DragFieldData {
  /** 'new' 从面板拖入新字段，'move' 从画布内移动 */
  action: 'new' | 'move';
  fieldType?: FormFieldType;
  fieldKey?: string;
  sourceParentKey?: string;
  sourceIndex?: number;
}
