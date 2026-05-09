<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElCard, ElForm, ElFormItem, ElInput, ElButton, ElTable, ElTableColumn, ElTag, ElEmpty, ElPagination } from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';
import type { TaskCenterQuery, TaskCenterItem, TaskCenterPage } from '@/types/flow';
import { CC_STATUS_TEXT, CC_STATUS_TAG } from '@/types/flow';
import { fetchMyCc, markCcRead } from '@/api/flow';
import { formatDateTime } from '@/utils/format';

const { t } = useI18n();

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
    const res = await fetchMyCc(query) as any;
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

// 标记已读
const handleMarkRead = async (row: TaskCenterItem) => {
  try {
    await markCcRead(Number(row.taskId));
    ElMessage.success(t('flow.cc.markReadSuccess'));
    loadData();
  } catch (error) {
    ElMessage.error(t('flow.cc.markReadFailed'));
  }
};

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
            :placeholder="t('flow.cc.keywordPlaceholder')"
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
      <ElTableColumn prop="processInstanceId" :label="t('flow.cc.processInstanceId')" width="200" />
      <ElTableColumn prop="nodeName" :label="t('flow.cc.nodeName')" min-width="150" />
      <ElTableColumn prop="viewStatus" :label="t('flow.common.status')" width="100">
        <template #default="{ row }">
          <ElTag :type="CC_STATUS_TAG[row.viewStatus as keyof typeof CC_STATUS_TAG] || 'info'">
            {{ CC_STATUS_TEXT[row.viewStatus as keyof typeof CC_STATUS_TEXT] || row.viewStatus }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="receivedAt" :label="t('flow.cc.receivedAt')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.receivedAt) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="finishedAt" :label="t('flow.cc.readAt')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.finishedAt) }}</template>
      </ElTableColumn>
      <ElTableColumn :label="t('flow.common.actions')" width="120" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="row.viewStatus === 'unread'"
            link
            type="primary"
            @click="handleMarkRead(row)"
          >
            {{ t('flow.cc.markAsRead') }}
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <!-- 空状态 -->
    <ElEmpty v-if="!loading && tableData.length === 0" :description="t('flow.cc.noCcRecords')" />

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
