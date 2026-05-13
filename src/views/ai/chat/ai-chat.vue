<script setup lang="ts">
import { onMounted, ref, nextTick, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElMessage,
  ElMessageBox,
  ElScrollbar,
} from 'element-plus';
import {
  ChatDotRound,
  Plus,
  Top,
  Picture,
  MagicStick,
  Connection,
  MoreFilled,
  PictureFilled,
} from '@element-plus/icons-vue';
import {
  pageConversations,
  listMessages,
  deleteConversation,
  renameConversation,
  togglePinConversation,
  listModelConfigs,
  pageAgents,
  CHAT_SSE_URL,
} from '@/api/ai';
import type { AiConversation, AiMessage, AiModelConfig, AiAgent, ChatRequest } from '@/types/ai';
import { useUserStore } from '@/stores/user';
import { renderMarkdown, renderMarkdownStreaming, decodeSourceFromBase64, DIAGRAM_LANGS } from '@/utils/markdown';
import DiagramEditor from '@/components/diagram/DiagramEditor.vue';
import { renderDiagram, DIAGRAM_TEMPLATES, DIAGRAM_LABELS, type DiagramLang } from '@/utils/diagram-renderers';

const { t } = useI18n();
const userStore = useUserStore();

/* ---------- 对话列表 ---------- */
const conversations = ref<AiConversation[]>([]);
const activeConversationId = ref<number | null>(null);

async function loadConversations() {
  const result = await pageConversations(1, 100);
  conversations.value = result?.records ?? [];
}

function startNewChat() {
  activeConversationId.value = null;
  messages.value = [];
}

async function selectConversation(conv: AiConversation) {
  activeConversationId.value = conv.id;
  const result = await listMessages(conv.id);
  messages.value = result ?? [];
  await nextTick();
  scrollToBottom();
}

async function handleDeleteConversation(conv: AiConversation) {
  await ElMessageBox.confirm(t('ai.chat.deleteConfirm', { name: conv.title }), t('common.tip'), { type: 'warning' });
  await deleteConversation(conv.id);
  if (activeConversationId.value === conv.id) {
    startNewChat();
  }
  await loadConversations();
  ElMessage.success(t('ai.deleteSuccess'));
}

async function handleRename(conv: AiConversation) {
  const { value } = await ElMessageBox.prompt(t('ai.chat.renamePrompt'), t('ai.chat.renameTitle'), {
    inputValue: conv.title,
  });
  if (value?.trim()) {
    await renameConversation(conv.id, value.trim());
    await loadConversations();
  }
}

async function handleTogglePin(conv: AiConversation) {
  await togglePinConversation(conv.id);
  await loadConversations();
}

/* ---------- 消息 ---------- */
const messages = ref<AiMessage[]>([]);
const inputContent = ref('');
const isStreaming = ref(false);
const messageContainerRef = ref<InstanceType<typeof ElScrollbar>>();

/**
 * 流式过程中已渲染的图表代码块数量，用于检测是否有新的完整闭合代码块出现。
 * 通过对比当前内容中匹配到的图表围栏代码块数与已渲染数来判断是否需要触发增量渲染。
 */
let lastRenderedDiagramCount = 0;
let diagramRenderTimer: ReturnType<typeof setTimeout> | null = null;
const DIAGRAM_FENCE_PATTERN = /```(?:mermaid|plantuml|puml|dot|graphviz|flow|flowchart|infographic)\n[\s\S]*?```/gi;

/**
 * 检测流式内容中是否有新的已闭合图表代码块，有则节流触发渲染。
 * 配合 mountDiagramsIn 的 data-diagram-mounted 去重，确保每个图只渲染一次。
 */
function scheduleDiagramRenderIfNeeded(content: string) {
  const matches = content.match(DIAGRAM_FENCE_PATTERN);
  const currentCount = matches?.length ?? 0;
  if (currentCount <= lastRenderedDiagramCount) return;
  // 有新的完整图表代码块出现，节流调度渲染
  lastRenderedDiagramCount = currentCount;
  if (diagramRenderTimer) clearTimeout(diagramRenderTimer);
  diagramRenderTimer = setTimeout(async () => {
    await nextTick();
    mountAllVisibleDiagrams();
  }, 500);
}

function scrollToBottom() {
  nextTick(() => {
    const wrap = messageContainerRef.value?.wrapRef;
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  });
}

/* ---------- 模型 & Agent ---------- */
const modelConfigs = ref<AiModelConfig[]>([]);
const agents = ref<AiAgent[]>([]);
const selectedModelId = ref<number | undefined>(undefined);
const selectedAgentId = ref<number | undefined>(undefined);
const enableDeepThinking = ref(false);
const enableWebSearch = ref(false);

async function loadModelConfigs() {
  modelConfigs.value = (await listModelConfigs()) ?? [];
  if (modelConfigs.value.length > 0 && !selectedModelId.value) {
    const defaultModel = modelConfigs.value.find((m) => m.isDefault);
    selectedModelId.value = defaultModel?.id ?? modelConfigs.value[0].id;
  }
}

