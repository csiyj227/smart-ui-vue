<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElMessage,
  ElMessageBox,
} from 'element-plus';
import { Plus, Search, Delete, Edit } from '@element-plus/icons-vue';
import {
  pageProviders,
  saveProvider,
  deleteProvider,
  pageModelConfigs,
  saveModelConfig,
  deleteModelConfig,
  listProviders,
} from '@/api/ai';
import type { AiModelProvider, AiModelConfig } from '@/types/ai';
import { PROVIDER_TYPES } from '@/types/ai';
import type { PageResult } from '@/types/api';

const { t } = useI18n();

const activeTab = ref('provider');

/* ==================== 供应商管理 ==================== */
const providerLoading = ref(false);
const providerList = ref<AiModelProvider[]>([]);
const providerTotal = ref(0);
const providerQuery = reactive({ current: 1, size: 10, keyword: '' });

async function fetchProviders() {
  providerLoading.value = true;
  try {
    const result: PageResult<AiModelProvider> = await pageProviders(
      providerQuery.current, providerQuery.size, providerQuery.keyword,
    );
    providerList.value = result?.records ?? [];
    providerTotal.value = result?.total ?? 0;
  } finally {
    providerLoading.value = false;
  }
}

const providerDialogVisible = ref(false);
const providerForm = reactive<Partial<AiModelProvider>>({
  providerName: '',
  providerType: 'OPENAI',
  baseUrl: '',
  apiKey: '',
  status: '1',
  sortOrder: 0,
  remark: '',
});

function openProviderDialog(row?: AiModelProvider) {
  if (row) {
    Object.assign(providerForm, row);
  } else {
    Object.assign(providerForm, {
      id: undefined, providerName: '', providerType: 'OPENAI',
      baseUrl: '', apiKey: '', status: '1', sortOrder: 0, remark: '',
    });
  }
  providerDialogVisible.value = true;
}

async function handleSaveProvider() {
  await saveProvider({ ...providerForm });
  ElMessage.success(t('common.success'));
  providerDialogVisible.value = false;
  await fetchProviders();
  await fetchProviderOptions();
}

async function handleDeleteProvider(row: AiModelProvider) {
  await ElMessageBox.confirm(t('ai.model.deleteConfirmProvider', { name: row.providerName }), t('common.tip'), { type: 'warning' });
  await deleteProvider(row.id);
  ElMessage.success(t('ai.deleteSuccess'));
  await fetchProviders();
}

/* ==================== 模型配置管理 ==================== */
const configLoading = ref(false);
const configList = ref<AiModelConfig[]>([]);
const configTotal = ref(0);
const configQuery = reactive({ current: 1, size: 10, providerId: undefined as number | undefined, keyword: '' });
const providerOptions = ref<AiModelProvider[]>([]);

async function fetchProviderOptions() {
  providerOptions.value = (await listProviders()) ?? [];
}

async function fetchConfigs() {
  configLoading.value = true;
  try {
    const result: PageResult<AiModelConfig> = await pageModelConfigs(
      configQuery.current, configQuery.size, configQuery.providerId, configQuery.keyword,
    );
    configList.value = result?.records ?? [];
    configTotal.value = result?.total ?? 0;
  } finally {
    configLoading.value = false;
  }
}

const configDialogVisible = ref(false);
const configForm = reactive<Partial<AiModelConfig>>({
  modelName: '',
  modelCode: '',
  providerId: undefined,
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
  contextWindow: 8192,
  supportVision: false,
  supportFunctionCall: false,
  status: '1',
  isDefault: false,
});

function openConfigDialog(row?: AiModelConfig) {
  if (row) {
    Object.assign(configForm, row);
  } else {
    Object.assign(configForm, {
      id: undefined, modelName: '', modelCode: '', providerId: undefined,
      maxTokens: 4096, temperature: 0.7, topP: 0.9, contextWindow: 8192,
      supportVision: false, supportFunctionCall: false, status: '1', isDefault: false,
    });
  }
  configDialogVisible.value = true;
}

async function handleSaveConfig() {
  await saveModelConfig({ ...configForm });
  ElMessage.success(t('common.success'));
  configDialogVisible.value = false;
  await fetchConfigs();
}

