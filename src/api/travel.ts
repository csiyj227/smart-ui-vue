import request from '@/utils/request';
import type { BizTravelApply } from '@/types/travel';

/** 分页查询出差申请 */
export const pageTravelApply = (params: Record<string, unknown>) =>
  request.get('/system/travel-apply/page', { params });

/** 根据 ID 查询详情 */
export const getTravelApplyById = (applyId: number) =>
  request.get(`/system/travel-apply/${applyId}`);

/** 新建出差申请 */
export const createTravelApply = (data: BizTravelApply) =>
  request.post('/system/travel-apply', data);

/** 修改出差申请 */
export const updateTravelApply = (data: BizTravelApply) =>
  request.put('/system/travel-apply', data);

/** 删除出差申请 */
export const deleteTravelApply = (applyId: number) =>
  request.delete(`/system/travel-apply/${applyId}`);

/** 提交审批（仅更新状态，不发起流程） */
export const submitTravelApply = (applyId: number) =>
  request.post(`/system/travel-apply/${applyId}/submit`);

/** 绑定流程实例 ID 到出差申请单 */
export const bindTravelProcess = (applyId: number, processInstanceId: string) =>
  request.put(`/system/travel-apply/${applyId}/bindProcess`, { processInstanceId });
