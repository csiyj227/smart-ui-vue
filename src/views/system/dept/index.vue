<template>
  <div>
    <el-card>
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between">
        <div>
          <el-button type="default" plain @click="toggleExpand">
            {{ isExpandAll ? t('system.dept.collapseAll') : t('system.dept.expandAll') }}
          </el-button>
        </div>
        <el-button type="primary" @click="handleAdd()">{{ t('system.dept.addRootDept') }}</el-button>
      </div>

      <el-table
        v-if="refreshTable"
        :data="deptTree"
        v-loading="loading"
        row-key="deptId"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="isExpandAll"
        border
      >
        <el-table-column prop="deptName" :label="t('system.dept.deptName')" min-width="200" />
        <el-table-column prop="sortOrder" :label="t('system.dept.sortOrder')" width="80" align="center" />
        <el-table-column prop="leader" :label="t('system.dept.leader')" width="120" />
        <el-table-column prop="phone" :label="t('system.dept.phone')" width="140" />
        <el-table-column prop="email" :label="t('system.dept.email')" width="180" />
        <el-table-column prop="status" :label="t('system.dept.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'">
              {{ row.status === '0' ? t('system.dept.statusNormal') : t('system.dept.statusDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.dept.createTime')" width="180">
            <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
          </el-table-column>
        <el-table-column :label="t('system.dept.operation')" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">{{ t('system.dept.edit') }}</el-button>
            <el-button type="primary" link size="small" @click="handleAdd(row)">{{ t('system.dept.add') }}</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">{{ t('system.dept.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="90px"
      >
        <el-form-item :label="t('system.dept.parentDept')" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="parentTreeOptions"
            :props="{ label: 'deptName', value: 'deptId', children: 'children' } as any"
            check-strictly
            filterable
            :placeholder="t('system.dept.selectParentDept')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('system.dept.deptName')" prop="deptName">
          <el-input v-model="form.deptName" :placeholder="t('system.dept.enterDeptName')" />
        </el-form-item>
        <el-form-item :label="t('system.dept.sortOrder')" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item :label="t('system.dept.leader')" prop="leader">
          <el-input v-model="form.leader" :placeholder="t('system.dept.enterLeader')" />
        </el-form-item>
        <el-form-item :label="t('system.dept.phone')" prop="phone">
          <el-input v-model="form.phone" :placeholder="t('system.dept.enterPhone')" />
        </el-form-item>
        <el-form-item :label="t('system.dept.email')" prop="email">
          <el-input v-model="form.email" :placeholder="t('system.dept.enterEmail')" />
        </el-form-item>
        <el-form-item :label="t('system.dept.status')" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="0">{{ t('system.dept.statusNormal') }}</el-radio>
            <el-radio value="1">{{ t('system.dept.statusDisabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('system.dept.cancel') }}</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">{{ t('system.dept.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { formatDateTime } from '@/utils/format'
import type { SysDept } from '@/types/api'
import { getDeptTree, getDeptById, createDept, updateDept, deleteDept } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t } = useI18n()

const loading = ref(false)
const submitLoading = ref(false)
const deptTree = ref<SysDept[]>([])
const isExpandAll = ref(true)
const refreshTable = ref(true)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const isEdit = ref(false)
const form = reactive<SysDept>({
  deptId: 0,
  deptName: '',
  parentId: 0,
  ancestors: '',
  sortOrder: 0,
  leader: '',
  phone: '',
  email: '',
  status: '0',
  tenantId: 0
})

const dialogTitle = computed(() => (isEdit.value ? t('system.dept.editDept') : t('system.dept.addDept')))

const parentTreeOptions = computed(() => {
  const root: SysDept = {
    deptId: 0,
    deptName: '根目录',
    parentId: 0,
    ancestors: '',
    sortOrder: 0,
    leader: '',
    phone: '',
    email: '',
    status: '0',
    tenantId: 0,
    children: deptTree.value
  }
  return [root]
})

const rules = reactive<FormRules>({
  deptName: [{ required: true, message: t('system.dept.enterDeptName'), trigger: 'blur' }],
  sortOrder: [{ required: true, message: t('system.dept.sortOrder'), trigger: 'blur' }]
})

async function fetchData() {
  loading.value = true
  try {
    const { data } = await getDeptTree()
    deptTree.value = data.data || []
  } finally {
    loading.value = false
  }
}

function toggleExpand() {
  isExpandAll.value = !isExpandAll.value
  refreshTable.value = false
  nextTick(() => {
    refreshTable.value = true
  })
}

function resetForm() {
  form.deptId = 0
  form.deptName = ''
  form.parentId = 0
  form.ancestors = ''
  form.sortOrder = 0
  form.leader = ''
  form.phone = ''
  form.email = ''
  form.status = '0'
  form.tenantId = 0
}

function handleAdd(parentRow?: SysDept) {
  resetForm()
  isEdit.value = false
  if (parentRow) {
    form.parentId = parentRow.deptId
  }
  dialogVisible.value = true
}

async function handleEdit(row: SysDept) {
  resetForm()
  isEdit.value = true
  try {
    const { data } = await getDeptById(row.deptId)
    const dept = data.data
    form.deptId = dept.deptId
    form.deptName = dept.deptName
    form.parentId = dept.parentId
    form.ancestors = dept.ancestors
    form.sortOrder = dept.sortOrder
    form.leader = dept.leader
    form.phone = dept.phone
    form.email = dept.email
    form.status = dept.status
    form.tenantId = dept.tenantId
    dialogVisible.value = true
  } catch {
    ElMessage.error(t('system.dept.updateFailed'))
  }
}

async function handleDelete(row: SysDept) {
  if (row.children && row.children.length > 0) {
    ElMessage.warning(t('system.dept.hasChildrenWarning'))
    return
  }
  await ElMessageBox.confirm(t('system.dept.deleteConfirm', { name: row.deptName }), t('system.dept.operation'), { type: 'warning' })
  try {
    await deleteDept(row.deptId)
    ElMessage.success(t('system.dept.deleteSuccess'))
    fetchData()
  } catch {
    ElMessage.error(t('system.dept.deleteFailed'))
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateDept({ ...form })
      ElMessage.success(t('system.dept.updateSuccess'))
    } else {
      await createDept({ ...form })
      ElMessage.success(t('system.dept.addSuccess'))
    }
    dialogVisible.value = false
    fetchData()
  } catch {
    ElMessage.error(isEdit.value ? t('system.dept.updateFailed') : t('system.dept.addFailed'))
  } finally {
    submitLoading.value = false
  }
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
</style>