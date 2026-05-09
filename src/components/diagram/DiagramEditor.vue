<script setup lang="ts">
/**
 * 图表源码编辑弹窗：左侧 textarea 编辑 DSL，右侧实时预览。
 *
 * 设计说明：
 * - 没有引入 Monaco/CodeMirror 这类重型编辑器，保持包体积；
 *   普通 textarea + 等宽字体 + Tab 缩进足够覆盖 LLM 产出图表的二次微调场景。
 * - 实时预览用 300ms 防抖，避免每次按键都触发 mermaid/viz 重新渲染（卡顿）。
 * - 保存时再向父组件 emit('save')，关闭即丢弃改动。
 */
import { ref, watch, onBeforeUnmount, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { renderDiagram, DIAGRAM_LABELS, type DiagramLang } from '@/utils/diagram-renderers';

interface Props {
  visible: boolean;
  lang: DiagramLang;
  source: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
  (e: 'save', source: string): void;
}>();

const draft = ref(props.source);
const previewRef = ref<HTMLDivElement | null>(null);
const previewError = ref('');
const previewing = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function doPreview() {
  const target = previewRef.value;
  if (!target) return;
  previewing.value = true;
  previewError.value = '';
  try {
    await renderDiagram(props.lang, draft.value, target);
    const svg = target.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    }
  } catch (e) {
    previewError.value = e instanceof Error ? e.message : String(e);
    target.innerHTML = '';
  } finally {
    previewing.value = false;
  }
}

function schedulePreview() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doPreview, 300);
}

watch(
  () => draft.value,
  () => schedulePreview(),
);

// 弹窗打开时初始化一次预览
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      draft.value = props.source;
      await nextTick();
      doPreview();
    }
  },
  { immediate: true },
);

function handleSave() {
  emit('save', draft.value);
}

function handleClose() {
  emit('update:visible', false);
}

/**
 * 在 textarea 内按 Tab 时插入 2 空格而不是切换焦点。
 * 编辑 mermaid/dot 这类对缩进敏感的 DSL 体验更好。
 */
function handleTabKey(e: KeyboardEvent) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = e.target as HTMLTextAreaElement;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const val = ta.value;
  const inserted = '  ';
  ta.value = val.slice(0, start) + inserted + val.slice(end);
  ta.selectionStart = ta.selectionEnd = start + inserted.length;
  draft.value = ta.value;
}

async function handleCopyDraft() {
  try {
    await navigator.clipboard.writeText(draft.value);
    ElMessage.success('源码已复制');
  } catch {
    ElMessage.error('复制失败');
  }
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="`编辑 - ${DIAGRAM_LABELS[lang]}`"
    width="80%"
    top="5vh"
    append-to-body
    :before-close="handleClose"
    @update:model-value="(v) => emit('update:visible', v)"
  >
    <div class="diagram-editor">
      <!-- 左侧 DSL -->
      <div class="editor-pane">
        <div class="pane-header">
          <span>源码</span>
          <el-button size="small" text @click="handleCopyDraft">复制</el-button>
        </div>
        <textarea
          v-model="draft"
          class="dsl-textarea"
          spellcheck="false"
          @keydown="handleTabKey"
        />
      </div>

      <!-- 右侧预览 -->
      <div class="preview-pane">
        <div class="pane-header">
          <span>预览 {{ previewing ? '（渲染中…）' : '' }}</span>
        </div>
        <div class="preview-canvas">
          <div v-show="!previewError" ref="previewRef" class="preview-container" />
          <div v-if="previewError" class="preview-error">⚠️ {{ previewError }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.diagram-editor {
  display: flex;
  gap: 16px;
  height: 70vh;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  min-width: 0;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dsl-textarea {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #fafbfc;
  color: var(--el-text-color-primary);
}

.preview-canvas {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  background:
    repeating-conic-gradient(#f5f5f5 0% 25%, #fff 0% 50%) 50% / 24px 24px;
}

.preview-container {
  max-width: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
}

.preview-container :deep(svg) {
  max-width: 100%;
  height: auto;
}

.preview-error {
  color: var(--el-color-danger);
  font-size: 13px;
  text-align: center;
  word-break: break-all;
}
</style>
