<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  EditPen,
  Document,
  Lock,
  Odometer,
  CircleCheck,
  Check,
  ArrowDown,
  Open,
  StarFilled,
  Clock,
  Timer,
  Operation,
  Calendar,
  Brush,
  UploadFilled,
  Memo,
  Share,
  Sort,
  Connection,
  SetUp,
  Edit,
  User,
  OfficeBuilding,
  Key,
  Notebook,
  List,
  InfoFilled,
  Pointer,
  Reading,
  Tickets,
  ChromeFilled,
  Minus,
  PriceTag,
  Picture,
  FolderOpened,
  Files,
  Grid as GridIcon,
  DArrowRight,
  Postcard,
  DArrowLeft,
} from '@element-plus/icons-vue';
import { ElCollapse, ElCollapseItem, ElIcon } from 'element-plus';
import type { FormFieldType, FormFieldCategory, FormFieldTypeMeta } from '@/types/form';
import { FORM_FIELD_TYPE_META, FORM_FIELD_CATEGORY_LABELS } from '@/types/form';

const activeCategories = ref<string[]>(['basic', 'advanced', 'org', 'subform', 'auxiliary', 'layout']);

// 图标映射（key 对应 FORM_FIELD_TYPE_META 中的 icon 字段）
const iconMap: Record<string, any> = {
  EditPen,
  Document,
  Lock,
  Odometer,
  CircleCheck,
  Check,
  ArrowDown,
  Open,
  StarFilled,
  Clock,
  Timer,
  Operation,
  Calendar,
  Brush,
  UploadFilled,
  Memo,
  Share,
  Sort,
  Connection,
  SetUp,
  Edit,
  User,
  OfficeBuilding,
  Key,
  Notebook,
  List,
  InfoFilled,
  Pointer,
  Reading,
  Tickets,
  ChromeFilled,
  Minus,
  PriceTag,
  Picture,
  FolderOpened,
  Files,
  Grid: GridIcon,
  DArrowRight,
  Postcard,
  DArrowLeft,
};

// 按分类分组
const groupedFields = computed(() => {
  const groups: Record<FormFieldCategory, FormFieldTypeMeta[]> = {
    basic: [],
    advanced: [],
    org: [],
    subform: [],
    auxiliary: [],
    layout: [],
  };

  Object.values(FORM_FIELD_TYPE_META).forEach((meta) => {
    groups[meta.category].push(meta);
  });

  return groups;
});

// 拖拽开始
function onDragStart(event: DragEvent, meta: FormFieldTypeMeta) {
  event.dataTransfer?.setData(
    'application/json',
    JSON.stringify({ action: 'new', fieldType: meta.type })
  );
  event.dataTransfer!.effectAllowed = 'copy';
}

// 点击添加字段
function onClickField(meta: FormFieldTypeMeta) {
  emit('add-field', meta);
}

const emit = defineEmits<{
  'add-field': [meta: FormFieldTypeMeta];
}>();
</script>

<template>
  <div class="field-palette">
    <ElCollapse v-model="activeCategories">
      <ElCollapseItem
        v-for="(fields, category) in groupedFields"
        :key="category"
        :name="category"
        :title="FORM_FIELD_CATEGORY_LABELS[category]"
      >
        <div class="field-palette__list">
          <div
            v-for="meta in fields"
            :key="meta.type"
            class="field-palette__item"
            draggable="true"
            @dragstart="onDragStart($event, meta)"
            @click="onClickField(meta)"
          >
            <ElIcon class="field-palette__icon">
              <component :is="iconMap[meta.icon]" />
            </ElIcon>
            <span class="field-palette__label">{{ meta.label }}</span>
          </div>
        </div>
      </ElCollapseItem>
    </ElCollapse>
  </div>
</template>

<script lang="ts">
export default {
  name: 'FieldPalette',
};
</script>

<style scoped lang="scss">
.field-palette {
  height: 100%;
  overflow-y: auto;

  &__list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 8px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    cursor: grab;
    transition: all 0.2s ease;
    background-color: var(--el-fill-color-blank);

    &:hover {
      border-color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &:active {
      cursor: grabbing;
    }
  }

  &__icon {
    font-size: 20px;
    color: var(--el-text-color-regular);
    margin-bottom: 4px;
  }

  &__label {
    font-size: 12px;
    color: var(--el-text-color-primary);
    text-align: center;
  }
}
</style>
