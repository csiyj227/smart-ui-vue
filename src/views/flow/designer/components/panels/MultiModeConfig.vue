<!--
  会签模式配置：none / sequential / parallel + passRule + passRatio。
  由 PropertyPanel 在节点是 APPROVE 时挂出来。
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ElFormItem, ElSelect, ElOption, ElInputNumber } from 'element-plus';
import {
  MULTI_MODES,
  MULTI_MODE_LABEL,
  PASS_RULES,
  PASS_RULE_LABEL,
  type MultiMode,
  type PassRule,
} from '@/types/flow';

interface Props {
  multiMode?: MultiMode;
  passRule?: PassRule;
  passRatio?: number;
}

const props = withDefaults(defineProps<Props>(), {
  multiMode: 'none',
  passRule: 'all',
  passRatio: 0.5,
});

const emit = defineEmits<{
  (e: 'update:multiMode', v: MultiMode): void;
  (e: 'update:passRule', v: PassRule): void;
  (e: 'update:passRatio', v: number): void;
}>();

/** 单人审批就不需要展示通过规则；折叠掉减少视觉噪音 */
const showPassRule = computed(() => props.multiMode !== 'none');
const showRatio = computed(() => showPassRule.value && props.passRule === 'ratio');
</script>

<template>
  <div class="multi-mode-config">
    <ElFormItem label="审批模式">
      <ElSelect
        :model-value="multiMode"
        size="small"
        @update:model-value="(v: MultiMode) => emit('update:multiMode', v)"
      >
        <ElOption
          v-for="m in MULTI_MODES"
          :key="m"
          :value="m"
          :label="MULTI_MODE_LABEL[m]"
        />
      </ElSelect>
    </ElFormItem>

    <ElFormItem v-if="showPassRule" label="通过规则">
      <ElSelect
        :model-value="passRule"
        size="small"
        @update:model-value="(v: PassRule) => emit('update:passRule', v)"
      >
        <ElOption
          v-for="r in PASS_RULES"
          :key="r"
          :value="r"
          :label="PASS_RULE_LABEL[r]"
        />
      </ElSelect>
    </ElFormItem>

    <ElFormItem v-if="showRatio" label="通过比例">
      <ElInputNumber
        :model-value="passRatio"
        :min="0.01"
        :max="1"
        :step="0.05"
        :precision="2"
        size="small"
        @update:model-value="(v: number | undefined) => emit('update:passRatio', v ?? 0.5)"
      />
    </ElFormItem>
  </div>
</template>