async function loadAgents() {
  const result = await pageAgents(1, 50);
  agents.value = result?.records ?? [];
}

/* ---------- 发送消息（SSE 流式） ---------- */
async function handleSend() {
  const content = inputContent.value.trim();
  if (!content || isStreaming.value) return;
  if (!selectedModelId.value) {
    ElMessage.warning(t('ai.chat.selectModel'));
    return;
  }

  const userMsg: AiMessage = {
    id: Date.now(),
    conversationId: activeConversationId.value ?? 0,
    role: 'USER',
    content,
    contentType: 'TEXT',
    status: 'SUCCESS',
  };
  messages.value.push(userMsg);
  inputContent.value = '';
  scrollToBottom();

  const assistantMsg: AiMessage = {
    id: Date.now() + 1,
    conversationId: activeConversationId.value ?? 0,
    role: 'ASSISTANT',
    content: '',
    contentType: 'TEXT',
    status: 'STREAMING',
  };
  messages.value.push(assistantMsg);
  // 必须通过 messages.value 中的代理对象操作，才能触发 Vue 3 的响应式更新
  const assistantIndex = messages.value.length - 1;
  const getAssistant = () => messages.value[assistantIndex];
  isStreaming.value = true;
  // 重置流式图表渲染计数器
  lastRenderedDiagramCount = 0;
  if (diagramRenderTimer) { clearTimeout(diagramRenderTimer); diagramRenderTimer = null; }

  try {
    const requestBody: ChatRequest = {
      conversationId: activeConversationId.value ?? undefined,
      modelConfigId: selectedModelId.value,
      agentId: selectedAgentId.value,
      content,
      enableDeepThinking: enableDeepThinking.value,
      enableWebSearch: enableWebSearch.value,
    };

    const response = await fetch(CHAT_SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${userStore.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE 事件之间用 \n\n 分隔，按事件块处理；剩余部分留在 buffer 中等待下一帧
        const events = buffer.split(/\n\n/);
        buffer = events.pop() ?? '';

        for (const eventBlock of events) {
          // 单个事件可能包含多行，例如 event: xxx / data: yyy
          const dataLines: string[] = [];
          for (const line of eventBlock.split('\n')) {
            const trimmed = line.trimEnd();
            if (trimmed.startsWith('data:')) {
              dataLines.push(trimmed.slice(5).trimStart());
            }
          }
          if (dataLines.length === 0) continue;
          const jsonStr = dataLines.join('\n');
          if (jsonStr === '[DONE]' || jsonStr === '') continue;
          try {
            const data = JSON.parse(jsonStr);
            const target = getAssistant();
            if (!target) continue;
            if (data.content) {
              target.content = (target.content ?? '') + data.content;
              // 流式过程中检测是否有新的完整图表代码块，有则增量渲染
              scheduleDiagramRenderIfNeeded(target.content);
            }
            if (data.reasoningContent) {
              target.reasoningContent = (target.reasoningContent ?? '') + data.reasoningContent;
            }
            if (data.conversationId) {
              activeConversationId.value = data.conversationId;
              target.conversationId = data.conversationId;
              userMsg.conversationId = data.conversationId;
            }
            if (data.modelCode) {
              target.modelCode = data.modelCode;
            }
            if (data.tokenCount) {
              target.tokenCount = data.tokenCount;
            }
            scrollToBottom();
          } catch (e) {
            // SSE 数据可能跨包，解析失败时回填到 buffer 等下一帧拼接
            console.warn('SSE parse failed:', jsonStr, e);
          }
        }
      }
    }

    const finalTarget = getAssistant();
    if (finalTarget) finalTarget.status = 'SUCCESS';
    await loadConversations();
  } catch (error: unknown) {
    const errTarget = getAssistant();
    if (errTarget) {
      errTarget.status = 'ERROR';
      errTarget.errorMsg = error instanceof Error ? error.message : t('ai.chat.requestFailed');
    }
    ElMessage.error(t('ai.chat.sendFailed'));
  } finally {
    isStreaming.value = false;
    scrollToBottom();
  }
}

/**
 * 输入框回车处理。需要避开 IME（中文/日文/韩文输入法）的合成事件，
 * 否则在拼音候选词阶段按回车选词时会被误判为发送，把未确认的文本直接发出去。
 *
 * 判定输入法合成中的两种方式（任一满足都跳过）：
 * 1. event.isComposing：现代浏览器的标准属性，候选词期间为 true
 * 2. event.keyCode === 229：W3C 规定的"IME 处理中"魔数，老版浏览器/某些输入法仍依赖
 *
 * 另外用 keypress + 自身的 compositionstart/end 事件作双保险，避免极端兼容场景遗漏。
 */
const isComposing = ref(false);

function handleCompositionStart() {
  isComposing.value = true;
}

