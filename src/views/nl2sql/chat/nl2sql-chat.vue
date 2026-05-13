
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Delete,
  Promotion,
  EditPen,
  PieChart,
  TrendCharts,
  Histogram,
  Grid,
  Loading,
  ChatDotRound,
  MagicStick,
  Document,
  DataAnalysis,
  Star,
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import {
  pageDataSets,
  pageSessions,
  createSession,
  deleteSession,
  renameSession,
  listSessionMessages,
  sendQuestionStream,
  editAndRerun,
  switchChart,
  parseJsonField,
  getSuggestions,
} from '@/api/nl2sql';
import type {
  Nl2sqlDataset,
  Nl2sqlSession,
  Nl2SqlChatVO,
  ChartRecommendConfig,
  ChartType,
} from '@/types/nl2sql';
import {
  registerEchartsTheme,
  CHATBI_THEME_NAME,
  AREA_GRADIENTS,
  CHATBI_COLORS,
} from '@/utils/echarts-theme';

registerEchartsTheme(echarts as any);

/* =============================================================================
 * 数据集 + 会话列表
 * ============================================================================= */
const datasets = ref<Nl2sqlDataset[]>([]);
const selectedDatasetId = ref<number>();
const sessions = ref<Nl2sqlSession[]>([]);
const currentSessionId = ref<number | null>(null);

async function loadDatasets() {
  const res = await pageDataSets(1, 200);
  datasets.value = res?.records ?? [];
  if (!selectedDatasetId.value && datasets.value.length > 0) {
    selectedDatasetId.value = datasets.value[0].id;
  }
}

async function loadSessions() {
  if (!selectedDatasetId.value) {
    sessions.value = [];
    return;
  }
  const res = await pageSessions(1, 50, selectedDatasetId.value);
  sessions.value = res?.records ?? [];
}

async function selectSession(s: Nl2sqlSession) {
  currentSessionId.value = s.id;
  await loadMessages();
}

async function newSession() {
  if (!selectedDatasetId.value) {
    ElMessage.warning(t('nl2sql.chat.selectDatasetFirst'));
    return;
  }
  const id = await createSession({ datasetId: selectedDatasetId.value, title: t('nl2sql.chat.newSessionTitle') });
  await loadSessions();
  currentSessionId.value = id;
  messages.value = [];
}

async function handleRename(s: Nl2sqlSession) {
  try {
    const { value } = await ElMessageBox.prompt(t('nl2sql.chat.renamePrompt'), t('nl2sql.chat.renameTitle'), {
      inputValue: s.title ?? '',
    });
    await renameSession(s.id, value);
    ElMessage.success(t('nl2sql.chat.renameSuccess'));
    await loadSessions();
  } catch { /* cancelled */ }
}

async function handleDeleteSession(s: Nl2sqlSession) {
  await ElMessageBox.confirm(t('nl2sql.chat.deleteConfirm', { title: s.title || s.id }), t('common.tip'), { type: 'warning' });
  await deleteSession(s.id);
  if (currentSessionId.value === s.id) {
    currentSessionId.value = null;
    messages.value = [];
  }
  await loadSessions();
}

watch(selectedDatasetId, async () => {
  currentSessionId.value = null;
  messages.value = [];
  await loadSessions();
  // 切换数据集时异步加载推荐问题
  loadSuggestions();
});

/* =============================================================================
 * 消息流
 * ============================================================================= */
type ChatItem = Nl2SqlChatVO & {
  role?: 'user' | 'assistant';
  stageHint?: string;
};

const messages = ref<ChatItem[]>([]);
const messageContainer = ref<HTMLDivElement | null>(null);
const sending = ref(false);
const input = ref('');

async function loadMessages() {
  if (!currentSessionId.value) return;
  const list = await listSessionMessages(currentSessionId.value);
  messages.value = list.map((m) => ({ ...m, role: (m.type as 'user' | 'assistant') ?? 'assistant' }));
  await scrollToBottom();
  await renderAllCharts();
}

async function scrollToBottom() {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
}

const stageLabels = computed<Record<string, string>>(() => ({
  prompt_built: t('nl2sql.chat.stagePromptBuilt'),
  sql_generated: t('nl2sql.chat.stageSqlGenerated'),
  sql_executed: t('nl2sql.chat.stageSqlExecuted'),
  analyzed: t('nl2sql.chat.stageAnalyzed'),
  chart_recommended: t('nl2sql.chat.stageChartRecommended'),
  insight_generated: t('nl2sql.chat.stageInsightGenerated'),
}));

const streamAbort = ref<AbortController | null>(null);

