<!--
  模拟运行预览对话框 —— 设计师不发布也能「走一遍流程」看每个节点的
  审批人解析结果是否符合预期。

  设计定位（明确边界，避免被误用）：
    本对话框做的是「**纯前端结构预演**」，不调后端，不污染数据库；
    它回答的是「我这张图的拓扑结构 + 每个节点配置的策略 / 参数 / 渠道
    在 BFS 全路径上看起来是什么样」这个问题，**不**回答「具体某用户
    在生产环境会被分配到哪个任务」。

  对于设计师而言这正好对应了发布前最常问的两件事：
    1. 「这张图能从开始走到结束吗？有没有断头节点？」—— BFS 走查直接
       暴露不可达节点；
    2. 「每个 APPROVE 节点我配的策略/参数文字描述对不对？」—— 把策略
       渲染成人话比单看属性面板里的 JSON 更直观。

  「具体审批人是谁」这种需要查 upms 的问题，准确答案只能在真正发布并
  发起一次实例后由后端 AssigneeResolver 给出。前端永远不会去重新实现
  一份「半正确」的解析，避免造成「设计器说会分配给 A，实际却分配给 B」
  的信任崩塌 —— 这条原则比「让对话框看起来更智能」更重要。
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElButton,
  ElTimeline,
  ElTimelineItem,
  ElTag,
  ElAlert,
} from 'element-plus';
import {
  ASSIGNEE_STRATEGY_META,
  type AssigneeStrategy,
  type FlowChartDsl,
  type FlowNodeDsl,
} from '@/types/flow';

interface Props {
  modelValue: boolean;
  dsl: FlowChartDsl;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const starterId = ref<number>(1);
const formDataText = ref<string>('{\n  "amount": 5000\n}');

interface TraceItem {
  nodeKey: string;
  label?: string;
  kind: string;
  description: string;
  predicted?: string;
}

const trace = ref<TraceItem[]>([]);
const errorMsg = ref<string>('');

const adjacency = computed(() => {
  const map = new Map<string, string[]>();
  for (const e of props.dsl.edges) {
    if (!map.has(e.from)) map.set(e.from, []);
    map.get(e.from)!.push(e.to);
  }
  return map;
});

const nodeMap = computed(() => new Map(props.dsl.nodes.map((n) => [n.key, n])));

/**
 * 把审批人策略翻译成「人话描述」。
 *
 * 这里**故意**只做「描述」而不做「预测」—— 真正的解析必须由后端
 * AssigneeResolver 在真实运行时完成（要查 upms / 算上下级关系 / 跑 SpEL）。
 * 前端做出的任何「预测」结果都是不可信的，反而会误导设计师。所以输出
 * 文案统一是「会按 XX 策略，从 YY 数据源解析」这种描述性句式，绝不
 * 出现「会分配给用户 1」这类断言。
 *
 * 这是个**设计决定**，不是「待实现的简化版」—— 即使后端将来开放
 * /flow/simulation/preview 接口，本对话框也会直接调那个接口拿真实结果，
 * 而不是在前端补一份本地解析。
 */
function describeAssigneeStrategy(
  node: FlowNodeDsl,
  formData: Record<string, unknown>,
  starter: number,
): string {
  const strategy = (node.properties?.assigneeStrategy as AssigneeStrategy) ?? '';
  const args = (node.properties?.assigneeArgs as Record<string, unknown>) ?? {};
  const meta = ASSIGNEE_STRATEGY_META[strategy];
  if (!meta) return '⚠ 未配置审批人策略 — 此节点会卡住';

  switch (strategy) {
    case 'user-fixed': {
      const ids = (args.userIds as number[] | undefined) ?? [];
      return ids.length > 0
        ? `按【指定用户】策略，候选人 = 用户 [${ids.join(', ')}]`
        : '⚠ 已选指定用户策略但 userIds 为空';
    }
    case 'role': {
      const ids = (args.roleIds as number[] | undefined) ?? [];
      return ids.length > 0
        ? `按【角色】策略，候选人 = 拥有角色 [${ids.join(', ')}] 的所有用户`
        : '⚠ 已选角色策略但 roleIds 为空';
    }
    case 'dept': {
      const ids = (args.deptIds as number[] | undefined) ?? [];
      const include = String(args.includeChildren ?? 'false') === 'true';
      return ids.length > 0
        ? `按【部门】策略，候选人 = 部门 [${ids.join(', ')}] ${include ? '含下级' : '不含下级'} 的成员`
        : '⚠ 已选部门策略但 deptIds 为空';
    }
    case 'leader-of-starter': {
      const level = Number(args.level ?? 1);
      return `按【发起人上级】策略，候选人 = 发起人 (模拟 id=${starter}) 沿组织架构上溯 ${level} 级的上级`;
    }
    case 'form-field': {
      const field = String(args.field ?? '');
      if (!field) return '⚠ 已选表单字段策略但未填字段名';
      const val = formData[field];
      return val === undefined
        ? `按【表单字段】策略，从字段 [${field}] 取值 — 当前模拟表单中该字段不存在`
        : `按【表单字段】策略，候选人 = 字段 [${field}] 当前模拟值 ${JSON.stringify(val)}`;
    }
    case 'spel': {
      const expr = String(args.expression ?? '');
      return expr
        ? `按【SpEL】策略，候选人由表达式决定 — 前端不解析，准确结果以发布后真实运行为准`
        : '⚠ 已选 SpEL 策略但表达式为空';
    }
    default:
      return '未知策略';
  }
}

const run = () => {
  trace.value = [];
  errorMsg.value = '';

  let formData: Record<string, unknown>;
  try {
    formData = JSON.parse(formDataText.value);
  } catch (e: unknown) {
    errorMsg.value = `表单数据 JSON 解析失败: ${(e as Error).message}`;
    return;
  }

  const start = props.dsl.nodes.find((n) => n.kind === 'START');
  if (!start) {
    errorMsg.value = '没有 START 节点，无法模拟';
    return;
  }

  // BFS 全路径走查 —— 不模拟 BRANCH 条件评估，直接把所有出边都展开。
  // 这样设计师能看到「所有可能到达的节点」，发现孤岛/死循环。
  // BRANCH 条件的「具体走哪一条」由真实运行决定，前端不做近似。
  const visited = new Set<string>();
  const queue: string[] = [start.key];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);
    const node = nodeMap.value.get(key);
    if (!node) continue;