function handleCompositionEnd() {
  // compositionend 触发时机比 keydown 稍晚，用 setTimeout 推到下一个 tick 再放开标记，
  // 避免「确认候选词的回车」紧接着触发发送。
  setTimeout(() => {
    isComposing.value = false;
  }, 0);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) {
    return;
  }
  // IME 合成中：候选词阶段按回车只是"选中候选"，不应触发发送
  if (event.isComposing || event.keyCode === 229 || isComposing.value) {
    return;
  }
  event.preventDefault();
  handleSend();
}

/**
 * 渲染消息内容，根据 role 和 status 选择是否启用 Markdown / 流式光标。
 */
function renderContent(msg: AiMessage): string {
  if (msg.role === 'USER') {
    return (msg.content || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch] || ch));
  }

  if (msg.status === 'STREAMING') {
    return msg.content ? renderMarkdownStreaming(msg.content) : '<span class="thinking">思考中...</span>';
  }

  return renderMarkdown(msg.content || '');
}

/* =============================================================================
 * 文生图：把 markdown.ts 输出的 .diagram-placeholder 占位 div 接管。
 *
 * 方案：直接调用 renderDiagram 把 SVG 写入占位 div + 原生 DOM 工具栏。
 * 全屏查看 / 编辑源码弹窗由主应用的 Vue 组件管理（DiagramEditor / el-dialog），
 * 通过 ref 控制可见性，避免 createApp 子应用的各种隔离问题。
 *
 * 增量渲染策略：流式输出过程中，只要图表代码块的围栏已闭合（即 renderMarkdown
 * 的正则能匹配到完整的 ```lang ... ``` 块并生成 diagram-placeholder），就立即
 * 渲染该图表，无需等待整个消息输出完成。通过 data-diagram-mounted 标记去重，
 * 结合节流（500ms）避免高频触发渲染。
 * =============================================================================
 */

/** 当前打开编辑弹窗的图表信息 */
const diagramEditorVisible = ref(false);
const diagramEditorLang = ref<DiagramLang>('mermaid');
const diagramEditorSource = ref('');
let diagramEditorTarget: HTMLElement | null = null; // 编辑保存后回写 SVG 的容器

/** 全屏查看弹窗 */
const diagramFullscreenVisible = ref(false);
const diagramFullscreenLang = ref<DiagramLang>('mermaid');
const diagramFullscreenSource = ref('');
const fullscreenContainerRef = ref<HTMLDivElement | null>(null);
const fullscreenTransform = ref({ scale: 1, x: 0, y: 0 });
const fullscreenDragging = ref(false);
let fullscreenDragStart = { x: 0, y: 0, originX: 0, originY: 0 };

/**
 * 为图表画布区域添加鼠标悬浮时的滚轮缩放和拖拽平移功能。
 */
function setupCanvasZoomAndPan(canvas: HTMLElement, svgContainer: HTMLElement) {
  const MIN_SCALE = 0.3;
  const MAX_SCALE = 5;
  const ZOOM_SENSITIVITY = 0.002;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;

  // 缩放比例提示气泡
  const zoomTip = document.createElement('div');
  zoomTip.style.cssText = 'position:absolute; top:8px; right:8px; padding:2px 8px; background:rgba(0,0,0,0.6); color:#fff; font-size:11px; border-radius:4px; opacity:0; transition:opacity 0.2s; pointer-events:none; z-index:10;';
  canvas.appendChild(zoomTip);

  let tipTimer: ReturnType<typeof setTimeout> | null = null;
  function showZoomTip() {
    zoomTip.textContent = `${Math.round(scale * 100)}%`;
    zoomTip.style.opacity = '1';
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { zoomTip.style.opacity = '0'; }, 1200);
  }

  function applyTransform() {
    svgContainer.style.transition = 'none';
    svgContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  // 滚轮缩放（鼠标悬浮即可触发，无需按键）
  canvas.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const prevScale = scale;
    const delta = -event.deltaY * ZOOM_SENSITIVITY;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + delta)));

    // 以鼠标位置为缩放中心
    const ratio = scale / prevScale;
    translateX = mouseX - ratio * (mouseX - translateX);
    translateY = mouseY - ratio * (mouseY - translateY);

    applyTransform();
    showZoomTip();
  }, { passive: false });

  // 拖拽平移
  canvas.addEventListener('mousedown', (event: MouseEvent) => {
    if (event.button !== 0) return;
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = translateX;
    dragOriginY = translateY;
    svgContainer.style.cursor = 'grabbing';
    event.preventDefault();
  });

  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;
    translateX = dragOriginX + (event.clientX - dragStartX);
    translateY = dragOriginY + (event.clientY - dragStartY);
    applyTransform();
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    svgContainer.style.cursor = 'grab';
  };

  // 绑定到 document 以支持鼠标移出画布后继续拖拽
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // 双击重置缩放和位置
  canvas.addEventListener('dblclick', (event: MouseEvent) => {
    event.preventDefault();
    scale = 1;
    translateX = 0;
    translateY = 0;
    svgContainer.style.transition = 'transform 0.25s ease-out';
    svgContainer.style.transform = 'translate(0px, 0px) scale(1)';
    showZoomTip();
  });
}

