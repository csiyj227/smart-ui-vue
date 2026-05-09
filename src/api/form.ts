/**
 * 表单管理模块前端 API 封装。
 *
 * 对应后端两个 Controller：
 *   1. SysFormController   (/form)         — 表单定义 CRUD + 发布 + 数据提交/查询
 *   2. FormBindingController (/flow/form)  — 流程与表单的绑定 / 快照
 *
 * 与 flow.ts 保持一致的风格：所有方法返回 axios 解包后的真实 data。
 */
import request from '@/utils/request';
import type { PageResult } from '@/types/api';
import type {
  SysFormView,
  SysFormDataView,
  CreateFormCmd,
  UpdateFormCmd,
  FormBindingView,
  BindFormCmd,
  BoundFormView,
  FormSnapshotView,
} from '@/types/form';

// ─────────── 表单定义 CRUD（SysFormController） ───────────

/** 分页查询表单列表 */
export function getFormPage(params: {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  category?: string;
}) {
  return request.get<unknown, PageResult<SysFormView>>('/system/form/page', {
    params: {
      current: params.pageNum,
      size: params.pageSize,
      keyword: params.keyword,
      status: params.status,
      category: params.category,
    },
  });
}

/** 根据 ID 获取表单详情 */
export function getFormById(formId: number) {
  return request.get<unknown, SysFormView>(`/system/form/${formId}`);
}

/** 根据 formKey 获取表单 */
export function getFormByKey(formKey: string) {
  return request.get<unknown, SysFormView>(`/system/form/key/${encodeURIComponent(formKey)}`);
}

/** 创建表单 */
export function createForm(data: CreateFormCmd) {
  return request.post<unknown, number>('/system/form', data);
}

/** 更新表单 */
export function updateForm(data: UpdateFormCmd) {
  return request.put<unknown, void>('/system/form', data);
}

/** 删除表单 */
export function deleteForm(formId: number) {
  return request.delete<unknown, void>(`/system/form/${formId}`);
}

/** 发布表单 */
export function publishForm(formId: number) {
  return request.post<unknown, void>(`/system/form/${formId}/publish`);
}

// ─────────── 表单数据（SysFormController） ───────────

/** 提交表单数据 */
export function submitFormData(data: { formId: number; formData: string }) {
  return request.post<unknown, number>('/system/form/data', data);
}

/** 获取表单数据列表 */
export function getFormDataList(formId: number) {
  return request.get<unknown, SysFormDataView[]>(`/system/form/${formId}/data`);
}

/** 获取当前用户的表单数据 */
export function getMyFormData(formId: number) {
  return request.get<unknown, SysFormDataView[]>(`/system/form/${formId}/my-data`);
}

// ─────────── 表单绑定（FormBindingController） ───────────

/** 绑定表单到流程定义或节点 */
export function bindForm(cmd: BindFormCmd) {
  return request.post<unknown, number>('/flow/form/binding', cmd);
}

/** 解除表单绑定 */
export function unbindForm(bindingId: number) {
  return request.delete<unknown, void>(`/flow/form/binding/${bindingId}`);
}

/**
 * 加载有效绑定（合并图表默认 + 节点覆盖）。
 * 返回的 BoundFormView 包含 formId、schemaJson、effectiveRules。
 */
export function loadEffectiveBinding(chartId: number, nodeKey?: string) {
  return request.get<unknown, BoundFormView>('/flow/form/binding/effective', {
    params: { chartId, nodeKey },
  });
}

// ─────────── 表单快照（FormBindingController） ───────────

/** 获取快照时间线 */
export function getSnapshotTimeline(processInstanceId: string) {
  return request.get<unknown, FormSnapshotView[]>(
    `/flow/form/snapshot/${encodeURIComponent(processInstanceId)}/timeline`,
  );
}

/** 获取当前活体表单数据 */
export function getCurrentFormPayload(processInstanceId: string) {
  return request.get<unknown, Record<string, unknown>>(
    `/flow/form/snapshot/${encodeURIComponent(processInstanceId)}/current`,
  );
}
