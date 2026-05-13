<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElCard,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElInput,
  ElTag,
  ElButton,
  ElEmpty,
  ElMessage,
  ElMessageBox,
  ElForm,
  ElFormItem,
  ElDrawer,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';
import { fetchMyTodo, completeTask, getInstanceDetail } from '@/api/flow';
import { formatDateTime } from '@/utils/format';
import type { TaskCenterQuery, TaskCenterItem, TaskCenterPage, FlowInstanceDetailVO, ApprovalRecordVO } from '@/types/flow';
import { TASK_VIEW_STATUS_TEXT, TASK_VIEW_STATUS_TAG, ACTION_TYPE_TEXT, ACTION_TYPE_TAG, BIZ_STATUS_LABEL, BIZ_STATUS_TAG_TYPE } from '@/types/flow';
import FlowPreview from '@/components/FlowPreview/FlowPreview.vue';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const keyword = ref('');
const tableData = ref<TaskCenterItem[]>([]);
const total = ref(0);
const query = reactive<TaskCenterQuery>({
  pageNum: 1,
  pageSize: 10,
});

async function loadData() {
  loading.value = true;
  try {
    const res = await fetchMyTodo(query) as any;
    const page = res.data?.data as TaskCenterPage;
    if (page) {
      tableData.value = page.records || [];
      total.value = page.total || 0;
    }
  } catch (error) {
    ElMessage.error(t('flow.todo.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.pageNum = 1;
  query.keyword = keyword.value || undefined;
  loadData();
}

function handleRefresh() {
  keyword.value = '';
  query.pageNum = 1;
  query.keyword = undefined;
  loadData();
}

function handleSizeChange(size: number) {
  query.pageSize = size;
  query.pageNum = 1;
  loadData();
}

function handleCurrentChange(page: number) {
  query.pageNum = page;
  loadData();
}

// ==================== 任务处理抽屉 ====================
const drawerVisible = ref(false);
const currentTask = ref<TaskCenterItem | null>(null);
const approvalComment = ref('');
const submitting = ref(false);
const instanceDetail = ref<FlowInstanceDetailVO | null>(null);
const detailLoading = ref(false);

async function handleProcess(row: TaskCenterItem) {
  if (!row.processInstanceId) return;

  // 先查询流程详情，判断是否为 CUSTOM 自定义表单
  try {
    const axiosRes = await getInstanceDetail(row.processInstanceId);
    const body = (axiosRes as any).data;
    const detail = body?.data as FlowInstanceDetailVO ?? null;

    if (detail?.formType === 'CUSTOM') {
      // CUSTOM 表单：跳转到流程任务处理页面
      router.push({
        path: `/flow/task/handle/${row.processInstanceId}`,
        query: { taskId: row.taskId, mode: 'handle' },
      });
      return;
    }

    // DYNAMIC 或无表单：打开抽屉
    currentTask.value = row;
    approvalComment.value = '';
    instanceDetail.value = detail;
    drawerVisible.value = true;
  } catch {
    // 查询失败降级为开抽屉
    currentTask.value = row;
    approvalComment.value = '';
    instanceDetail.value = null;
    drawerVisible.value = true;
  }
}

async function handleApprove() {
  if (!currentTask.value?.taskId) return;
  submitting.value = true;
  try {
    await completeTask({
      taskId: currentTask.value.taskId,
      action: 'approve',
      comment: approvalComment.value || undefined,
    });
    ElMessage.success(t('flow.common.approveSuccess'));
    drawerVisible.value = false;
    loadData();
  } catch {
    ElMessage.error(t('flow.common.approveFailed'));
  } finally {
    submitting.value = false;
  }
}

async function handleReject() {
  if (!currentTask.value?.taskId) return;
  try {
    await ElMessageBox.confirm(t('flow.common.rejectConfirmMessage'), t('flow.common.rejectConfirmTitle'), {
      confirmButtonText: t('flow.common.rejectConfirmButton'),
      cancelButtonText: t('flow.common.cancel'),
      type: 'warning',
    });
  } catch {
    return; // 用户取消
  }

  submitting.value = true;
  try {
    await completeTask({
      taskId: currentTask.value.taskId,
      action: 'reject',
      comment: approvalComment.value || undefined,
    });
    ElMessage.success(t('flow.common.rejected'));
    drawerVisible.value = false;
    loadData();
  } catch {
    ElMessage.error(t('flow.common.rejectFailed'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="task-list">
    <ElCard shadow="never" class="task-list__card">
      <!-- 搜索栏 -->
      <div class="task-list__filter">
        <ElForm :inline="true" :model="query" class="task-list__form" @submit.prevent>
          <ElFormItem :label="t('flow.common.search')">
            <ElInput
              v-model="keyword"
              :placeholder="t('flow.todo.keywordPlaceholder')"
              clearable
              :prefix-icon="Search"
              class="task-list__input"
              @keyup.enter="handleSearch"
            />
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" :icon="Search" @click="handleSearch">{{ t('flow.common.search') }}</ElButton>
            <ElButton :icon="Refresh" @click="handleRefresh">{{ t('flow.common.reset') }}</ElButton>
          </ElFormItem>
        </ElForm>
      </div>

      <!-- 表格 -->
      <ElTable
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="margin-top: 16px"
      >
        <ElTableColumn prop="chartName" :label="t('flow.common.processName')" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="title" :label="t('flow.common.title')" min-width="200" show-overflow-tooltip />
        <ElTableColumn prop="bizNo" :label="t('flow.common.bizNo')" width="180" show-overflow-tooltip />
        <ElTableColumn prop="nodeName" :label="t('flow.common.currentNode')" width="120" show-overflow-tooltip />
        <ElTableColumn prop="starterName" :label="t('flow.common.starter')" width="100" show-overflow-tooltip />
        <ElTableColumn prop="viewStatus" :label="t('flow.common.status')" width="100">
          <template #default="{ row }">
            <ElTag
              v-if="row.viewStatus"
              :type="TASK_VIEW_STATUS_TAG[row.viewStatus] || 'info'"
            >
              {{ TASK_VIEW_STATUS_TEXT[row.viewStatus] || row.viewStatus }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="receivedAt" :label="t('flow.todo.receivedAt')" width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDateTime(row.receivedAt) }}</template>
        </ElTableColumn>
        <ElTableColumn :label="t('flow.common.actions')" width="100" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link size="small" @click="handleProcess(row)">{{ t('flow.todo.taskHandle') }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- 空状态 -->
      <ElEmpty
        v-if="!loading && tableData.length === 0"
        :description="t('flow.todo.noTodoTasks')"
        style="margin-top: 40px"
      />

      <!-- 分页 -->
      <div class="task-list__pager">
        <ElPagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </ElCard>

    <!-- 任务处理抽屉 -->
    <ElDrawer
      v-model="drawerVisible"
      :title="t('flow.todo.taskHandle')"
      size="560px"
      :close-on-click-modal="false"
    >
      <div v-loading="detailLoading" style="min-height: 200px;">
        <template v-if="currentTask && instanceDetail">
          <!-- 流程信息 -->
          <ElDescriptions :column="2" border class="task-list__descriptions">
            <ElDescriptionsItem :label="t('flow.common.processName')">{{ instanceDetail.chartName || currentTask?.chartName }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('flow.common.bizNo')">{{ instanceDetail.bizNo }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('flow.common.title')" :span="2">{{ instanceDetail.title }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('flow.common.starter')">{{ instanceDetail.starterName }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('flow.common.status')">
              <ElTag
                v-if="instanceDetail.bizStatus"
                :type="(BIZ_STATUS_TAG_TYPE[instanceDetail.bizStatus] || 'info') as any"
              >
                {{ BIZ_STATUS_LABEL[instanceDetail.bizStatus] || instanceDetail.bizStatus }}
              </ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem :label="t('flow.common.startTime')" :span="2">{{ formatDateTime(instanceDetail.startTime) }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('flow.common.endTime')" :span="2" v-if="instanceDetail.endTime">{{ formatDateTime(instanceDetail.endTime) }}</ElDescriptionsItem>
          </ElDescriptions>

          <ElDivider />

          <!-- 流程图 -->
          <div class="task-list__section">
            <div class="task-list__section-title">{{ t('flow.common.flowChart') }}</div>
            <FlowPreview
              :chart-dsl="instanceDetail.chartDsl"
              :active-node-keys="instanceDetail.activeNodeKeys"
              :completed-node-keys="instanceDetail.completedNodeKeys"
              height="320px"
            />
          </div>

          <ElDivider />

          <!-- 表单数据 -->
          <div class="task-list__section">
            <div class="task-list__section-title">{{ t('flow.common.formData') }}</div>
            <div v-if="instanceDetail.formData && Object.keys(instanceDetail.formData).length > 0">
              <ElDescriptions :column="1" border>
                <ElDescriptionsItem
                  v-for="(value, key) in instanceDetail.formData"
                  :key="key"
                  :label="instanceDetail.fieldLabelMap?.[key as string] || key"
                >
                  {{ value }}
                </ElDescriptionsItem>
              </ElDescriptions>
            </div>
            <ElEmpty v-else :description="t('flow.common.noFormData')" :image-size="60" />
          </div>

          <ElDivider />

          <!-- 审批记录 -->
          <div class="task-list__section">
            <div class="task-list__section-title">{{ t('flow.common.approvalRecords') }}</div>
            <ElTimeline v-if="instanceDetail.records && instanceDetail.records.length > 0">
              <ElTimelineItem
                v-for="record in instanceDetail.records"
                :key="record.recordId"
                :timestamp="formatDateTime(record.occurredAt)"
                placement="top"
              >
                <div class="task-list__timeline-item">
                  <div class="task-list__timeline-header">
                    <ElTag
                      v-if="record.actionType"
                      :type="(ACTION_TYPE_TAG[record.actionType] || '') as any"
                      size="small"
                    >
                      {{ ACTION_TYPE_TEXT[record.actionType] || record.actionType }}
                    </ElTag>
                    <span class="task-list__timeline-actor">{{ record.actorName }}</span>
                  </div>
                  <div v-if="record.comment" class="task-list__timeline-comment">
                    {{ record.comment }}
                  </div>
                </div>
              </ElTimelineItem>
            </ElTimeline>
            <ElEmpty v-else :description="t('flow.common.noApprovalRecords')" :image-size="60" />
          </div>

          <ElDivider />

          <!-- 审批意见 -->
          <div class="task-list__comment">
            <div class="task-list__comment-label">{{ t('flow.common.approvalComment') }}</div>
            <ElInput
              v-model="approvalComment"
              type="textarea"
              :rows="4"
              :placeholder="t('flow.common.commentPlaceholder')"
              maxlength="500"
              show-word-limit
            />
          </div>

          <!-- 操作按钮 -->
          <div class="task-list__actions">
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
        </template>
        <ElEmpty v-else-if="!detailLoading" :description="t('flow.common.noDetailData')" />
      </div>
    </ElDrawer>
  </div>
</template>

<style lang="scss" scoped>
.task-list {
  padding: 16px;

  &__card {
    border-radius: 8px;
  }

  &__filter {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  &__form {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0;

    :deep(.el-form-item) {
      margin-right: 16px;
      margin-bottom: 0;
    }
  }

  &__input {
    width: 240px;
  }

  &__pager {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  &__comment {
    margin-top: 16px;
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
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}
</style>