/**
 * 将 SVG 渲染到指定容器中，并创建原生 DOM 工具栏。
 */
async function renderDiagramInPlace(el: HTMLElement, lang: DiagramLang, source: string) {
  // 构建 DOM 结构：工具栏 + 渲染区
  el.innerHTML = '';
  el.style.cssText = 'white-space:normal; margin:12px 0; border:1px solid #e4e7ed; border-radius:8px; background:#fff; overflow:hidden;';

  // 工具栏
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:#f5f7fa; border-bottom:1px solid #e4e7ed; font-size:12px;';
  const label = document.createElement('span');
  label.textContent = DIAGRAM_LABELS[lang] ?? lang;
  label.style.cssText = 'color:#909399; font-weight:500;';
  toolbar.appendChild(label);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; gap:4px;';

  function makeBtn(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'padding:2px 8px; font-size:12px; border:1px solid #dcdfe6; border-radius:4px; background:#fff; cursor:pointer; color:#606266;';
    btn.addEventListener('mouseenter', () => { btn.style.background = '#ecf5ff'; btn.style.color = '#409eff'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; btn.style.color = '#606266'; });
    btn.addEventListener('click', onClick);
    return btn;
  }

  // 渲染区
  const canvas = document.createElement('div');
  canvas.style.cssText = 'padding:16px; min-height:60px; display:flex; justify-content:center; align-items:center; overflow:hidden; position:relative;';
  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = 'max-width:100%; display:flex; justify-content:center; transform-origin:center center; transition:transform 0.1s ease-out; cursor:grab;';
  canvas.appendChild(svgContainer);

  // 编辑按钮
  actions.appendChild(makeBtn('✏️ 编辑', () => {
    diagramEditorLang.value = lang;
    diagramEditorSource.value = source;
    diagramEditorTarget = svgContainer;
    diagramEditorVisible.value = true;
  }));

  // 复制源码按钮
  actions.appendChild(makeBtn(`📋 ${t('ai.chat.copySource')}`, async () => {
    try {
      await navigator.clipboard.writeText(source);
      ElMessage.success(t('ai.chat.sourceCopied'));
    } catch { ElMessage.error(t('ai.chat.copyFailed')); }
  }));

  // 全屏查看按钮
  actions.appendChild(makeBtn(`🔍 ${t('ai.chat.fullscreen')}`, () => {
    diagramFullscreenLang.value = lang;
    diagramFullscreenSource.value = source;
    fullscreenTransform.value = { scale: 1, x: 0, y: 0 };
    diagramFullscreenVisible.value = true;
  }));

  toolbar.appendChild(actions);
  el.appendChild(toolbar);
  el.appendChild(canvas);

  // 渲染 SVG
  try {
    await renderDiagram(lang, source, svgContainer);
    const svg = svgContainer.querySelector('svg');
    if (svg) {
      // 不要 removeAttribute('width')——flex 容器中 SVG 移除 width 后宽高会坍缩为 0
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.maxWidth = '100%';
    }
    // 鼠标悬浮时的滚轮缩放 + 拖拽平移
    setupCanvasZoomAndPan(canvas, svgContainer);
  } catch (e) {
    svgContainer.innerHTML = `<div style="color:#f56c6c; font-size:13px;">⚠️ 渲染失败：${e instanceof Error ? e.message : e}</div>`;
  }
}

/**
 * 在指定容器内查找未渲染的 .diagram-placeholder，直接渲染 SVG。
 */
function mountDiagramsIn(container: HTMLElement) {
  const placeholders = container.querySelectorAll<HTMLElement>(
    '.diagram-placeholder:not([data-diagram-mounted])',
  );
  placeholders.forEach((el) => {
    const lang = el.getAttribute('data-diagram-lang') as DiagramLang | null;
    const encoded = el.getAttribute('data-diagram-source') ?? '';
    if (!lang) return;
    let source = '';
    try { source = decodeSourceFromBase64(encoded); }
    catch { source = ''; }
    el.setAttribute('data-diagram-mounted', '1');
    renderDiagramInPlace(el, lang, source);
  });
}

/**
 * 扫描整个消息列表容器，渲染所有未渲染的图表占位符。
 */
function mountAllVisibleDiagrams() {
  const wrap = messageContainerRef.value?.wrapRef;
  if (!wrap) return;
  mountDiagramsIn(wrap);
}

/** 编辑弹窗保存回调：重新渲染 SVG */
function handleDiagramEditorSave(newSource: string) {
  diagramEditorVisible.value = false;
  if (diagramEditorTarget) {
    diagramEditorTarget.innerHTML = '';
    renderDiagram(diagramEditorLang.value, newSource, diagramEditorTarget).then(() => {
      const svg = diagramEditorTarget?.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxWidth = '100%';
      }
    }).catch(() => { /* 编辑器内已有预览，此处静默 */ });
  }
  // 更新 source 以便下次编辑/全屏时用新版本
  diagramEditorSource.value = newSource;
}

