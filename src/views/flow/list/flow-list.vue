<!--
  流程定义列表 —— 设计器入口页。

  这是最朴素的列表 + CRUD 页，不在这里做花哨的卡片视图、看板视图，因为：
    - 设计器才是这个模块的「主舞台」，列表只是过路页
    - 与 smart-upms 的「角色管理」「用户管理」保持一致的表格风格，降低用户学习成本

  操作：
    - 新建：跳到 /flow/designer/new
    - 编辑：跳到 /flow/designer/:chartId
    - 发布/下线：直接调 API（不进设计器）
    - 删除：DRAFT 状态才允许；PUBLISHED 只能下线
-->
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ElCard,
  ElButton,
  ElTable,
  ElTableColumn,
  ElTag,
  ElInput,
  ElSelect,
  ElOption,
  ElPagination,
  ElMessage,
  ElMessageBox,
  ElSpace,
  ElForm,
  ElFormItem,
} from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';
import {
  pageDefinitions,
  publishDefinition,
  archiveDefinition,
  deleteDefinition,
} from '@/api/flow';
import { formatDateTime } from '@/utils/format';
import {
  PUBLISH_STATUS_CODE,
  PUBLISH_STATUS_TEXT,
  type FlowDefinitionView,
  type PublishStatusCode,
} from '@/types/flow';
import type { PageResult } from '@/types/api';

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const list = ref<FlowDefinitionView[]>([]);
const total = ref(0);

/**
 * 检索参数。status 字段使用前端业务名（DRAFT/PUBLISHED/ARCHIVED），
 * fetchList 在调 API 前再翻译成后端编码 ('0'/'1'/'2')。这层映射放
 * 在调用层而不是 watcher 里，避免「双向 watch + select 选项映射」的乱象。
 */
const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  status: '' as '' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
});

/** 状态码 → ElTag 类型 */
const STATUS_TAG_TYPE: Record<PublishStatusCode, 'info' | 'warning' | 'success'> = {
  [PUBLISH_STATUS_CODE.DRAFT]: 'warning',
  [PUBLISH_STATUS_CODE.PUBLISHED]: 'success',
  [PUBLISH_STATUS_CODE.ARCHIVED]: 'info',
};

async function fetchList() {
  loading.value = true;
  try {
    // axios 响应拦截器返回完整 response，需要 response.data 得到 R<T>，再 .data 得到 PageResult
    const axiosRes = await pageDefinitions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
    });
    const body = (axiosRes as any).data;
    const page = body?.data as PageResult<FlowDefinitionView> | undefined;
    list.value = page?.records ?? [];
    total.value = page?.total ?? 0;
  } catch (err) {
    console.error('[flow-list] fetch failed', err);
    ElMessage.error(t('flow.loadFailed'));
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);

function onSearch() {
  query.pageNum = 1;
  fetchList();
}

function onReset() {
  query.keyword = '';
  query.status = '';
  query.pageNum = 1;
  fetchList();
}

function onCreate() {
  router.push('/flow/designer/new');
}

function onEdit(row: FlowDefinitionView) {
  router.push(`/flow/designer/${row.chartId}`);
}

async function onPublish(row: FlowDefinitionView) {
  try {
    await ElMessageBox.confirm(t('flow.publishConfirm', { name: row.chartName }), t('flow.publishTitle'), { type: 'warning' });
    await publishDefinition(row.chartId);
    ElMessage.success(t('flow.publishSuccess'));
    fetchList();
  } catch {
    /* 用户取消 */
  }
}

async function onArchive(row: FlowDefinitionView) {
  try {
    await ElMessageBox.confirm(
      t('flow.archiveConfirm', { name: row.chartName }),
      t('flow.archiveTitle'),
      { type: 'warning' },
    );
    await archiveDefinition(row.chartId);
    ElMessage.success(t('flow.archiveSuccess'));
    fetchList();
  } catch {
    /* 用户取消 */
  }
}

async function onDelete(row: FlowDefinitionView) {
  if (row.publishStatus !== PUBLISH_STATUS_CODE.DRAFT) {
    ElMessage.warning(t('flow.deleteDraftOnly'));
    return;
  }
  try {
    await ElMessageBox.confirm(t('flow.deleteConfirm', { name: row.chartName }), t('flow.deleteTitle'), {
      type: 'error',
    });
    await deleteDefinition(row.chartId);
    ElMessage.success(t('flow.deleteSuccess'));
    fetchList();
  } catch {
    /* 用户取消 */
  }
}
</script>

