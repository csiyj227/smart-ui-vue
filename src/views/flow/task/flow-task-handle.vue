<script setup lang="ts">
/**
 * 流程任务处理页面 —— 通用的「查看/处理」页面。
 *
 * 路由参数：
 *   - processInstanceId：流程实例 ID（路径参数）
 *   - taskId：待办任务 ID（query 参数，仅待办模式下有）
 *   - mode：'handle' = 待办处理（显示审批操作区），'view' = 只读查看
 *
 * 页面布局：
 *   上半部分：嵌入自定义表单详情（CUSTOM 类型通过 viewUrl + 业务 ID 跳转组件）
 *   下半部分：流程信息（流程图 + 审批记录 + 审批操作区）
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElCard, ElButton, ElMessage, ElMessageBox, ElInput,
  ElDescriptions, ElDescriptionsItem, ElTag, ElDivider,
  ElTimeline, ElTimelineItem, ElEmpty, ElSkeleton,
} from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { getInstanceDetail, completeTask } from '@/api/flow';
import { formatDateTime } from '@/utils/format';
import type { FlowInstanceDetailVO } from '@/types/flow';
import { BIZ_STATUS_LABEL, BIZ_STATUS_TAG_TYPE, ACTION_TYPE_TEXT, ACTION_TYPE_TAG } from '@/types/flow';
import FlowPreview from '@/components/FlowPreview/FlowPreview.vue';
import TravelDetail from '@/views/biz/travel/travel-detail.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const processInstanceId = computed(() => route.params.processInstanceId as string);
const taskId = computed(() => (route.query.taskId as string) || '');
const mode = computed(() => (route.query.mode as string) || 'view');
const isHandleMode = computed(() => mode.value === 'handle' && !!taskId.value);

const loading = ref(true);
const detail = ref<FlowInstanceDetailVO | null>(null);
const approvalComment = ref('');
const submitting = ref(false);

/** 从 formData 中获取业务实体 ID（如 applyId） */
const businessId = computed(() => {
  const fd = detail.value?.formData;
  if (!fd) return null;
  // 常用的业务 key 命名约定
  return fd.applyId ?? fd.businessId ?? fd.id ?? null;
});

/** 判断是否为自定义表单 */
const isCustomForm = computed(() => detail.value?.formType === 'CUSTOM');

/** 渲染自定义表单详情的组件名 —— 根据 viewUrl 路径匹配 */
const customFormComponent = computed(() => {
  const viewUrl = detail.value?.formViewUrl;
  if (!viewUrl) return null;
  // 出差申请单
  if (viewUrl.includes('/biz/travel/')) return 'TravelDetail';
  return null;
});

