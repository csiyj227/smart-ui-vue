/** 出差申请单实体 */
export interface BizTravelApply {
  applyId?: number;
  applyNo?: string;
  applicantId?: number;
  applicantName?: string;
  deptName?: string;
  reason?: string;
  departure?: string;
  destination?: string;
  startTime?: string;
  endTime?: string;
  transport?: string;
  estimatedCost?: number;
  remark?: string;
  status?: string;
  processInstanceId?: string;
  createTime?: string;
  updateTime?: string;
}

/** 状态 → 中文标签 */
export const TRAVEL_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

/** 状态 → ElTag type */
export const TRAVEL_STATUS_TAG: Record<string, string> = {
  DRAFT: 'info',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** 交通方式选项 */
export const TRANSPORT_OPTIONS = [
  { label: '飞机', value: '飞机' },
  { label: '高铁', value: '高铁' },
  { label: '火车', value: '火车' },
  { label: '汽车', value: '汽车' },
  { label: '自驾', value: '自驾' },
  { label: '其他', value: '其他' },
];