async function sendMessage() {
  const question = input.value.trim();
  if (!question) return;
  if (!selectedDatasetId.value) {
    ElMessage.warning(t('nl2sql.chat.selectDatasetFirst'));
    return;
  }

  messages.value.push({ role: 'user', content: question, type: 'user' });

  // 累积态：SSE 每个事件增量合并到这个对象上
  let accumulated: ChatItem = {
    role: 'assistant',
    type: 'assistant',
    content: '',
    stageHint: t('nl2sql.chat.preparing'),
  } as ChatItem;
  // 先 push 一份初始占位，记住它在数组中的索引
  messages.value.push({ ...accumulated });
  const placeholderIndex = messages.value.length - 1;

  await scrollToBottom();
  input.value = '';
  sending.value = true;

  streamAbort.value?.abort();
  const ctrl = new AbortController();
  streamAbort.value = ctrl;

  /**
   * 把 accumulated 的最新快照写回数组，触发 Vue 响应式更新。
   * fetch ReadableStream 的回调不在 Vue 微任务范围内，
   * Object.assign 修改同一对象引用时 Vue 无法检测变更，
   * 必须用 splice 替换为新对象才能触发视图刷新。
   */
  function flushToView() {
    messages.value.splice(placeholderIndex, 1, { ...accumulated });
  }

  try {
    let chartRendered = false;
    await sendQuestionStream(
      {
        sessionId: currentSessionId.value ?? undefined,
        datasetId: selectedDatasetId.value,
        question,
      },
      (event, payload) => {
        // 增量合并到累积对象
        accumulated = {
          ...accumulated,
          sessionId: payload.sessionId ?? accumulated.sessionId,
          messageId: payload.messageId ?? accumulated.messageId,
          sql: payload.sql ?? accumulated.sql,
          queryResult: payload.rows ? JSON.stringify(payload.rows) : accumulated.queryResult,
          resultCount: payload.rowCount ?? accumulated.resultCount,
          executionTime: payload.executionTime ?? accumulated.executionTime,
          chartType: payload.chartType ?? accumulated.chartType,
          chartConfig: payload.chartConfig ?? accumulated.chartConfig,
          dimensions: payload.dimensions ?? accumulated.dimensions,
          measures: payload.measures ?? accumulated.measures,
          dataInsight: payload.dataInsight ?? accumulated.dataInsight,
          errorMessage: payload.errorMessage ?? accumulated.errorMessage,
          stageHint: stageLabels.value[event] ?? accumulated.stageHint,
        };

        if (event === 'session' && payload.sessionId && !currentSessionId.value) {
          currentSessionId.value = payload.sessionId;
          loadSessions();
        }

        if (event === 'done') accumulated.stageHint = undefined;
        if (event === 'failed' || event === 'error') {
          accumulated.stageHint = undefined;
          accumulated.errorMessage =
            payload.errorMessage ?? (payload.message as string) ?? t('nl2sql.chat.executeFailed');
        }

        // 立即刷新到视图，让用户看到每个阶段的实时渲染
        flushToView();

        // chart_recommended / done 阶段尝试渲染图表
        if (
          !chartRendered &&
          (event === 'chart_recommended' || event === 'done') &&
          accumulated.chartType &&
          accumulated.chartType !== 'table' &&
          accumulated.queryResult
        ) {
          chartRendered = true;
          nextTick(() => renderChart(messages.value[placeholderIndex]));
        }

        scrollToBottom();
      },
      ctrl.signal,
    );
  } catch (e: unknown) {
    if ((e as DOMException)?.name === 'AbortError') {
      /* user cancelled */
    } else {
      console.error(e);
      accumulated.errorMessage = (e as Error)?.message ?? t('nl2sql.chat.requestFailed');
      accumulated.stageHint = undefined;
      flushToView();
    }
  } finally {
    sending.value = false;
    streamAbort.value = null;
  }
}

/* =============================================================================
 * SQL 编辑 / 图表切换
 * ============================================================================= */
const sqlEditing = ref<{ messageId: number; sql: string } | null>(null);

function openSqlEditor(item: ChatItem) {
  if (!item.messageId) return;
  sqlEditing.value = { messageId: item.messageId, sql: item.sql ?? '' };
}

async function applySqlEdit() {
  if (!sqlEditing.value) return;
  const { messageId, sql } = sqlEditing.value;
  if (!sql.trim()) {
    ElMessage.warning(t('nl2sql.chat.sqlEmptyWarning'));
    return;
  }
  const updated = await editAndRerun(messageId, sql);
  const idx = messages.value.findIndex((m) => m.messageId === messageId);
  if (idx >= 0) {
    messages.value.splice(idx, 1, { ...updated, role: 'assistant' });
  }
  sqlEditing.value = null;
  ElMessage.success(t('nl2sql.chat.rerunSuccess'));
  await renderAllCharts();
}