async function loadDetail() {
  if (!processInstanceId.value) return;
  loading.value = true;
  try {
    const res = await getInstanceDetail(processInstanceId.value) as any;
    detail.value = res.data?.data as FlowInstanceDetailVO ?? null;
  } catch {
    ElMessage.error(t('flow.common.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleApprove() {
  if (!taskId.value) return;
  submitting.value = true;
  try {
    await completeTask({
      taskId: taskId.value,
      action: 'approve',
      comment: approvalComment.value || undefined,
    });
    ElMessage.success(t('flow.common.approveSuccess'));
    router.back();
  } catch {
    ElMessage.error(t('flow.common.approveFailed'));
  } finally {
    submitting.value = false;
  }
}

async function handleReject() {
  if (!taskId.value) return;
  try {
    await ElMessageBox.confirm(t('flow.common.rejectConfirmMessage'), t('flow.common.rejectConfirmTitle'), {
      confirmButtonText: t('flow.common.rejectConfirmButton'),
      cancelButtonText: t('flow.common.cancel'),
      type: 'warning',
    });
  } catch {
    return;
  }

  submitting.value = true;
  try {
    await completeTask({
      taskId: taskId.value,
      action: 'reject',
      comment: approvalComment.value || undefined,
    });
    ElMessage.success(t('flow.common.rejected'));
    router.back();
  } catch {
    ElMessage.error(t('flow.common.rejectFailed'));
  } finally {
    submitting.value = false;
  }
}

function handleBack() {
  router.back();
}

onMounted(loadDetail);
</script>

<template>
  <div class="flow-handle">
    <!-- 顶部导航 -->
    <div class="flow-handle__topbar">
      <ElButton :icon="ArrowLeft" link @click="handleBack">返回</ElButton>
      <span class="flow-handle__title">
        {{ isHandleMode ? t('flow.taskHandle.taskHandle') : t('flow.common.view') }}
        <template v-if="detail?.title"> — {{ detail.title }}</template>
      </span>
    </div>

    <ElSkeleton v-if="loading" :rows="10" animated style="padding: 16px;" />

    <template v-else-if="detail">
      <!-- =========== 上半部分：业务表单详情 =========== -->
      <ElCard shadow="never" class="flow-handle__section">
        <template #header>
          <span class="flow-handle__section-title">
            {{ detail.formName || t('flow.taskHandle.formDetail') }}
          </span>
        </template>

        <!-- CUSTOM 表单：嵌入对应业务组件 -->
        <template v-if="isCustomForm && customFormComponent === 'TravelDetail'">
          <TravelDetail :apply-id="businessId as number" />
        </template>

        <!-- DYNAMIC 表单：显示 key-value 表单数据 -->
        <template v-else-if="detail.formData && Object.keys(detail.formData).length > 0">
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem
              v-for="(value, key) in detail.formData"
              :key="key"
              :label="detail.fieldLabelMap?.[key as string] || key"
            >
              {{ value }}
            </ElDescriptionsItem>
          </ElDescriptions>
        </template>

        <ElEmpty v-else :description="t('flow.common.noFormData')" :image-size="60" />
      </ElCard>

      <!-- =========== 下半部分：流程信息 =========== -->
      <ElCard shadow="never" class="flow-handle__section">
        <template #header>
          <span class="flow-handle__section-title">{{ t('flow.common.processInfo') }}</span>
        </template>

        <!-- 基本信息 -->
        <ElDescriptions :column="2" border size="small">
          <ElDescriptionsItem :label="t('flow.common.processName')">{{ detail.chartName }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('flow.common.bizNo')">{{ detail.bizNo }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('flow.common.starter')">{{ detail.starterName }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('flow.common.status')">
            <ElTag
              v-if="detail.bizStatus"
              :type="(BIZ_STATUS_TAG_TYPE[detail.bizStatus] as any) || 'info'"
              size="small"
            >
              {{ BIZ_STATUS_LABEL[detail.bizStatus] || detail.bizStatus }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="t('flow.common.startTime')">{{ formatDateTime(detail.startTime) }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="detail.endTime" :label="t('flow.common.endTime')">{{ formatDateTime(detail.endTime) }}</ElDescriptionsItem>
        </ElDescriptions>

        <ElDivider />

        <!-- 流程图 -->
        <div class="flow-handle__sub-section">
          <div class="flow-handle__sub-title">{{ t('flow.common.flowChart') }}</div>
          <FlowPreview
            :chart-dsl="detail.chartDsl"
            :active-node-keys="detail.activeNodeKeys"
            :completed-node-keys="detail.completedNodeKeys"
            height="280px"
          />
        </div>

        <ElDivider />

        <!-- 审批记录 -->
        <div class="flow-handle__sub-section">
          <div class="flow-handle__sub-title">{{ t('flow.common.approvalRecords') }}</div>
          <ElTimeline v-if="detail.records && detail.records.length > 0">
            <ElTimelineItem
              v-for="record in detail.records"
              :key="record.recordId"
              :timestamp="formatDateTime(record.occurredAt)"
              placement="top"
            >
              <div class="flow-handle__timeline-item">
                <div class="flow-handle__timeline-header">
                  <ElTag
                    v-if="record.actionType"
                    :type="(ACTION_TYPE_TAG[record.actionType] as any) || ''"
                    size="small"
                  >
                    {{ ACTION_TYPE_TEXT[record.actionType] || record.actionType }}
                  </ElTag>
                  <span class="flow-handle__timeline-actor">{{ record.actorName }}</span>
                </div>
                <div v-if="record.comment" class="flow-handle__timeline-comment">
                  {{ record.comment }}
                </div>
              </div>
            </ElTimelineItem>
          </ElTimeline>
          <ElEmpty v-else :description="t('flow.common.noApprovalRecords')" :image-size="60" />
        </div>
      </ElCard>

      <!-- =========== 审批操作区（仅待办处理模式） =========== -->
      <ElCard v-if="isHandleMode" shadow="never" class="flow-handle__section">
        <template #header>
          <span class="flow-handle__section-title">{{ t('flow.taskHandle.approvalOperation') }}</span>
        </template>

        <div class="flow-handle__comment">
          <div class="flow-handle__comment-label">{{ t('flow.common.approvalComment') }}</div>
          <ElInput
            v-model="approvalComment"
            type="textarea"
            :rows="4"
            :placeholder="t('flow.common.commentPlaceholder')"
            maxlength="500"
            show-word-limit
          />
        </div>

        <div class="flow-handle__actions">
          <ElButton
            type="primary"
            size="large"
            :loading="submitting"
            @click="handleApprove"
          >
            {{ t('flow.common.approve') }}
          </ElButton>
          <ElButton
            type="danger"
            size="large"
            :loading="submitting"
            @click="handleReject"
          >
            {{ t('flow.common.reject') }}
          </ElButton>
        </div>
      </ElCard>
    </template>

    <ElEmpty v-else :description="t('flow.common.noDetailData')" />
  </div>
</template>

<style lang="scss" scoped>
.flow-handle {
  padding: 16px;
  max-width: 960px;
  margin: 0 auto;

  &__topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__section {
    margin-bottom: 16px;
  }

  &__section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__sub-section {
    margin-top: 8px;
  }

  &__sub-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 12px;
  }

  &__timeline-item {
    line-height: 1.6;
  }

  &__timeline-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__timeline-actor {
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  &__timeline-comment {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  &__comment {
    margin-bottom: 16px;
  }

  &__comment-label {
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--el-text-color-primary);
  }

  &__actions {
    display: flex;
    justify-content: center;
    gap: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}
</style>