<template>
  <div class="flow-list">
    <ElCard shadow="never" class="flow-list__card">
      <!-- 顶部检索栏 -->
      <!--
        改用 ElForm inline 而不是裸 div + flex：
          1. label/控件对齐用 ElForm 自带的 form-item 间距，不再依赖手写的 gap+固定宽度
          2. 各 form-item 自己负责 label 与控件之间的标准间距，不会出现下拉框被挤变形
          3. 右侧的「新建流程」按钮独立成一组，不参与 form 布局，避免被搜索表单的
             label 宽度计算拖累
      -->
      <div class="flow-list__filter">
        <ElForm :inline="true" :model="query" class="flow-list__form" @submit.prevent>
          <ElFormItem :label="t('flow.nameLabel')">
            <ElInput
              v-model="query.keyword"
              :placeholder="t('flow.namePlaceholder')"
              clearable
              :prefix-icon="Search"
              class="flow-list__input"
              @keyup.enter="onSearch"
            />
          </ElFormItem>
          <ElFormItem :label="t('flow.statusLabel')">
            <ElSelect
              v-model="query.status"
              :placeholder="t('flow.statusPlaceholder')"
              clearable
              class="flow-list__select"
            >
              <ElOption :label="t('flow.statusDraft')" :value="'DRAFT'" />
              <ElOption :label="t('flow.statusPublished')" :value="'PUBLISHED'" />
              <ElOption :label="t('flow.statusArchived')" :value="'ARCHIVED'" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" :icon="Search" @click="onSearch">{{ t('flow.search') }}</ElButton>
            <ElButton :icon="Refresh" @click="onReset">{{ t('flow.reset') }}</ElButton>
          </ElFormItem>
        </ElForm>
        <div class="flow-list__filter-spacer" />
        <ElButton type="primary" :icon="Plus" @click="onCreate">{{ t('flow.createNew') }}</ElButton>
      </div>

      <!-- 列表 -->
      <ElTable v-loading="loading" :data="list" stripe border style="margin-top: 16px">
        <ElTableColumn prop="chartName" :label="t('flow.colName')" min-width="200" show-overflow-tooltip />
        <ElTableColumn prop="chartKey" :label="t('flow.colKey')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <code>{{ row.chartKey }}</code>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="chartCategory" :label="t('flow.colCategory')" width="120" show-overflow-tooltip />
        <ElTableColumn prop="chartVersion" :label="t('flow.colVersion')" width="80" align="center">
          <template #default="{ row }">v{{ row.chartVersion }}</template>
        </ElTableColumn>
        <ElTableColumn prop="publishStatus" :label="t('flow.colStatus')" width="100" align="center">
          <template #default="{ row }">
            <ElTag :type="STATUS_TAG_TYPE[row.publishStatus as PublishStatusCode] ?? 'info'" size="small">
              {{ PUBLISH_STATUS_TEXT[row.publishStatus as PublishStatusCode] ?? row.publishStatus }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="updateTime" :label="t('flow.colUpdateTime')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updateTime) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="updateBy" :label="t('flow.colUpdateBy')" width="120" />
        <ElTableColumn :label="t('flow.colAction')" width="280" fixed="right">
          <template #default="{ row }">
            <ElSpace :size="6">
              <ElButton type="primary" size="small" link @click="onEdit(row)">{{ t('flow.edit') }}</ElButton>
              <ElButton
                v-if="row.publishStatus === PUBLISH_STATUS_CODE.DRAFT"
                type="success"
                size="small"
                link
                @click="onPublish(row)"
              >
                {{ t('flow.publish') }}
              </ElButton>
              <ElButton
                v-if="row.publishStatus === PUBLISH_STATUS_CODE.PUBLISHED"
                type="warning"
                size="small"
                link
                @click="onArchive(row)"
              >
                {{ t('flow.archive') }}
              </ElButton>
              <ElButton
                v-if="row.publishStatus === PUBLISH_STATUS_CODE.DRAFT"
                type="danger"
                size="small"
                link
                @click="onDelete(row)"
              >
                {{ t('flow.delete') }}
              </ElButton>
            </ElSpace>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- 分页 -->
      <div class="flow-list__pager">
        <ElPagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </ElCard>
  </div>
</template>

<style lang="scss" scoped>
.flow-list {
  padding: 16px;

  &__card {
    border-radius: 8px;
  }

  &__filter {
    display: flex;
    align-items: flex-start; // ElForm 高度比 ElButton 略高（label 占空间），用 flex-start 对齐第一行
    gap: 8px;
  }

  // 让 inline form 的 form-item 在自己内部 wrap 而不是溢出
  // 同时去掉 form-item 默认的 margin-bottom（inline 模式下显得多余）
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

  // 控件宽度：input 比 select 宽一些（因为要承载更长的标识符）
  &__input {
    width: 240px;
  }

  &__select {
    width: 160px;
  }

  &__filter-spacer {
    // form 已经 flex:1 占据中间空间，这里不再 flex:1
    width: 0;
  }

  &__pager {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