/** 全屏弹窗 @opened 回调：渲染图表到全屏容器 */
async function onDiagramFullscreenOpened() {
  await nextTick();
  const target = fullscreenContainerRef.value;
  if (!target) return;
  target.innerHTML = '';

  const isECharts = diagramFullscreenLang.value === 'infographic';
  const wrapper = target.parentElement; // transform 层
  const viewport = wrapper?.parentElement; // 外层滚动/溢出容器

  if (isECharts && viewport) {
    // ECharts 需要明确的像素级容器尺寸，撑满全屏视口
    const viewportRect = viewport.getBoundingClientRect();
    const chartWidth = Math.floor(viewportRect.width * 0.85);
    const chartHeight = Math.floor(viewportRect.height * 0.85);
    target.style.width = `${chartWidth}px`;
    target.style.height = `${chartHeight}px`;
    target.style.transform = 'translate(-50%, -50%)';
  }

  try {
    await renderDiagram(diagramFullscreenLang.value, diagramFullscreenSource.value, target);
    if (!isECharts) {
      const svg = target.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxWidth = 'none';
      }
    }
  } catch (e) {
    target.innerHTML = `<div style="color:#f56c6c;">⚠️ 渲染失败：${e instanceof Error ? e.message : e}</div>`;
  }
}

/* 全屏缩放/拖拽 */
function onFsWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const next = Math.min(Math.max(fullscreenTransform.value.scale * delta, 0.2), 8);
  fullscreenTransform.value = { ...fullscreenTransform.value, scale: next };
}
function onFsMouseDown(e: MouseEvent) {
  fullscreenDragging.value = true;
  fullscreenDragStart = { x: e.clientX, y: e.clientY, originX: fullscreenTransform.value.x, originY: fullscreenTransform.value.y };
}
function onFsMouseMove(e: MouseEvent) {
  if (!fullscreenDragging.value) return;
  fullscreenTransform.value = { ...fullscreenTransform.value, x: fullscreenDragStart.originX + (e.clientX - fullscreenDragStart.x), y: fullscreenDragStart.originY + (e.clientY - fullscreenDragStart.y) };
}
function onFsMouseUp() { fullscreenDragging.value = false; }
function resetFsTransform() { fullscreenTransform.value = { scale: 1, x: 0, y: 0 }; }

watch(
  () => messages.value.map((m) => `${m.id}:${m.status}`).join('|'),
  async () => {
    // status 变化（如 STREAMING → SUCCESS）时，清理流式渲染定时器并重置计数器，
    // 然后立即做一次完整扫描，确保所有图表都已渲染（包括最后一个代码块）。
    if (diagramRenderTimer) { clearTimeout(diagramRenderTimer); diagramRenderTimer = null; }
    lastRenderedDiagramCount = 0;
    await nextTick();
    mountAllVisibleDiagrams();
  },
);

/* ---------- 显式「📊 图表」按钮：插入快捷模板 ---------- */

/** 图表类型下拉选项 */
const DIAGRAM_OPTIONS: { lang: DiagramLang; label: string }[] = [
  { lang: 'mermaid', label: '🌊 Mermaid 流程图/思维导图' },
  { lang: 'plantuml', label: '🌱 PlantUML 时序/类图' },
  { lang: 'dot', label: '🕸️ Graphviz 关系图' },
  { lang: 'flow', label: '🔀 Flowchart 流程图' },
  { lang: 'infographic', label: '📊 Infographic (ECharts)' },
];

/**
 * 用户点击「📊 图表」选某类后，在输入框前缀化一段 Prompt，
 * 引导 LLM 用对应 DSL 输出。已存在内容时拼到末尾，否则给一个示例兜底。
 */
function handleInsertDiagramPrompt(lang: DiagramLang) {
  const label = DIAGRAM_LABELS[lang];
  const prompt = t('ai.chat.diagramPrompt', { label, lang });
  const existing = inputContent.value.trim();
  if (existing) {
    inputContent.value = `${prompt}\n${existing}`;
  } else {
    // 空输入时直接给模板，让用户能立刻看到示例图表
    inputContent.value = `${prompt}\n（在这里描述你的需求；或直接发送以查看示例）\n\n参考模板：\n${DIAGRAM_TEMPLATES[lang]}`;
  }
}

/* ---------- 初始化 ---------- */
onMounted(async () => {
  await Promise.all([loadConversations(), loadModelConfigs(), loadAgents()]);
});

const _currentModelName = computed(() => {
  const model = modelConfigs.value.find((m) => m.id === selectedModelId.value);
  return model?.modelName ?? t('ai.chat.selectModelPlaceholder');
});
</script>

