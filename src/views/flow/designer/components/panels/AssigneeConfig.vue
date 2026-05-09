<!--
  审批人策略配置面板 —— APPROVE 节点专属。

  这里采用「strategy 选择 + 动态字段」的元数据驱动方式，新增策略时只需
  在 ASSIGNEE_STRATEGY_META 里加一行配置，不用改这个组件。这是相比 jnpf
  把 6 种策略硬编码成 6 个面板组件的一个明显改进。

  multiUser / multiRole / multiDept 三个 type 直接接到 smart-upms 的真实
  组织数据 —— 通过 use-org-resolvers.ts 的 ensureUsers/ensureRoles/
  ensureDepts 拉到完整列表后用 ElSelect 多选呈现。这避免了「在配置面板里
  让设计师手动输 user id」这种反人类操作。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  ElFormItem,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElInput,
} from 'element-plus';
import {
  ASSIGNEE_STRATEGIES,
  ASSIGNEE_STRATEGY_META,
  type AssigneeStrategy,
  type AssigneeStrategyField,
} from '@/types/flow';
import { useOrgResolvers, type OrgOption } from '@/composables/flow/use-org-resolvers';

interface Props {
  /** 当前策略 key */
  strategy?: AssigneeStrategy;
  /** 策略参数对象 */
  args?: Record<string, unknown>;
}

const props = withDefaults(defineProps<Props>(), {
  strategy: 'leader-of-starter',
  args: () => ({}),
});

const emit = defineEmits<{
  (e: 'update:strategy', v: AssigneeStrategy): void;
  (e: 'update:args', v: Record<string, unknown>): void;
}>();

const strategyMeta = computed(() => ASSIGNEE_STRATEGY_META[props.strategy]);

const { users, roles, depts, ensureUsers, ensureRoles, ensureDepts } = useOrgResolvers();

// 异步加载状态（仅做按钮 loading 提示，不阻塞 UI）
const loadingUsers = ref(false);
const loadingRoles = ref(false);
const loadingDepts = ref(false);

/**
 * 按需懒加载：根据传入的策略 meta 判断需要加载什么组织数据。
 * 显式接收 meta 参数，避免在 emit 后 props 尚未更新时读到旧值。
 */
const loadOrgDataForStrategy = async (meta: typeof strategyMeta.value) => {
  const types = new Set(meta.fields.map((f) => f.type));
  if (types.has('multiUser')) {
    loadingUsers.value = true;
    await ensureUsers().catch(() => {/* 错误已被 resolver 内部 reset，下次切换策略可重试 */});
    loadingUsers.value = false;
  }
  if (types.has('multiRole')) {
    loadingRoles.value = true;
    await ensureRoles().catch(() => {});
    loadingRoles.value = false;
  }
  if (types.has('multiDept')) {
    loadingDepts.value = true;
    await ensureDepts().catch(() => {});
    loadingDepts.value = false;
  }
};

onMounted(() => loadOrgDataForStrategy(strategyMeta.value));

const onStrategyChange = async (next: AssigneeStrategy) => {
  emit('update:strategy', next);
  // 切换策略时清空 args，避免「上一种策略的字段残留」
  emit('update:args', {});
  // 用新策略的 meta 立刻加载，不等 props 更新
  const nextMeta = ASSIGNEE_STRATEGY_META[next];
  await loadOrgDataForStrategy(nextMeta);
};

/**
 * 字段值的双向绑定 helper —— 把对单个字段的修改 patch 回完整 args 对象，
 * 然后整体 emit 出去。这样父组件只需 v-model:args 一个绑定。
 */
const patchField = (key: string, value: unknown) => {
  emit('update:args', { ...props.args, [key]: value });
};

const getFieldValue = (field: AssigneeStrategyField): unknown =>
  props.args[field.key];

/**
 * 把 args 里存的 number[] 转成 ElSelect 期望的 model-value 类型；
 * 不做这层归一化的话，初次回显时 ElSelect 会把字符串当成新选项追加。
 */
const asIdArray = (val: unknown): number[] =>
  Array.isArray(val) ? val.filter((v) => typeof v === 'number') : [];

/** 选择器数据源：根据 field.type 路由到对应的 ref。 */
const optionsOf = (field: AssigneeStrategyField): OrgOption[] => {
  if (field.type === 'multiUser') return users.value;
  if (field.type === 'multiRole') return roles.value;
  if (field.type === 'multiDept') return depts.value;
  return [];
};

const isLoading = (field: AssigneeStrategyField): boolean => {
  if (field.type === 'multiUser') return loadingUsers.value;
  if (field.type === 'multiRole') return loadingRoles.value;
  if (field.type === 'multiDept') return loadingDepts.value;
  return false;
};
</script>

<template>
  <div class="assignee-config">
    <ElFormItem label="审批人策略">
      <ElSelect
        :model-value="strategy"
        size="small"
        @update:model-value="onStrategyChange"
      >
        <ElOption
          v-for="key in ASSIGNEE_STRATEGIES"
          :key="key"
          :value="key"
          :label="ASSIGNEE_STRATEGY_META[key].label"
        />
      </ElSelect>
      <div class="assignee-config__hint">{{ strategyMeta.hint }}</div>
    </ElFormItem>

    <ElFormItem
      v-for="field in strategyMeta.fields"
      :key="field.key"
      :label="field.label"
      :required="field.required"
    >
      <!-- text -->
      <ElInput
        v-if="field.type === 'text'"
        :model-value="(getFieldValue(field) as string) ?? ''"
        size="small"
        :placeholder="field.placeholder"
        @update:model-value="(v: string) => patchField(field.key, v)"
      />

      <!-- number -->
      <ElInputNumber
        v-else-if="field.type === 'number'"
        :model-value="(getFieldValue(field) as number) ?? null"
        size="small"
        :min="1"
        :placeholder="field.placeholder"
        @update:model-value="(v: number | undefined) => patchField(field.key, v)"
      />

      <!-- select（如 includeChildren 这种枚举） -->
      <ElSelect
        v-else-if="field.type === 'select'"
        :model-value="(getFieldValue(field) as string) ?? ''"
        size="small"
        @update:model-value="(v: string) => patchField(field.key, v)"
      >
        <ElOption
          v-for="opt in field.options"
          :key="opt.value"
          :value="opt.value"
          :label="opt.label"
        />
      </ElSelect>

      <!--
        multiUser / multiRole / multiDept：统一走 ElSelect 多选 +
        filterable 远程搜索体验。这里数据已经在 ensureXxx() 里全量
        拉好缓存到 ref，本地搜索即可，秒级响应。
       -->
      <ElSelect
        v-else
        :model-value="asIdArray(getFieldValue(field))"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        :loading="isLoading(field)"
        size="small"
        :placeholder="field.placeholder ?? '请选择'"
        style="width: 100%"
        @update:model-value="(v: number[]) => patchField(field.key, v)"
      >
        <ElOption
          v-for="opt in optionsOf(field)"
          :key="opt.id"
          :value="opt.id"
          :label="opt.label"
        />
      </ElSelect>
    </ElFormItem>
  </div>
</template>

<style lang="scss" scoped>
.assignee-config {
  &__hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
  }
}
</style>