async function changeChart(item: ChatItem, chartType: ChartType) {
  if (!item.messageId) return;
  const updated = await switchChart(item.messageId, chartType);
  const idx = messages.value.findIndex((m) => m.messageId === item.messageId);
  if (idx >= 0) {
    messages.value.splice(idx, 1, { ...updated, role: 'assistant' });
  }
  await renderAllCharts();
}

/* =============================================================================
 * 渲染辅助：表格 + ECharts
 * ============================================================================= */
interface ParsedRows {
  columns: string[];
  rows: Record<string, unknown>[];
}

function parseRows(item: ChatItem): ParsedRows {
  const rows = parseJsonField<Record<string, unknown>[]>(item.queryResult, []);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

const chartInstances = new Map<number, echarts.ECharts>();

async function renderAllCharts() {
  await nextTick();
  for (const m of messages.value) {
    if (m.messageId && m.chartType && m.chartType !== 'table') {
      renderChart(m);
    }
  }
}

function renderChart(item: ChatItem) {
  if (!item.messageId) return;
  const dom = document.getElementById(`chart-${item.messageId}`);
  if (!dom) {
    requestAnimationFrame(() => renderChart(item));
    return;
  }
  if (dom.clientWidth === 0 || dom.clientHeight === 0) {
    requestAnimationFrame(() => renderChart(item));
    return;
  }
  const { rows, columns } = parseRows(item);
  if (rows.length === 0) return;

  const prev = chartInstances.get(item.messageId);
  if (prev) prev.dispose();

  const inst = echarts.init(dom, CHATBI_THEME_NAME);
  const cfg = parseJsonField<ChartRecommendConfig>(item.chartConfig, {});

  const xField = cfg.xAxisField || columns[0];
  const yFields =
    cfg.yAxisFields && cfg.yAxisFields.length > 0 ? cfg.yAxisFields : columns.slice(1);
  const categories = rows.map((r) => String(r[xField] ?? ''));

  let option: echarts.EChartsOption;
  switch (item.chartType) {
    case 'pie': {
      const valueField = cfg.valueField || yFields[0] || columns[1] || columns[0];
      const nameField = cfg.groupField || xField;
      const pieData = rows.map((r) => ({
        name: String(r[nameField] ?? ''),
        value: Number(r[valueField] ?? 0),
      }));
      option = {
        title: cfg.title ? { text: cfg.title, left: 'center', top: 8 } : undefined,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 4, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
        series: [
          {
            type: 'pie',
            radius: ['44%', '70%'],
            center: ['50%', '46%'],
            avoidLabelOverlap: true,
            label: {
              show: true,
              formatter: '{b|{b}}\n{d|{d}%}',
              rich: {
                b: { fontSize: 12, color: '#E2E8F0', lineHeight: 18 },
                d: { fontSize: 11, color: '#94A3B8' },
              },
            },
            data: pieData,
          },
        ],
      };
      break;
    }
    case 'line':
      option = {
        title: cfg.title ? { text: cfg.title, left: 'center', top: 8 } : undefined,
        tooltip: { trigger: 'axis' },
        legend: { bottom: 4, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
        grid: { left: 48, right: 24, bottom: 56, top: cfg.title ? 56 : 36 },
        xAxis: { type: 'category', boundaryGap: false, data: categories },
        yAxis: { type: 'value' },
        series: yFields.map((f, i) => ({
          name: f,
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 2.5,
            shadowBlur: 12,
            shadowColor: CHATBI_COLORS[i % CHATBI_COLORS.length] + '66',
            shadowOffsetY: 4,
          },
          areaStyle: { color: AREA_GRADIENTS[i % AREA_GRADIENTS.length] },
          data: rows.map((r) => Number(r[f] ?? 0)),
        })),
      };
      break;
    case 'bar':
    default:
      option = {
        title: cfg.title ? { text: cfg.title, left: 'center', top: 8 } : undefined,
        tooltip: { trigger: 'axis' },
        legend: { bottom: 4, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
        grid: { left: 48, right: 24, bottom: 56, top: cfg.title ? 56 : 36 },
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: yFields.map((f, i) => ({
          name: f,
          type: 'bar' as const,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHATBI_COLORS[i % CHATBI_COLORS.length] },
                { offset: 1, color: CHATBI_COLORS[i % CHATBI_COLORS.length] + '55' },
              ],
            },
            borderRadius: [6, 6, 0, 0],
          },
          barMaxWidth: 36,
          data: rows.map((r) => Number(r[f] ?? 0)),
        })),
      };
  }

  inst.setOption(option);
  chartInstances.set(item.messageId, inst);
  requestAnimationFrame(() => inst.resize());
}

