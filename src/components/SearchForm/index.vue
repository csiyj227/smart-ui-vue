<template>
  <el-form :model="modelValue" inline class="search-form">
    <el-row :gutter="16" class="search-form__row">
      <template v-for="(col, index) in visibleColumns" :key="col.prop">
        <el-col :span="6">
          <el-form-item :label="col.label" :prop="col.prop">
            <el-input
              v-if="col.type === 'input' || !col.type"
              v-model="modelValue[col.prop]"
              :placeholder="col.placeholder || `Please enter ${col.label}`"
              clearable
              @keyup.enter="handleSearch"
            />
            <el-select
              v-else-if="col.type === 'select'"
              v-model="modelValue[col.prop]"
              :placeholder="col.placeholder || `Please select ${col.label}`"
              clearable
            >
              <el-option
                v-for="opt in col.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-date-picker
              v-else-if="col.type === 'date'"
              v-model="modelValue[col.prop]"
              :placeholder="col.placeholder || `Please select ${col.label}`"
              clearable
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
            <el-date-picker
              v-else-if="col.type === 'daterange'"
              v-model="modelValue[col.prop]"
              type="daterange"
              range-separator="-"
              start-placeholder="Start date"
              end-placeholder="End date"
              clearable
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </template>

      <el-col :span="6" class="search-form__actions">
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            Search
          </el-button>
          <el-button @click="handleReset">
            Reset
          </el-button>
          <el-button
            v-if="columns.length > 3"
            link
            type="primary"
            @click="toggleExpand"
          >
            {{ expanded ? 'Collapse' : 'Expand' }}
            <el-icon class="search-form__expand-icon" :class="{ 'is-expanded': expanded }">
              <ArrowDown />
            </el-icon>
          </el-button>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

export interface SearchColumn {
  prop: string
  label: string
  type?: 'input' | 'select' | 'date' | 'daterange'
  options?: Array<{ label: string; value: any }>
  placeholder?: string
}

const props = defineProps<{
  modelValue: Record<string, any>
  columns: SearchColumn[]
}>()

const emit = defineEmits<{
  search: []
  reset: []
}>()

const expanded = ref(false)

const visibleColumns = computed(() => {
  if (expanded.value || props.columns.length <= 3) {
    return props.columns
  }
  return props.columns.slice(0, 3)
})

function toggleExpand() {
  expanded.value = !expanded.value
}

function handleSearch() {
  emit('search')
}

function handleReset() {
  Object.keys(props.modelValue).forEach((key) => {
    props.modelValue[key] = undefined
  })
  emit('reset')
}
</script>

<style lang="scss" scoped>
.search-form {
  padding: 18px 16px 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);

  :deep(.el-form-item) {
    margin-bottom: 18px;
    width: 100%;
  }

  :deep(.el-form-item__label) {
    color: var(--color-text-regular);
  }

  :deep(.el-input),
  :deep(.el-select) {
    width: 100%;
  }

  &__row {
    width: 100%;
  }

  &__actions {
    display: flex;
    align-items: center;

    :deep(.el-form-item__content) {
      flex-wrap: nowrap;
    }
  }

  &__expand-icon {
    transition: transform var(--transition-normal);

    &.is-expanded {
      transform: rotate(180deg);
    }
  }
}
</style>