async function handleDeleteConfig(row: AiModelConfig) {
  await ElMessageBox.confirm(t('ai.model.deleteConfirmModel', { name: row.modelName }), t('common.tip'), { type: 'warning' });
  await deleteModelConfig(row.id);
  ElMessage.success(t('ai.deleteSuccess'));
  await fetchConfigs();
}

onMounted(async () => {
  await Promise.all([fetchProviders(), fetchConfigs(), fetchProviderOptions()]);
});
</script>

<template>
  <el-card shadow="never">
    <el-tabs v-model="activeTab">
      <!-- 供应商 Tab -->
      <el-tab-pane :label="t('ai.model.tabProvider')" name="provider">
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
          <el-input v-model="providerQuery.keyword" :placeholder="t('ai.model.searchProviderPlaceholder')" :prefix-icon="Search"
            clearable style="width: 240px" @clear="fetchProviders" @keyup.enter="fetchProviders" />
          <el-button type="primary" :icon="Plus" @click="openProviderDialog()">{{ t('ai.model.addProvider') }}</el-button>
        </div>
        <el-table v-loading="providerLoading" :data="providerList" stripe>
          <el-table-column prop="providerName" :label="t('ai.model.colProviderName')" min-width="140" />
          <el-table-column prop="providerType" :label="t('ai.model.colType')" width="120">
            <template #default="{ row }">
              <el-tag>{{ PROVIDER_TYPES.find(t => t.value === row.providerType)?.label ?? row.providerType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="baseUrl" :label="t('ai.model.colApiUrl')" min-width="200" show-overflow-tooltip />
          <el-table-column prop="apiKeyMasked" :label="t('ai.model.colApiKey')" width="160" />
          <el-table-column prop="status" :label="t('ai.model.colStatus')" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === '1' ? 'success' : 'info'">{{ row.status === '1' ? t('ai.model.statusEnabled') : t('ai.model.statusDisabled') }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('ai.model.colActions')" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :icon="Edit" @click="openProviderDialog(row)">{{ t('ai.edit') }}</el-button>
              <el-button link type="danger" :icon="Delete" @click="handleDeleteProvider(row)">{{ t('ai.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="providerQuery.current" v-model:page-size="providerQuery.size"
          :total="providerTotal" layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50]"
          style="margin-top: 16px; justify-content: flex-end" @change="fetchProviders" />
      </el-tab-pane>

      <!-- 模型配置 Tab -->
      <el-tab-pane :label="t('ai.model.tabConfig')" name="config">
        <div style="display: flex; gap: 12px; margin-bottom: 16px">
          <el-select v-model="configQuery.providerId" :placeholder="t('ai.model.allProviders')" clearable style="width: 180px"
            @change="fetchConfigs">
            <el-option v-for="p in providerOptions" :key="p.id" :label="p.providerName" :value="p.id" />
          </el-select>
          <el-input v-model="configQuery.keyword" :placeholder="t('ai.model.searchModelPlaceholder')" :prefix-icon="Search"
            clearable style="width: 200px" @clear="fetchConfigs" @keyup.enter="fetchConfigs" />
          <el-button type="primary" :icon="Plus" style="margin-left: auto" @click="openConfigDialog()">{{ t('ai.model.addModel') }}</el-button>
        </div>
        <el-table v-loading="configLoading" :data="configList" stripe>
          <el-table-column prop="modelName" :label="t('ai.model.colModelName')" min-width="160" />
          <el-table-column prop="modelCode" :label="t('ai.model.colModelCode')" min-width="160" />
          <el-table-column prop="providerName" :label="t('ai.model.colProvider')" width="120" />
          <el-table-column prop="maxTokens" :label="t('ai.model.colMaxTokens')" width="100" align="right" />
          <el-table-column prop="contextWindow" :label="t('ai.model.colContextWindow')" width="110" align="right" />
          <el-table-column :label="t('ai.model.colCapabilities')" width="140">
            <template #default="{ row }">
              <el-tag v-if="row.supportVision" size="small" type="success" style="margin-right:4px">{{ t('ai.model.capabilityVision') }}</el-tag>
              <el-tag v-if="row.supportFunctionCall" size="small" type="warning">{{ t('ai.model.capabilityTool') }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('ai.model.colDefault')" width="60" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isDefault" type="primary" size="small">{{ t('ai.model.defaultTag') }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('ai.model.colActions')" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :icon="Edit" @click="openConfigDialog(row)">{{ t('ai.edit') }}</el-button>
              <el-button link type="danger" :icon="Delete" @click="handleDeleteConfig(row)">{{ t('ai.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="configQuery.current" v-model:page-size="configQuery.size"
          :total="configTotal" layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50]"
          style="margin-top: 16px; justify-content: flex-end" @change="fetchConfigs" />
      </el-tab-pane>
    </el-tabs>

    <!-- 供应商表单弹窗 -->
    <el-dialog v-model="providerDialogVisible" :title="providerForm.id ? t('ai.model.editProviderTitle') : t('ai.model.addProviderTitle')" width="540px">
      <el-form :model="providerForm" label-width="100px">
        <el-form-item :label="t('ai.model.labelProviderName')"><el-input v-model="providerForm.providerName" /></el-form-item>
        <el-form-item :label="t('ai.model.labelType')">
          <el-select v-model="providerForm.providerType" style="width: 100%">
            <el-option v-for="t in PROVIDER_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ai.model.labelApiUrl')"><el-input v-model="providerForm.baseUrl" /></el-form-item>
        <el-form-item :label="t('ai.model.labelApiKey')"><el-input v-model="providerForm.apiKey" type="password" show-password /></el-form-item>
        <el-form-item :label="t('ai.model.labelStatus')">
          <el-switch v-model="providerForm.status" active-value="1" inactive-value="0" />
        </el-form-item>
        <el-form-item :label="t('ai.model.labelSortOrder')"><el-input-number v-model="providerForm.sortOrder" :min="0" /></el-form-item>
        <el-form-item :label="t('ai.model.labelRemark')"><el-input v-model="providerForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="providerDialogVisible = false">{{ t('ai.cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveProvider">{{ t('ai.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 模型配置表单弹窗 -->
    <el-dialog v-model="configDialogVisible" :title="configForm.id ? t('ai.model.editModelTitle') : t('ai.model.addModelTitle')" width="600px">
      <el-form :model="configForm" label-width="110px">
        <el-form-item :label="t('ai.model.labelModelName')"><el-input v-model="configForm.modelName" /></el-form-item>
        <el-form-item :label="t('ai.model.labelModelCode')"><el-input v-model="configForm.modelCode" :placeholder="t('ai.model.placeholderModelCode')" /></el-form-item>
        <el-form-item :label="t('ai.model.labelProviderSelect')">
          <el-select v-model="configForm.providerId" :placeholder="t('ai.model.placeholderSelect')" style="width: 100%">
            <el-option v-for="p in providerOptions" :key="p.id" :label="p.providerName" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ai.model.labelMaxTokens')"><el-input-number v-model="configForm.maxTokens" :min="1" :max="128000" /></el-form-item>
        <el-form-item :label="t('ai.model.labelTemperature')"><el-input-number v-model="configForm.temperature" :min="0" :max="2" :step="0.1" :precision="1" /></el-form-item>
        <el-form-item :label="t('ai.model.labelTopP')"><el-input-number v-model="configForm.topP" :min="0" :max="1" :step="0.1" :precision="1" /></el-form-item>
        <el-form-item :label="t('ai.model.labelContextWindow')"><el-input-number v-model="configForm.contextWindow" :min="1024" :step="1024" /></el-form-item>
        <el-form-item :label="t('ai.model.labelVision')"><el-switch v-model="configForm.supportVision" /></el-form-item>
        <el-form-item :label="t('ai.model.labelFunctionCall')"><el-switch v-model="configForm.supportFunctionCall" /></el-form-item>
        <el-form-item :label="t('ai.model.labelDefaultModel')"><el-switch v-model="configForm.isDefault" /></el-form-item>
        <el-form-item :label="t('ai.model.labelStatus')"><el-switch v-model="configForm.status" active-value="1" inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">{{ t('ai.cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveConfig">{{ t('ai.confirm') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
