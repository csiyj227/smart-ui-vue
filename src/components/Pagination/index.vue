<template>
  <div class="pagination-wrapper">
    <el-pagination
      v-model:current-page="current"
      v-model:page-size="size"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      background
      @current-change="handleChange"
      @size-change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
const current = defineModel<number>('current', { required: true })
const size = defineModel<number>('size', { required: true })

const props = defineProps<{
  total: number
}>()

const emit = defineEmits<{
  change: []
}>()

function handleChange() {
  emit('change')
}
</script>

<style lang="scss" scoped>
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0;

  :deep(.el-pagination) {
    color: var(--color-text-regular);

    .el-pagination__total {
      color: var(--color-text-regular);
    }

    .btn-prev,
    .btn-next {
      color: var(--color-text-regular);
    }

    .el-pager li {
      color: var(--color-text-regular);

      &.is-active {
        color: var(--color-primary);
      }
    }

    .el-pagination__sizes .el-input {
      .el-input__wrapper {
        border-color: var(--color-border);
      }
    }

    .el-pagination__jump {
      color: var(--color-text-regular);
    }
  }
}
</style>