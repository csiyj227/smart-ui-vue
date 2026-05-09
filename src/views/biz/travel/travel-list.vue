<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElCard, ElButton, ElInput, ElForm, ElFormItem, ElTable, ElTableColumn,
  ElTag, ElPagination, ElEmpty, ElMessage, ElMessageBox,
} from 'element-plus';
import { Search, Refresh, Plus } from '@element-plus/icons-vue';
import { pageTravelApply, deleteTravelApply, bindTravelProcess } from '@/api/travel';
import { startProcess } from '@/api/flow';
import type { BizTravelApply } from '@/types/travel';
import { TRAVEL_STATUS_LABEL, TRAVEL_STATUS_TAG } from '@/types/travel';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);
const tableData = ref<BizTravelApply[]>([]);
const total = ref(0);

const query = reactive({
  current: 1,
  size: 10,
  applyNo: '',
  applicantName: '',
  destination: '',
  status: '',
});

async function loadData() {
  loading.value = true;
  try {
    const res = await pageTravelApply(query) as any;
    const page = res.data?.data;
    if (page) {
      tableData.value = page.records || [];
      total.value = page.total || 0;
    }
  } catch {
    ElMessage.error(t('biz.travel.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.current = 1;
  loadData();
}

function handleReset() {
  query.applyNo = '';
  query.applicantName = '';
  query.destination = '';
  query.status = '';
  query.current = 1;
  loadData();
}

function handleSizeChange(size: number) {
  query.size = size;
  query.current = 1;
  loadData();
}

function handleCurrentChange(page: number) {
  query.current = page;
  loadData();
}

function handleAdd() {
  router.push('/biz/travel/form');
}

function handleEdit(row: BizTravelApply) {
  router.push(`/biz/travel/form/${row.applyId}`);
}

function handleView(row: BizTravelApply) {
  router.push(`/biz/travel/view/${row.applyId}`);
}

async function handleDelete(row: BizTravelApply) {
  try {
    await ElMessageBox.confirm(t('biz.travel.deleteConfirm'), t('common.tip'), { type: 'warning' });
    await deleteTravelApply(row.applyId!);
    ElMessage.success(t('biz.travel.deleteSuccess'));
    loadData();
  } catch {
    // cancelled
  }
}

/** 出差审批流程标识 — 在流程设计器中配置的 chartKey */
const TRAVEL_CHART_KEY = 'newFlow_mots7vn3';

/** 提交发起流程：调流程发起接口 → 回写 processInstanceId */
async function handleSubmit(row: BizTravelApply) {
  try {
    await ElMessageBox.confirm(
      t('biz.travel.submitConfirm'),
      t('biz.travel.submitTitle'),
      { confirmButtonText: t('biz.travel.submitBtn'), cancelButtonText: t('biz.travel.cancelBtn'), type: 'info' },
    );

    const flowTitle = t('biz.travel.flowTitle', { applyNo: row.applyNo, name: row.applicantName || '' });
    const formData = {
      applyId: row.applyId,
      applyNo: row.applyNo,
      applicantName: row.applicantName,
      departure: row.departure,
      destination: row.destination,
      startTime: row.startTime,
      endTime: row.endTime,
      transport: row.transport,
      estimatedCost: row.estimatedCost,
      reason: row.reason,
    };

    // 1. 调用流程发起接口
    const res = await startProcess({
      chartKey: TRAVEL_CHART_KEY,
      title: flowTitle,
      bizNoPrefix: 'TRAVEL',
      formData,
    }) as any;

    const processInstanceId = res.data?.data;
    if (!processInstanceId) {
      ElMessage.error(t('biz.travel.processStartFailed'));
      return;
    }

    // 2. 回写 processInstanceId 到出差申请单
    await bindTravelProcess(row.applyId!, processInstanceId);

    ElMessage.success(t('biz.travel.processStartSuccess'));
    loadData();
  } catch {
    // cancelled or error
  }
}

onMounted(loadData);
</script>

<template>
  <div class="travel-list">
    <ElCard shadow="never">
      <!-- 搜索栏 -->
      <div class="travel-list__filter">
        <ElForm :inline="true" :model="query" @submit.prevent>
          <ElFormItem :label="t('biz.travel.applyNoLabel')">
            <ElInput v-model="query.applyNo" :placeholder="t('biz.travel.placeholder')" clearable style="width: 160px" @keyup.enter="handleSearch" />
          </ElFormItem>
          <ElFormItem :label="t('biz.travel.applicantLabel')">
            <ElInput v-model="query.applicantName" :placeholder="t('biz.travel.placeholder')" clearable style="width: 140px" @keyup.enter="handleSearch" />
          </ElFormItem>
          <ElFormItem :label="t('biz.travel.destinationLabel')">
            <ElInput v-model="query.destination" :placeholder="t('biz.travel.placeholder')" clearable style="width: 140px" @keyup.enter="handleSearch" />
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" :icon="Search" @click="handleSearch">{{ t('biz.travel.search') }}</ElButton>
            <ElButton :icon="Refresh" @click="handleReset">{{ t('biz.travel.reset') }}</ElButton>
          </ElFormItem>
        </ElForm>
        <ElButton type="primary" :icon="Plus" @click="handleAdd">{{ t('biz.travel.createNew') }}</ElButton>
      </div>

      <!-- 表格 -->
      <ElTable v-loading="loading" :data="tableData" border stripe>
        <ElTableColumn prop="applyNo" :label="t('biz.travel.colApplyNo')" min-width="180" />
        <ElTableColumn prop="applicantName" :label="t('biz.travel.colApplicant')" width="100" />
        <ElTableColumn prop="deptName" :label="t('biz.travel.colDept')" width="120" />
        <ElTableColumn prop="departure" :label="t('biz.travel.colDeparture')" width="100" />
        <ElTableColumn prop="destination" :label="t('biz.travel.colDestination')" width="100" />
        <ElTableColumn prop="startTime" :label="t('biz.travel.colStartTime')" width="160" />
        <ElTableColumn prop="endTime" :label="t('biz.travel.colEndTime')" width="160" />
        <ElTableColumn prop="transport" :label="t('biz.travel.colTransport')" width="90" />
        <ElTableColumn prop="estimatedCost" :label="t('biz.travel.colEstimatedCost')" width="100" align="right">
          <template #default="{ row }">
            {{ row.estimatedCost != null ? `¥${Number(row.estimatedCost).toFixed(2)}` : '-' }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" :label="t('biz.travel.colStatus')" width="90" align="center">
          <template #default="{ row }">
            <ElTag :type="(TRAVEL_STATUS_TAG[row.status] as any) || 'info'" size="small">
              {{ TRAVEL_STATUS_LABEL[row.status] || row.status }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('biz.travel.colAction')" width="220" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" size="small" @click="handleView(row)">{{ t('biz.travel.view') }}</ElButton>
            <template v-if="row.status === 'DRAFT' || row.status === 'REJECTED'">
              <ElButton link type="primary" size="small" @click="handleEdit(row)">{{ t('biz.travel.edit') }}</ElButton>
              <ElButton link type="success" size="small" @click="handleSubmit(row)">{{ t('biz.travel.submit') }}</ElButton>
              <ElButton link type="danger" size="small" @click="handleDelete(row)">{{ t('biz.travel.delete') }}</ElButton>
            </template>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElEmpty v-if="tableData.length === 0 && !loading" :description="t('biz.travel.noData')" />

      <!-- 分页 -->
      <div class="travel-list__pager">
        <ElPagination
          v-model:current-page="query.current"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </ElCard>
  </div>
</template>

<style lang="scss" scoped>
.travel-list {
  padding: 16px;

  &__filter {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;

    :deep(.el-form-item) {
      margin-right: 12px;
      margin-bottom: 0;
    }
  }

  &__pager {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
