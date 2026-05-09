<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElMessage,
  ElMessageBox,
} from 'element-plus';
import { Plus, Search, Edit, Delete, Document, View, Upload, Refresh } from '@element-plus/icons-vue';
import {
  pageKnowledgeBases,
  saveKnowledgeBase,
  deleteKnowledgeBase,
  pageKnowledgeDocuments,
  deleteKnowledgeDocument,
  listModelConfigs,
  uploadAiFile,
  addKnowledgeDocument,
  parseKnowledgeDocument,
  reindexKnowledgeBase,
} from '@/api/ai';
import type { AiKnowledgeBase, AiKnowledgeDocument, AiModelConfig } from '@/types/ai';
import type { PageResult } from '@/types/api';

const { t } = useI18n();

const loading = ref(false);
const kbList = ref<AiKnowledgeBase[]>([]);
const total = ref(0);
const query = reactive({ current: 1, size: 10, keyword: '' });

async function fetchKnowledgeBases() {
  loading.value = true;
  try {
    const result: PageResult<AiKnowledgeBase> = await pageKnowledgeBases(
      query.current, query.size, query.keyword,
    );
    kbList.value = result?.records ?? [];
    total.value = result?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/* ---------- 知识库表单 ---------- */
const dialogVisible = ref(false);
const modelConfigs = ref<AiModelConfig[]>([]);

const kbForm = reactive<Partial<AiKnowledgeBase>>({
  kbName: '',
  description: '',
  embeddingModelId: undefined,
  similarityThreshold: 0.7,
  topK: 5,
  chunkSize: 500,
  chunkOverlap: 50,
  status: '1',
});

function openDialog(row?: AiKnowledgeBase) {
  if (row) {
    Object.assign(kbForm, row);
  } else {
    Object.assign(kbForm, {
      id: undefined, kbName: '', description: '', embeddingModelId: undefined,
      similarityThreshold: 0.7, topK: 5, chunkSize: 500, chunkOverlap: 50, status: '1',
    });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await saveKnowledgeBase({ ...kbForm });
  ElMessage.success(t('common.success'));
  dialogVisible.value = false;
  await fetchKnowledgeBases();
}

async function handleDelete(row: AiKnowledgeBase) {
  await ElMessageBox.confirm(t('ai.knowledge.deleteConfirm', { name: row.kbName }), t('common.tip'), { type: 'warning' });
  await deleteKnowledgeBase(row.id);
  ElMessage.success(t('ai.deleteSuccess'));
  await fetchKnowledgeBases();
}

/**
 * 重新索引整个知识库 —— 适用场景：
 * ① 刚配好 embedding 模型，需要把已有文档的向量补上
 * ② 换了 embedding 模型（维度变了，旧向量必须重建）
 * ③ 调整了 chunkSize/chunkOverlap，分片粒度需要重切
 */
async function handleReindex(row: AiKnowledgeBase) {
  if (!row.embeddingModelId) {
    await ElMessageBox.confirm(
      t('ai.knowledge.reindexNoModelConfirm', { name: row.kbName }),
      t('common.tip'),
      { type: 'warning' },
    );
  } else {
    await ElMessageBox.confirm(
      t('ai.knowledge.reindexConfirm', { name: row.kbName }),
      t('ai.knowledge.rebuildIndexTitle'),
      { type: 'warning', confirmButtonText: t('ai.knowledge.startRebuild') },
    );
  }
  const msg = await reindexKnowledgeBase(row.id);
  ElMessage.success(msg || t('ai.knowledge.reindexQueued'));
  await fetchKnowledgeBases();
}

/* ---------- 文档管理 ---------- */
const docDrawerVisible = ref(false);
const docDrawerTitle = ref('');
const docList = ref<AiKnowledgeDocument[]>([]);
const docTotal = ref(0);
const docQuery = reactive({ kbId: 0, current: 1, size: 10 });

async function viewDocuments(row: AiKnowledgeBase) {
  docDrawerTitle.value = t('ai.knowledge.docDrawerTitle', { name: row.kbName });
  docQuery.kbId = row.id;
  docQuery.current = 1;
  await fetchDocuments();
  docDrawerVisible.value = true;
}

async function fetchDocuments() {
  const result: PageResult<AiKnowledgeDocument> = await pageKnowledgeDocuments(
    docQuery.kbId, docQuery.current, docQuery.size,
  );
  docList.value = result?.records ?? [];
  docTotal.value = result?.total ?? 0;
}

async function handleDeleteDoc(row: AiKnowledgeDocument) {
  await ElMessageBox.confirm(t('ai.knowledge.deleteDocConfirm', { name: row.docName }), t('common.tip'), { type: 'warning' });
  await deleteKnowledgeDocument(row.id);
  ElMessage.success(t('ai.deleteSuccess'));
  await fetchDocuments();
}

/* ---------- 文档上传 ---------- */
const uploadDialogVisible = ref(false);
const uploadingFile = ref<File | null>(null);
const uploading = ref(false);
const uploadProgress = ref(0);

function openUploadDialog() {
  uploadingFile.value = null;
  uploadProgress.value = 0;
  uploadDialogVisible.value = true;
}

function inferDocType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    pdf: 'PDF',
    doc: 'WORD',
    docx: 'WORD',
    txt: 'TXT',
    md: 'MARKDOWN',
    markdown: 'MARKDOWN',
    html: 'HTML',
    htm: 'HTML',
  };
  return map[ext] ?? 'TXT';
}

async function handleFileChange(uploadFile: { raw?: File }) {
  if (!uploadFile.raw) return;
  uploadingFile.value = uploadFile.raw;
}

async function handleUpload() {
  if (!uploadingFile.value) {
    ElMessage.warning(t('ai.knowledge.selectFileFirst'));
    return;
  }

  uploading.value = true;
  uploadProgress.value = 10;

  try {
    // Step 1: upload file to server
    const result = await uploadAiFile(uploadingFile.value, 'kb-' + docQuery.kbId);
    uploadProgress.value = 60;

    // Step 2: register document in knowledge base
    const docId = await addKnowledgeDocument({
      kbId: docQuery.kbId,
      docName: result.originalName,
      docType: inferDocType(result.originalName),
      fileUrl: result.url,
      fileSize: result.size,
    });
    uploadProgress.value = 80;

    // Step 3: trigger async parsing
    await parseKnowledgeDocument(docId);
    uploadProgress.value = 100;

    ElMessage.success(t('ai.knowledge.uploadSuccess'));
    uploadDialogVisible.value = false;
    await fetchDocuments();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('ai.knowledge.uploadFailed');
    ElMessage.error(msg);
  } finally {
    uploading.value = false;
  }
}

async function handleReparse(row: AiKnowledgeDocument) {
  try {
    await parseKnowledgeDocument(row.id);
    ElMessage.success(t('ai.knowledge.reparseTriggered'));
    await fetchDocuments();
  } catch {
    ElMessage.error(t('ai.knowledge.reparseFailed'));
  }
}

/** 格式化文件大小 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/** 解析状态映射 */
const parseStatusMap: Record<string, { label: string; type: string }> = {
  PENDING: { label: t('ai.knowledge.statusPending'), type: 'info' },
  PARSING: { label: t('ai.knowledge.statusParsing'), type: 'warning' },
  COMPLETED: { label: t('ai.knowledge.statusCompleted'), type: 'success' },
  FAILED: { label: t('ai.knowledge.statusFailed'), type: 'danger' },
};

onMounted(async () => {
  const [, models] = await Promise.all([fetchKnowledgeBases(), listModelConfigs()]);
  modelConfigs.value = models ?? [];
});
</script>

<template>
  <el-card shadow="never">
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px">
      <el-input v-model="query.keyword" :placeholder="t('ai.knowledge.searchPlaceholder')" :prefix-icon="Search"
        clearable style="width: 280px" @clear="fetchKnowledgeBases" @keyup.enter="fetchKnowledgeBases" />
      <el-button type="primary" :icon="Plus" @click="openDialog()">{{ t('ai.knowledge.createNew') }}</el-button>
    </div>

    <!-- 知识库卡片列表 -->
    <div v-loading="loading" class="kb-grid">
      <el-empty v-if="kbList.length === 0" :description="t('ai.knowledge.noData')" />
      <div v-for="kb in kbList" :key="kb.id" class="kb-card">
        <div class="kb-header">
          <el-icon :size="28" style="color: var(--el-color-primary)"><Document /></el-icon>
          <div class="kb-info">
            <div class="kb-name">{{ kb.kbName }}</div>
            <div class="kb-desc">{{ kb.description || t('ai.knowledge.noDescription') }}</div>
          </div>
        </div>
        <div class="kb-stats">
          <div class="stat-item">
            <span class="stat-value">{{ kb.documentCount ?? 0 }}</span>
            <span class="stat-label">{{ t('ai.knowledge.statDocuments') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ kb.segmentCount ?? 0 }}</span>
            <span class="stat-label">{{ t('ai.knowledge.statSegments') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ kb.topK ?? 5 }}</span>
            <span class="stat-label">{{ t('ai.knowledge.statTopK') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ kb.similarityThreshold ?? 0.7 }}</span>
            <span class="stat-label">{{ t('ai.knowledge.statThreshold') }}</span>
          </div>
        </div>
        <div class="kb-actions">
          <el-button link type="primary" :icon="View" @click="viewDocuments(kb)">{{ t('ai.knowledge.btnDocuments') }}</el-button>
          <el-button link type="success" :icon="Refresh" @click="handleReindex(kb)">{{ t('ai.knowledge.btnReindex') }}</el-button>
          <el-button link type="primary" :icon="Edit" @click="openDialog(kb)">{{ t('ai.edit') }}</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(kb)">{{ t('ai.delete') }}</el-button>
        </div>
      </div>
    </div>

    <el-pagination v-model:current-page="query.current" v-model:page-size="query.size"
      :total="total" layout="total, prev, pager, next" style="margin-top: 16px; justify-content: flex-end"
      @change="fetchKnowledgeBases" />

    <!-- 知识库表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="kbForm.id ? t('ai.knowledge.editTitle') : t('ai.knowledge.createTitle')" width="580px">
      <el-form :model="kbForm" label-width="110px">
        <el-form-item :label="t('ai.knowledge.labelName')"><el-input v-model="kbForm.kbName" /></el-form-item>
        <el-form-item :label="t('ai.knowledge.labelDescription')"><el-input v-model="kbForm.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item :label="t('ai.knowledge.labelEmbeddingModel')">
          <el-select v-model="kbForm.embeddingModelId" :placeholder="t('ai.model.placeholderSelect')" clearable style="width: 100%">
            <el-option v-for="m in modelConfigs" :key="m.id" :label="m.modelName" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ai.knowledge.labelSimilarityThreshold')"><el-input-number v-model="kbForm.similarityThreshold" :min="0" :max="1" :step="0.05" :precision="2" /></el-form-item>
        <el-form-item :label="t('ai.knowledge.labelTopK')"><el-input-number v-model="kbForm.topK" :min="1" :max="20" /></el-form-item>
        <el-form-item :label="t('ai.knowledge.labelChunkSize')"><el-input-number v-model="kbForm.chunkSize" :min="100" :max="2000" :step="50" /></el-form-item>
        <el-form-item :label="t('ai.knowledge.labelChunkOverlap')"><el-input-number v-model="kbForm.chunkOverlap" :min="0" :max="500" :step="10" /></el-form-item>
        <el-form-item :label="t('ai.model.labelStatus')"><el-switch v-model="kbForm.status" active-value="1" inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('ai.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ t('ai.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 文档管理抽屉 -->
    <el-drawer v-model="docDrawerVisible" :title="docDrawerTitle" size="780px">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px">
        <el-button type="primary" :icon="Upload" @click="openUploadDialog">{{ t('ai.knowledge.uploadDocument') }}</el-button>
        <el-button :icon="Refresh" @click="fetchDocuments">{{ t('common.reset') }}</el-button>
      </div>
      <el-table :data="docList" stripe>
        <el-table-column prop="docName" :label="t('ai.knowledge.colDocName')" min-width="160" show-overflow-tooltip />
        <el-table-column prop="docType" :label="t('ai.knowledge.colDocType')" width="80" />
        <el-table-column :label="t('ai.knowledge.colFileSize')" width="90">
          <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column prop="segmentCount" :label="t('ai.knowledge.colSegmentCount')" width="80" align="right" />
        <el-table-column prop="tokenCount" :label="t('ai.knowledge.colTokenCount')" width="80" align="right" />
        <el-table-column :label="t('ai.knowledge.colParseStatus')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="(parseStatusMap[row.parseStatus]?.type as any) ?? 'info'" size="small">
              {{ parseStatusMap[row.parseStatus]?.label ?? row.parseStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('ai.model.colActions')" width="160" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.parseStatus === 'PENDING' || row.parseStatus === 'FAILED'"
              link type="primary" :icon="Refresh" @click="handleReparse(row)"
            >{{ t('ai.knowledge.btnParse') }}</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDeleteDoc(row)">{{ t('ai.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="docList.length === 0" :description="t('ai.knowledge.emptyDocuments')" />
      <el-pagination v-if="docTotal > docQuery.size" v-model:current-page="docQuery.current"
        :total="docTotal" :page-size="docQuery.size" layout="prev, pager, next"
        style="margin-top: 16px; justify-content: center" @change="fetchDocuments" />
    </el-drawer>

    <!-- 文档上传弹窗 -->
    <el-dialog v-model="uploadDialogVisible" :title="t('ai.knowledge.uploadDialogTitle')" width="520px">
      <el-upload
        drag
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
        accept=".pdf,.doc,.docx,.txt,.md,.markdown,.html,.htm"
      >
        <el-icon class="el-icon--upload" :size="48"><Upload /></el-icon>
        <div class="el-upload__text">
          {{ t('ai.knowledge.uploadDragText') }}
        </div>
        <template #tip>
          <div class="el-upload__tip">
            {{ t('ai.knowledge.uploadTip') }}
          </div>
        </template>
      </el-upload>
      <div v-if="uploadingFile" style="margin-top: 12px">
        <el-tag type="info">{{ t('ai.knowledge.selectedFile', { name: uploadingFile.name, size: formatFileSize(uploadingFile.size) }) }}</el-tag>
      </div>
      <el-progress v-if="uploading" :percentage="uploadProgress" style="margin-top: 16px" />
      <template #footer>
        <el-button @click="uploadDialogVisible = false" :disabled="uploading">{{ t('ai.cancel') }}</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">{{ t('ai.knowledge.uploadAndParse') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.kb-grid > .el-empty {
  grid-column: 1 / -1;
}

.kb-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.2s;
}

.kb-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.kb-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.kb-info { flex: 1; }

.kb-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.kb-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-stats {
  display: flex;
  justify-content: space-around;
  padding: 12px 0;
  border-top: 1px solid var(--el-border-color-extra-light);
  border-bottom: 1px solid var(--el-border-color-extra-light);
  margin-bottom: 12px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.kb-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
