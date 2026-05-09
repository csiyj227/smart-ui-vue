<template>
  <div class="role-container">
    <el-card shadow="never">
      <!-- Search -->
      <div class="role-toolbar">
        <div class="role-toolbar__left">
          <el-input v-model="query.roleName" :placeholder="t('system.role.roleName')" clearable style="width: 200px" @clear="fetchData" @keyup.enter="fetchData">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="query.status" :placeholder="t('system.role.status')" clearable style="width: 120px" @change="fetchData">
            <el-option :label="t('system.role.statusNormal')" value="0" />
            <el-option :label="t('system.role.statusDisabled')" value="1" />
          </el-select>
          <el-button type="primary" @click="fetchData">{{ t('system.role.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('system.role.reset') }}</el-button>
        </div>
        <el-button type="primary" @click="handleAdd">{{ t('system.role.addRole') }}</el-button>
      </div>

      <!-- Table -->
      <el-table v-loading="loading" :data="tableData" border>
        <el-table-column prop="roleId" :label="t('system.role.roleId')" width="80" />
        <el-table-column prop="roleName" :label="t('system.role.roleName')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="roleCode" :label="t('system.role.roleCode')" width="120" />
        <el-table-column prop="roleDesc" :label="t('system.role.description')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="dsType" :label="t('system.role.dataScope')" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ dsTypeLabels[row.dsType] || t('system.role.dsUnknown') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="t('system.role.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
              {{ row.status === '0' ? t('system.role.statusNormal') : t('system.role.statusDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.role.createTime')" width="180">
            <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
          </el-table-column>
        <el-table-column :label="t('system.role.operation')" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">{{ t('system.role.edit') }}</el-button>
            <el-button link type="primary" size="small" @click="handlePermission(row)">{{ t('system.role.permission') }}</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">{{ t('system.role.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="role-pagination">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="page.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="fetchData"
          @size-change="fetchData"
        />
      </div>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item :label="t('system.role.roleName')" prop="roleName">
          <el-input v-model="form.roleName" :placeholder="t('system.role.enterRoleName')" />
        </el-form-item>
        <el-form-item :label="t('system.role.roleCode')" prop="roleCode">
          <el-input v-model="form.roleCode" :placeholder="t('system.role.enterRoleCode')" :disabled="isEdit" />
        </el-form-item>
        <el-form-item :label="t('system.role.description')" prop="roleDesc">
          <el-input v-model="form.roleDesc" type="textarea" :rows="3" :placeholder="t('system.role.enterDescription')" />
        </el-form-item>
        <el-form-item :label="t('system.role.dataScope')" prop="dsType">
          <el-select v-model="form.dsType" :placeholder="t('system.role.selectDataScope')" style="width: 100%">
            <el-option v-for="(label, key) in dsTypeLabels" :key="key" :label="label" :value="Number(key)" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.dsType === 1" :label="t('system.role.customPermission')" prop="dsScope">
          <el-input v-model="form.dsScope" :placeholder="t('system.role.customDeptIds')" />
        </el-form-item>
        <el-form-item :label="t('system.role.status')" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="0">{{ t('system.role.statusNormal') }}</el-radio>
            <el-radio value="1">{{ t('system.role.statusDisabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- Permission Assignment Dialog -->
    <el-dialog v-model="permDialogVisible" :title="t('system.role.assignPermission')" width="600px" destroy-on-close>
      <div style="margin-bottom: 12px;">
        <el-checkbox v-model="menuExpandAll" @change="(val: string | number | boolean) => handleMenuExpandAll(!!val)">{{ t('system.role.expandCollapse') }}</el-checkbox>
        <el-checkbox v-model="menuCheckAll" :indeterminate="menuIndeterminate" @change="(val: string | number | boolean) => handleMenuCheckAll(!!val)">{{ t('system.role.checkAll') }}</el-checkbox>
      </div>
      <el-tree
        ref="menuTreeRef"
        :data="menuTree"
        :props="{ label: 'menuName', children: 'children' }"
        node-key="menuId"
        show-checkbox
        default-expand-all
        :default-checked-keys="checkedMenuIds"
      />
      <template #footer>
        <el-button @click="permDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="permSubmitting" @click="handlePermSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { getRolePage, getRoleById, createRole, updateRole, deleteRole, saveRoleMenus, getRoleMenuIds, getMenuTree } from '@/api/admin'
import type { SysRole, SysMenu } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()



const dsTypeLabels = computed<Record<number, string>>(() => ({
  0: t('system.role.dsAll'),
  1: t('system.role.dsCustom'),
  2: t('system.role.dsDept'),
  3: t('system.role.dsDeptBelow'),
  4: t('system.role.dsSelf'),
}))

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const permDialogVisible = ref(false)
const permSubmitting = ref(false)
const formRef = ref<FormInstance>()
const menuTreeRef = ref<any>()
const menuTree = ref<SysMenu[]>([])
const checkedMenuIds = ref<number[]>([])
const menuExpandAll = ref(true)
const menuCheckAll = ref(false)
const menuIndeterminate = ref(false)
const isEdit = ref(false)
const currentRoleId = ref(0)

const tableData = ref<SysRole[]>([])
const query = reactive({ roleName: '', status: '' })
const page = reactive({ current: 1, size: 10, total: 0 })

const defaultForm = () => ({
  roleId: 0,
  roleName: '',
  roleCode: '',
  roleDesc: '',
  dsType: 0,
  dsScope: '',
  status: '0',
  tenantId: 1,
})

const form = reactive(defaultForm())
const dialogTitle = computed(() => isEdit.value ? t('system.role.editRole') : t('system.role.addRole'))

const rules: FormRules = {
  roleName: [{ required: true, message: t('system.role.enterRoleName'), trigger: 'blur' }],
  roleCode: [{ required: true, message: t('system.role.enterRoleCode'), trigger: 'blur' }],
}

async function fetchData() {
  loading.value = true
  try {
    const { data } = await getRolePage({ current: page.current, size: page.size, ...query })
    tableData.value = data.data.records
    page.total = data.data.total
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.roleName = ''
  query.status = ''
  page.current = 1
  fetchData()
}

function handleAdd() {
  isEdit.value = false
  Object.assign(form, defaultForm())
  dialogVisible.value = true
}

async function handleEdit(row: SysRole) {
  isEdit.value = true
  try {
    const { data } = await getRoleById(row.roleId)
    Object.assign(form, data.data)
    dialogVisible.value = true
  } catch {
    ElMessage.error(t('system.role.fetchFailed'))
  }
}

async function handleDelete(row: SysRole) {
  try {
    await ElMessageBox.confirm(t('system.role.deleteConfirm', { roleName: row.roleName }), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteRole(row.roleId)
    ElMessage.success(t('system.role.deleteSuccess'))
    fetchData()
  } catch {
    ElMessage.error(t('system.role.deleteFailed'))
  }
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateRole(form as any)
    } else {
      await createRole(form as any)
    }
    ElMessage.success(isEdit.value ? t('system.role.updateSuccess') : t('system.role.addSuccess'))
    dialogVisible.value = false
    fetchData()
  } catch {
    ElMessage.error(isEdit.value ? t('system.role.updateFailed') : t('system.role.addFailed'))
  } finally {
    submitting.value = false
  }
}

// Permission assignment
async function handlePermission(row: SysRole) {
  currentRoleId.value = row.roleId
  const { data: menuRes } = await getMenuTree()
  menuTree.value = menuRes.data || []

  // Get currently assigned menu IDs
  try {
    const { data: idsRes } = await getRoleMenuIds(row.roleId)
    const allMenuIds: number[] = idsRes.data || []
    // el-tree setCheckedKeys only sets leaf nodes as checked;
    // parent nodes are auto-checked based on children state.
    const leafIds = getLeafMenuIds(menuTree.value, new Set(allMenuIds))
    checkedMenuIds.value = leafIds
  } catch {
    checkedMenuIds.value = []
  }

  permDialogVisible.value = true
  await nextTick()
}

function getLeafMenuIds(menus: SysMenu[], allIds: Set<number>): number[] {
  const leaves: number[] = []
  for (const menu of menus) {
    if (menu.children?.length) {
      leaves.push(...getLeafMenuIds(menu.children, allIds))
    } else if (allIds.has(menu.menuId)) {
      leaves.push(menu.menuId)
    }
  }
  return leaves
}

function handleMenuExpandAll(val: boolean) {
  const tree = menuTreeRef.value
  if (!tree) return
  const nodes = tree.store._getAllNodes()
  nodes.forEach((node: any) => { node.expanded = val })
}

function handleMenuCheckAll(val: boolean) {
  const tree = menuTreeRef.value
  if (!tree) return
  if (val) {
    tree.setCheckedNodes(menuTree.value as any)
  } else {
    tree.setCheckedKeys([])
  }
  menuIndeterminate.value = false
}

async function handlePermSubmit() {
  const tree = menuTreeRef.value
  if (!tree) return
  const checkedKeys = tree.getCheckedKeys() as number[]
  const halfCheckedKeys = tree.getHalfCheckedKeys() as number[]
  const menuIds = [...checkedKeys, ...halfCheckedKeys]

  permSubmitting.value = true
  try {
    await saveRoleMenus(currentRoleId.value, menuIds)
    ElMessage.success(t('system.role.permissionSuccess'))
    permDialogVisible.value = false
  } catch {
    ElMessage.error(t('system.role.permissionFailed'))
  } finally {
    permSubmitting.value = false
  }
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
.role-container {
  .role-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;

    &__left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .role-pagination {
    display: flex;
    justify-content: flex-end;
    padding: 16px 0;
  }
}
</style>