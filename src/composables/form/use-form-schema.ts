/**
 * 表单设计器核心组合式函数。
 *
 * 负责管理设计器的全部状态：
 *   - 字段列表（有序树形结构，支持嵌套容器）
 *   - 全局配置（标签位置、大小等）
 *   - 选中字段
 *   - 字段增删改移
 *   - 序列化 / 反序列化
 *   - 撤销 / 重做
 */
import { ref, computed, watch, shallowRef } from 'vue';
import type {
  FormSchema,
  FormFieldSchema,
  FormGlobalConfig,
  FormFieldType,
  SelectedField,
  FormTabPane,
  FormGridColumn,
} from '@/types/form';
import { FORM_FIELD_TYPE_META } from '@/types/form';

/** 生成唯一字段 key */
function generateFieldKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'field_';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** 生成唯一 tab/column key */
function generateKey(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix + '_';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** 为某种字段类型创建默认 schema */
function createDefaultField(fieldType: FormFieldType): FormFieldSchema {
  const meta = FORM_FIELD_TYPE_META[fieldType];
  const base: FormFieldSchema = {
    fieldKey: generateFieldKey(),
    fieldType,
    label: meta.label,
    placeholder: `请输入${meta.label}`,
    span: 24,
    validation: { required: false },
  };

  switch (fieldType) {
    // ── 基础字段 ──
    case 'INPUT':
      base.validation = { required: false, maxLength: 200 };
      break;
    case 'TEXTAREA':
      base.placeholder = `请输入${meta.label}`;
      base.validation = { required: false, maxLength: 2000 };
      break;
    case 'PASSWORD':
      base.placeholder = '请输入密码';
      base.validation = { required: false, maxLength: 128 };
      break;
    case 'NUMBER':
      base.placeholder = `请输入${meta.label}`;
      base.precision = 0;
      base.step = 1;
      break;
    case 'RADIO':
      base.placeholder = undefined;
      base.options = [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ];
      break;
    case 'CHECKBOX':
      base.placeholder = undefined;
      base.options = [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ];
      break;
    case 'SELECT':
      base.placeholder = `请选择${meta.label}`;
      base.options = [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ];
      base.multiple = false;
      break;
    case 'SWITCH':
      base.placeholder = undefined;
      break;
    case 'RATE':
      base.placeholder = undefined;
      break;
    case 'TIME':
      base.placeholder = '请选择时间';
      break;
    case 'TIME_RANGE':
      base.placeholder = undefined;
      break;
    case 'SLIDER':
      base.placeholder = undefined;
      break;
    case 'DATE':
      base.placeholder = '请选择日期';
      base.dateType = 'date';
      base.dateFormat = 'YYYY-MM-DD';
      break;
    case 'DATE_RANGE':
      base.placeholder = undefined;
      base.dateType = 'daterange';
      base.dateFormat = 'YYYY-MM-DD';
      break;
    case 'COLOR_PICKER':
      base.placeholder = undefined;
      break;
    // ── 进阶字段 ──
    case 'UPLOAD':
      base.placeholder = undefined;
      base.acceptFileTypes = '.jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx';
      base.maxFileCount = 5;
      base.maxFileSizeMb = 10;
      break;
    case 'RICH_TEXT':
      base.placeholder = '请输入内容';
      base.editorHeight = 300;
      break;
    case 'CASCADER':
      base.placeholder = '请选择';
      base.cascaderOptions = [];
      break;
    case 'TRANSFER':
      base.placeholder = undefined;
      break;
    case 'TREE':
      base.placeholder = undefined;
      break;
    case 'TREE_SELECT':
      base.placeholder = '请选择';
      break;
    case 'SIGNATURE':
      base.placeholder = undefined;
      break;
    // ── 组织字段 ──
    case 'USER_SELECT':
      base.placeholder = '请选择人员';
      base.multiple = false;
      break;
    case 'DEPT_SELECT':
      base.placeholder = '请选择部门';
      base.multiple = false;
      break;
    case 'ROLE_SELECT':
      base.placeholder = '请选择角色';
      base.multiple = false;
      break;
    // ── 子表单组件 ──
    case 'SUB_FORM':
      base.placeholder = undefined;
      base.children = [];
      break;
    case 'TABLE_FORM':
      base.placeholder = undefined;
      base.children = [];
      break;
    // ── 辅助组件 ──
    case 'ALERT':
      base.placeholder = undefined;
      base.label = '提示信息';
      break;
    case 'BUTTON':
      base.placeholder = undefined;
      base.label = '按钮';
      break;
    case 'TEXT':
      base.placeholder = undefined;
      base.label = '文字说明内容';
      break;
    case 'TITLE':
      base.placeholder = undefined;
      base.label = '标题文本';
      break;
    case 'HTML':
      base.placeholder = undefined;
      base.label = 'HTML';
      break;
    case 'DIVIDER':
      base.placeholder = undefined;
      base.label = '分割线';
      break;
    case 'TAG':
      base.placeholder = undefined;
      break;
    case 'IMAGE':
      base.placeholder = undefined;
      break;
    // ── 布局组件 ──
    case 'GROUP':
      base.placeholder = undefined;
      base.children = [];
      break;
    case 'TABS':
      base.placeholder = undefined;
      base.tabs = [
        { key: generateKey('tab'), label: '标签一', children: [] },
        { key: generateKey('tab'), label: '标签二', children: [] },
      ];
      break;
    case 'GRID':
      base.placeholder = undefined;
      base.columns = [
        { span: 12, children: [] },
        { span: 12, children: [] },
      ];
      break;
    case 'TABLE_LAYOUT':
      base.placeholder = undefined;
      base.children = [];
      break;
    case 'SPACER':
      base.placeholder = undefined;
      break;
    case 'CARD':
      base.placeholder = undefined;
      base.children = [];
      break;
    case 'COLLAPSE':
      base.placeholder = undefined;
      base.children = [];
      break;
  }

  return base;
}

/** 撤销/重做栈的最大深度 */
const MAX_HISTORY = 50;

export function useFormSchema() {
  // ── 核心状态 ──
  const fields = ref<FormFieldSchema[]>([]);
  const formConfig = ref<FormGlobalConfig>({
    labelPosition: 'top',
    labelWidth: '100px',
    size: 'default',
    disabled: false,
  });
  const selectedFieldKey = ref<string | null>(null);

  // ── 撤销/重做 ──
  const undoStack = shallowRef<string[]>([]);
  const redoStack = shallowRef<string[]>([]);

  function snapshot(): string {
    return JSON.stringify({ fields: fields.value, formConfig: formConfig.value });
  }

  function commit() {
    const state = snapshot();
    undoStack.value = [...undoStack.value.slice(-(MAX_HISTORY - 1)), state];
    redoStack.value = [];
  }

  function restoreSnapshot(json: string) {
    const parsed = JSON.parse(json);
    fields.value = parsed.fields;
    formConfig.value = parsed.formConfig;
  }

  function undo() {
    if (undoStack.value.length <= 1) return;
    const current = undoStack.value[undoStack.value.length - 1];
    const previous = undoStack.value[undoStack.value.length - 2];
    redoStack.value = [...redoStack.value, current];
    undoStack.value = undoStack.value.slice(0, -1);
    restoreSnapshot(previous);
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    const next = redoStack.value[redoStack.value.length - 1];
    redoStack.value = redoStack.value.slice(0, -1);
    undoStack.value = [...undoStack.value, next];
    restoreSnapshot(next);
  }

  const canUndo = computed(() => undoStack.value.length > 1);
  const canRedo = computed(() => redoStack.value.length > 0);

  // 初始化时压入第一个快照
  function initHistory() {
    undoStack.value = [snapshot()];
    redoStack.value = [];
  }

  // ── 字段查找 ──

  /** 在字段树中递归查找，返回 [字段, 父字段列表, 在父中的索引] */
  function findFieldInList(
    list: FormFieldSchema[],
    fieldKey: string,
  ): { field: FormFieldSchema; parent: FormFieldSchema[]; index: number } | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].fieldKey === fieldKey) {
        return { field: list[i], parent: list, index: i };
      }
      // 递归搜索容器子节点
      const item = list[i];
      if (item.children) {
        const found = findFieldInList(item.children, fieldKey);
        if (found) return found;
      }
      if (item.tabs) {
        for (const tab of item.tabs) {
          const found = findFieldInList(tab.children, fieldKey);
          if (found) return found;
        }
      }
      if (item.columns) {
        for (const col of item.columns) {
          const found = findFieldInList(col.children, fieldKey);
          if (found) return found;
        }
      }
    }
    return null;
  }

  function findField(fieldKey: string) {
    return findFieldInList(fields.value, fieldKey);
  }

  /** 当前选中的字段 schema */
  const selectedField = computed<FormFieldSchema | null>(() => {
    if (!selectedFieldKey.value) return null;
    const result = findField(selectedFieldKey.value);
    return result?.field ?? null;
  });

  // ── 字段操作 ──

  /** 添加新字段到指定位置 */
  function addField(fieldType: FormFieldType, targetIndex?: number, parentKey?: string) {
    const newField = createDefaultField(fieldType);
    let targetList = fields.value;

    if (parentKey) {
      const parentResult = findField(parentKey);
      if (parentResult) {
        const parent = parentResult.field;
        if (parent.children) {
          targetList = parent.children;
        }
      }
    }

    const insertIndex = targetIndex ?? targetList.length;
    targetList.splice(insertIndex, 0, newField);
    selectedFieldKey.value = newField.fieldKey;
    commit();
    return newField;
  }

  /** 添加新字段到 tabs 的指定 tab 中 */
  function addFieldToTab(fieldType: FormFieldType, parentKey: string, tabKey: string, targetIndex?: number) {
    const parentResult = findField(parentKey);
    if (!parentResult?.field.tabs) return null;

    const tab = parentResult.field.tabs.find((t) => t.key === tabKey);
    if (!tab) return null;

    const newField = createDefaultField(fieldType);
    const insertIndex = targetIndex ?? tab.children.length;
    tab.children.splice(insertIndex, 0, newField);
    selectedFieldKey.value = newField.fieldKey;
    commit();
    return newField;
  }

  /** 添加新字段到 grid 的指定列中 */
  function addFieldToColumn(fieldType: FormFieldType, parentKey: string, columnIndex: number, targetIndex?: number) {
    const parentResult = findField(parentKey);
    if (!parentResult?.field.columns) return null;

    const column = parentResult.field.columns[columnIndex];
    if (!column) return null;

    const newField = createDefaultField(fieldType);
    const insertIndex = targetIndex ?? column.children.length;
    column.children.splice(insertIndex, 0, newField);
    selectedFieldKey.value = newField.fieldKey;
    commit();
    return newField;
  }

  /** 删除字段 */
  function removeField(fieldKey: string) {
    const result = findField(fieldKey);
    if (!result) return;

    result.parent.splice(result.index, 1);

    if (selectedFieldKey.value === fieldKey) {
      selectedFieldKey.value = null;
    }
    commit();
  }

  /** 更新字段属性 */
  function updateField(fieldKey: string, updates: Partial<FormFieldSchema>) {
    const result = findField(fieldKey);
    if (!result) return;

    Object.assign(result.field, updates);
    commit();
  }

  /** 移动字段（在同一层级内上移/下移） */
  function moveField(fieldKey: string, direction: 'up' | 'down') {
    const result = findField(fieldKey);
    if (!result) return;

    const { parent, index } = result;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= parent.length) return;

    const temp = parent[index];
    parent[index] = parent[targetIndex];
    parent[targetIndex] = temp;
    commit();
  }

  /** 复制字段 */
  function duplicateField(fieldKey: string) {
    const result = findField(fieldKey);
    if (!result) return null;

    const clone = JSON.parse(JSON.stringify(result.field)) as FormFieldSchema;
    reassignKeys(clone);
    clone.label = clone.label + ' (副本)';

    result.parent.splice(result.index + 1, 0, clone);
    selectedFieldKey.value = clone.fieldKey;
    commit();
    return clone;
  }

  /** 递归重新分配 fieldKey，防止 key 冲突 */
  function reassignKeys(field: FormFieldSchema) {
    field.fieldKey = generateFieldKey();
    if (field.children) {
      field.children.forEach(reassignKeys);
    }
    if (field.tabs) {
      field.tabs.forEach((tab) => {
        tab.key = generateKey('tab');
        tab.children.forEach(reassignKeys);
      });
    }
    if (field.columns) {
      field.columns.forEach((col) => {
        col.children.forEach(reassignKeys);
      });
    }
  }

  /** 跨容器移动字段（拖拽排序） */
  function moveFieldTo(
    fieldKey: string,
    targetParentKey: string | null,
    targetIndex: number,
    targetTabKey?: string,
    targetColumnIndex?: number,
  ) {
    const result = findField(fieldKey);
    if (!result) return;

    // 先从原位置移除
    const [removed] = result.parent.splice(result.index, 1);

    // 确定目标列表
    let targetList: FormFieldSchema[];
    if (!targetParentKey) {
      targetList = fields.value;
    } else {
      const parentResult = findField(targetParentKey);
      if (!parentResult) {
        // 恢复原位置
        result.parent.splice(result.index, 0, removed);
        return;
      }
      const parentField = parentResult.field;

      if (targetTabKey && parentField.tabs) {
        const tab = parentField.tabs.find((t) => t.key === targetTabKey);
        if (!tab) {
          result.parent.splice(result.index, 0, removed);
          return;
        }
        targetList = tab.children;
      } else if (targetColumnIndex !== undefined && parentField.columns) {
        const col = parentField.columns[targetColumnIndex];
        if (!col) {
          result.parent.splice(result.index, 0, removed);
          return;
        }
        targetList = col.children;
      } else if (parentField.children) {
        targetList = parentField.children;
      } else {
        result.parent.splice(result.index, 0, removed);
        return;
      }
    }

    const clampedIndex = Math.min(targetIndex, targetList.length);
    targetList.splice(clampedIndex, 0, removed);
    commit();
  }

  // ── Tabs 操作 ──

  function addTab(fieldKey: string) {
    const result = findField(fieldKey);
    if (!result?.field.tabs) return;
    result.field.tabs.push({
      key: generateKey('tab'),
      label: `标签${result.field.tabs.length + 1}`,
      children: [],
    });
    commit();
  }

  function removeTab(fieldKey: string, tabKey: string) {
    const result = findField(fieldKey);
    if (!result?.field.tabs) return;
    const tabIndex = result.field.tabs.findIndex((t) => t.key === tabKey);
    if (tabIndex < 0 || result.field.tabs.length <= 1) return;
    result.field.tabs.splice(tabIndex, 1);
    commit();
  }

  function updateTab(fieldKey: string, tabKey: string, updates: Partial<FormTabPane>) {
    const result = findField(fieldKey);
    if (!result?.field.tabs) return;
    const tab = result.field.tabs.find((t) => t.key === tabKey);
    if (!tab) return;
    Object.assign(tab, updates);
    commit();
  }

  // ── Grid 操作 ──

  function addColumn(fieldKey: string, span = 12) {
    const result = findField(fieldKey);
    if (!result?.field.columns) return;
    result.field.columns.push({ span, children: [] });
    commit();
  }

  function removeColumn(fieldKey: string, columnIndex: number) {
    const result = findField(fieldKey);
    if (!result?.field.columns) return;
    if (result.field.columns.length <= 1) return;
    result.field.columns.splice(columnIndex, 1);
    commit();
  }

  function updateColumnSpan(fieldKey: string, columnIndex: number, span: number) {
    const result = findField(fieldKey);
    if (!result?.field.columns) return;
    const col = result.field.columns[columnIndex];
    if (!col) return;
    col.span = span;
    commit();
  }

  // ── 序列化 / 反序列化 ──

  /** 将当前状态序列化为 FormSchema JSON 字符串 */
  function toSchemaJson(): string {
    const schema: FormSchema = {
      version: 1,
      fields: fields.value,
      formConfig: formConfig.value,
    };
    return JSON.stringify(schema);
  }

  /** 从 FormSchema JSON 字符串加载状态 */
  function fromSchemaJson(json: string) {
    try {
      const schema: FormSchema = JSON.parse(json);
      fields.value = schema.fields ?? [];
      formConfig.value = schema.formConfig ?? {
        labelPosition: 'top',
        labelWidth: '100px',
        size: 'default',
        disabled: false,
      };
      selectedFieldKey.value = null;
      initHistory();
    } catch (err) {
      console.error('[use-form-schema] Failed to parse schema JSON', err);
    }
  }

  /** 重置为空表单 */
  function reset() {
    fields.value = [];
    formConfig.value = {
      labelPosition: 'top',
      labelWidth: '100px',
      size: 'default',
      disabled: false,
    };
    selectedFieldKey.value = null;
    initHistory();
  }

  /** 获取所有字段的 fieldKey 列表（扁平化，含嵌套） */
  function getAllFieldKeys(): string[] {
    const keys: string[] = [];
    function collect(list: FormFieldSchema[]) {
      for (const field of list) {
        keys.push(field.fieldKey);
        if (field.children) collect(field.children);
        if (field.tabs) field.tabs.forEach((tab) => collect(tab.children));
        if (field.columns) field.columns.forEach((col) => collect(col.children));
      }
    }
    collect(fields.value);
    return keys;
  }

  // 初始化
  initHistory();

  return {
    // 状态
    fields,
    formConfig,
    selectedFieldKey,
    selectedField,

    // 撤销/重做
    undo,
    redo,
    canUndo,
    canRedo,
    commit,

    // 字段操作
    addField,
    addFieldToTab,
    addFieldToColumn,
    removeField,
    updateField,
    moveField,
    duplicateField,
    moveFieldTo,
    findField,

    // Tabs 操作
    addTab,
    removeTab,
    updateTab,

    // Grid 操作
    addColumn,
    removeColumn,
    updateColumnSpan,

    // 序列化
    toSchemaJson,
    fromSchemaJson,
    reset,
    getAllFieldKeys,
  };
}