window.addEventListener('resize', () => {
  chartInstances.forEach((c) => c.resize());
});

const CHART_BUTTONS: { type: ChartType; icon: typeof Grid; label: string }[] = [
  { type: 'table', icon: Grid, label: t('nl2sql.chat.chartTable') },
  { type: 'bar', icon: Histogram, label: t('nl2sql.chat.chartBar') },
  { type: 'line', icon: TrendCharts, label: t('nl2sql.chat.chartLine') },
  { type: 'pie', icon: PieChart, label: t('nl2sql.chat.chartPie') },
];

/** 动态推荐问题：根据数据集 AI 生成，后端缓存 10 分钟 */
const suggestions = ref<string[]>([]);
const suggestionsLoading = ref(false);

async function loadSuggestions() {
  if (!selectedDatasetId.value) {
    suggestions.value = [];
    return;
  }
  suggestionsLoading.value = true;
  try {
    const result = await getSuggestions(selectedDatasetId.value);
    suggestions.value = result ?? [];
  } catch (e) {
    console.warn(t('nl2sql.chat.loadSuggestionsFailed'), e);
    suggestions.value = [];
  } finally {
    suggestionsLoading.value = false;
  }
}

function useSuggestion(q: string) {
  input.value = q;
}

const currentDatasetName = computed(
  () => datasets.value.find((d) => d.id === selectedDatasetId.value)?.name ?? '',
);

onMounted(async () => {
  await loadDatasets();
  await loadSessions();
  // 初始化时如果已选中数据集，加载推荐问题
  loadSuggestions();
});
</script>

