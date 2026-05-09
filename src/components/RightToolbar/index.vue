<template>
  <div class="right-toolbar">
    <div class="right-toolbar__left">
      <slot />
    </div>
    <div class="right-toolbar__right">
      <el-tooltip content="Search" placement="top">
        <el-button :icon="Search" circle size="small" @click="toggleSearch" />
      </el-tooltip>

      <el-popover placement="bottom" :width="200" trigger="click">
        <template #reference>
          <el-tooltip content="Column settings" placement="top">
            <el-button :icon="Setting" circle size="small" />
          </el-tooltip>
        </template>
        <div class="right-toolbar__column-list">
          <el-checkbox
            v-for="(col, index) in innerColumns"
            :key="col.prop"
            v-model="innerColumns[index].visible"
            :label="col.label"
            @change="handleColumnChange"
          />
        </div>
      </el-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, Setting } from '@element-plus/icons-vue'

export interface ToolbarColumn {
  prop: string
  label: string
  visible?: boolean
}

const props = defineProps<{
  columns: ToolbarColumn[]
  showSearch?: boolean
}>()

const emit = defineEmits<{
  'update:columns': [columns: ToolbarColumn[]]
  'update:showSearch': [value: boolean]
}>()

const innerColumns = ref<ToolbarColumn[]>([])

watch(
  () => props.columns,
  (val) => {
    innerColumns.value = val.map((col) => ({ ...col, visible: col.visible !== false }))
  },
  { immediate: true, deep: true }
)

function handleColumnChange() {
  emit('update:columns', innerColumns.value.map((col) => ({ ...col })))
}

function toggleSearch() {
  emit('update:showSearch', !props.showSearch)
}
</script>

<style lang="scss" scoped>
.right-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-button.is-circle) {
      border-color: var(--color-border);
      color: var(--color-text-regular);

      &:hover {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }
    }
  }

  &__column-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-checkbox {
      margin-right: 0;
    }
  }
}
</style>