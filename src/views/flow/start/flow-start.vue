<!--
  发起流程页面 —— 展示已发布的流程定义列表，点击"发起"按钮后打开右侧抽屉填写表单。

  功能：
    - 顶部搜索栏：关键词搜索 + 查询/重置按钮
    - 中间流程卡片列表：网格布局，每行 3-4 个流程卡片
    - 底部分页
    - 右侧抽屉：表单填写 + 流程信息两个 Tab
-->
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElCard,
  ElButton,
  ElInput,
  ElForm,
  ElFormItem,
  ElRow,
  ElCol,
  ElPagination,
  ElDrawer,
  ElTabs,
  ElTabPane,
  ElMessage,
  ElTag,
  ElEmpty,
  ElDivider,
  ElDescriptions,
  ElDescriptionsItem,
} from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';
import { pageDefinitions, getDefinition, startProcess } from '@/api/flow';
import { getFormById } from '@/api/form';
import type { FlowDefinitionView, FlowChartDsl, FlowFormBinding } from '@/types/flow';
import type { PageResult } from '@/types/api';
import FormRenderer from '@/components/FormRenderer/FormRenderer.vue';
import FlowPreview from '@/components/FlowPreview/FlowPreview.vue';

const { t } = useI18n();

const loading = ref(false);
const list = ref<FlowDefinitionView[]>([]);
const total = ref(0);

/** 检索参数 */
const query = reactive({
  pageNum: 1,
  pageSize: 12,
  keyword: '',
});

/** 抽屉相关状态 */
const drawerVisible = ref(false);
const drawerLoading = ref(false);
const currentDefinition = ref<FlowDefinitionView | null>(null);
const chartDsl = ref<FlowChartDsl | null>(null);
const formSchema = ref<string>('');
const formData = ref<Record<string, unknown>>({});
const processTitle = ref('');

/** 获取已发布流程列表 */
async function fetchList() {
  loading.value = true;
  try {
    const axiosRes = await pageDefinitions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: '1' as any,  // 1 = 已发布（后端 publish_status 编码）
    });
    const body = (axiosRes as any).data;
    const page = body?.data as PageResult<FlowDefinitionView> | undefined;
    list.value = page?.records ?? [];
    total.value = page?.total ?? 0;
  } catch (err) {
    console.error('[flow-start] fetch failed', err);
    ElMessage.error(t('flow.start.loadListFailed'));
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
  query.pageNum = 1;
  fetchList();
}

/** 点击"发起"按钮 */
async function onStart(row: FlowDefinitionView) {
  drawerLoading.value = true;
  try {
    // 获取流程详情
    const axiosRes = await getDefinition(row.chartId);
    const body = (axiosRes as any).data;
    const definition = body?.data as FlowDefinitionView | undefined;

    if (!definition || !definition.chartDsl) {
      ElMessage.error(t('flow.start.getDetailFailed'));
      return;
    }

    currentDefinition.value = definition;

    // 解析 chartDsl
    try {
      chartDsl.value = JSON.parse(definition.chartDsl);
    } catch (e) {
      console.error('[flow-start] parse chartDsl failed', e);
      ElMessage.error(t('flow.start.parseConfigFailed'));
      return;
    }

    // 查找 DYNAMIC 类型的表单
    const dynamicForm = chartDsl.value?.forms?.find((f: FlowFormBinding) => f.type === 'DYNAMIC');

    if (dynamicForm && dynamicForm.formId) {
      // 获取表单 schema
      const formAxiosRes = await getFormById(dynamicForm.formId);
      const formBody = (formAxiosRes as any).data;
      const formView = formBody?.data;

      if (formView && formView.schema) {
        formSchema.value = formView.schema;
      } else {
        formSchema.value = '';
        ElMessage.warning(t('flow.start.formNotFound'));
      }
    } else {
      formSchema.value = '';
    }

    // 重置表单数据
    formData.value = {};
    processTitle.value = '';

    // 打开抽屉
    drawerVisible.value = true;
  } catch (err) {
    console.error('[flow-start] onStart failed', err);
    ElMessage.error(t('flow.start.getDetailFailed'));
  } finally {
    drawerLoading.value = false;
  }
}

/** 提交发起 */
async function onSubmit() {
  if (!currentDefinition.value || !chartDsl.value) {
    ElMessage.error(t('flow.start.missingProcessInfo'));
    return;
  }

  try {
    await startProcess({
      chartKey: chartDsl.value.chartKey,
      title: processTitle.value || undefined,
      formData: Object.keys(formData.value).length > 0 ? formData.value : undefined,
    });

    ElMessage.success(t('flow.start.startSuccess'));
    drawerVisible.value = false;
    fetchList();
  } catch (err) {
    console.error('[flow-start] submit failed', err);
    ElMessage.error(t('flow.start.startFailed'));
  }
}

function onCancel() {
  drawerVisible.value = false;
}
</script>

