/**
 * smart-flow 模块前端 API 封装。
 *
 * 命名约定：所有方法名都以「领域名词 + 动词」组合，避免后端 controller 里
 * 出现过的「saveDraft / overwriteDraft」二选一这种含义重叠 —— 前端只暴露
 * 一个 saveDraft，根据 chartId 是否存在自动决定 POST 还是 PUT，外部调用者
 * 不需要关心 REST 风格细节。
 *
 * 所有方法都返回 axios 解包后的真实 data（R<T> 已在 utils/request.ts 拆掉）。
 * 如果某天需要拿到原始 R<T>（比如 flow_inst_admin 操作希望看到 code），改
 * request.ts 即可，不需要改这里。
 *
 * 注意：utils/request 的 axios 响应拦截器已经把 R<T> 拆成 data；同一个文件里
 * 不同方法的返回值类型应一致（都返回 data 而不是 R<data>），否则上层调用
 * 方就要在多处加判空，体验很差。
 */
import request from '@/utils/request';
import type {
  FlowDefinitionDraftCmd,
  FlowDefinitionView,
  TaskCenterQuery,
  TaskCenterPage,
  StartFlowCmd,
  CompleteTaskCmd,
  FlowInstanceDetailVO,
} from '@/types/flow';
import type { PageResult } from '@/types/api';

/**
 * 保存草稿。chartId 为 null 创建新版本，有值则覆盖原草稿。
 *
 * 之所以前端封一层而不是让调用者直接选 POST/PUT，是因为「保存草稿」对设计师
 * 来说就是一个动作，REST 动词的差异属于实现细节。
 */
export function saveDraft(cmd: FlowDefinitionDraftCmd) {
  if (cmd.chartId == null) {
    return request.post<unknown, number>('/flow/definition/draft', cmd);
  }
  return request.put<unknown, number>(`/flow/definition/${cmd.chartId}/draft`, cmd);
}

/** 编译并发布到 Flowable，对已发布版本是幂等的（直接返回当前 view）。 */
export function publishDefinition(chartId: number) {
  return request.post<unknown, FlowDefinitionView>(`/flow/definition/${chartId}/publish`);
}

/**
 * 归档版本：从 Flowable undeploy，已运行实例不受影响。
 *
 * 命名上故意叫 archive 而不是 delete —— 后端使用的是「软归档」语义（保留行
 * 但停止接收新实例）。前端列表里同时暴露 archive（下线）和 deleteDraft
 * （硬删除草稿），不要混用。
 */
export function archiveDefinition(chartId: number) {
  return request.delete<unknown, void>(`/flow/definition/${chartId}`);
}

/**
 * 删除草稿（DRAFT 状态的硬删除别名）。后端目前是统一的 DELETE 端点 ——
 * 应用层会根据 status 决定是「归档」还是「删除草稿」（草稿没有 deployment，
 * 直接删行；已发布的归档保留行）。前端封两个名字仅仅是为了让调用方意图清晰。
 */
export function deleteDefinition(chartId: number) {
  return request.delete<unknown, void>(`/flow/definition/${chartId}`);
}

/** 拿到单个版本详情。 */
export function getDefinition(chartId: number) {
  return request.get<unknown, FlowDefinitionView>(`/flow/definition/${chartId}`);
}

/**
 * 列出某 chartKey 的所有版本，新到旧。
 * 版本对比对话框、设计器右上角「版本切换」用这个。
 *
 * 入参是 chartKey（业务标识），不是 chartId（行号）—— 因为「版本」概念是
 * 在 chartKey 维度聚合的，同一个 key 的不同 chartId 才是不同版本。
 */
export function listVersions(chartKey: string) {
  return request.get<unknown, FlowDefinitionView[]>(
    `/flow/definition/key/${encodeURIComponent(chartKey)}/versions`,
  );
}

/** 拿到当前 chartKey 的「正在生效」版本。 */
export function getLatestPublished(chartKey: string) {
  return request.get<unknown, FlowDefinitionView>(
    `/flow/definition/key/${encodeURIComponent(chartKey)}/latest`,
  );
}

/**
 * 流程定义列表分页（设计器入口页用）。
 *
 * 后端会按 chartKey 聚合到「最新版本」一行，列表只展示「有哪些流程」而不是
 * 「每个流程的每个历史版本」—— 历史版本通过 listVersions 单独查看。
 */
export interface FlowDefinitionPageQuery {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export function pageDefinitions(query: FlowDefinitionPageQuery) {
  return request.get<unknown, PageResult<FlowDefinitionView>>('/flow/definition/page', {
    params: {
      current: query.pageNum,
      size: query.pageSize,
      keyword: query.keyword,
      status: query.status,
    },
  });
}

// ============================================================================
// 任务中心
// ============================================================================

/** 我的待办 */
export function fetchMyTodo(query: TaskCenterQuery = {}) {
  return request.get<unknown, TaskCenterPage>('/flow/task-center/my-todo', { params: query });
}

/** 我的已办 */
export function fetchMyDone(query: TaskCenterQuery = {}) {
  return request.get<unknown, TaskCenterPage>('/flow/task-center/my-done', { params: query });
}

/** 我发起的 */
export function fetchMyStarted(query: TaskCenterQuery = {}) {
  return request.get<unknown, TaskCenterPage>('/flow/task-center/my-started', { params: query });
}

/** 抄送我的 */
export function fetchMyCc(query: TaskCenterQuery = {}) {
  return request.get<unknown, TaskCenterPage>('/flow/task-center/my-cc', { params: query });
}

/** 待办数量（角标用） */
export function fetchPendingCount() {
  return request.get<unknown, number>('/flow/task-center/pending-count');
}

/** 标记抄送为已读 */
export function markCcRead(ccId: number) {
  return request.post<unknown, void>(`/flow/task-center/cc/${ccId}/read`);
}

// ============================================================================
// 流程实例
// ============================================================================

/** 发起流程 */
export function startProcess(cmd: StartFlowCmd) {
  return request.post<unknown, string>('/flow/instance/start', cmd);
}

/** 完成任务（审批/驳回） */
export function completeTask(cmd: CompleteTaskCmd) {
  return request.post<unknown, void>('/flow/instance/complete', cmd);
}

/** 获取流程实例详情（聚合：基本信息 + 表单数据 + 审批记录） */
export function getInstanceDetail(processInstanceId: string) {
  return request.get<unknown, FlowInstanceDetailVO>(`/flow/instance/${processInstanceId}/detail`);
}