<template>
  <div class="ai-chat-container">
    <!-- 左侧对话列表 -->
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <el-button type="primary" :icon="Plus" class="new-chat-btn" @click="startNewChat">
          新建对话
        </el-button>
      </div>
      <el-scrollbar class="conversation-list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: conv.id === activeConversationId }"
          @click="selectConversation(conv)"
        >
          <el-icon class="conv-icon"><ChatDotRound /></el-icon>
          <span class="conv-title">{{ conv.title }}</span>
          <div class="conv-actions" @click.stop>
            <el-icon v-if="conv.pinned" class="pin-icon"><Top /></el-icon>
            <el-dropdown trigger="click" size="small">
              <el-icon class="more-icon"><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="handleTogglePin(conv)">
                    {{ conv.pinned ? t('ai.chat.unpin') : t('ai.chat.pin') }}
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleRename(conv)">{{ t('ai.chat.rename') }}</el-dropdown-item>
                  <el-dropdown-item @click="handleDeleteConversation(conv)" divided>
                    <span style="color: var(--el-color-danger)">{{ t('ai.chat.delete') }}</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <el-empty v-if="conversations.length === 0" :description="t('ai.chat.noConversation')" :image-size="60" />
      </el-scrollbar>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-main">
      <el-scrollbar ref="messageContainerRef" class="message-area">
        <div class="message-list">
          <el-empty v-if="messages.length === 0" :description="t('ai.chat.startNewChat')" :image-size="120" />
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="message-item"
            :class="msg.role.toLowerCase()"
            :data-msg-id="msg.id"
          >
            <div class="message-avatar">
              <el-avatar v-if="msg.role === 'USER'" :size="36" style="background: var(--el-color-primary)">
                {{ userStore.userInfo?.realName?.charAt(0) ?? 'U' }}
              </el-avatar>
              <el-avatar v-else :size="36" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
                AI
              </el-avatar>
            </div>
            <div class="message-body">
              <div v-if="msg.reasoningContent" class="reasoning-block">
                <div class="reasoning-label">💭 深度思考</div>
                <div class="reasoning-content markdown-body" v-html="renderMarkdown(msg.reasoningContent)" />
              </div>
              <div
                class="message-content"
                :class="{ 'markdown-body': msg.role === 'ASSISTANT' }"
                v-html="renderContent(msg)"
              />
              <div v-if="msg.modelCode && msg.role === 'ASSISTANT' && msg.status === 'SUCCESS'" class="message-meta">
                <span>{{ msg.modelCode }}</span>
                <span v-if="msg.tokenCount"> · {{ msg.tokenCount }} tokens</span>
              </div>
              <div v-if="msg.status === 'ERROR'" class="message-error">
                ⚠️ {{ msg.errorMsg ?? t('ai.chat.responseError') }}
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>

      <!-- 图表编辑弹窗（主应用组件树内，非 createApp 子应用） -->
      <DiagramEditor
        v-if="diagramEditorVisible"
        v-model:visible="diagramEditorVisible"
        :lang="diagramEditorLang"
        :source="diagramEditorSource"
        @save="handleDiagramEditorSave"
      />

      <!-- 图表全屏查看弹窗 -->
      <el-dialog
        v-model="diagramFullscreenVisible"
        :title="DIAGRAM_LABELS[diagramFullscreenLang]"
        fullscreen
        append-to-body
        @opened="onDiagramFullscreenOpened"
      >
        <template #header="{ titleId, titleClass }">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-right:24px;">
            <span :id="titleId" :class="titleClass">{{ DIAGRAM_LABELS[diagramFullscreenLang] }}</span>
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="color:#909399; font-size:13px; min-width:48px;">{{ Math.round(fullscreenTransform.scale * 100) }}%</span>
              <el-button size="small" @click="resetFsTransform">重置</el-button>
            </div>
          </div>
        </template>
        <div
          style="width:100%; height:calc(100vh - 120px); overflow:hidden; background:repeating-conic-gradient(#f5f5f5 0% 25%,#fff 0% 50%) 50%/24px 24px; position:relative; user-select:none;"
          @wheel.prevent="onFsWheel"
          @mousedown="onFsMouseDown"
          @mousemove="onFsMouseMove"
          @mouseup="onFsMouseUp"
          @mouseleave="onFsMouseUp"
        >
          <div
            style="position:absolute; top:50%; left:50%; transform-origin:center center;"
            :style="{ transform: `translate(${fullscreenTransform.x}px, ${fullscreenTransform.y}px) scale(${fullscreenTransform.scale})`, cursor: fullscreenDragging ? 'grabbing' : 'grab' }"
          >
            <div ref="fullscreenContainerRef" style="transform:translate(-50%,-50%); display:flex; justify-content:center;" />
          </div>
        </div>
      </el-dialog>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-toolbar">
          <el-select v-model="selectedModelId" :placeholder="t('ai.chat.selectModelPlaceholder')" size="small" style="width: 180px">
            <el-option
              v-for="model in modelConfigs"
              :key="model.id"
              :label="model.modelName"
              :value="model.id"
            />
          </el-select>
          <el-select
            v-model="selectedAgentId"
            :placeholder="t('ai.chat.selectAgentPlaceholder')"
            size="small"
            clearable
            style="width: 160px; margin-left: 8px"
          >
            <el-option v-for="agent in agents" :key="agent.id" :label="agent.agentName" :value="agent.id" />
          </el-select>
          <div class="toolbar-switches">
            <el-tooltip :content="t('ai.deepThinking')">
              <el-button
                :type="enableDeepThinking ? 'primary' : 'default'"
                :icon="MagicStick"
                size="small"
                circle
                @click="enableDeepThinking = !enableDeepThinking"
              />
            </el-tooltip>
            <el-tooltip :content="t('ai.webSearch')">
              <el-button
                :type="enableWebSearch ? 'primary' : 'default'"
                :icon="Connection"
                size="small"
                circle
                @click="enableWebSearch = !enableWebSearch"
              />
            </el-tooltip>
            <!-- 文生图：选择图表类型，向输入框注入 Prompt 前缀 + 模板 -->
            <el-dropdown trigger="click" @command="handleInsertDiagramPrompt">
              <el-tooltip :content="t('ai.chat.generateChart')">
                <el-button :icon="PictureFilled" size="small" circle />
              </el-tooltip>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="opt in DIAGRAM_OPTIONS"
                    :key="opt.lang"
                    :command="opt.lang"
                  >
                    {{ opt.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-tooltip :content="t('ai.chat.uploadImage')">
              <el-button :icon="Picture" size="small" circle />
            </el-tooltip>
          </div>
        </div>
        <div class="input-box">
          <el-input
            v-model="inputContent"
            type="textarea"
            :rows="3"
            :placeholder="t('ai.chat.enterToSend')"
            resize="none"
            @keydown="handleKeydown as any"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          />
          <el-button
            type="primary"
            class="send-btn"
            :loading="isStreaming"
            :disabled="!inputContent.trim()"
            @click="handleSend"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===================================================================
   AI Chat — Premium Visual Design
   基于项目 Design Tokens（variables.scss）系统化升级
   遵循 UI/UX Pro Max 设计规范
   =================================================================== */

/* ---------- 容器布局 ---------- */
.ai-chat-container {
  display: flex;
  height: calc(100vh - 120px);
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-light);
}

/* ---------- 侧边栏 ---------- */
.chat-sidebar {
  width: 280px;
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  position: relative;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.new-chat-btn {
  width: 100%;
  border-radius: var(--radius-lg) !important;
  background: var(--gradient-primary) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 500;
  letter-spacing: 0.3px;
  height: 40px;
  box-shadow: var(--shadow-primary);
  transition: all var(--transition-normal);
}
.new-chat-btn:hover {
  background: var(--gradient-primary-hover) !important;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}
.new-chat-btn:active {
  transform: translateY(0);
}

.conversation-list { flex: 1; }

.conversation-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin: 2px 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: 10px;
  border-radius: var(--radius-md);
  position: relative;
}

.conversation-item:hover {
  background: var(--color-primary-subtle);
}

.conversation-item.active {
  background: var(--color-primary-subtle);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.conversation-item.active .conv-title {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.conv-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}
.conversation-item:hover .conv-icon,
.conversation-item.active .conv-icon {
  color: var(--color-primary);
}

.conv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text-regular);
  transition: color var(--transition-fast);
}