<template>
  <div class="chatbi-shell">
    <!-- 装饰性背景 -->
    <div class="bg-decor" aria-hidden="true">
      <div class="bg-glow bg-glow-1"></div>
      <div class="bg-glow bg-glow-2"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="chatbi-layout">
      <!-- ============== 左侧 sidebar ============== -->
      <aside class="side glass">
        <div class="side-header">
          <div class="brand">
            <div class="brand-logo">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div class="brand-info">
              <div class="brand-title">ChatBI</div>
              <div class="brand-subtitle">{{ t('nl2sql.chat.brandSubtitle') }}</div>
            </div>
          </div>

          <el-select
            v-model="selectedDatasetId"
            :placeholder="t('nl2sql.chat.selectDatasetPlaceholder')"
            filterable
            class="dataset-select"
          >
            <el-option v-for="d in datasets" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>

          <button class="new-session-btn" :disabled="!selectedDatasetId" @click="newSession">
            <el-icon><Plus /></el-icon>
            <span>{{ t('nl2sql.chat.newSessionBtn') }}</span>
          </button>
        </div>

        <div class="session-list">
          <div class="session-list-title">
            <span>{{ t('nl2sql.chat.sessionListTitle') }}</span>
            <span class="session-count">{{ sessions.length }}</span>
          </div>
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            :class="{ active: currentSessionId === s.id }"
            @click="selectSession(s)"
          >
            <div class="session-icon">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div class="session-title">{{ s.title || t('nl2sql.chat.noTitle') }}</div>
            <div class="session-actions">
              <el-button link size="small" @click.stop="handleRename(s)">
                <el-icon><EditPen /></el-icon>
              </el-button>
              <el-button link size="small" @click.stop="handleDeleteSession(s)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <div v-if="sessions.length === 0" class="empty-tip">{{ t('nl2sql.chat.noSessions') }}</div>
        </div>
      </aside>

      <!-- ============== 右侧主区 ============== -->
      <main class="main glass">
        <header class="main-header">
          <div class="main-header-left">
            <span class="dot dot-online"></span>
            <span class="header-label">{{ t('nl2sql.chat.headerLabel') }}</span>
            <template v-if="currentDatasetName">
              <span class="header-divider">/</span>
              <span class="header-dataset">{{ currentDatasetName }}</span>
            </template>
          </div>
          <div class="main-header-right">
            <span v-if="sending" class="thinking-badge">
              <span class="thinking-dot"></span>
              <span class="thinking-dot"></span>
              <span class="thinking-dot"></span>
            </span>
            <span class="badge">{{ t('nl2sql.chat.sseBadge') }}</span>
          </div>
        </header>

        <div ref="messageContainer" class="messages">
          <!-- 空状态欢迎页 -->
          <div v-if="messages.length === 0" class="welcome">
            <div class="welcome-glow"></div>
            <div class="welcome-icon">
              <el-icon :size="40"><MagicStick /></el-icon>
            </div>
            <h2 class="welcome-title">{{ t('nl2sql.chat.welcomeTitle') }}</h2>
            <p class="welcome-desc">
              {{ t('nl2sql.chat.welcomeDesc') }}
            </p>
            <div class="welcome-suggestions">
              <template v-if="suggestionsLoading">
                <div class="suggestion-loading">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>{{ t('nl2sql.chat.suggestionsLoading') }}</span>
                </div>
              </template>
              <template v-else-if="suggestions.length > 0">
                <button
                  v-for="(q, i) in suggestions"
                  :key="i"
                  class="suggestion-chip"
                  @click="useSuggestion(q)"
                >
                  <el-icon><Promotion /></el-icon>
                  <span>{{ q }}</span>
                </button>
              </template>
              <div v-else-if="selectedDatasetId" class="suggestion-empty">
                {{ t('nl2sql.chat.suggestionEmptyWithDataset') }}
              </div>
              <div v-else class="suggestion-empty">
                {{ t('nl2sql.chat.selectDatasetFirst') }}
              </div>
            </div>
          </div>

          <!-- 消息列表 -->
          <div v-for="(m, idx) in messages" :key="idx" class="msg" :class="m.role">
            <!-- 用户气泡 -->
            <template v-if="m.role === 'user'">
              <div class="avatar avatar-user">U</div>
              <div class="bubble user-bubble">{{ m.content }}</div>
            </template>

            <!-- 助手回答 -->
            <template v-else>
              <div class="avatar avatar-bot">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <div class="bubble assistant-bubble">
                <!-- 阶段进度提示 -->
                <div v-if="m.stageHint" class="stage-hint">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>{{ m.stageHint }}</span>
                </div>

                <!-- 错误 -->
                <div v-if="m.errorMessage" class="err-card">
                  <span class="err-icon">!</span>
                  <span>{{ m.errorMessage }}</span>
                </div>

                <!-- SQL 卡片 -->
                <section v-if="m.sql" class="card sql-card">
                  <div class="card-header">
                    <div class="card-badge sql-badge">SQL</div>
                    <span class="card-title">{{ t('nl2sql.chat.sqlCardTitle') }}</span>
                    <button class="card-action" @click="openSqlEditor(m)">
                      <el-icon><EditPen /></el-icon>
                      <span>{{ t('nl2sql.chat.editAndRerun') }}</span>
                    </button>
                  </div>
                  <pre class="sql-box"><code>{{ m.sql }}</code></pre>
                  <div class="sql-meta">
                    <span class="meta-pill">
                      <el-icon><Grid /></el-icon>
                      {{ t('nl2sql.chat.rowCount', { count: m.resultCount ?? 0 }) }}
                    </span>
                    <span class="meta-pill">
                      <el-icon><DataAnalysis /></el-icon>
                      {{ t('nl2sql.chat.executionTime', { time: m.executionTime ?? 0 }) }}
                    </span>
                  </div>
                </section>

                <!-- 查询结果：表格 / 图表 -->
                <section v-if="m.queryResult" class="card chart-card">
                  <div class="card-header">
                    <div class="card-badge chart-badge">
                      <el-icon><Histogram /></el-icon>
                    </div>
                    <span class="card-title">{{ t('nl2sql.chat.queryResultTitle') }}</span>
                    <div class="chart-switcher">
                      <button
                        v-for="b in CHART_BUTTONS"
                        :key="b.type"
                        class="switch-btn"
                        :class="{ active: (m.chartType || 'table') === b.type }"
                        @click="changeChart(m, b.type)"
                      >
                        <el-icon><component :is="b.icon" /></el-icon>
                        <span>{{ b.label }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- 表格 -->
                  <div v-if="!m.chartType || m.chartType === 'table'" class="table-wrapper">
                    <el-table
                      :data="parseRows(m).rows"
                      stripe
                      max-height="360"
                      size="small"
                      class="dark-table"
                    >
                      <el-table-column
                        v-for="col in parseRows(m).columns"
                        :key="col"
                        :prop="col"
                        :label="col"
                        min-width="120"
                      />
                    </el-table>
                  </div>

                  <!-- 图表 -->
                  <div v-else class="chart-wrapper">
                    <div :id="`chart-${m.messageId}`" class="chart-box"></div>
                  </div>
                </section>

                <!-- 数据洞察卡片 -->
                <section v-if="m.dataInsight" class="card insight-card">
                  <div class="card-header">
                    <div class="card-badge insight-badge">AI</div>
                    <span class="card-title">{{ t('nl2sql.chat.insightTitle') }}</span>
                  </div>
                  <div class="insight-text">{{ m.dataInsight }}</div>
                </section>
              </div>
            </template>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="input-area">
          <div class="input-wrap" :class="{ disabled: !selectedDatasetId }">
            <el-input
              v-model="input"
              type="textarea"
              :rows="2"
              :autosize="{ minRows: 2, maxRows: 6 }"
              resize="none"
              :placeholder="selectedDatasetId ? t('nl2sql.chat.inputPlaceholder') : t('nl2sql.chat.selectDatasetFirst')"
              :disabled="!selectedDatasetId || sending"
              class="input-textarea"
              @keydown.enter.exact.prevent
              @keydown.ctrl.enter="sendMessage"
              @keydown.meta.enter="sendMessage"
            />
            <button
              class="send-btn"
              :disabled="!selectedDatasetId || !input.trim() || sending"
              @click="sendMessage"
            >
              <el-icon v-if="!sending"><Promotion /></el-icon>
              <el-icon v-else class="is-rotating"><Loading /></el-icon>
            </button>
          </div>
          <div class="input-tip">{{ t('nl2sql.chat.inputTip') }}</div>
        </div>
      </main>
    </div>

    <!-- SQL 编辑弹窗 -->
    <el-dialog
      :model-value="!!sqlEditing"
      :title="t('nl2sql.chat.editSqlDialogTitle')"
      width="720px"
      :close-on-click-modal="false"
      class="sql-dialog"
      @update:model-value="(v: boolean) => { if (!v) sqlEditing = null }"
    >
      <el-input
        v-if="sqlEditing"
        v-model="sqlEditing.sql"
        type="textarea"
        :rows="12"
        style="font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"
      />
      <template #footer>
        <el-button @click="sqlEditing = null">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="applySqlEdit">{{ t('nl2sql.chat.execute') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* =============================================================================
 * ChatBI 暗色科技风
 *   深空蓝紫渐变底色 + 径向高光 + 细网格 + Glassmorphism 毛玻璃面板
 *   主色 indigo-400 (#818CF8) / cyan-400 (#22D3EE) / pink-400 (#F472B6)
 * ============================================================================= */
.chatbi-shell {
  position: relative;
  height: calc(100vh - 100px);
  background: radial-gradient(ellipse at top left, #1E1B4B 0%, #0F172A 45%, #020617 100%);
  border-radius: 16px;
  overflow: hidden;
  isolation: isolate;
  color: #E2E8F0;
}

/* ---------- 装饰背景 ---------- */
.bg-decor {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}
.bg-glow-1 {
  width: 520px;
  height: 520px;
  top: -120px;
  left: -100px;
  background: radial-gradient(circle, #6366F1 0%, transparent 70%);
}
.bg-glow-2 {
  width: 420px;
  height: 420px;
  bottom: -120px;
  right: -80px;
  background: radial-gradient(circle, #06B6D4 0%, transparent 70%);
  opacity: 0.25;
}
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}

.chatbi-layout {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  gap: 16px;
  padding: 16px;
}

/* ---------- 玻璃面板 ---------- */
.glass {
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 14px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* ============================================================================
 * 左侧 sidebar
 * ============================================================================ */
.side {
  width: 280px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.side-header {
  padding: 18px 16px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #6366F1, #06B6D4);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
  font-size: 20px;
  color: white;
}
.brand-title {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #E0E7FF, #67E8F9);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.5px;
}
.brand-subtitle {
  font-size: 11px;
  color: #94A3B8;
  margin-top: 2px;
  letter-spacing: 0.3px;
}

.dataset-select { width: 100%; }
:deep(.dataset-select .el-input__wrapper) {
  background: rgba(15, 23, 42, 0.6);
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.18) inset;
  border-radius: 8px;
}
:deep(.dataset-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.5) inset;
}
:deep(.dataset-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #6366F1 inset, 0 0 0 4px rgba(99, 102, 241, 0.18);
}
:deep(.dataset-select .el-input__inner) { color: #E2E8F0; }

.new-session-btn {
  margin-top: 12px;
  width: 100%;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
}
.new-session-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.5);
}
.new-session-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}
.session-list::-webkit-scrollbar { width: 6px; }
.session-list::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 3px;
}
.session-list-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px 10px;
  font-size: 11px;
  color: #64748B;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.session-count {
  background: rgba(99, 102, 241, 0.15);
  color: #818CF8;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 10px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}
.session-item:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.18);
}
.session-item.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(6, 182, 212, 0.1));
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}
.session-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: rgba(99, 102, 241, 0.15);
  display: grid;
  place-items: center;
  color: #A5B4FC;
  font-size: 13px;
  flex-shrink: 0;
}
.session-item.active .session-icon {
  background: linear-gradient(135deg, #6366F1, #06B6D4);
  color: white;
}
.session-title {
  flex: 1;
  font-size: 13px;
  color: #CBD5E1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-item.active .session-title {
  color: white;
  font-weight: 500;
}
.session-actions {
  display: none;
  gap: 2px;
}
.session-item:hover .session-actions { display: flex; }
:deep(.session-actions .el-button) { color: #94A3B8 !important; }
:deep(.session-actions .el-button:hover) { color: #F472B6 !important; }

.empty-tip {
  padding: 24px 12px;
  text-align: center;
  color: #64748B;
  font-size: 12px;
  line-height: 1.7;
}

/* ============================================================================
 * 右侧主区
 * ============================================================================ */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 22px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.main-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-online {
  background: #34D399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.18);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.18); }
  50%      { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0.05); }
}
.header-label {
  color: #E2E8F0;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.header-divider { color: #64748B; }
.header-dataset {
  color: #818CF8;
  font-weight: 500;
}

.main-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.thinking-badge {
  display: inline-flex;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(129, 140, 248, 0.15);
  border-radius: 12px;
}
.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #818CF8;
  animation: thinking 1.4s ease-in-out infinite;
}
.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes thinking {
  0%, 60%, 100% { transform: scale(0.8); opacity: 0.5; }
  30% { transform: scale(1.2); opacity: 1; }
}
.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(99, 102, 241, 0.18));
  color: #67E8F9;
  border: 1px solid rgba(6, 182, 212, 0.3);
  letter-spacing: 0.3px;
}