    let description = '';
    let predicted: string | undefined;
    switch (node.kind) {
      case 'START':
        description = `流程启动，发起人 id=${starterId.value}`;
        break;
      case 'END':
        description = '流程结束';
        break;
      case 'APPROVE':
        description = '人工审批';
        predicted = describeAssigneeStrategy(node, formData, starterId.value);
        break;
      case 'NOTIFY':
        description = `通知抄送 (${(node.properties?.channels as string[])?.join('/') ?? '默认'})`;
        break;
      case 'SCRIPT':
        description = `调用 Bean: ${node.properties?.handlerName ?? '?'}`;
        break;
      case 'BRANCH':
        description = '条件分支：根据出边条件评估';
        break;
      case 'PARALLEL':
        description = '并行分支：所有出边同时执行';
        break;
      case 'JOINT':
        description = '并行汇聚：等待所有入边';
        break;
    }

    trace.value.push({
      nodeKey: node.key,
      label: node.label,
      kind: node.kind,
      description,
      predicted,
    });

    for (const next of adjacency.value.get(key) ?? []) queue.push(next);
  }
};
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    title="模拟运行 (结构预演)"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <ElAlert
      type="info"
      :closable="false"
      title="本预演只校验流程拓扑结构和节点配置完整性。具体审批人由发布后的后端 AssigneeResolver 实时解析，不在本预演范围。"
      style="margin-bottom: 12px"
    />

    <ElForm label-position="top" size="small">
      <ElFormItem label="模拟发起人 (用户 ID)">
        <ElInputNumber v-model="starterId" :min="1" />
      </ElFormItem>
      <ElFormItem label="模拟表单数据 (JSON)">
        <ElInput v-model="formDataText" type="textarea" :rows="4" />
      </ElFormItem>
    </ElForm>

    <ElButton type="primary" @click="run">开始预演</ElButton>

    <ElAlert
      v-if="errorMsg"
      type="error"
      :title="errorMsg"
      :closable="false"
      style="margin-top: 12px"
    />

    <ElTimeline v-if="trace.length > 0" style="margin-top: 16px">
      <ElTimelineItem
        v-for="(item, idx) in trace"
        :key="idx"
        :hollow="item.kind !== 'APPROVE'"
        placement="top"
      >
        <div class="simulation-item">
          <ElTag size="small" effect="plain">{{ item.kind }}</ElTag>
          <strong style="margin-left: 6px">{{ item.label || item.nodeKey }}</strong>
          <div class="simulation-item__desc">{{ item.description }}</div>
          <div v-if="item.predicted" class="simulation-item__predicted">
            审批人解析 → {{ item.predicted }}
          </div>
        </div>
      </ElTimelineItem>
    </ElTimeline>
  </ElDialog>
</template>

<style lang="scss" scoped>
.simulation-item {
  &__desc {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }
  &__predicted {
    font-size: 13px;
    color: var(--el-color-primary);
    margin-top: 4px;
  }
}
</style>