<template>
  <div class="flow-start">
    <ElCard shadow="never" class="flow-start__card">
      <!-- 顶部搜索栏 -->
      <div class="flow-start__filter">
        <ElForm :inline="true" :model="query" class="flow-start__form" @submit.prevent>
          <ElFormItem :label="t('flow.common.keywordPlaceholder')">
            <ElInput
              v-model="query.keyword"
              :placeholder="t('flow.start.keywordPlaceholder')"
              clearable
              :prefix-icon="Search"
              class="flow-start__input"
              @keyup.enter="onSearch"
            />
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" :icon="Search" @click="onSearch">{{ t('flow.common.search') }}</ElButton>
            <ElButton :icon="Refresh" @click="onReset">{{ t('flow.common.reset') }}</ElButton>
          </ElFormItem>
        </ElForm>
      </div>

      <!-- 流程卡片列表 -->
      <div v-loading="loading" class="flow-start__list">
        <ElRow :gutter="16" v-if="list.length > 0">
          <ElCol
            v-for="item in list"
            :key="item.chartId"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
            class="flow-start__col"
          >
            <ElCard shadow="hover" class="flow-start__card-item">
              <div class="flow-start__card-header">
                <h3 class="flow-start__card-title">{{ item.chartName }}</h3>
                <ElTag size="small" type="success">v{{ item.chartVersion }}</ElTag>
              </div>
              <div class="flow-start__card-category">
                <span class="flow-start__label">{{ t('flow.start.category') }}：</span>
                <span>{{ item.chartCategory || t('flow.start.uncategorized') }}</span>
              </div>
              <div class="flow-start__card-desc">
                {{ item.description || t('flow.start.noDescription') }}
              </div>
              <ElDivider />
              <div class="flow-start__card-footer">
                <ElButton type="primary" size="small" @click="onStart(item)">
                  {{ t('flow.start.startBtn') }}
                </ElButton>
              </div>
            </ElCard>
          </ElCol>
        </ElRow>

        <ElEmpty v-else :description="t('flow.start.noPublishedProcesses')" />
      </div>

      <!-- 分页 -->
      <div class="flow-start__pager">
        <ElPagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </ElCard>

    <!-- 右侧抽屉 -->
    <ElDrawer
      v-model="drawerVisible"
      :title="t('flow.start.startProcess')"
      size="640px"
      :close-on-click-modal="false"
    >
      <div v-loading="drawerLoading" class="flow-start__drawer-content">
        <template v-if="currentDefinition && chartDsl">
          <!-- 标题输入 -->
          <ElFormItem :label="t('flow.start.processTitle')" class="flow-start__title-input">
            <ElInput
              v-model="processTitle"
              :placeholder="t('flow.start.titlePlaceholder')"
              clearable
            />
          </ElFormItem>

          <!-- Tab 切换 -->
          <ElTabs>
            <!-- Tab 1: 表单填写 -->
            <ElTabPane :label="t('flow.start.formFill')">
              <div v-if="formSchema" class="flow-start__form-container">
                <FormRenderer
                  :schema="formSchema"
                  v-model="formData"
                />
              </div>
              <ElEmpty v-else :description="t('flow.start.noFormRequired')" />
            </ElTabPane>

            <!-- Tab 2: 流程信息 -->
            <ElTabPane :label="t('flow.common.processInfo')">
              <ElDescriptions :column="2" border>
                <ElDescriptionsItem :label="t('flow.common.processName')" :span="2">
                  {{ currentDefinition.chartName }}
                </ElDescriptionsItem>
                <ElDescriptionsItem :label="t('flow.start.processKey')">
                  <code>{{ chartDsl.chartKey }}</code>
                </ElDescriptionsItem>
                <ElDescriptionsItem :label="t('flow.start.version')">
                  v{{ currentDefinition.chartVersion }}
                </ElDescriptionsItem>
              </ElDescriptions>

              <ElDivider />

              <h4 class="flow-start__section-title">流程图</h4>
              <FlowPreview
                :chart-dsl="currentDefinition.chartDsl"
                height="400px"
              />
            </ElTabPane>
          </ElTabs>
        </template>
      </div>

      <!-- 抽屉底部按钮 -->
      <template #footer>
        <div class="flow-start__drawer-footer">
          <ElButton @click="onCancel">{{ t('flow.common.cancel') }}</ElButton>
          <ElButton type="primary" @click="onSubmit" :loading="drawerLoading">
            {{ t('flow.start.submit') }}
          </ElButton>
        </div>
      </template>
    </ElDrawer>
  </div>
</template>

<style lang="scss" scoped>
.flow-start {
  padding: 16px;

  &__card {
    border-radius: 8px;
  }

  &__filter {
    display: flex;
    align-items: center;
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
    width: 280px;
  }

  &__list {
    margin-top: 16px;
    min-height: 300px;
  }

  &__col {
    margin-bottom: 16px;
  }

  &__card-item {
    height: 100%;
    display: flex;
    flex-direction: column;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  &__card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  &__card-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__card-category {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }

  &__label {
    color: var(--el-text-color-regular);
  }

  &__card-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    min-height: 40px;
  }

  &__card-footer {
    display: flex;
    justify-content: flex-end;
  }

  &__pager {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  &__drawer-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  &__title-input {
    margin-bottom: 16px;
  }

  &__form-container {
    max-height: calc(100vh - 300px);
    overflow-y: auto;
  }

  &__section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 12px 0;
  }

  &__node-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__node-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  &__node-name {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  &__drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
