<!--
  表单管理列表页 — 表单设计器入口。

  与流程定义列表（flow-list.vue）保持一致的表格风格：
    - 新建：跳到 /form/designer/new
    - 编辑：跳到 /form/designer/:formId
    - 发布：直接调 API
    - 删除：仅草稿状态允许
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
  getFormPage,
  publishForm,
  deleteForm,
} from '@/api/form';
import {
  FORM_STATUS_CODE,
  FORM_STATUS_TEXT,
  FORM_STATUS_TAG_TYPE,
  type SysFormView,
  type FormStatusCode,
} from '@/types/form';

import type { PageResult } from '@/types/api';
const router = useRouter();
const { t } = useI18n();

/**
 * 格式化日期时间。兼容两种后端返回格式：
 *   1. ISO 字符串："2026-05-03T18:49:46"
 *   2. Jackson 数组：[2026, 5, 3, 18, 49, 46, 906399000]
 */
function formatDateTime(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.replace('T', ' ').substring(0, 19);
  }
  if (Array.isArray(value) && value.length >= 6) {
    const [year, month, day, hour, minute, second] = value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
  }
  return String(value);
}

const loading = ref(false);
const list = ref<SysFormView[]>([]);
const total = ref(0);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  status: '' as '' | '0' | '1',
});

async function fetchList() {
  loading.value = true;
  try {
    const axiosRes = await getFormPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
    });
    const body = (axiosRes as any).data;
    const page = body?.data as PageResult<SysFormView> | undefined;
    list.value = page?.records ?? [];
    total.value = page?.total ?? 0;
  } catch (err) {
    console.error('[form-list] fetch failed', err);
    ElMessage.error(t('formList.loadFailed'));
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
  router.push('/form/designer/new');
}

function onEdit(row: SysFormView) {
  router.push(`/form/designer/${row.formId}`);
}

async function onPublish(row: SysFormView) {
  try {
    await ElMessageBox.confirm(
      t('formList.publishConfirm', { formName: row.formName }),
      t('formList.publishTitle'),
      { type: 'warning' },
    );
    await publishForm(row.formId);
    ElMessage.success(t('formList.publishSuccess'));
    fetchList();
  } catch {
    /* 用户取消 */
  }
}

async function onDelete(row: SysFormView) {
  if (row.status !== FORM_STATUS_CODE.DRAFT) {
    ElMessage.warning(t('formList.draftOnly'));
    return;
  }
  try {
    await ElMessageBox.confirm(
      t('formList.deleteConfirm', { formName: row.formName }),
      t('formList.deleteTitle'),
      { type: 'error' },
    );
    await deleteForm(row.formId);
    ElMessage.success(t('formList.deleteSuccess'));
    fetchList();
  } catch {
    /* 用户取消 */
  }
}
</script>

<template>
  <div class="form-list">
    <ElCard shadow="never" class="form-list__card">
      <!-- 顶部检索栏 -->
      <div class="form-list__filter">
        <ElForm :inline="true" :model="query" class="form-list__form" @submit.prevent>
          <ElFormItem :label="t('formList.nameLabel')">
            <ElInput
              v-model="query.keyword"
              :placeholder="t('formList.namePlaceholder')"
              clearable
              :prefix-icon="Search"
              class="form-list__input"
              @keyup.enter="onSearch"
            />
          </ElFormItem>
          <ElFormItem :label="t('formList.statusLabel')">
            <ElSelect
              v-model="query.status"
              :placeholder="t('formList.statusPlaceholder')"
              clearable
              class="form-list__select"
            >
              <ElOption :label="t('formList.statusDraft')" :value="FORM_STATUS_CODE.DRAFT" />
              <ElOption :label="t('formList.statusPublished')" :value="FORM_STATUS_CODE.PUBLISHED" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" :icon="Search" @click="onSearch">{{ t('formList.search') }}</ElButton>
            <ElButton :icon="Refresh" @click="onReset">{{ t('formList.reset') }}</ElButton>
          </ElFormItem>
        </ElForm>
        <div class="form-list__filter-spacer" />
        <ElButton type="primary" :icon="Plus" @click="onCreate">{{ t('formList.createNew') }}</ElButton>
      </div>

      <!-- 列表 -->
      <ElTable v-loading="loading" :data="list" stripe border style="margin-top: 16px">
        <ElTableColumn prop="formName" :label="t('formList.colFormName')" min-width="200" show-overflow-tooltip />
        <ElTableColumn prop="formKey" :label="t('formList.colFormKey')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <code>{{ row.formKey }}</code>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" :label="t('formList.colCategory')" width="120" show-overflow-tooltip />
        <ElTableColumn prop="version" :label="t('formList.colVersion')" width="80" align="center">
          <template #default="{ row }">v{{ row.version }}</template>
        </ElTableColumn>
        <ElTableColumn prop="status" :label="t('formList.statusLabel')" width="100" align="center">
          <template #default="{ row }">
            <ElTag
              :type="FORM_STATUS_TAG_TYPE[row.status as FormStatusCode] ?? 'info'"
              size="small"
            >
              {{ FORM_STATUS_TEXT[row.status as FormStatusCode] ?? row.status }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="updateTime" :label="t('formList.colUpdateTime')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updateTime) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="updateBy" :label="t('formList.colUpdateBy')" width="120" />
        <ElTableColumn :label="t('formList.colAction')" width="240" fixed="right">
          <template #default="{ row }">
            <ElSpace :size="6">
              <ElButton type="primary" size="small" link @click="onEdit(row)">{{ t('formList.edit') }}</ElButton>
              <ElButton
                v-if="row.status === FORM_STATUS_CODE.DRAFT"
                type="success"
                size="small"
                link
                @click="onPublish(row)"
              >
                {{ t('formList.publish') }}
              </ElButton>
              <ElButton
                v-if="row.status === FORM_STATUS_CODE.DRAFT"
                type="danger"
                size="small"
                link
                @click="onDelete(row)"
              >
                {{ t('formList.delete') }}
              </ElButton>
            </ElSpace>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- 分页 -->
      <div class="form-list__pager">
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
.form-list {
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

  &__select {
    width: 160px;
  }

  &__filter-spacer {
    width: 0;
  }

  &__pager {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
