
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Edit, Delete } from '@element-plus/icons-vue';
import { pageDataSets, pageKnowledge, saveKnowledge, deleteKnowledge } from '@/api/nl2sql';
import type { Nl2sqlDataset, Nl2sqlKnowledge, KnowledgeType } from '@/types/nl2sql';

const { t } = useI18n();

const TYPE_OPTIONS = computed(() => [
  { value: 'sql_example' as KnowledgeType, label: t('nl2sql.knowledge.typeSqlExample'), tagType: 'primary' as const },
  { value: 'term' as KnowledgeType, label: t('nl2sql.knowledge.typeTerm'), tagType: 'success' as const },
  { value: 'rule' as KnowledgeType, label: t('nl2sql.knowledge.typeRule'), tagType: 'warning' as const },
  { value: 'mapping' as KnowledgeType, label: t('nl2sql.knowledge.typeMapping'), tagType: 'info' as const },
]);

function tagOf(type: string) {
  return TYPE_OPTIONS.value.find((o) => o.value === type) ?? { label: type, tagType: 'info' as const };
}

/* ---------- 数据集选择（顶部筛选） ---------- */
const datasets = ref<Nl2sqlDataset[]>([]);
const selectedDatasetId = ref<number>();

async function fetchDatasets() {
  const res = await pageDataSets(1, 200);
  datasets.value = res?.records ?? [];
  if (!selectedDatasetId.value && datasets.value.length > 0) {
    selectedDatasetId.value = datasets.value[0].id;
  }
}

/* ---------- 知识列表 ---------- */
const loading = ref(false);
const list = ref<Nl2sqlKnowledge[]>([]);
const total = ref(0);
const query = reactive<{ current: number; size: number; type?: string; keyword?: string }>({
  current: 1,
  size: 10,
  type: undefined,
});

async function fetchList() {
  if (!selectedDatasetId.value) {
    list.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const res = await pageKnowledge(query.current, query.size, selectedDatasetId.value, query.type);
    list.value = res?.records ?? [];
    total.value = res?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

watch(() => selectedDatasetId.value, () => {
  query.current = 1;
  fetchList();
});

/* ---------- 新增 / 编辑弹窗 ---------- */
const dialogVisible = ref(false);
const saving = ref(false);
const form = reactive<Partial<Nl2sqlKnowledge>>(emptyForm());
function emptyForm(): Partial<Nl2sqlKnowledge> {
  return { id: undefined, datasetId: undefined, type: 'sql_example', title: '', content: '', status: 1 };
}

function openDialog(row?: Nl2sqlKnowledge) {
  Object.assign(form, emptyForm());
  if (row) {
    Object.assign(form, row);
  } else {
    form.datasetId = selectedDatasetId.value;
  }
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.datasetId) {
    ElMessage.warning(t('nl2sql.knowledge.datasetRequired'));
    return;
  }
  if (!form.content) {
    ElMessage.warning(t('nl2sql.knowledge.contentRequired'));
    return;
  }
  saving.value = true;
  try {
    await saveKnowledge(form);
    ElMessage.success(t('nl2sql.knowledge.saveSuccess'));
    dialogVisible.value = false;
    await fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: Nl2sqlKnowledge) {
  await ElMessageBox.confirm(t('nl2sql.knowledge.deleteConfirm', { name: row.title || row.content.slice(0, 20) }), t('common.tip'), { type: 'warning' });
  await deleteKnowledge(row.id);
  ElMessage.success(t('nl2sql.knowledge.deleteSuccess'));
  await fetchList();
}

onMounted(async () => {
  await fetchDatasets();
  await fetchList();
});
</script>

<template>
  <el-card shadow="never">
    <!-- 顶部工具栏 -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
      <div style="display: flex; gap: 12px">
        <el-select
          v-model="selectedDatasetId"
          :placeholder="t('nl2sql.knowledge.selectDataset')"
          style="width: 240px"
          filterable
        >
          <el-option v-for="ds in datasets" :key="ds.id" :label="ds.name" :value="ds.id" />
        </el-select>
        <el-select v-model="query.type" :placeholder="t('nl2sql.knowledge.allTypes')" clearable style="width: 160px" @change="fetchList">
          <el-option v-for="t_item in TYPE_OPTIONS" :key="t_item.value" :label="t_item.label" :value="t_item.value" />
        </el-select>
      </div>
      <el-button type="primary" :icon="Plus" :disabled="!selectedDatasetId" @click="openDialog()">
        {{ t('nl2sql.knowledge.addKnowledge') }}
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column :label="t('nl2sql.knowledge.colType')" width="120">
        <template #default="{ row }">
          <el-tag :type="tagOf(row.type).tagType" size="small">{{ tagOf(row.type).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" :label="t('nl2sql.knowledge.colTitle')" min-width="200" show-overflow-tooltip />
      <el-table-column prop="content" :label="t('nl2sql.knowledge.colContent')" min-width="400">
        <template #default="{ row }">
          <div style="white-space: pre-wrap; max-height: 80px; overflow: hidden; font-family: var(--el-font-family-mono, monospace); font-size: 12px;">
            {{ row.content }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="updateTime" :label="t('nl2sql.knowledge.colUpdateTime')" width="170" />
      <el-table-column :label="t('nl2sql.knowledge.colAction')" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Edit" @click="openDialog(row)">{{ t('nl2sql.knowledge.edit') }}</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">{{ t('nl2sql.knowledge.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.current"
      v-model:page-size="query.size"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 16px; justify-content: flex-end"
      @change="fetchList"
    />

    <!-- 弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? t('nl2sql.knowledge.editTitle') : t('nl2sql.knowledge.createTitle')" width="700px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px">
        <el-form-item :label="t('nl2sql.knowledge.datasetLabel')" required>
          <el-select v-model="form.datasetId" :disabled="!!form.id" filterable style="width: 100%">
            <el-option v-for="ds in datasets" :key="ds.id" :label="ds.name" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('nl2sql.knowledge.typeLabel')" required>
          <el-radio-group v-model="form.type">
            <el-radio-button v-for="t_item in TYPE_OPTIONS" :key="t_item.value" :value="t_item.value">
              {{ t_item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('nl2sql.knowledge.titleLabel')">
          <el-input v-model="form.title" :placeholder="t('nl2sql.knowledge.titlePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('nl2sql.knowledge.contentLabel')" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            :placeholder="form.type === 'sql_example' ? t('nl2sql.knowledge.contentSqlPlaceholder') : t('nl2sql.knowledge.contentOtherPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">{{ t('nl2sql.knowledge.save') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
