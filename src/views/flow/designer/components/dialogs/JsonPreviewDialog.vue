<!--
  DSL JSON 预览对话框 —— 给设计师 / 后端排查问题用。

  为什么不直接放在右侧抽屉里？
    - 设计师 90% 时间不需要看原始 JSON，让它常驻会浪费屏幕；
    - 排查问题时 JSON 通常需要拷贝到 Postman / 编辑器再处理，对话框
      模式更贴合「打开 → 查看 → 复制 → 关闭」的工作流。
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ElDialog, ElButton, ElMessage } from 'element-plus';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import type { FlowChartDsl } from '@/types/flow';

interface Props {
  modelValue: boolean;
  dsl: FlowChartDsl;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const formatted = computed(() => JSON.stringify(props.dsl, null, 2));

const onCopy = async () => {
  try {
    await navigator.clipboard.writeText(formatted.value);
    ElMessage.success('JSON 已复制到剪贴板');
  } catch {
    ElMessage.error('复制失败，请手动选中复制');
  }
};
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    title="DSL JSON 预览"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="json-preview">
      <VueJsonPretty :data="dsl" :deep="3" :show-line-number="true" />
    </div>
    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">关闭</ElButton>
      <ElButton type="primary" @click="onCopy">复制 JSON</ElButton>
    </template>
  </ElDialog>
</template>

<style lang="scss" scoped>
.json-preview {
  max-height: 60vh;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