/* ---------- 消息流 ---------- */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scroll-behavior: smooth;
}
.messages::-webkit-scrollbar { width: 8px; }
.messages::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.18);
  border-radius: 4px;
}
.messages::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.3); }

/* ---------- 欢迎页 ---------- */
.welcome {
  margin: auto;
  text-align: center;
  max-width: 600px;
  padding: 40px 20px;
  position: relative;
  animation: fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.welcome-glow {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 200px;
  background: radial-gradient(ellipse, rgba(129, 140, 248, 0.25) 0%, transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}
.welcome-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  color: white;
  background: linear-gradient(135deg, #6366F1, #06B6D4);
  box-shadow: 0 12px 32px rgba(99, 102, 241, 0.45);
  position: relative;
  z-index: 1;
}
.welcome-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #E0E7FF, #67E8F9);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 10px;
  position: relative;
  z-index: 1;
}
.welcome-desc {
  color: #94A3B8;
  font-size: 14px;
  max-width: 420px;
  line-height: 1.6;
  margin: 0 auto 28px;
  position: relative;
  z-index: 1;
}
.welcome-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 580px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}
.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #C7D2FE;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.suggestion-chip:hover:not(:disabled) {
  border-color: #818CF8;
  color: #E2E8F0;
  background: rgba(129, 140, 248, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(129, 140, 248, 0.2);
}
.suggestion-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.suggestion-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #818CF8;
  font-size: 13px;
  padding: 12px 0;
}
.suggestion-loading .el-icon { font-size: 16px; }
.suggestion-empty {
  color: #64748B;
  font-size: 13px;
  padding: 12px 0;
}

