<!--
  顶部工具栏：
    左：返回 + chart 名称
    中：撤销/重做 + 自动布局 + 校验
    右：JSON 预览 + 模拟运行 + 版本对比 + 保存草稿 + 发布
-->
<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import {
  ElButton,
  ElButtonGroup,
  ElTooltip,
  ElTag,
  ElIcon,
  ElInput,
} from 'element-plus';
import {
  Back,
  RefreshLeft,
  RefreshRight,
  Document,
  VideoPlay,
  DocumentChecked,
  Connection,
  Promotion,
  Edit,
} from '@element-plus/icons-vue';

interface Props {
  chartName: string;
  status?: 'NEW' | 'DRAFT' | 'PUBLISHED';
  canUndo: boolean;
  canRedo: boolean;
  saving?: boolean;
  publishing?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  status: 'NEW',
  saving: false,
  publishing: false,
});

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'auto-layout'): void;
  (e: 'validate'): void;
  (e: 'preview-json'): void;
  (e: 'simulate'): void;
  (e: 'compare-versions'): void;
  (e: 'save'): void;
  (e: 'publish'): void;
  (e: 'update:chartName', name: string): void;
}>();

const statusMeta = {
  NEW: { type: 'info' as const, text: '未保存' },
  DRAFT: { type: 'warning' as const, text: '草稿' },
  PUBLISHED: { type: 'success' as const, text: '已发布' },
};

const editingName = ref(false);
const nameInput = ref(props.chartName || '');
const nameInputRef = ref<InstanceType<typeof ElInput> | null>(null);

watch(() => props.chartName, (v) => { nameInput.value = v || ''; });

async function startEditName() {
  nameInput.value = props.chartName || '';
  editingName.value = true;
  await nextTick();
  nameInputRef.value?.focus();
}

function confirmName() {
  editingName.value = false;
  const trimmed = nameInput.value.trim();
  if (trimmed && trimmed !== props.chartName) {
    emit('update:chartName', trimmed);
  }
}
</script>

<template>
  <header class="designer-toolbar">
    <div class="designer-toolbar__left">
      <ElButton :icon="Back" link @click="emit('back')">返回</ElButton>
      <ElInput
        v-if="editingName"
        ref="nameInputRef"
        v-model="nameInput"
        size="small"
        class="designer-toolbar__name-input"
        placeholder="请输入流程名称"
        @blur="confirmName"
        @keyup.enter="confirmName"
      />
      <span v-else class="designer-toolbar__title" @click="startEditName">
        {{ chartName || '未命名流程' }}
        <ElIcon class="designer-toolbar__edit-icon"><Edit /></ElIcon>
      </span>
      <ElTag :type="statusMeta[status].type" size="small" round>
        {{ statusMeta[status].text }}
      </ElTag>
    </div>

    <div class="designer-toolbar__center">
      <ElButtonGroup>
        <ElTooltip content="撤销 (Ctrl+Z)">
          <ElButton :icon="RefreshLeft" :disabled="!canUndo" size="small" @click="emit('undo')" />
        </ElTooltip>
        <ElTooltip content="重做 (Ctrl+Shift+Z)">
          <ElButton :icon="RefreshRight" :disabled="!canRedo" size="small" @click="emit('redo')" />
        </ElTooltip>
      </ElButtonGroup>
      <ElButton :icon="Connection" size="small" @click="emit('auto-layout')">整理布局</ElButton>
      <ElButton :icon="DocumentChecked" size="small" @click="emit('validate')">校验</ElButton>
    </div>

    <div class="designer-toolbar__right">
      <ElButton :icon="Document" size="small" @click="emit('preview-json')">JSON</ElButton>
      <ElButton :icon="VideoPlay" size="small" @click="emit('simulate')">模拟运行</ElButton>
      <ElButton size="small" @click="emit('compare-versions')">版本对比</ElButton>
      <ElButton type="primary" size="small" :loading="saving" @click="emit('save')">
        保存草稿
      </ElButton>
      <ElButton type="success" size="small" :icon="Promotion" :loading="publishing" @click="emit('publish')">
        发布
      </ElButton>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.designer-toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  &__edit-icon {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    opacity: 0;
    transition: opacity 0.2s;

    .designer-toolbar__title:hover & {
      opacity: 1;
    }
  }

  &__name-input {
    width: 240px;
  }

  &__center,
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__right {
    justify-self: end;
  }
}
</style>
