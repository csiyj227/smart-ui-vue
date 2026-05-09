
<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Edit, Delete, Refresh, Setting, MagicStick, Check, Reading } from '@element-plus/icons-vue';
import {
  pageDataSets,
  pageDataSources,
  createDataSet,
  updateDataSet,
  deleteDataSet,
  getDataSetDetail,
  syncDataSetTables,
  replaceDataSetTables,
  updateDataSetColumns,
  replaceDataSetRelations,
  listRemoteTables,
  evaluateDataSetColumns,
  learnDataset,
} from '@/api/nl2sql';
import type {
  Nl2sqlDataset,
  Nl2sqlDatasource,
  DataSetDetail,
  DataSetColumn,
  DataSetRelation,
  DataSetTable,
  TableMeta,
  LearnStatus,
  ColumnAiSuggestion,
} from '@/types/nl2sql';

const { t } = useI18n();

/* ---------- 列表数据 ---------- */
const loading = ref(false);
const list = ref<Nl2sqlDataset[]>([]);
const total = ref(0);
const query = reactive({ current: 1, size: 10, keyword: '' });

const datasources = ref<Nl2sqlDatasource[]>([]);
const dsMap = computed(() => {
  const m = new Map<number, string>();
  datasources.value.forEach((d) => m.set(d.id, d.name));
  return m;
});

