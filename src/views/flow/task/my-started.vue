<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElCard, ElForm, ElFormItem, ElInput, ElButton, ElTable, ElTableColumn, ElTag, ElEmpty, ElPagination, ElDrawer, ElDescriptions, ElDescriptionsItem, ElDivider, ElTimeline, ElTimelineItem } from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';
import type { TaskCenterQuery, TaskCenterItem, TaskCenterPage, FlowInstanceDetailVO, ApprovalRecordVO } from '@/types/flow';
import { BIZ_STATUS_TEXT, BIZ_STATUS_TAG, ACTION_TYPE_TEXT, ACTION_TYPE_TAG, BIZ_STATUS_LABEL, BIZ_STATUS_TAG_TYPE } from '@/types/flow';
import FlowPreview from '@/components/FlowPreview/FlowPreview.vue';
import { fetchMyStarted, getInstanceDetail } from '@/api/flow';
import { formatDateTime } from '@/utils/format';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();

// 查询参数
const query = reactive<TaskCenterQuery>({
  pageNum: 1,
  pageSize: 10,
  keyword: ''
});

// 表格数据
const tableData = ref<TaskCenterItem[]>([]);
const total = ref(0);
const loading = ref(false);

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const res = await fetchMyStarted(query) as any;
    const page = res.data?.data as TaskCenterPage;
    if (page) {
      tableData.value = page.records || [];
      total.value = page.total || 0;
    }
  } catch (error) {
    ElMessage.error(t('flow.common.loadFailed'));
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  query.pageNum = 1;
  loadData();
};

// 分页大小变化
const handleSizeChange = (size: number) => {
  query.pageSize = size;
  query.pageNum = 1;
  loadData();
};

// 页码变化
const handleCurrentChange = (page: number) => {
  query.pageNum = page;
  loadData();
};

// 刷新
const handleRefresh = () => {
  query.keyword = '';
  query.pageNum = 1;
  loadData();
};

// ==================== 查看详情抽屉 ====================
const drawerVisible = ref(false);
const currentTask = ref<TaskCenterItem | null>(null);
const instanceDetail = ref<FlowInstanceDetailVO | null>(null);
const detailLoading = ref(false);

async function handleView(row: TaskCenterItem) {
  if (!row.processInstanceId) return;

  try {
    const axiosRes = await getInstanceDetail(row.processInstanceId);
    const body = (axiosRes as any).data;
    const detail = body?.data as FlowInstanceDetailVO ?? null;

    if (detail?.formType === 'CUSTOM') {
      router.push({
        path: `/flow/task/handle/${row.processInstanceId}`,
        query: { mode: 'view' },
      });
      return;
    }

    currentTask.value = row;
    instanceDetail.value = detail;
    drawerVisible.value = true;
  } catch {
    currentTask.value = row;
    instanceDetail.value = null;
    drawerVisible.value = true;
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
        <ElFormItem :label="t('flow.common.keyword')">
          <ElInput
            v-model="query.keyword"
            :placeholder="t('flow.started.keywordPlaceholder')"
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
      style="width: 100%; margin-top: 16px"
    >
      <ElTableColumn prop="title" :label="t('flow.common.title')" min-width="200" />
      <ElTableColumn prop="bizNo" :label="t('flow.common.bizNo')" width="180" />
      <ElTableColumn prop="viewStatus" :label="t('flow.common.status')" width="100">
        <template #default="{ row }">
          <ElTag :type="BIZ_STATUS_TAG[row.viewStatus as keyof typeof BIZ_STATUS_TAG] || 'info'">
            {{ BIZ_STATUS_TEXT[row.viewStatus as keyof typeof BIZ_STATUS_TEXT] || row.viewStatus }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="starterName" :label="t('flow.common.starter')" width="120" />
      <ElTableColumn prop="receivedAt" :label="t('flow.common.startTime')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.receivedAt) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="finishedAt" :label="t('flow.common.endTime')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.finishedAt) }}</template>
      </ElTableColumn>
      <ElTableColumn :label="t('flow.common.actions')" width="100" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="handleView(row)">{{ t('flow.common.view') }}</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <!-- 空状态 -->
    <ElEmpty v-if="!loading && tableData.length === 0" :description="t('flow.started.noStartedProcesses')" />

    <!-- 分页 -->
    <div class="task-list__pager">
      <ElPagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </ElCard>

    <!-- 查看详情抽屉 -->
    <ElDrawer v-model="drawerVisible" :title="t('flow.common.processInfo')" size="560px">
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
        </template>
        <ElEmpty v-else-if="!detailLoading" :description="t('flow.common.noDetailData')" />
      </div>
    </ElDrawer>
  </div>
</template>

<style lang="scss" scoped>
.task-list {
  padding: 16px;
}

.task-list__card {
  border-radius: 8px;
}

.task-list__filter {
  display: flex;
}

.task-list__form {
  flex: 1;
}

.task-list__input {
  width: 240px;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

.task-list__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
