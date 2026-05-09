<!--
  边的条件表达式编辑器 —— 当选中一条边时挂出来。

  Flowable 条件表达式是 ${...} 包裹的 EL 表达式。这里给两种输入模式：
    1. 「简单」：常用变量 + 运算符的下拉拼接（90% 场景够用，零学习成本）；
    2. 「高级」：直接写完整表达式，给会写 SpEL/EL 的开发者用。

  目前先实现「高级」模式 —— 「简单」模式是 P2 优化项，等用户反馈再做。
  这一选择是为了避免在还不知道表单字段全集的时候过度设计「下拉变量列表」。
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ElFormItem, ElInput, ElInputNumber, ElTag, ElLink } from 'element-plus';

interface Props {
  condition?: string;
  priority?: number;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  condition: '',
  priority: undefined,
  label: '',
});

const emit = defineEmits<{
  (e: 'update:condition', v: string): void;
  (e: 'update:priority', v: number | undefined): void;
  (e: 'update:label', v: string): void;
}>();

/**
 * 给设计师快捷插入的常见模板。点击就把表达式追加到当前内容末尾，
 * 让设计师可以「拼装 + 微调」而不是「从零开始」。
 */
const SNIPPETS: { label: string; value: string }[] = [
  { label: '审批通过', value: '${approved}' },
  { label: '审批驳回', value: '${!approved}' },
  { label: '金额 > 1万', value: '${formData.amount > 10000}' },
  { label: '部门是研发', value: "${formData.deptName == '研发'}" },
];

const insert = (snippet: string) => {
  const next = props.condition ? `${props.condition} && ${snippet}` : snippet;
  emit('update:condition', next);
};

/** 简单的语法预校验：必须以 ${ 开头，} 结尾 —— 给个 hint 但不强制 */
const syntaxHint = computed(() => {
  if (!props.condition) return '';
  const trimmed = props.condition.trim();
  if (!trimmed.startsWith('${') || !trimmed.endsWith('}')) {
    return '提示：Flowable 条件表达式应当以 ${} 包裹';
  }
  return '';
});
</script>

<template>
  <div class="branch-condition-editor">
    <ElFormItem label="边名称">
      <ElInput
        :model-value="label"
        size="small"
        placeholder="例如：通过 / 驳回"
        @update:model-value="(v: string) => emit('update:label', v)"
      />
    </ElFormItem>

    <ElFormItem label="条件表达式">
      <ElInput
        :model-value="condition"
        type="textarea"
        size="small"
        :rows="2"
        placeholder="${approved} —— 留空表示无条件分支（默认）"
        @update:model-value="(v: string) => emit('update:condition', v)"
      />
      <div v-if="syntaxHint" class="branch-condition-editor__hint is-warning">
        {{ syntaxHint }}
      </div>

      <div class="branch-condition-editor__snippets">
        <span class="branch-condition-editor__snippets-title">常用：</span>
        <ElLink
          v-for="s in SNIPPETS"
          :key="s.value"
          type="primary"
          :underline="false"
          @click="insert(s.value)"
        >
          <ElTag size="small" type="info" effect="plain">{{ s.label }}</ElTag>
        </ElLink>
      </div>
    </ElFormItem>

    <ElFormItem label="优先级">
      <ElInputNumber
        :model-value="priority"
        :min="0"
        :max="999"
        size="small"
        controls-position="right"
        @update:model-value="(v: number | undefined) => emit('update:priority', v)"
      />
      <div class="branch-condition-editor__hint">
        数字越小越先匹配；条件分支节点根据优先级评估出边
      </div>
    </ElFormItem>
  </div>
</template>

<style lang="scss" scoped>
.branch-condition-editor {
  &__hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;

    &.is-warning {
      color: var(--el-color-warning);
    }
  }

  &__snippets {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  &__snippets-title {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