.conv-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.conversation-item:hover .conv-actions { opacity: 1; }
.pin-icon { color: var(--color-warning); opacity: 1 !important; }
.more-icon {
  cursor: pointer;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}
.more-icon:hover { color: var(--color-primary); }

/* ---------- 聊天主区域 ---------- */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  position: relative;
}

.message-area {
  flex: 1;
  padding: 24px 24px 12px;
}

.message-list {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 24px;
}

/* ---------- 消息项 ---------- */
.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-item.user { flex-direction: row-reverse; }

.message-avatar {
  flex-shrink: 0;
}

.message-avatar :deep(.el-avatar) {
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--color-surface);
}

.message-item.assistant .message-avatar :deep(.el-avatar) {
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 600;
}

.message-body {
  max-width: 75%;
  min-width: 0;
}

.message-item.user .message-body { text-align: right; }

.message-content {
  padding: 14px 18px;
  border-radius: var(--radius-xl);
  line-height: 1.7;
  font-size: 14px;
  word-break: break-word;
  white-space: pre-wrap;
  position: relative;
}

/* 图表占位符内重置 white-space */
.message-content :deep(.diagram-placeholder) {
  white-space: normal;
}

/* 用户消息气泡 */
.message-item.user .message-content {
  background: var(--gradient-primary);
  color: #fff;
  border-bottom-right-radius: var(--radius-sm);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
}

/* AI 助手消息气泡 */
.message-item.assistant .message-content {
  background: var(--color-surface);
  color: var(--color-text);
  border-bottom-left-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
}

