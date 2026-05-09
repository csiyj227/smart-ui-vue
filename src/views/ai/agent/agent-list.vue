<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElMessage,
  ElMessageBox,
} from 'element-plus';
import { Plus, Search, Edit, Delete } from '@element-plus/icons-vue';
import {
  pageAgents,
  saveAgent,
  deleteAgent,
  listModelConfigs,
  pageKnowledgeBases,
  listAllMcpTools,
  getAgentToolIds,
  getAgentKnowledgeBaseIds,
} from '@/api/ai';
import type { AiAgent, AgentSaveCmd, AiModelConfig, AiKnowledgeBase, AiMcpTool } from '@/types/ai';
import type { PageResult } from '@/types/api';

const { t } = useI18n();
const loading = ref(false);
const agentList = ref<AiAgent[]>([]);
const total = ref(0);
const query = reactive({ current: 1, size: 12, keyword: '', category: '' });

async function fetchAgents() {
  loading.value = true;
  try {
    const result: PageResult<AiAgent> = await pageAgents(
      query.current, query.size, query.keyword || undefined, query.category || undefined,
    );
    agentList.value = result?.records ?? [];
    total.value = result?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/* ---------- 表单弹窗 ---------- */
const dialogVisible = ref(false);
const modelConfigs = ref<AiModelConfig[]>([]);
const knowledgeBases = ref<AiKnowledgeBase[]>([]);
const mcpTools = ref<AiMcpTool[]>([]);

const agentForm = reactive<Partial<AiAgent>>({
  agentName: '',
  description: '',
  systemPrompt: '',
  welcomeMessage: '',
  modelConfigId: undefined,
  temperatureOverride: undefined,
  enableWebSearch: false,
  enableDeepThinking: false,
  isPublic: true,
  category: '',
  sortOrder: 0,
  status: '1',
});
const selectedToolIds = ref<number[]>([]);
const selectedKbIds = ref<number[]>([]);

async function loadFormOptions() {
  const [models, kbs, tools] = await Promise.all([
    listModelConfigs(),
    pageKnowledgeBases(1, 100),
    listAllMcpTools().catch(() => [] as AiMcpTool[]),
  ]);
  modelConfigs.value = models ?? [];
  knowledgeBases.value = kbs?.records ?? [];
  mcpTools.value = tools ?? [];
}

async function openDialog(row?: AiAgent) {
  if (row) {
    Object.assign(agentForm, row);
    // 列表查询的 AiAgent 不含 toolIds / knowledgeBaseIds（这俩在关联表里），
    // 必须额外调专用接口拿绑定关系并回填，否则编辑时多选框是空的，
    // 一保存就把已有绑定全清掉。
    selectedToolIds.value = row.toolIds ?? [];
    selectedKbIds.value = row.knowledgeBaseIds ?? [];
    dialogVisible.value = true;
    try {
      const [toolIds, kbIds] = await Promise.all([
        getAgentToolIds(row.id).catch(() => [] as number[]),
        getAgentKnowledgeBaseIds(row.id).catch(() => [] as number[]),
      ]);
      selectedToolIds.value = toolIds ?? [];
      selectedKbIds.value = kbIds ?? [];
    } catch (e) {
      console.warn('Failed to load agent bindings:', e);
    }
  } else {
    Object.assign(agentForm, {
      id: undefined, agentName: '', description: '', systemPrompt: '',
      welcomeMessage: '', modelConfigId: undefined, temperatureOverride: undefined,
      enableWebSearch: false, enableDeepThinking: false, isPublic: true,
      category: '', sortOrder: 0, status: '1',
    });
    selectedToolIds.value = [];
    selectedKbIds.value = [];
    dialogVisible.value = true;
  }
}

async function handleSave() {
  // 后端 AgentCmd 是扁平结构，agent 字段需平铺，toolIds/knowledgeBaseIds 与之同级
  const cmd: AgentSaveCmd = {
    ...agentForm,
    toolIds: selectedToolIds.value,
    knowledgeBaseIds: selectedKbIds.value,
  };
  await saveAgent(cmd);
  ElMessage.success(t('ai.saveSuccess'));
  dialogVisible.value = false;
  await fetchAgents();
}

async function handleDelete(row: AiAgent) {
  await ElMessageBox.confirm(t('ai.deleteConfirm', { name: row.agentName }), t('common.tip'), { type: 'warning' });
  await deleteAgent(row.id);
  ElMessage.success(t('ai.deleteSuccess'));
  await fetchAgents();
}

onMounted(async () => {
  await Promise.all([fetchAgents(), loadFormOptions()]);
});
</script>

<template>
  <el-card shadow="never">
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
      <div style="display: flex; gap: 12px">
        <el-input v-model="query.keyword" :placeholder="t('ai.searchPlaceholder')" :prefix-icon="Search"
          clearable style="width: 240px" @clear="fetchAgents" @keyup.enter="fetchAgents" />
        <el-select v-model="query.category" :placeholder="t('ai.categoryPlaceholder')" clearable style="width: 140px" @change="fetchAgents">
          <el-option :label="t('ai.categoryGeneral')" value="general" />
          <el-option :label="t('ai.categoryCoding')" value="coding" />
          <el-option :label="t('ai.categoryWriting')" value="writing" />
          <el-option :label="t('ai.categoryAnalysis')" value="analysis" />
        </el-select>
      </div>
      <el-button type="primary" :icon="Plus" @click="openDialog()">{{ t('ai.createNew') }}</el-button>
    </div>

    <!-- 卡片列表 -->
    <div v-loading="loading" class="agent-grid">
      <el-empty v-if="agentList.length === 0" :description="t('ai.noData')" />
      <div v-for="agent in agentList" :key="agent.id" class="agent-card">
        <div class="agent-card-header">
          <el-avatar :size="48" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
            {{ agent.agentName.charAt(0) }}
          </el-avatar>
          <div class="agent-info">
            <div class="agent-name">{{ agent.agentName }}</div>
            <div class="agent-model">{{ agent.modelName ?? t('ai.noModelConfigured') }}</div>
          </div>
        </div>
        <div class="agent-desc">{{ agent.description || t('ai.noDescription') }}</div>
        <div class="agent-tags">
          <el-tag v-if="agent.enableDeepThinking" size="small" type="warning">{{ t('ai.deepThinking') }}</el-tag>
          <el-tag v-if="agent.enableWebSearch" size="small" type="success">{{ t('ai.webSearch') }}</el-tag>
          <el-tag v-if="agent.isPublic" size="small">{{ t('ai.public') }}</el-tag>
          <el-tag v-if="agent.toolIds?.length" size="small" type="info">{{ t('ai.toolsCount', { count: agent.toolIds.length }) }}</el-tag>
          <el-tag v-if="agent.knowledgeBaseIds?.length" size="small" type="danger">{{ t('ai.knowledgeBasesCount', { count: agent.knowledgeBaseIds?.length }) }}</el-tag>
        </div>
        <div class="agent-actions">
          <el-button link type="primary" :icon="Edit" @click="openDialog(agent)">{{ t('ai.edit') }}</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(agent)">{{ t('ai.delete') }}</el-button>
        </div>
      </div>
    </div>

    <el-pagination v-model:current-page="query.current" v-model:page-size="query.size"
      :total="total" layout="total, prev, pager, next" style="margin-top: 16px; justify-content: flex-end"
      @change="fetchAgents" />

    <!-- 表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="agentForm.id ? t('ai.editTitle') : t('ai.createTitle')" width="680px" top="5vh">
      <el-form :model="agentForm" label-width="100px">
        <el-form-item :label="t('ai.nameLabel')"><el-input v-model="agentForm.agentName" /></el-form-item>
        <el-form-item :label="t('ai.descriptionLabel')"><el-input v-model="agentForm.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item :label="t('ai.systemPromptLabel')">
          <el-input v-model="agentForm.systemPrompt" type="textarea" :rows="4"
            :placeholder="t('ai.systemPromptPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('ai.welcomeMessageLabel')"><el-input v-model="agentForm.welcomeMessage" :placeholder="t('ai.welcomeMessagePlaceholder')" /></el-form-item>
        <el-form-item :label="t('ai.modelLabel')">
          <el-select v-model="agentForm.modelConfigId" :placeholder="t('ai.modelPlaceholder')" style="width: 100%">
            <el-option v-for="m in modelConfigs" :key="m.id" :label="m.modelName" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ai.categoryLabel')">
          <el-select v-model="agentForm.category" :placeholder="t('ai.categorySelectPlaceholder')" clearable style="width: 100%">
            <el-option :label="t('ai.categoryGeneral')" value="general" />
            <el-option :label="t('ai.categoryCoding')" value="coding" />
            <el-option :label="t('ai.categoryWriting')" value="writing" />
            <el-option :label="t('ai.categoryAnalysis')" value="analysis" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ai.knowledgeBaseLabel')">
          <el-select v-model="selectedKbIds" multiple :placeholder="t('ai.knowledgeBasePlaceholder')" style="width: 100%">
            <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.kbName" :value="kb.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ai.mcpToolLabel')">
          <el-select v-model="selectedToolIds" multiple :placeholder="t('ai.mcpToolPlaceholder')" style="width: 100%">
            <el-option v-for="tool in mcpTools" :key="tool.id" :value="tool.id">
              <template #default>
                <div style="display: flex; align-items: center; justify-content: space-between">
                  <span>{{ tool.toolName }}</span>
                  <span style="color: var(--el-text-color-secondary); font-size: 12px">
                    {{ tool.serverName ?? '' }}
                  </span>
                </div>
              </template>
            </el-option>
          </el-select>
          <div style="font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px">
            {{ t('ai.mcpToolNote') }}
          </div>
        </el-form-item>
        <el-form-item :label="t('ai.deepThinkingLabel')"><el-switch v-model="agentForm.enableDeepThinking" /></el-form-item>
        <el-form-item :label="t('ai.webSearchLabel')"><el-switch v-model="agentForm.enableWebSearch" /></el-form-item>
        <el-form-item :label="t('ai.publicLabel')"><el-switch v-model="agentForm.isPublic" /></el-form-item>
        <el-form-item :label="t('ai.sortOrderLabel')"><el-input-number v-model="agentForm.sortOrder" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('ai.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ t('ai.confirm') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.agent-grid > .el-empty {
  grid-column: 1 / -1;
}

.agent-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.2s;
}

.agent-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.agent-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.agent-info { flex: 1; }

.agent-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.agent-model {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.agent-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.agent-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--el-border-color-extra-light);
  padding-top: 12px;
}
</style>
