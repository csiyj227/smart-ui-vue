<script setup lang="ts">
/**
 * 单个图表展示组件。
 *
 * 职责：
 * 1. 接收 lang + source，调用 utils/diagram-renderers 渲染到内部 container
 * 2. 提供工具栏：编辑源码 / 复制 DSL / 复制 PNG / 全屏查看
 * 3. 渲染失败时展示错误信息 + 原始源码（方便用户排查/手动修复）
 *
 * 缩放/拖拽：
 * - 普通模式下不启用，避免影响阅读
 * - 全屏模式下启用滚轮缩放 + 鼠标拖拽（轻量自实现，避免引入 panzoom 库）
 */
import { onMounted, ref, shallowRef, watch, nextTick, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, DocumentCopy, PictureFilled, FullScreen, Refresh } from '@element-plus/icons-vue';
import { renderDiagram, DIAGRAM_LABELS, type DiagramLang } from '@/utils/diagram-renderers';
import DiagramEditor from './DiagramEditor.vue';

interface Props {
  lang: DiagramLang;
  source: string;
}
const props = defineProps<Props>();

/** 当前正在渲染的源码（用户编辑后会替换 props.source） */
const currentSource = ref(props.source);
const containerRef = ref<HTMLDivElement | null>(null);
const fullscreenContainerRef = ref<HTMLDivElement | null>(null);
const errorMsg = ref('');
const loading = ref(false);

/** 编辑弹窗 */
const editorVisible = ref(false);
/** 全屏对话框 */
const fullscreenVisible = ref(false);

/** 缩放/拖拽状态（仅全屏模式生效） */
const transform = shallowRef({ scale: 1, x: 0, y: 0 });
const dragging = ref(false);
let dragStart = { x: 0, y: 0, originX: 0, originY: 0 };

async function doRender(target: HTMLElement | null) {
  if (!target) return;
  loading.value = true;
  errorMsg.value = '';
  try {
    await renderDiagram(props.lang, currentSource.value, target);
    // 让 SVG 自适应容器宽度（mermaid/viz/flowchart 默认会写死 width）
    const svg = target.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
    target.innerHTML = '';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.source,
  (val) => {
    // 父组件传入新源码时同步（流式场景）
    currentSource.value = val;
    nextTick(() => doRender(containerRef.value));
  },
);

onMounted(async () => {
  // 子应用通过 createApp().mount() 动态挂载时，ref 绑定可能延迟一帧
  await nextTick();
  doRender(containerRef.value);
});

/* ---------------- 工具栏动作 ---------------- */

async function handleCopySource() {
  try {
    await navigator.clipboard.writeText(currentSource.value);
    ElMessage.success('源码已复制');
  } catch {
    ElMessage.error('复制失败，请手动复制');
  }
}

async function handleCopyImage() {
  const target = fullscreenVisible.value ? fullscreenContainerRef.value : containerRef.value;
  if (!target) return;
  try {
    const { toBlob } = await import('html-to-image');
    const blob = await toBlob(target, { backgroundColor: '#ffffff', pixelRatio: 2 });
    if (!blob) throw new Error('生成 PNG 失败');
    // ClipboardItem 在部分浏览器/HTTP 环境下不可用，做一次降级
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      ElMessage.success('图片已复制到剪贴板');
    } else {
      // 降级：触发下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('已下载 PNG（当前环境不支持复制图片到剪贴板）');
    }
  } catch (e) {
    ElMessage.error(`复制图片失败: ${e instanceof Error ? e.message : e}`);
  }
}

function handleEdit() {
  editorVisible.value = true;
}

function handleEditorSave(newSource: string) {
  currentSource.value = newSource;
  editorVisible.value = false;
  nextTick(() => doRender(containerRef.value));
}

function handleFullscreen() {
  fullscreenVisible.value = true;
  // 重置变换
  transform.value = { scale: 1, x: 0, y: 0 };
  // 渲染在 @opened 回调中触发，确保 dialog DOM 完全就绪
}

/** el-dialog @opened：动画结束后 DOM 才真正可用 */
async function onFullscreenOpened() {
  await nextTick();
  await doRender(fullscreenContainerRef.value);
}

function handleRetry() {
  doRender(containerRef.value);
}

/* ---------------- 全屏缩放/拖拽 ---------------- */

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const next = Math.min(Math.max(transform.value.scale * delta, 0.2), 8);
  transform.value = { ...transform.value, scale: next };
}

function onMouseDown(e: MouseEvent) {
  dragging.value = true;
  dragStart = {
    x: e.clientX,
    y: e.clientY,
    originX: transform.value.x,
    originY: transform.value.y,
  };
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return;
  transform.value = {
    ...transform.value,
    x: dragStart.originX + (e.clientX - dragStart.x),
    y: dragStart.originY + (e.clientY - dragStart.y),
  };
}

