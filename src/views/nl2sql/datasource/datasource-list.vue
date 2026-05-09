
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Edit, Delete, Connection, Refresh } from '@element-plus/icons-vue';
import {
  pageDataSources,
  saveDataSource,
  deleteDataSource,
  testDataSource,
  testDataSourceById,
} from '@/api/nl2sql';
import type { Nl2sqlDatasource, DataSourceType } from '@/types/nl2sql';

const { t } = useI18n();

/* ---------- 列表数据 ---------- */
const loading = ref(false);
const list = ref<Nl2sqlDatasource[]>([]);
const total = ref(0);
const query = reactive({ current: 1, size: 10, keyword: '' });

/* ---------- 数据源类型 → 默认端口（新建表单的便利项） ---------- */
const TYPE_OPTIONS: { label: string; value: DataSourceType; defaultPort: number }[] = [
  { label: 'MySQL', value: 'mysql', defaultPort: 3306 },
  { label: 'PostgreSQL', value: 'postgresql', defaultPort: 5432 },
  { label: 'Oracle', value: 'oracle', defaultPort: 1521 },
  { label: 'GaussDB', value: 'gaussdb', defaultPort: 5432 },
];

async function fetchList() {
  loading.value = true;
  try {
    const result = await pageDataSources(query.current, query.size, query.keyword || undefined);
    list.value = result?.records ?? [];
    total.value = result?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/* ---------- 新建/编辑弹窗 ---------- */
const dialogVisible = ref(false);
const saving = ref(false);
const testingInDialog = ref(false);

// 编辑时密码字段是空字符串（后端不回传明文密码），保留空意味着「不更新密码」
// 因为后端 update 时如果 password 为空会跳过该字段。
const form = reactive<Partial<Nl2sqlDatasource>>(emptyForm());
function emptyForm(): Partial<Nl2sqlDatasource> {
  return {
    id: undefined,
    name: '',
    type: 'mysql',
    host: '',
    port: 3306,
    databaseName: '',
    schemaName: '',
    username: '',
    password: '',
    description: '',
    status: 1,
  };
}

function openDialog(row?: Nl2sqlDatasource) {
  Object.assign(form, emptyForm());
  if (row) {
    Object.assign(form, row);
    form.password = ''; // 编辑场景下不回填明文密码
  }
  dialogVisible.value = true;
}

function onTypeChange(value: DataSourceType) {
  // 新建时切换类型 → 自动带出默认端口；编辑时也要避免遗留旧端口造成误解
  const opt = TYPE_OPTIONS.find((o) => o.value === value);
  if (opt && !form.id) {
    form.port = opt.defaultPort;
  }
}

async function handleSave() {
  if (!form.name || !form.host || !form.username) {
    ElMessage.warning(t('nl2sql.datasource.nameHostUserRequired'));
    return;
  }
  if (!form.id && !form.password) {
    ElMessage.warning(t('nl2sql.datasource.passwordRequiredForNew'));
    return;
  }
  saving.value = true;
  try {
    await saveDataSource(form);
    ElMessage.success(t('nl2sql.datasource.saveSuccess'));
    dialogVisible.value = false;
    await fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: Nl2sqlDatasource) {
  await ElMessageBox.confirm(t('nl2sql.datasource.deleteConfirm', { name: row.name }), t('common.tip'), { type: 'warning' });
  await deleteDataSource(row.id);
  ElMessage.success(t('nl2sql.datasource.deleteSuccess'));
  await fetchList();
}

/* ---------- 连接测试（弹窗内 + 列表行内） ---------- */
async function handleTestInDialog() {
  if (!form.host || !form.username || !form.password) {
    ElMessage.warning(t('nl2sql.datasource.testFillFirst'));
    return;
  }
  testingInDialog.value = true;
  try {
    const ok = await testDataSource({
      type: form.type as string,
      host: form.host as string,
      port: form.port as number,
      databaseName: form.databaseName,
      schemaName: form.schemaName,
      username: form.username as string,
      password: form.password as string,
    });
    if (ok) ElMessage.success(t('nl2sql.datasource.testSuccess'));
    else ElMessage.error(t('nl2sql.datasource.testFailed'));
  } finally {
    testingInDialog.value = false;
  }
}

const testingRowId = ref<number | null>(null);
async function handleTestRow(row: Nl2sqlDatasource) {
  testingRowId.value = row.id;
  try {
    const ok = await testDataSourceById(row.id);
    if (ok) {
      ElMessage.success(t('nl2sql.datasource.testRowSuccess', { name: row.name }));
    } else {
      ElMessage.error(t('nl2sql.datasource.testRowFailed', { name: row.name }));
    }
    await fetchList(); // 刷新 last_test_time / status
  } finally {
    testingRowId.value = null;
  }
}

function statusTag(status?: number) {
  if (status === 1) return { type: 'success' as const, text: t('nl2sql.datasource.statusSuccess') };
  if (status === 0) return { type: 'danger' as const, text: t('nl2sql.datasource.statusFailed') };
  return { type: 'info' as const, text: t('nl2sql.datasource.statusUntested') };
}

/**
 * 把后端返回的时间字段格式化成 yyyy-MM-dd HH:mm:ss。
 *
 * 后端 LocalDateTime 经 Jackson 默认序列化可能出现两种格式：
 *   1) 字符串 "2026-05-07T14:42:23.597"（启用了 JavaTimeModule + WRITE_DATES_AS_TIMESTAMPS=false）
 *   2) 数字数组 [2026,5,7,14,42,23,597000000]（默认行为）
 * 两种都用 new Date(...) 兜底，前者直接传字符串，后者解构成参数。
 * 这样不依赖具体的 Jackson 配置，也不需要后端再加 @JsonFormat。
 */
function formatDateTime(input?: string | number[] | null): string {
  if (input == null || input === '') return '';
  let date: Date;
  if (Array.isArray(input)) {
    // [year, month(1-based), day, hour, minute, second, nano] —— JS month 是 0-based
    const [y, mo, d, h = 0, mi = 0, s = 0] = input;
    date = new Date(y, (mo ?? 1) - 1, d ?? 1, h, mi, s);
  } else {
    date = new Date(input);
  }
  if (Number.isNaN(date.getTime())) return String(input);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 相对时间显示：「刚刚 / N 分钟前 / N 小时前 / N 天前 / yyyy-MM-dd」。
 * 设计取舍：
 *   - 7 天内用相对时间，符合"最近连通"语义，瞄一眼就知道新鲜度
 *   - 超过 7 天用绝对日期（不带时分），相对时间「30 天前」反而看不懂
 *   - 完整时间放 tooltip，需要精确时间时 hover 即可
 */
function formatRelativeTime(input?: string | number[] | null): string {
  if (input == null || input === '') return '';
  let date: Date;
  if (Array.isArray(input)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = input;
    date = new Date(y, (mo ?? 1) - 1, d ?? 1, h, mi, s);
  } else {
    date = new Date(input);
  }
  if (Number.isNaN(date.getTime())) return String(input);

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t('nl2sql.datasource.timeJustNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('nl2sql.datasource.timeMinutesAgo', { n: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('nl2sql.datasource.timeHoursAgo', { n: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return t('nl2sql.datasource.timeDaysAgo', { n: diffDay });
  // 超过一周直接显示日期，避免出现"30 天前"这种没有意义的描述
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

onMounted(fetchList);
</script>

<template>
  <el-card shadow="never">
    <!-- 顶部工具栏 -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
      <div style="display: flex; gap: 12px">
        <el-input
          v-model="query.keyword"
          :placeholder="t('nl2sql.datasource.searchPlaceholder')"
          :prefix-icon="Search"
          clearable
          style="width: 260px"
          @clear="fetchList"
          @keyup.enter="fetchList"
        />
        <el-button :icon="Refresh" @click="fetchList">{{ t('nl2sql.datasource.refresh') }}</el-button>
      </div>
      <el-button type="primary" :icon="Plus" @click="openDialog()">{{ t('nl2sql.datasource.createNew') }}</el-button>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="name" :label="t('nl2sql.datasource.colName')" min-width="160" />
      <el-table-column prop="type" :label="t('nl2sql.datasource.colType')" width="120">
        <template #default="{ row }">
          <el-tag>{{ row.type?.toUpperCase() }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('nl2sql.datasource.colConnection')" min-width="220">
        <template #default="{ row }">
          <span style="font-family: var(--el-font-family-mono, monospace)">
            {{ row.host }}:{{ row.port }}{{ row.databaseName ? '/' + row.databaseName : '' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="username" :label="t('nl2sql.datasource.colUsername')" width="140" />
      <!--
        最近连通：单行紧凑布局
        - 状态用 Tag（成功/失败/未测试）
        - 时间用「相对时间」（如 "5 分钟前"），hover 显示完整 yyyy-MM-dd HH:mm:ss
        - 未测试或没时间时不显示「—」占位，避免视觉噪声
      -->
      <el-table-column :label="t('nl2sql.datasource.colLastConnected')" width="180">
        <template #default="{ row }">
          <div style="display: inline-flex; align-items: center; gap: 6px">
            <el-tag :type="statusTag(row.lastTestStatus).type" size="small">
              {{ statusTag(row.lastTestStatus).text }}
            </el-tag>
            <el-tooltip
              v-if="row.lastTestTime"
              :content="formatDateTime(row.lastTestTime)"
              placement="top"
            >
              <span style="font-size: 12px; color: var(--el-text-color-secondary)">
                {{ formatRelativeTime(row.lastTestTime) }}
              </span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="description" :label="t('nl2sql.datasource.colDescription')" min-width="180" show-overflow-tooltip />
      <el-table-column :label="t('nl2sql.datasource.colAction')" width="240" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :icon="Connection"
            :loading="testingRowId === row.id"
            @click="handleTestRow(row)"
          >
            {{ t('nl2sql.datasource.test') }}
          </el-button>
          <el-button link type="primary" :icon="Edit" @click="openDialog(row)">{{ t('nl2sql.datasource.edit') }}</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">{{ t('nl2sql.datasource.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.current"
      v-model:page-size="query.size"
      :total="total"
      layout="total, prev, pager, next, sizes"
      style="margin-top: 16px; justify-content: flex-end"
      @change="fetchList"
    />

    <!-- 新建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? t('nl2sql.datasource.editTitle') : t('nl2sql.datasource.createTitle')"
      width="640px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item :label="t('nl2sql.datasource.colName')" required>
          <el-input v-model="form.name" :placeholder="t('nl2sql.datasource.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('nl2sql.datasource.colType')" required>
          <el-select v-model="form.type" style="width: 100%" @change="onTypeChange">
            <el-option v-for="t in TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item :label="t('nl2sql.datasource.hostLabel')" required>
              <el-input v-model="form.host" :placeholder="t('nl2sql.datasource.hostPlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('nl2sql.datasource.portLabel')" required>
              <el-input-number v-model="form.port" :min="1" :max="65535" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('nl2sql.datasource.databaseLabel')">
              <el-input v-model="form.databaseName" :placeholder="t('nl2sql.datasource.databasePlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('nl2sql.datasource.schemaLabel')">
              <el-input v-model="form.schemaName" :placeholder="t('nl2sql.datasource.schemaPlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('nl2sql.datasource.usernameLabel')" required>
              <el-input v-model="form.username" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="form.id ? t('nl2sql.datasource.passwordEditLabel') : t('nl2sql.datasource.passwordLabel')" :required="!form.id">
              <el-input v-model="form.password" type="password" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('nl2sql.datasource.descriptionLabel')">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :loading="testingInDialog" :icon="Connection" @click="handleTestInDialog">{{ t('nl2sql.datasource.testConnection') }}</el-button>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">{{ t('nl2sql.datasource.save') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