/* ---------- 消息行 ---------- */
.msg {
  display: flex;
  gap: 12px;
  animation: msg-in 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.msg.user { flex-direction: row-reverse; }

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
}
.avatar-user {
  background: linear-gradient(135deg, #F472B6, #FBBF24);
  color: white;
  box-shadow: 0 4px 12px rgba(244, 114, 182, 0.4);
}
.avatar-bot {
  background: linear-gradient(135deg, #6366F1, #06B6D4);
  color: white;
  font-size: 16px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.bubble {
  max-width: calc(100% - 50px);
  line-height: 1.6;
  word-break: break-word;
}
.user-bubble {
  padding: 12px 16px;
  border-radius: 14px 14px 4px 14px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: white;
  white-space: pre-wrap;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
  max-width: 70%;
}
.assistant-bubble {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* ---------- 阶段进度 ---------- */
.stage-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(129, 140, 248, 0.1);
  border: 1px solid rgba(129, 140, 248, 0.3);
  border-radius: 20px;
  font-size: 12px;
  color: #818CF8;
  align-self: flex-start;
}

/* ---------- 错误 ---------- */
.err-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #FCA5A5;
  font-size: 13px;
}
.err-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.25);
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* ---------- 通用卡片 ---------- */
.card {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  padding: 14px 18px;
  backdrop-filter: blur(10px);
  transition: border-color 0.3s;
}
.card:hover { border-color: rgba(99, 102, 241, 0.3); }

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
}
.sql-badge {
  background: rgba(34, 211, 238, 0.15);
  color: #22D3EE;
  letter-spacing: 0.5px;
}
.chart-badge {
  background: rgba(129, 140, 248, 0.15);
  color: #818CF8;
}
.insight-badge {
  background: rgba(244, 114, 182, 0.15);
  color: #F472B6;
  letter-spacing: 0.5px;
}
.card-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #E2E8F0;
  letter-spacing: 0.3px;
}
.card-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #818CF8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.card-action:hover {
  background: rgba(129, 140, 248, 0.15);
  border-color: #818CF8;
}