function onMouseUp() {
  dragging.value = false;
}

function resetTransform() {
  transform.value = { scale: 1, x: 0, y: 0 };
}

onBeforeUnmount(() => {
  // 全屏关闭时确保 mouseup 监听被释放（防御性）
  dragging.value = false;
});
</script>

<template>
  <div class="diagram-block">
    <!-- 工具栏 -->
    <div class="diagram-toolbar">
      <span class="diagram-label">{{ DIAGRAM_LABELS[lang] }}</span>
      <div class="diagram-actions">
        <el-tooltip content="编辑源码" placement="top">
          <el-button :icon="Edit" size="small" text @click="handleEdit" />
        </el-tooltip>
        <el-tooltip content="复制源码" placement="top">
          <el-button :icon="DocumentCopy" size="small" text @click="handleCopySource" />
        </el-tooltip>
        <el-tooltip content="复制为 PNG" placement="top">
          <el-button :icon="PictureFilled" size="small" text @click="handleCopyImage" />
        </el-tooltip>
        <el-tooltip content="全屏查看" placement="top">
          <el-button :icon="FullScreen" size="small" text @click="handleFullscreen" />
        </el-tooltip>
      </div>
    </div>

    <!-- 渲染区 -->
    <div class="diagram-canvas">
      <div v-if="loading" class="diagram-loading">渲染中…</div>
      <div v-show="!errorMsg" ref="containerRef" class="diagram-container" />
      <div v-if="errorMsg" class="diagram-error">
        <div class="error-title">⚠️ 渲染失败：{{ errorMsg }}</div>
        <el-button :icon="Refresh" size="small" @click="handleRetry">重试</el-button>
        <el-button :icon="Edit" size="small" @click="handleEdit">编辑源码</el-button>
        <pre class="error-source">{{ currentSource }}</pre>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <DiagramEditor
      v-if="editorVisible"
      v-model:visible="editorVisible"
      :lang="lang"
      :source="currentSource"
      @save="handleEditorSave"
    />

    <!-- 全屏对话框 -->
    <el-dialog
      v-model="fullscreenVisible"
      :title="DIAGRAM_LABELS[lang]"
      fullscreen
      append-to-body
      class="diagram-fullscreen-dialog"
      @opened="onFullscreenOpened"
    >
      <template #header="{ titleId, titleClass }">
        <div class="fs-header">
          <span :id="titleId" :class="titleClass">{{ DIAGRAM_LABELS[lang] }}</span>
          <div class="fs-toolbar">
            <span class="fs-scale">{{ Math.round(transform.scale * 100) }}%</span>
            <el-button size="small" @click="resetTransform">重置</el-button>
            <el-button size="small" :icon="DocumentCopy" @click="handleCopySource">复制源码</el-button>
            <el-button size="small" :icon="PictureFilled" @click="handleCopyImage">复制 PNG</el-button>
          </div>
        </div>
      </template>
      <div
        class="fs-stage"
        @wheel="onWheel"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      >
        <div
          class="fs-transform"
          :style="{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            cursor: dragging ? 'grabbing' : 'grab',
          }"
        >
          <div ref="fullscreenContainerRef" class="diagram-container fs-container" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style>
/* 不使用 scoped：此组件通过 createApp 挂载为独立子应用，
   scoped 生成的 data-v-xxx 与主应用不一致，样式选择器全部失效。
   改用 .diagram-block 前缀避免全局污染。 */
.diagram-block {
  margin: 12px 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.diagram-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}

.diagram-label {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.diagram-actions {
  display: flex;
  gap: 2px;
}

.diagram-canvas {
  position: relative;
  padding: 16px;
  min-height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.diagram-container {
  max-width: 100%;
  display: flex;
  justify-content: center;
}

.diagram-container svg {
  max-width: 100%;
  height: auto;
}

.diagram-loading {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.diagram-error {
  width: 100%;
  text-align: left;
}

.error-title {
  color: var(--el-color-danger);
  margin-bottom: 8px;
  font-size: 13px;
}

.error-source {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--el-fill-color);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-regular);
  max-height: 200px;
  overflow: auto;
}

/* ---- 全屏 ---- */
.fs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-right: 24px;
}
.fs-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.fs-scale {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  min-width: 48px;
}

.fs-stage {
  width: 100%;
  height: calc(100vh - 120px);
  overflow: hidden;
  background: repeating-conic-gradient(#f5f5f5 0% 25%, #fff 0% 50%) 50% / 24px 24px;
  position: relative;
  user-select: none;
}

.fs-transform {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
}

.fs-container {
  transform: translate(-50%, -50%);
}

.fs-container svg {
  max-width: none;
  height: auto;
}
</style>
