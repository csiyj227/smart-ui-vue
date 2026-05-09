<template>
  <div class="user-container">
    <el-row :gutter="16">
      <!-- Left: Dept Tree -->
      <el-col :span="4">
        <el-card shadow="never" class="dept-tree-card">
          <template #header>
            <span>{{ t('system.user.deptTree') }}</span>
          </template>
          <el-input v-model="deptFilter" :placeholder="t('system.user.searchDept')" clearable style="margin-bottom: 12px" />
          <el-tree
            ref="deptTreeRef"
            :data="deptTree"
            :props="{ label: 'deptName', children: 'children' }"
            node-key="deptId"
            highlight-current
            default-expand-all
            :filter-node-method="filterDept"
            @node-click="handleDeptClick"
          />
        </el-card>
      </el-col>

      <!-- Right: User Table -->
      <el-col :span="20">
        <el-card shadow="never">
          <!-- Search -->
          <div class="user-toolbar">
            <div class="user-toolbar__left">
              <el-input v-model="query.username" :placeholder="t('system.user.enterUsername')" clearable style="width: 160px" @clear="fetchData" @keyup.enter="fetchData">
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-input v-model="query.realName" :placeholder="t('system.user.enterRealName')" clearable style="width: 160px" @clear="fetchData" @keyup.enter="fetchData" />
              <el-select v-model="query.status" :placeholder="t('system.user.status')" clearable style="width: 120px" @change="fetchData">
                <el-option :label="t('system.user.statusNormal')" value="0" />
                <el-option :label="t('system.user.statusDisabled')" value="1" />
              </el-select>
              <el-button type="primary" @click="fetchData">{{ t('system.user.search') }}</el-button>
              <el-button @click="resetQuery">{{ t('system.user.reset') }}</el-button>
            </div>
            <div class="user-toolbar__right">
              <el-button type="primary" @click="handleAdd">{{ t('system.user.addUser') }}</el-button>
            </div>
          </div>

          <!-- Table -->
          <el-table v-loading="loading" :data="tableData" border>
            <el-table-column prop="userId" :label="t('system.user.id')" width="70" />
            <el-table-column prop="username" :label="t('system.user.username')" width="120" show-overflow-tooltip />
            <el-table-column prop="realName" :label="t('system.user.realName')" width="100" />
            <el-table-column prop="phone" :label="t('system.user.phone')" width="130" />
            <el-table-column prop="email" :label="t('system.user.email')" min-width="160" show-overflow-tooltip />
            <el-table-column :label="t('system.user.dept')" width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.deptName || getDeptName(row.deptId) }}</template>
            </el-table-column>
            <el-table-column :label="t('system.user.post')" width="100" show-overflow-tooltip>
              <template #default="{ row }">{{ row.postName || getPostName(row.postId) }}</template>
            </el-table-column>
            <el-table-column prop="status" :label="t('system.user.status')" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
                  {{ row.status === '0' ? t('system.user.statusNormal') : t('system.user.statusDisabled') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('system.user.createTime')" width="180">
              <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
            </el-table-column>
            <el-table-column :label="t('system.user.operation')" width="240" fixed="right" align="center">
              <template #default="{ row }">
                <div class="op-cell">
                  <el-button type="primary" link size="small" @click="handleEdit(row)">
                    <el-icon><Edit /></el-icon>{{ t('system.user.edit') }}
                  </el-button>
                  <el-button type="primary" link size="small" @click="handleAssignRole(row)">
                    <el-icon><UserFilled /></el-icon>{{ t('system.user.role') }}
                  </el-button>
                  <el-dropdown trigger="click" @command="(cmd: string) => handleMoreCommand(cmd, row)">
                    <el-button type="primary" link size="small">
                      {{ t('system.user.more') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="resetPwd">
                          <el-icon><Key /></el-icon>{{ t('system.user.resetPassword') }}
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" divided>
                          <el-icon style="color: var(--el-color-danger)"><Delete /></el-icon>
                          <span style="color: var(--el-color-danger)">{{ t('system.user.delete') }}</span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- Pagination -->
          <div class="user-pagination">
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
      </el-col>
    </el-row>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('system.user.username')" prop="username">
              <el-input v-model="form.username" :placeholder="t('system.user.enterUsername')" :disabled="isEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('system.user.realName')" prop="realName">
              <el-input v-model="form.realName" :placeholder="t('system.user.enterRealName')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="!isEdit" :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('system.user.password')" prop="password">
              <el-input v-model="form.password" type="password" show-password :placeholder="t('system.user.enterPassword')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('system.user.phone')" prop="phone">
              <el-input v-model="form.phone" :placeholder="t('system.user.enterPhone')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('system.user.email')" prop="email">
              <el-input v-model="form.email" :placeholder="t('system.user.enterEmail')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('system.user.dept')" prop="deptId">
              <el-tree-select
                v-model="form.deptId"
                :data="deptTreeOptions"
                :props="{ label: 'deptName', value: 'deptId', children: 'children' } as any"
                check-strictly
                filterable
                :placeholder="t('system.user.selectDept')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('system.user.post')" prop="postId">
              <el-select v-model="form.postId" :placeholder="t('system.user.selectPost')" style="width: 100%">
                <el-option v-for="post in postList" :key="post.postId" :label="post.postName" :value="post.postId" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('system.user.status')" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio value="0">{{ t('system.user.statusNormal') }}</el-radio>
                <el-radio value="1">{{ t('system.user.statusDisabled') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- Assign Role Dialog -->
    <el-dialog v-model="roleDialogVisible" :title="t('system.user.assignRole')" width="400px" destroy-on-close>
      <p style="margin-bottom: 12px; color: var(--color-text-regular)">
        {{ t('system.user.username') }}：<strong>{{ currentUser?.username }}</strong>
      </p>
      <el-checkbox-group v-model="selectedRoleIds">
        <el-checkbox v-for="role in allRoles" :key="role.roleId" :value="role.roleId" :label="role.roleName" />
      </el-checkbox-group>
      <template #footer>
        <el-button @click="roleDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="roleSubmitting" @click="handleRoleSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Edit, UserFilled, ArrowDown, Key, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getUserPage, createUser, updateUser, deleteUser, getUserRoleIds,
  resetUserPassword, saveUserRoles,
  getRolePage, getDeptTree, getPostList
} from '@/api/admin'
import type { SysUser, SysDept, SysRole, SysPost, UserForm } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const roleDialogVisible = ref(false)
const roleSubmitting = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const deptTreeRef = ref<any>()
const deptFilter = ref('')
const selectedDeptId = ref<number | null>(null)

const tableData = ref<SysUser[]>([])
const deptTree = ref<SysDept[]>([])
const postList = ref<SysPost[]>([])
const allRoles = ref<SysRole[]>([])
const selectedRoleIds = ref<number[]>([])
const currentUser = ref<SysUser | null>(null)

const query = reactive({ username: '', realName: '', status: '', deptId: undefined as number | undefined })
const page = reactive({ current: 1, size: 10, total: 0 })

const defaultForm = (): UserForm => ({
  userId: undefined,
  username: '',
  password: '',
  realName: '',
  phone: '',
  email: '',
  deptId: undefined,
  postId: undefined,
  status: '0',
  roleIds: [],
})

const form = reactive<UserForm>(defaultForm())
const dialogTitle = computed(() => isEdit.value ? t('system.user.editUser') : t('system.user.addUserTitle'))

const deptTreeOptions = computed(() => {
  const root: SysDept = { deptId: 0, deptName: t('system.user.rootDept'), parentId: 0, ancestors: '0', sortOrder: 0, leader: '', phone: '', email: '', status: '0', tenantId: 1, children: deptTree.value }
  return [root]
})

const rules: FormRules = {
  username: [{ required: true, message: t('system.user.enterUsername'), trigger: 'blur' }],
  realName: [{ required: true, message: t('system.user.enterRealName'), trigger: 'blur' }],
  password: [{ required: true, message: t('system.user.enterPassword'), trigger: 'blur' }],
}

// Dept tree filter
watch(deptFilter, (val) => {
  deptTreeRef.value?.filter(val)
})

function filterDept(value: string, data: any) {
  if (!value) return true
  return data.deptName?.includes(value)
}

function handleDeptClick(data: SysDept) {
  selectedDeptId.value = data.deptId
  query.deptId = data.deptId
  page.current = 1
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const params: any = { current: page.current, size: page.size, username: query.username, realName: query.realName }
    if (query.status) params.status = query.status
    if (query.deptId) params.deptId = query.deptId
    const { data } = await getUserPage(params)
    tableData.value = data.data.records
    page.total = data.data.total
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.username = ''
  query.realName = ''
  query.status = ''
  query.deptId = undefined
  selectedDeptId.value = null
  page.current = 1
  fetchData()
}

function handleAdd() {
  isEdit.value = false
  Object.assign(form, defaultForm())
  dialogVisible.value = true
}

async function handleEdit(row: SysUser) {
  isEdit.value = true
  Object.assign(form, {
    userId: row.userId,
    username: row.username,
    realName: row.realName,
    phone: row.phone,
    email: row.email,
    deptId: row.deptId,
    postId: row.postId,
    status: row.status,
    roleIds: [],
  })
  dialogVisible.value = true
}

async function handleDelete(row: SysUser) {
  try {
    await ElMessageBox.confirm(t('system.user.deleteConfirm', { username: row.username }), t('common.warning'), { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteUser(row.userId)
    ElMessage.success(t('system.user.deleteSuccess'))
    fetchData()
  } catch {
    ElMessage.error(t('system.user.deleteFailed'))
  }
}

function handleMoreCommand(cmd: string, row: SysUser) {
  if (cmd === 'resetPwd') {
    handleResetPwd(row)
  } else if (cmd === 'delete') {
    handleDelete(row)
  }
}

async function handleResetPwd(row: SysUser) {
  try {
    await ElMessageBox.confirm(t('system.user.resetPasswordConfirm', { username: row.username }), t('common.warning'), { type: 'warning' })
  } catch {
    return
  }
  try {
    await resetUserPassword(row.userId, 'smart123')
    ElMessage.success(t('system.user.passwordResetSuccess'))
  } catch {
    ElMessage.error(t('system.user.passwordResetFailed'))
  }
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateUser(form)
    } else {
      await createUser(form)
    }
    ElMessage.success(isEdit.value ? t('system.user.updateSuccess') : t('system.user.addSuccess'))
    dialogVisible.value = false
    fetchData()
  } catch {
    ElMessage.error(isEdit.value ? t('system.user.updateFailed') : t('system.user.addFailed'))
  } finally {
    submitting.value = false
  }
}

// Role assignment
async function handleAssignRole(row: SysUser) {
  currentUser.value = row
  const { data: roleRes } = await getRolePage({ current: 1, size: 999 })
  allRoles.value = roleRes.data.records
  try {
    const { data: roleIdsRes } = await getUserRoleIds(row.userId)
    selectedRoleIds.value = roleIdsRes.data || []
  } catch {
    selectedRoleIds.value = []
  }
  roleDialogVisible.value = true
}

async function handleRoleSubmit() {
  roleSubmitting.value = true
  try {
    await saveUserRoles(currentUser.value!.userId, selectedRoleIds.value)
    ElMessage.success(t('system.user.roleAssignSuccess'))
    roleDialogVisible.value = false
  } catch {
    ElMessage.error(t('system.user.roleAssignFailed'))
  } finally {
    roleSubmitting.value = false
  }
}

async function loadDeptTree() {
  const { data } = await getDeptTree()
  deptTree.value = data.data || []
}

async function loadPostList() {
  try {
    const { data } = await getPostList()
    postList.value = data.data || []
  } catch {
    postList.value = []
  }
}

function getDeptName(deptId: number): string {
  const walk = (list: SysDept[]): string => {
    for (const d of list) {
      if (d.deptId === deptId) return d.deptName
      if (d.children) {
        const found = walk(d.children)
        if (found) return found
      }
    }
    return ''
  }
  return walk(deptTree.value)
}

function getPostName(postId: number): string {
  return postList.value.find(p => p.postId === postId)?.postName || ''
}

onMounted(() => {
  fetchData()
  loadDeptTree()
  loadPostList()
})
</script>

<style lang="scss" scoped>
.user-container {
  .dept-tree-card {
    height: calc(100vh - 160px);
    overflow: auto;

    :deep(.el-card__body) {
      padding: 12px;
    }
  }

  .user-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;

    &__left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .user-pagination {
    display: flex;
    justify-content: flex-end;
    padding: 16px 0;
  }

  .op-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    // 让 dropdown 触发器和按钮高度一致、垂直居中
    :deep(.el-dropdown) {
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }

    // link 按钮去掉默认外边距，避免 gap 之外又被撑开
    :deep(.el-button + .el-button) {
      margin-left: 0;
    }

    .el-button {
      vertical-align: middle;
    }
  }
}
</style>