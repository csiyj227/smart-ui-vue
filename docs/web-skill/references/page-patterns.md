# 页面编写规范

## 标准 CRUD 页面结构

```vue
<template>
  <div class="page-container">
    <!-- 搜索工具栏 -->
    <div class="toolbar">
      <div class="toolbar__left">
        <el-input v-model="query.keyword" placeholder="关键词" clearable />
        <el-button type="primary" @click="fetchData">搜索</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </div>
      <div class="toolbar__right">
        <el-button v-permission="['xxx_add']" type="primary" @click="handleAdd">新增</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table v-loading="loading" :data="tableData" border>
      <el-table-column prop="id" label="ID" width="70" />
      <!-- 更多列 -->
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <el-button v-permission="['xxx_edit']" type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button v-permission="['xxx_del']" type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="page.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="fetchData"
        @size-change="fetchData"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <!-- 表单字段 -->
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getXxxPage, createXxx, updateXxx, deleteXxx } from '@/api/xxx'
import type { XxxEntity } from '@/types/api'

const query = reactive({ keyword: '' })
const page = reactive({ current: 1, size: 10, total: 0 })
const loading = ref(false)
const tableData = ref<XxxEntity[]>([])

const dialogVisible = ref(false)
const dialogTitle = ref('')
const submitting = ref(false)
const form = reactive<Partial<XxxEntity>>({})

async function fetchData() {
  loading.value = true
  try {
    const { data } = await getXxxPage({ ...query, current: page.current, size: page.size })
    tableData.value = data.data.records
    page.total = data.data.total
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchData())
</script>

<style lang="scss" scoped>
.page-container { /* 页面级样式 */ }
</style>
```

## 编码规范

- 使用 `<script setup lang="ts">`，禁止 Options API
- Props 使用 `defineProps<T>()` 带类型，Emits 使用 `defineEmits<T>()`
- 组件文件名 PascalCase，样式 `<style lang="scss" scoped>`
- 操作按钮加 `v-permission`，删除用 `ElMessageBox.confirm` 二次确认
- 表格加 `v-loading`，分页默认 `layout="total, sizes, prev, pager, next, jumper"`

## 新增页面步骤

1. 在 `src/views/` 下新建页面目录和 `.vue` 文件
2. 在 `src/api/` 下新增 API 文件
3. 在 `src/types/api.ts` 中补充类型定义
4. 在 `src/router/index.ts` 添加路由（或通过后端菜单配置动态路由）
5. 在后端 `sys_menu` 表中插入菜单和按钮权限数据