async function fetchList() {
  loading.value = true;
  try {
    const res = await pageDataSets(query.current, query.size, query.keyword || undefined);
    list.value = res?.records ?? [];
    total.value = res?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

async function fetchDataSources() {
  const res = await pageDataSources(1, 200);
  datasources.value = res?.records ?? [];
}

/* ---------- 新建/编辑（基本信息） ---------- */
const baseDialogVisible = ref(false);
const baseSaving = ref(false);
const baseForm = reactive<Partial<Nl2sqlDataset>>({});

function openBaseDialog(row?: Nl2sqlDataset) {
  Object.assign(baseForm, { id: undefined, name: '', datasourceId: undefined, description: '', status: 1 });
  if (row) Object.assign(baseForm, row);
  baseDialogVisible.value = true;
}

async function saveBase() {
  if (!baseForm.name || !baseForm.datasourceId) {
    ElMessage.warning(t('nl2sql.dataset.nameDatasourceRequired'));
    return;
  }
  baseSaving.value = true;
  try {
    if (baseForm.id) {
      await updateDataSet(baseForm.id, baseForm);
      ElMessage.success(t('nl2sql.dataset.updateSuccess'));
    } else {
      const id = await createDataSet(baseForm);
      ElMessage.success(t('nl2sql.dataset.createSuccess'));
      // 创建完直接打开详情页配置表/字段
      await openDetail({ ...(baseForm as Nl2sqlDataset), id });
    }
    baseDialogVisible.value = false;
    await fetchList();
  } finally {
    baseSaving.value = false;
  }
}

async function handleDelete(row: Nl2sqlDataset) {
  await ElMessageBox.confirm(t('nl2sql.dataset.deleteConfirm', { name: row.name }), t('common.tip'), { type: 'warning' });
  await deleteDataSet(row.id);
  ElMessage.success(t('nl2sql.dataset.deleteSuccess'));
  await fetchList();
}

/* ---------- 详情抽屉（表 / 字段 / 关系） ---------- */
const detailDrawer = ref(false);
const detailLoading = ref(false);
const detail = ref<DataSetDetail | null>(null);
const activeTab = ref<'tables' | 'columns' | 'relations'>('tables');

async function openDetail(row: Nl2sqlDataset) {
  detailDrawer.value = true;
  detailLoading.value = true;
  try {
    detail.value = await getDataSetDetail(row.id);
    if (!detail.value) return;
    detail.value.tables = detail.value.tables ?? [];
    detail.value.relations = detail.value.relations ?? [];
    // 后端返回的 columns 嵌在 tables[].columns 里，这里扁平化派生 detail.columns，
    // 同时打开抽屉时立即初始化字段编辑缓冲区，避免用户首次切到字段 tab 时为空。
    detail.value.columns = flattenColumns(detail.value.tables);
    enterColumnEdit();
    enterRelationEdit();
  } finally {
    detailLoading.value = false;
  }
}

/** 把 detail.tables[].columns[] 扁平化为统一的 columns 列表（注入 tableName）。 */
function flattenColumns(tables: DataSetTable[] | undefined): DataSetColumn[] {
  if (!tables) return [];
  return tables.flatMap((t) =>
    ((t as DataSetTable & { columns?: DataSetColumn[] }).columns ?? []).map((c) => ({
      ...c,
      tableName: c.tableName ?? t.tableName,
    })),
  );
}

/* ---------- 表选择（从远端选 / 手动管理） ---------- */
const tableSelectVisible = ref(false);
const remoteTables = ref<TableMeta[]>([]);
/** 完整的已选表名集合，搜索筛选时不会丢失不可见行的选中状态 */
const remoteSelectedSet = ref<Set<string>>(new Set());
const remoteSelected = computed(() => Array.from(remoteSelectedSet.value));
const remoteLoading = ref(false);
const remoteTableSearch = ref('');
const remoteTableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>();
const filteredRemoteTables = computed(() => {
  const keyword = remoteTableSearch.value.trim().toLowerCase();
  if (!keyword) return remoteTables.value;
  return remoteTables.value.filter(
    (t) =>
      t.tableName.toLowerCase().includes(keyword) ||
      (t.tableComment ?? '').toLowerCase().includes(keyword),
  );
});

/**
 * 搜索筛选变化后，回显当前可见行中已选中的勾选状态。
 * 使用 watch + nextTick 确保 el-table 已渲染完新行再 toggleRowSelection。
 */
watch(filteredRemoteTables, () => {
  nextTick(() => {
    const tableEl = remoteTableRef.value;
    if (!tableEl) return;
    filteredRemoteTables.value.forEach((row) => {
      tableEl.toggleRowSelection(row, remoteSelectedSet.value.has(row.tableName));
    });
  });
});

/**
 * el-table 的 selection-change 回调。
 * 只更新当前可见行的选中/取消状态，不影响被筛选掉的行。
 */
function handleRemoteSelectionChange(rows: TableMeta[]) {
  const visibleNames = new Set(filteredRemoteTables.value.map((t) => t.tableName));
  const newSelectedNames = new Set(rows.map((r) => r.tableName));
  // 对于当前可见的行：按实际勾选状态增删
  for (const name of visibleNames) {
    if (newSelectedNames.has(name)) {
      remoteSelectedSet.value.add(name);
    } else {
      remoteSelectedSet.value.delete(name);
    }
  }
  // 不可见行保持不变（不在 visibleNames 中的不做任何处理）
}

async function openTableSelect() {
  if (!detail.value) return;
  tableSelectVisible.value = true;
  remoteTableSearch.value = '';
  remoteLoading.value = true;
  try {
    remoteTables.value = await listRemoteTables(detail.value.datasourceId);
    // 已选中的表回显
    const existing = new Set(detail.value.tables?.map((t) => t.tableName));
    remoteSelectedSet.value = new Set(
      remoteTables.value.filter((t) => existing.has(t.tableName)).map((t) => t.tableName),
    );
    // 等渲染后回显勾选状态
    nextTick(() => {
      const tableEl = remoteTableRef.value;
      if (!tableEl) return;
      remoteTables.value.forEach((row) => {
        if (existing.has(row.tableName)) {
          tableEl.toggleRowSelection(row, true);
        }
      });
    });
  } finally {
    remoteLoading.value = false;
  }
}

async function confirmTableSelect() {
  if (!detail.value) return;
  const selected: DataSetTable[] = remoteTables.value
    .filter((t) => remoteSelectedSet.value.has(t.tableName))
    .map((t) => ({
      tableName: t.tableName,
      tableComment: t.tableComment,
    }));
  await replaceDataSetTables(detail.value.id, selected);
  ElMessage.success(t('nl2sql.dataset.updateTableSelectSuccess'));
  tableSelectVisible.value = false;
  // 触发同步以拉取选中表的列结构
  await handleSync();
}

async function handleSync() {
  if (!detail.value) return;
  await syncDataSetTables(detail.value.id);
  ElMessage.success(t('nl2sql.dataset.syncSuccess'));
  const refreshed = await getDataSetDetail(detail.value.id);
  refreshed.tables = refreshed.tables ?? [];
  refreshed.relations = refreshed.relations ?? [];
  refreshed.columns = flattenColumns(refreshed.tables);
  detail.value = refreshed;
  enterColumnEdit();
}

async function handleRemoveTable(tableName: string) {
  if (!detail.value) return;
  await ElMessageBox.confirm(t('nl2sql.dataset.removeTableConfirm', { tableName }), t('common.tip'), { type: 'warning' });
  detail.value.tables = (detail.value.tables ?? []).filter((t) => t.tableName !== tableName);
  await replaceDataSetTables(detail.value.id, detail.value.tables);
  const refreshed = await getDataSetDetail(detail.value.id);
  refreshed.tables = refreshed.tables ?? [];
  refreshed.relations = refreshed.relations ?? [];
  refreshed.columns = flattenColumns(refreshed.tables);
  detail.value = refreshed;
  enterColumnEdit();
  ElMessage.success(t('nl2sql.dataset.removeTableSuccess'));
}

/* ---------- 字段批量编辑 ----------
 * 失焦清空问题的最终修复方案（彻底）：
 *
 * 之前以为是 computed 重算导致重渲。实际上更深层的原因是：
 * el-table 在传入新的 :data 数组（即使内容一样）时，会按 row-key 重新做 diff，
 * 但 row-key 内嵌的 input/checkbox 是用 v-model 直接绑到 row 对象上的。
 * 如果在 input 失焦的瞬间触发了「另一个修改 columnsBuf 的函数」（比如 tab 切换的
 * @click="enterColumnEdit"、或 saveColumns 的 detail 重新获取），
 * 整个 columnsBuf 会被 JSON.parse(JSON.stringify(...)) 重置为「来自后端的旧值」，
 * 而用户刚输入但还没保存的内容就丢了。
 *
 * 解决方案：
 *   1. 模板上 el-tab-pane 移除 @click="enterColumnEdit"（罪魁祸首）
 *   2. enterColumnEdit 仅在 openDetail / handleSync / saveColumns 后调用一次
 *   3. filteredColumns 改为 ref，仅在 watch 触发时重算
 *   4. el-table 加 row-key 让 DOM 稳定复用
 *   5. 用 columnsByKey Map 统一通过 v-model 写入，避免 row 对象引用问题
 */
const columnsBuf = ref<DataSetColumn[]>([]);
const columnGroupBy = ref<string>('');
const columnFilter = ref('');
const filteredColumns = ref<DataSetColumn[]>([]);

function recomputeFilteredColumns() {
  let arr = columnsBuf.value;
  if (columnGroupBy.value) arr = arr.filter((c) => c.tableName === columnGroupBy.value);
  if (columnFilter.value) {
    const k = columnFilter.value.toLowerCase();
    arr = arr.filter(
      (c) =>
        c.columnName.toLowerCase().includes(k) ||
        (c.userRemark ?? '').toLowerCase().includes(k) ||
        (c.columnComment ?? '').toLowerCase().includes(k),
    );
  }
  filteredColumns.value = arr;
}

// 仅监听筛选条件，不监听 columnsBuf 内部对象（深度变化交给 v-model 直接同步）
watch([columnGroupBy, columnFilter], recomputeFilteredColumns);

// 表筛选下拉的数据源 = 数据集已绑定的表列表（detail.tables），
// 以前误用了 detail.columns（后端不返此字段）导致下拉始终为空。
const tableNamesInDetail = computed(() => {
  return (detail.value?.tables ?? []).map((t) => t.tableName).filter(Boolean);
});

function enterColumnEdit() {
  columnsBuf.value = JSON.parse(JSON.stringify(detail.value?.columns ?? []));
  // 同时清掉旧的 AI 建议结果（columnsBuf 重置后 id 可能对不上）
  aiSuggestionMap.value = new Map();
  recomputeFilteredColumns();
}

/* ---------- 学习数据集 ---------- */
/**
 * 当前正在学习中的数据集 id 集合。
 * 用 Set 而不是单个 boolean，是为了支持「列表里多个数据集同时学习」（虽然后端目前是同步接口，
 * 但前端 await 阶段不应阻塞用户对其他行的操作）。
 */
const learningIds = ref<Set<number>>(new Set());

async function handleLearn(row: Nl2sqlDataset) {
  if (!row.id || learningIds.value.has(row.id)) return;
  // 二次确认：学习会调用 LLM 自动补全空备注并直接落库，告知用户避免误操作
  try {
    await ElMessageBox.confirm(
      t('nl2sql.dataset.learnConfirm'),
      t('nl2sql.dataset.learnTitle', { name: row.name }),
      { type: 'info', confirmButtonText: t('nl2sql.dataset.startLearn'), cancelButtonText: t('common.cancel') },
    );
  } catch {
    return; // 用户取消
  }

  // 触发响应式：Set 直接 add 不会触发，必须 new 一个
  learningIds.value = new Set(learningIds.value).add(row.id);
  // 乐观更新本地状态：立即把 tag 切换为「学习中」，无需等待后端
  row.learnStatus = 1;
  try {
    await learnDataset(row.id, true);
    ElMessage.success(t('nl2sql.dataset.learnSuccess', { name: row.name }));
    // 学习成功后服务端的 learn_status / learn_time 已变更，刷新列表拿最新值
    await fetchList();
  } catch (e) {
    console.error(e);
    // 失败时回滚本地状态到 3（失败），避免用户看到永远的「学习中」
    row.learnStatus = 3;
  } finally {
    const next = new Set(learningIds.value);
    next.delete(row.id);
    learningIds.value = next;
  }
}

/* ---------- AI 评估字段含义 ---------- */
/** AI 建议结果按 columnId 索引，便于在表格行内合并展示 */
const aiSuggestionMap = ref<Map<number, ColumnAiSuggestion>>(new Map());
const aiEvaluating = ref(false);

/** 是否处于"AI 建议已就绪、未采纳"状态——决定是否显示建议列和采纳按钮 */
const hasAiSuggestions = computed(() => aiSuggestionMap.value.size > 0);

/** 当前 row 的 AI 建议（模板里方便用） */
function getSuggestion(row: DataSetColumn): ColumnAiSuggestion | undefined {
  return row.id ? aiSuggestionMap.value.get(row.id) : undefined;
}

/** 一键 AI 评估：对所有「user_remark 为空」的字段调用后端 LLM */
async function runAiEvaluate() {
  if (!detail.value) return;
  aiEvaluating.value = true;
  try {
    // 后端默认行为就是 onlyEmptyRemark=true，不需要传 cmd
    const suggestions = await evaluateDataSetColumns(detail.value.id);
    const map = new Map<number, ColumnAiSuggestion>();
    suggestions.forEach((s) => {
      if (s.columnId) map.set(s.columnId, s);
    });
    aiSuggestionMap.value = map;
    if (suggestions.length === 0) {
      ElMessage.info(t('nl2sql.dataset.noEvaluableFields'));
    } else {
      ElMessage.success(t('nl2sql.dataset.aiEvaluateSuccess', { count: suggestions.length }));
    }
  } catch (e) {
    console.error(e);
  } finally {
    aiEvaluating.value = false;
  }
}

/** 单条采纳：把 AI 建议的 remark/dim/measure 应用到 columnsBuf 对应行上（仅前端，未保存） */
function adoptSuggestion(row: DataSetColumn) {
  const s = getSuggestion(row);
  if (!s) return;
  // 通过 id 在 columnsBuf 里定位实际对象（filteredColumns 里的 row 就是引用本体，但更安全的做法是按 id 找）
  const target = columnsBuf.value.find((c) => c.id === row.id);
  if (!target) return;
  if (s.suggestedRemark) target.userRemark = s.suggestedRemark;
  if (typeof s.suggestedIsDimension === 'boolean') target.isDimension = s.suggestedIsDimension;
  if (typeof s.suggestedIsMeasure === 'boolean') target.isMeasure = s.suggestedIsMeasure;
  // 采纳后从 map 里移除，UI 上"采纳"按钮会消失
  if (row.id) {
    aiSuggestionMap.value.delete(row.id);
    // 触发响应式（Map 修改不会自动触发）
    aiSuggestionMap.value = new Map(aiSuggestionMap.value);
  }
  ElMessage.success(`已采纳 ${row.columnName} 的建议（记得点保存）`);
}

/** 批量采纳：把当前可见（已过滤）的所有有建议的行一起应用 */
function adoptAllSuggestions() {
  let count = 0;
  for (const row of filteredColumns.value) {
    const s = getSuggestion(row);
    if (!s) continue;
    const target = columnsBuf.value.find((c) => c.id === row.id);
    if (!target) continue;
    if (s.suggestedRemark) target.userRemark = s.suggestedRemark;
    if (typeof s.suggestedIsDimension === 'boolean') target.isDimension = s.suggestedIsDimension;
    if (typeof s.suggestedIsMeasure === 'boolean') target.isMeasure = s.suggestedIsMeasure;
    if (row.id) aiSuggestionMap.value.delete(row.id);
    count++;
  }
  if (count > 0) {
    aiSuggestionMap.value = new Map(aiSuggestionMap.value);
    ElMessage.success(t('nl2sql.dataset.adoptAllSuccess', { count }));
  } else {
    ElMessage.info(t('nl2sql.dataset.noAdoptableSuggestions'));
  }
}

/** 丢弃所有 AI 建议（关闭建议显示） */
function discardAllSuggestions() {
  aiSuggestionMap.value = new Map();
}

async function saveColumns() {
  if (!detail.value) return;
  await updateDataSetColumns(detail.value.id, columnsBuf.value);
  ElMessage.success(t('nl2sql.dataset.saveColumnsSuccess'));
  const refreshed = await getDataSetDetail(detail.value.id);
  refreshed.tables = refreshed.tables ?? [];
  refreshed.relations = refreshed.relations ?? [];
  refreshed.columns = flattenColumns(refreshed.tables);
  detail.value = refreshed;
  enterColumnEdit();
}

/* ---------- 表关系编辑 ---------- */
const relationsBuf = ref<DataSetRelation[]>([]);
function enterRelationEdit() {
  relationsBuf.value = JSON.parse(JSON.stringify(detail.value?.relations ?? []));
}
function addRelation() {
  relationsBuf.value.push({
    sourceTable: '',
    sourceColumn: '',
    targetTable: '',
    targetColumn: '',
    relationType: 'LEFT JOIN',
  });
}
function removeRelation(idx: number) {
  relationsBuf.value.splice(idx, 1);
}
async function saveRelations() {
  if (!detail.value) return;
  await replaceDataSetRelations(detail.value.id, relationsBuf.value);
  ElMessage.success(t('nl2sql.dataset.saveRelationsSuccess'));
  const refreshed = await getDataSetDetail(detail.value.id);
  refreshed.tables = refreshed.tables ?? [];
  refreshed.relations = refreshed.relations ?? [];
  refreshed.columns = flattenColumns(refreshed.tables);
  detail.value = refreshed;
  enterRelationEdit();
}

/* ---------- 状态展示 ---------- */
function learnTag(status?: LearnStatus | number) {
  switch (status) {
    case 1: return { type: 'warning' as const, text: '学习中' };
    case 2: return { type: 'success' as const, text: '已学习' };
    case 3: return { type: 'danger' as const, text: '失败' };
    default: return { type: 'info' as const, text: '未学习' };
  }
}

onMounted(async () => {
  await Promise.all([fetchDataSources(), fetchList()]);
});
</script>

<template>
  <el-card shadow="never">
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
      <div style="display: flex; gap: 12px">
        <el-input
          v-model="query.keyword"
          :placeholder="t('nl2sql.dataset.searchPlaceholder')"
          :prefix-icon="Search"
          clearable
          style="width: 240px"
          @clear="fetchList"
          @keyup.enter="fetchList"
        />
        <el-button :icon="Refresh" @click="fetchList">{{ t('common.refresh') }}</el-button>
      </div>
      <el-button type="primary" :icon="Plus" @click="openBaseDialog()">{{ t('nl2sql.dataset.createNew') }}</el-button>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="name" :label="t('nl2sql.dataset.colName')" min-width="180" />
      <el-table-column :label="t('nl2sql.dataset.colDatasource')" min-width="160">
        <template #default="{ row }">
          {{ dsMap.get(row.datasourceId) ?? row.datasourceId }}
        </template>
      </el-table-column>
      <el-table-column prop="description" :label="t('nl2sql.dataset.colDescription')" min-width="220" show-overflow-tooltip />
      <el-table-column :label="t('nl2sql.dataset.colLearnStatus')" width="120">
        <template #default="{ row }">
          <el-tag :type="learnTag(row.learnStatus).type" size="small">
            {{ learnTag(row.learnStatus).text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updateTime" :label="t('nl2sql.dataset.colUpdateTime')" width="170" />
      <el-table-column :label="t('nl2sql.dataset.colAction')" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Setting" @click="openDetail(row)">{{ t('nl2sql.dataset.configure') }}</el-button>
          <el-button
            link
            type="success"
            :icon="Reading"
            :loading="learningIds.has(row.id)"
            :disabled="row.learnStatus === 1"
            @click="handleLearn(row)"
          >
            {{ row.learnStatus === 2 ? t('nl2sql.dataset.relearn') : t('nl2sql.dataset.learn') }}
          </el-button>
          <el-button link type="primary" :icon="Edit" @click="openBaseDialog(row)">{{ t('nl2sql.dataset.edit') }}</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">{{ t('nl2sql.dataset.delete') }}</el-button>
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

    <!-- 基本信息弹窗 -->
    <el-dialog v-model="baseDialogVisible" :title="baseForm.id ? t('nl2sql.dataset.editTitle') : t('nl2sql.dataset.createTitle')" width="520px" :close-on-click-modal="false">
      <el-form :model="baseForm" label-width="100px">
        <el-form-item :label="t('nl2sql.dataset.formName')" required>
          <el-input v-model="baseForm.name" />
        </el-form-item>
        <el-form-item :label="t('nl2sql.dataset.formDatasource')" required>
          <el-select v-model="baseForm.datasourceId" :placeholder="t('nl2sql.dataset.selectDatasource')" filterable style="width: 100%" :disabled="!!baseForm.id">
            <el-option v-for="d in datasources" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('nl2sql.dataset.formDescription')">
          <el-input v-model="baseForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="baseDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="baseSaving" @click="saveBase">{{ t('nl2sql.dataset.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailDrawer" size="80%" :title="detail ? `${t('nl2sql.dataset.configureDataset')}：${detail.name}` : ''" :close-on-click-modal="false">
      <div v-loading="detailLoading">
        <el-tabs v-model="activeTab">
          <!-- 表选择 -->
          <el-tab-pane :label="t('nl2sql.dataset.tabTables')" name="tables">
            <div style="display: flex; gap: 12px; margin-bottom: 12px">
              <el-button type="primary" :icon="Plus" @click="openTableSelect">{{ t('nl2sql.dataset.addTable') }}</el-button>
              <el-button :icon="Refresh" @click="handleSync">{{ t('nl2sql.dataset.syncStructure') }}</el-button>
              <el-text type="info" size="small" style="align-self: center">
                {{ t('nl2sql.dataset.syncHint') }}
              </el-text>
            </div>
            <el-table :data="detail?.tables ?? []" stripe>
              <el-table-column prop="tableName" :label="t('nl2sql.dataset.tableName')" min-width="200" />
              <el-table-column prop="tableComment" :label="t('nl2sql.dataset.tableComment')" min-width="240" show-overflow-tooltip />
              <el-table-column prop="tableAlias" :label="t('nl2sql.dataset.tableAlias')" min-width="160" />
              <el-table-column :label="t('nl2sql.dataset.tableAction')" width="120">
                <template #default="{ row }">
                  <el-button link type="danger" :icon="Delete" @click="handleRemoveTable(row.tableName)">{{ t('nl2sql.dataset.remove') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!--
            字段元数据 tab：
            ⚠️ 严禁加 @click="enterColumnEdit"！这是上次失焦清空的根因 ——
              用户在表格内编辑字段时，input 失焦的瞬间如果鼠标点到了 tab 标签的边缘，
              会重置整个 columnsBuf，把刚输入的内容覆盖回旧值。
              enterColumnEdit 仅在 openDetail / handleSync / saveColumns 内显式调用即可。
          -->
          <el-tab-pane :label="t('nl2sql.dataset.tabFields')" name="columns">
            <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; align-items: center">
              <el-select v-model="columnGroupBy" :placeholder="t('nl2sql.dataset.filterByTable')" clearable style="width: 220px">
                <el-option v-for="t in tableNamesInDetail" :key="t" :label="t" :value="t" />
              </el-select>
              <el-input v-model="columnFilter" :placeholder="t('nl2sql.dataset.searchFieldPlaceholder')" clearable style="width: 280px" />
              <el-button type="primary" @click="saveColumns">{{ t('nl2sql.dataset.saveColumns') }}</el-button>
              <el-button
                type="warning"
                :icon="MagicStick"
                :loading="aiEvaluating"
                @click="runAiEvaluate"
              >
                {{ t('nl2sql.dataset.aiEvaluate') }}
              </el-button>
              <el-button
                v-if="hasAiSuggestions"
                type="success"
                :icon="Check"
                @click="adoptAllSuggestions"
              >
                {{ t('nl2sql.dataset.adoptAll') }}
              </el-button>
              <el-button v-if="hasAiSuggestions" link @click="discardAllSuggestions">
                {{ t('nl2sql.dataset.discardSuggestions') }}
              </el-button>
              <el-text type="info" size="small" style="align-self: center">
                {{ t('nl2sql.dataset.fieldRemarkHint') }}
              </el-text>
            </div>
            <el-alert
              v-if="hasAiSuggestions"
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 12px"
            >
              {{ t('nl2sql.dataset.aiSuggestionAlert', { count: aiSuggestionMap.size }) }}
            </el-alert>
            <!--
              row-key 必须设置：el-table 才能稳定地复用行 DOM。
              没有 row-key 时，数据数组任何变化都会让 el-table 按索引比较重建所有行 → input 失焦。
              这里用 "tableName::columnName" 作为天然唯一键（id 在新增字段场景下可能为空）。
            -->
            <el-table
              :data="filteredColumns"
              stripe
              max-height="600"
              :row-key="(row: DataSetColumn) => `${row.tableName}::${row.columnName}`"
            >
              <el-table-column prop="tableName" :label="t('nl2sql.dataset.colTable')" width="140" />
              <el-table-column prop="columnName" :label="t('nl2sql.dataset.fieldName')" width="150" />
              <el-table-column prop="columnType" :label="t('nl2sql.dataset.fieldType')" width="100" />
              <el-table-column prop="columnComment" :label="t('nl2sql.dataset.fieldComment')" min-width="140" show-overflow-tooltip />
              <el-table-column :label="t('nl2sql.dataset.fieldDescription')" min-width="220">
                <template #default="{ row }">
                  <el-input v-model="row.userRemark" :placeholder="t('nl2sql.dataset.fieldRemarkPlaceholder')" />
                </template>
              </el-table-column>
              <!-- AI 建议列：仅当有建议结果时显示 -->
              <el-table-column
                v-if="hasAiSuggestions"
                :label="t('nl2sql.dataset.aiSuggestionCol')"
                min-width="260"
              >
                <template #default="{ row }">
                  <div v-if="getSuggestion(row)" class="ai-suggest-cell">
                    <div class="ai-suggest-text" :title="getSuggestion(row)?.suggestedRemark">
                      {{ getSuggestion(row)?.suggestedRemark || t('nl2sql.dataset.noSuggestionText') }}
                    </div>
                    <div class="ai-suggest-tags">
                      <el-tag
                        v-if="getSuggestion(row)?.suggestedIsDimension"
                        size="small"
                        type="info"
                      >
                        {{ t('nl2sql.dataset.dimension') }}
                      </el-tag>
                      <el-tag
                        v-if="getSuggestion(row)?.suggestedIsMeasure"
                        size="small"
                        type="success"
                      >
                        {{ t('nl2sql.dataset.measure') }}
                      </el-tag>
                      <el-button
                        link
                        type="primary"
                        size="small"
                        :icon="Check"
                        @click="adoptSuggestion(row)"
                      >
                        {{ t('nl2sql.dataset.adopt') }}
                      </el-button>
                    </div>
                  </div>
                  <span v-else style="color: var(--el-text-color-disabled)">—</span>
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.isDimension')" width="60" align="center">
                <template #default="{ row }">
                  <el-checkbox v-model="row.isDimension" />
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.isMeasure')" width="60" align="center">
                <template #default="{ row }">
                  <el-checkbox v-model="row.isMeasure" />
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.isPrimaryKey')" width="60" align="center">
                <template #default="{ row }">
                  <el-icon v-if="row.isPrimaryKey" color="var(--el-color-warning)"><Setting /></el-icon>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!--
            表关系 tab：同样移除 @click="enterRelationEdit"，避免误触清空 relationsBuf。
            enterRelationEdit 在 openDetail / saveRelations 后已主动调用。
          -->
          <el-tab-pane :label="t('nl2sql.dataset.tabRelations')" name="relations">
            <div style="display: flex; gap: 12px; margin-bottom: 12px">
              <el-button type="primary" :icon="Plus" @click="addRelation">{{ t('nl2sql.dataset.addRelation') }}</el-button>
              <el-button @click="saveRelations">{{ t('nl2sql.dataset.saveRelations') }}</el-button>
            </div>
            <el-table :data="relationsBuf" stripe>
              <el-table-column :label="t('nl2sql.dataset.sourceTable')" min-width="160">
                <template #default="{ row }">
                  <el-select v-model="row.sourceTable" :placeholder="t('nl2sql.dataset.selectTable')" filterable size="small">
                    <el-option v-for="t in tableNamesInDetail" :key="t" :label="t" :value="t" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.sourceField')" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.sourceColumn" :placeholder="t('nl2sql.dataset.fieldName')" size="small" />
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.relationType')" width="140">
                <template #default="{ row }">
                  <el-select v-model="row.relationType" size="small">
                    <el-option label="LEFT JOIN" value="LEFT JOIN" />
                    <el-option label="INNER JOIN" value="INNER JOIN" />
                    <el-option label="RIGHT JOIN" value="RIGHT JOIN" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.targetTable')" min-width="160">
                <template #default="{ row }">
                  <el-select v-model="row.targetTable" :placeholder="t('nl2sql.dataset.selectTable')" filterable size="small">
                    <el-option v-for="t in tableNamesInDetail" :key="t" :label="t" :value="t" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.targetField')" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.targetColumn" :placeholder="t('nl2sql.dataset.fieldName')" size="small" />
                </template>
              </el-table-column>
              <el-table-column :label="t('nl2sql.dataset.colAction')" width="80">
                <template #default="{ $index }">
                  <el-button link type="danger" :icon="Delete" @click="removeRelation($index)" />
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 表选择弹窗（嵌套在抽屉内） -->

      <el-dialog v-model="tableSelectVisible" :title="t('nl2sql.dataset.selectTables')" width="720px" append-to-body>
        <el-input
          v-model="remoteTableSearch"
          :placeholder="t('nl2sql.dataset.searchTablePlaceholder')"
          :prefix-icon="Search"
          clearable
          style="margin-bottom: 12px"
        />
        <el-table
          ref="remoteTableRef"
          v-loading="remoteLoading"
          :data="filteredRemoteTables"
          max-height="500"
          @selection-change="handleRemoteSelectionChange"
        >
          <el-table-column type="selection" width="55" :selectable="() => true" />
          <el-table-column prop="tableName" :label="t('nl2sql.dataset.tableName')" min-width="200" />
          <el-table-column prop="tableComment" :label="t('nl2sql.dataset.tableComment')" min-width="200" show-overflow-tooltip />
          <el-table-column prop="tableType" :label="t('nl2sql.dataset.tableType')" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.tableType === 'VIEW' ? 'warning' : 'primary'" size="small">
                {{ row.tableType === 'VIEW' ? t('nl2sql.dataset.view') : t('nl2sql.dataset.table') }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top: 8px; color: var(--el-text-color-secondary); font-size: 12px">
          {{ t('nl2sql.dataset.selectedCount', { selected: remoteSelected.length, total: remoteTables.length }) }}
        </div>
        <template #footer>
          <el-button @click="tableSelectVisible = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="confirmTableSelect">{{ t('nl2sql.dataset.confirmSelection') }}</el-button>
        </template>
      </el-dialog>
    </el-drawer>
  </el-card>
</template>
