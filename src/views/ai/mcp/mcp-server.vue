<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElMessage,
  ElMessageBox,
} from 'element-plus';
import { Plus, Search, Edit, Delete, View, Refresh } from '@element-plus/icons-vue';
import {
  pageMcpServers,
  saveMcpServer,
  deleteMcpServer,
  listMcpTools,
  syncMcpTools,
} from '@/api/ai';
import type { AiMcpServer, AiMcpTool } from '@/types/ai';
import { TRANSPORT_TYPES } from '@/types/ai';
import type { PageResult } from '@/types/api';

const { t } = useI18n();

const loading = ref(false);
const serverList = ref<AiMcpServer[]>([]);
const total = ref(0);
const query = reactive({ current: 1, size: 10, keyword: '' });

async function fetchServers() {
  loading.value = true;
  try {
    const result: PageResult<AiMcpServer> = await pageMcpServers(
      query.current, query.size, query.keyword,
    );
    serverList.value = result?.records ?? [];
    total.value = result?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/* ---------- 服务器表单 ---------- */
const dialogVisible = ref(false);
const serverForm = reactive<Partial<AiMcpServer>>({
  serverName: '',
  transportType: 'SSE',
  serverUrl: '',
  command: '',
  args: '',
  envVars: '',
  status: '1',
  remark: '',
});

function openDialog(row?: AiMcpServer) {
  if (row) {
    Object.assign(serverForm, row);
  } else {
    Object.assign(serverForm, {
      id: undefined, serverName: '', transportType: 'SSE',
      serverUrl: '', command: '', args: '', envVars: '',
      status: '1', remark: '',
    });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await saveMcpServer({ ...serverForm });
  ElMessage.success(t('common.success'));
  dialogVisible.value = false;
  await fetchServers();
}

async function handleDelete(row: AiMcpServer) {
  await ElMessageBox.confirm(t('ai.mcp.deleteConfirm', { name: row.serverName }), t('common.tip'), { type: 'warning' });
  await deleteMcpServer(row.id);
  ElMessage.success(t('ai.deleteSuccess'));
  await fetchServers();
}

/* ---------- 工具查看 ---------- */
const toolDrawerVisible = ref(false);
const toolDrawerTitle = ref('');
const toolList = ref<AiMcpTool[]>([]);
const toolLoading = ref(false);
const syncing = ref(false);
// 当前抽屉对应的 server，用于"同步"按钮拿到 serverId
const currentServer = ref<AiMcpServer | null>(null);

async function viewTools(row: AiMcpServer) {
  currentServer.value = row;
  toolDrawerTitle.value = t('ai.mcp.toolListTitle', { name: row.serverName });
  toolDrawerVisible.value = true;
  toolLoading.value = true;
  try {
    toolList.value = (await listMcpTools(row.id)) ?? [];
  } finally {
    toolLoading.value = false;
  }
}

/**
 * 同步指定 MCP server 的工具列表（调后端的 JSON-RPC tools/list 并 upsert）。
 * 同步成功后，工具会出现在 Agent 编辑表单的 MCP 工具下拉里。
 */
async function handleSyncTools(row: AiMcpServer) {
  if (row.transportType !== 'SSE') {
    ElMessage.warning(t('ai.mcp.syncWarning'));
    return;
  }
  syncing.value = true;
  try {
    const count = await syncMcpTools(row.id);
    ElMessage.success(t('ai.mcp.syncSuccess', { count }));
    // 如果当前抽屉打开的就是这个 server，刷新一下抽屉里的工具列表
    if (toolDrawerVisible.value && currentServer.value?.id === row.id) {
      toolList.value = (await listMcpTools(row.id)) ?? [];
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error(t('ai.mcp.syncFailed', { msg }));
  } finally {
    syncing.value = false;
  }
}

onMounted(() => fetchServers());
</script>

<template>
  <el-card shadow="never">
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
      <el-input v-model="query.keyword" :placeholder="t('ai.mcp.searchPlaceholder')" :prefix-icon="Search"
        clearable style="width: 280px" @clear="fetchServers" @keyup.enter="fetchServers" />
      <el-button type="primary" :icon="Plus" @click="openDialog()">{{ t('ai.mcp.addServer') }}</el-button>
    </div>

    <el-table v-loading="loading" :data="serverList" stripe>
      <el-table-column prop="serverName" :label="t('ai.mcp.colServerName')" min-width="160" />
      <el-table-column prop="transportType" :label="t('ai.mcp.colTransportType')" width="100">
        <template #default="{ row }">
          <el-tag :type="row.transportType === 'SSE' ? 'primary' : 'warning'">{{ row.transportType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('ai.mcp.colConnectionInfo')" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.transportType === 'SSE'">{{ row.serverUrl }}</span>
          <span v-else>{{ row.command }} {{ row.args }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" :label="t('ai.model.colStatus')" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '1' ? 'success' : 'info'">{{ row.status === '1' ? t('ai.model.statusEnabled') : t('ai.model.statusDisabled') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" :label="t('ai.model.labelRemark')" min-width="120" show-overflow-tooltip />
      <el-table-column :label="t('ai.model.colActions')" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="View" @click="viewTools(row)">{{ t('ai.mcp.btnTools') }}</el-button>
          <el-button link type="success" :icon="Refresh" :loading="syncing" @click="handleSyncTools(row)">{{ t('ai.mcp.btnSync') }}</el-button>
          <el-button link type="primary" :icon="Edit" @click="openDialog(row)">{{ t('ai.edit') }}</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">{{ t('ai.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="query.current" v-model:page-size="query.size"
      :total="total" layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50]"
      style="margin-top: 16px; justify-content: flex-end" @change="fetchServers" />

    <!-- 服务器表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="serverForm.id ? t('ai.mcp.editServerTitle') : t('ai.mcp.addServerTitle')" width="580px">
      <el-form :model="serverForm" label-width="100px">
        <el-form-item :label="t('ai.mcp.labelServerName')"><el-input v-model="serverForm.serverName" /></el-form-item>
        <el-form-item :label="t('ai.mcp.labelTransportType')">
          <el-select v-model="serverForm.transportType" style="width: 100%">
            <el-option v-for="t in TRANSPORT_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <template v-if="serverForm.transportType === 'SSE'">
          <el-form-item :label="t('ai.mcp.labelServerUrl')"><el-input v-model="serverForm.serverUrl" :placeholder="t('ai.mcp.placeholderServerUrl')" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item :label="t('ai.mcp.labelCommand')"><el-input v-model="serverForm.command" :placeholder="t('ai.mcp.placeholderCommand')" /></el-form-item>
          <el-form-item :label="t('ai.mcp.labelArgs')"><el-input v-model="serverForm.args" :placeholder="t('ai.mcp.placeholderArgs')" /></el-form-item>
        </template>
        <el-form-item :label="t('ai.mcp.labelEnvVars')"><el-input v-model="serverForm.envVars" type="textarea" :rows="3" :placeholder="t('ai.mcp.placeholderEnvVars')" /></el-form-item>
        <el-form-item :label="t('ai.model.labelStatus')"><el-switch v-model="serverForm.status" active-value="1" inactive-value="0" /></el-form-item>
        <el-form-item :label="t('ai.model.labelRemark')"><el-input v-model="serverForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('ai.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ t('ai.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 工具列表抽屉 -->
    <el-drawer v-model="toolDrawerVisible" :title="toolDrawerTitle" size="560px">
      <div style="margin-bottom: 12px; display: flex; justify-content: flex-end">
        <el-button v-if="currentServer" type="primary" :icon="Refresh" :loading="syncing"
          @click="handleSyncTools(currentServer)">
          {{ t('ai.mcp.syncToolsBtn') }}
        </el-button>
      </div>
      <el-table v-loading="toolLoading" :data="toolList" stripe>
        <el-table-column prop="toolName" :label="t('ai.mcp.colToolName')" min-width="160" />
        <el-table-column prop="toolDescription" :label="t('ai.mcp.colToolDescription')" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" :label="t('ai.model.colStatus')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '1' ? 'success' : 'info'" size="small">{{ row.status === '1' ? t('ai.model.statusEnabled') : t('ai.model.statusDisabled') }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!toolLoading && toolList.length === 0" :description="t('ai.mcp.emptyTools')" />
    </el-drawer>
  </el-card>
</template>