/* 深度思考区块 */
.reasoning-block {
  margin-bottom: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
  border-radius: var(--radius-lg);
  border-left: 3px solid var(--color-warning);
  font-size: 13px;
  color: #92400E;
  line-height: 1.6;
}

.reasoning-label {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-warning);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 消息元信息 */
.message-meta {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  display: flex;
  gap: 8px;
  align-items: center;
}

.message-item.user .message-meta {
  justify-content: flex-end;
}

.message-error {
  margin-top: 8px;
  color: var(--color-danger);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ---------- Markdown 渲染样式 ---------- */
.markdown-body :deep(.md-h1),
.markdown-body :deep(.md-h2),
.markdown-body :deep(.md-h3),
.markdown-body :deep(.md-h4) {
  margin: 16px 0 8px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

.markdown-body :deep(.md-h1) { font-size: 1.5em; }
.markdown-body :deep(.md-h2) { font-size: 1.3em; }
.markdown-body :deep(.md-h3) { font-size: 1.15em; }
.markdown-body :deep(.md-h4) { font-size: 1.05em; }

.markdown-body :deep(.md-p) { margin: 8px 0; line-height: 1.75; }
.markdown-body :deep(.md-ul),
.markdown-body :deep(.md-ol) { margin: 8px 0; padding-left: 24px; }
.markdown-body :deep(.md-li) { margin: 4px 0; line-height: 1.75; }

.markdown-body :deep(.md-quote) {
  margin: 12px 0;
  padding: 10px 16px;
  border-left: 3px solid var(--color-primary-light);
  background: var(--color-primary-subtle);
  color: var(--color-text-regular);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-style: italic;
}

.markdown-body :deep(.md-hr) {
  border: none;
  border-top: 1px solid var(--color-border-light);
  margin: 16px 0;
}

.markdown-body :deep(.md-link) {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition-fast);
}
.markdown-body :deep(.md-link:hover) {
  border-bottom-color: var(--color-primary);
}

.markdown-body :deep(.md-inline-code) {
  padding: 2px 7px;
  background: var(--color-primary-subtle);
  border-radius: var(--radius-sm);
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  font-size: 0.88em;
  color: var(--color-primary-dark);
  border: 1px solid var(--color-border-light);
}

.markdown-body :deep(.md-pre) {
  position: relative;
  margin: 12px 0;
  background: #1a1b26;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.markdown-body :deep(.md-code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #24253a;
  color: #7a7c9e;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  border-bottom: 1px solid #2e2f47;
}

.markdown-body :deep(.md-code) {
  display: block;
  padding: 14px 16px;
  color: #e2e4f0;
  font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
  overflow-x: auto;
}

.markdown-body :deep(.md-cursor) {
  display: inline-block;
  margin-left: 2px;
  color: var(--color-primary);
  animation: cursor-blink 1s infinite;
}

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

/* ---------- 思考中状态 ---------- */
.thinking {
  color: var(--color-text-muted);
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---------- 输入区域 ---------- */
.input-area {
  padding: 16px 24px 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--color-border-light);
  position: relative;
}

.input-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 8px;
}

.input-toolbar :deep(.el-select) {
  --el-select-border-color-hover: var(--color-primary-light);
}

.toolbar-switches {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.toolbar-switches :deep(.el-button) {
  transition: all var(--transition-fast);
}
.toolbar-switches :deep(.el-button:hover) {
  transform: scale(1.08);
}
.toolbar-switches :deep(.el-button.is-active),
.toolbar-switches :deep(.el-button--primary) {
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.input-box {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-box :deep(.el-textarea__inner) {
  border-radius: var(--radius-xl);
  padding: 12px 18px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  transition: all var(--transition-fast);
  font-size: 14px;
  line-height: 1.6;
  box-shadow: var(--shadow-sm);
}
.input-box :deep(.el-textarea__inner:focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}

.send-btn {
  height: 42px;
  border-radius: var(--radius-xl);
  padding: 0 28px;
  background: var(--gradient-primary) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 500;
  box-shadow: var(--shadow-primary);
  transition: all var(--transition-normal);
}
.send-btn:hover:not(:disabled) {
  background: var(--gradient-primary-hover) !important;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}
.send-btn:active {
  transform: translateY(0);
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* ---------- 空状态 ---------- */
.message-list :deep(.el-empty) {
  padding: 60px 0;
}
.message-list :deep(.el-empty__description p) {
  color: var(--color-text-muted);
  font-size: 14px;
}

.conversation-list :deep(.el-empty) {
  padding: 40px 0;
}
.conversation-list :deep(.el-empty__description p) {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* ---------- 滚动条美化 ---------- */
.conversation-list :deep(.el-scrollbar__thumb) {
  background: var(--color-border);
  border-radius: var(--radius-full);
}
.message-area :deep(.el-scrollbar__thumb) {
  background: var(--color-border);
  border-radius: var(--radius-full);
}
</style>