/* SQL 卡片 */
.sql-box {
  background: rgba(2, 6, 23, 0.6);
  color: #E2E8F0;
  padding: 14px 16px;
  border-radius: 8px;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  line-height: 1.6;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  border: 1px solid rgba(34, 211, 238, 0.15);
}
.sql-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(99, 102, 241, 0.15);
}
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #94A3B8;
}
.meta-pill .el-icon { color: #22D3EE; font-size: 13px; }

/* 图表切换 */
.chart-switcher {
  display: inline-flex;
  background: rgba(2, 6, 23, 0.5);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 11px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748B;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.switch-btn:hover { color: #E2E8F0; }
.switch-btn.active {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff;
  box-shadow: 0 2px 8px rgba(129, 140, 248, 0.4);
}

/* 图表容器 */
.chart-wrapper {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.5), rgba(2, 6, 23, 0.7));
  border-radius: 10px;
  padding: 8px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  overflow: hidden;
}
.chart-box {
  width: 100%;
  height: 340px;
}

/* 暗色表格 */
.table-wrapper {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.12);
}
:deep(.dark-table) {
  background: rgba(2, 6, 23, 0.5);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-border-color: rgba(99, 102, 241, 0.1);
  --el-table-header-bg-color: rgba(15, 23, 42, 0.6);
  --el-table-header-text-color: #E2E8F0;
  --el-table-text-color: #94A3B8;
  --el-table-row-hover-bg-color: rgba(129, 140, 248, 0.08);
}
:deep(.dark-table th.el-table__cell) {
  background: rgba(15, 23, 42, 0.6) !important;
  color: #E2E8F0 !important;
  font-weight: 600;
}
:deep(.dark-table tr) { background: transparent !important; }
:deep(.dark-table .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background: rgba(129, 140, 248, 0.04) !important;
}

/* 数据洞察卡片 */
.insight-card {
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.08), rgba(192, 132, 252, 0.05));
  border-color: rgba(244, 114, 182, 0.25);
}
.insight-text {
  color: #E2E8F0;
  font-size: 14px;
  line-height: 1.75;
  padding: 4px 0;
}

/* ============================================================================
 * 输入区
 * ============================================================================ */
.input-area {
  padding: 16px 22px 18px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}
.input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: rgba(2, 6, 23, 0.6);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 16px;
  padding: 8px 8px 8px 16px;
  transition: all 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}
.input-wrap:focus-within {
  border-color: #818CF8;
  box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.12), 0 0 20px rgba(129, 140, 248, 0.15);
}
.input-wrap.disabled { opacity: 0.5; }

:deep(.input-textarea .el-textarea__inner) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #E2E8F0 !important;
  -webkit-text-fill-color: #E2E8F0 !important;
  padding: 8px 0;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  caret-color: #818CF8;
}
:deep(.input-textarea .el-textarea__inner::placeholder) {
  color: #64748B !important;
  -webkit-text-fill-color: #64748B !important;
}

/* 确保 Element Plus 全局输入框在暗色主题下文字可见 */
:deep(.el-input__inner),
:deep(.el-textarea__inner) {
  color: #E2E8F0 !important;
  -webkit-text-fill-color: #E2E8F0 !important;
}
:deep(.el-input__inner::placeholder),
:deep(.el-textarea__inner::placeholder) {
  color: #64748B !important;
  -webkit-text-fill-color: #64748B !important;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  transition: all 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(129, 140, 248, 0.4);
}
.send-btn:hover:not(:disabled) {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 6px 20px rgba(129, 140, 248, 0.6);
}
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.is-rotating { animation: rotate 1s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }

.input-tip {
  margin-top: 8px;
  font-size: 11px;
  color: #64748B;
  text-align: right;
  padding-right: 8px;
}

/* ============================================================================
 * SQL 编辑弹窗
 * ============================================================================ */
:deep(.sql-dialog .el-dialog) {
  background: #1E293B;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
:deep(.sql-dialog .el-dialog__header) { color: #E2E8F0; }
:deep(.sql-dialog .el-dialog__title) { color: #E2E8F0; }
:deep(.sql-dialog .el-textarea__inner) {
  background: #0F172A;
  color: #E2E8F0;
  border-color: rgba(99, 102, 241, 0.3);
}
</style>
