<template>
  <div class="menu-management">
    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button plain @click="toggleExpand">
            {{ isExpand ? t('system.menu.collapseAll') : t('system.menu.expandAll') }}
          </el-button>
        </div>
        <el-button type="primary" @click="handleAdd()">{{ t('system.menu.addRootMenu') }}</el-button>
      </div>

      <el-table
        v-if="refreshTable"
        :data="menuTree"
        v-loading="loading"
        row-key="menuId"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="isExpand"
        border
      >
        <el-table-column prop="menuName" :label="t('system.menu.menuName')" min-width="180" />
        <el-table-column prop="icon" :label="t('system.menu.icon')" width="80" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.icon"><component :is="row.icon" /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="menuType" :label="t('system.menu.type')" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.menuType === '0'" type="warning" size="small">{{ t('system.menu.typeDirectory') }}</el-tag>
            <el-tag v-else-if="row.menuType === '1'" type="primary" size="small">{{ t('system.menu.typeMenu') }}</el-tag>
            <el-tag v-else-if="row.menuType === '2'" type="info" size="small">{{ t('system.menu.typeButton') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" :label="t('system.menu.sortOrder')" width="70" align="center" />
        <el-table-column prop="permission" :label="t('system.menu.permission')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="path" :label="t('system.menu.path')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="component" :label="t('system.menu.component')" min-width="150" show-overflow-tooltip />
        <el-table-column :label="t('system.menu.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.visible ? 'success' : 'danger'" size="small">
              {{ row.visible ? t('system.menu.isVisible') : t('system.menu.hidden') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.menu.operation')" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">{{ t('system.menu.edit') }}</el-button>
            <el-button
              v-if="row.menuType !== '2'"
              type="primary"
              link
              size="small"
              @click="handleAdd(row)"
            >
              {{ t('system.menu.add') }}
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">{{ t('system.menu.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="680px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item :label="t('system.menu.parentMenu')" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="parentTreeOptions"
            :props="{ value: 'menuId', label: 'menuName', children: 'children' } as any"
            check-strictly
            filterable
            :placeholder="t('system.menu.selectParent')"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item :label="t('system.menu.menuType')" prop="menuType">
          <el-radio-group v-model="form.menuType">
            <el-radio value="0">{{ t('system.menu.typeDirectory') }}</el-radio>
            <el-radio value="1">{{ t('system.menu.typeMenu') }}</el-radio>
            <el-radio value="2">{{ t('system.menu.typeButton') }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="t('system.menu.menuName')" prop="menuName">
          <el-input v-model="form.menuName" :placeholder="t('system.menu.enterMenuName')" />
        </el-form-item>

        <el-form-item :label="t('system.menu.sortOrder')" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>

        <!-- Directory & Menu: icon -->
        <el-form-item v-if="form.menuType === '0' || form.menuType === '1'" :label="t('system.menu.icon')" prop="icon">
          <el-input v-model="form.icon" :placeholder="t('system.menu.enterIcon')" />
        </el-form-item>

        <!-- Directory & Menu: path -->
        <el-form-item v-if="form.menuType === '0' || form.menuType === '1'" :label="t('system.menu.path')" prop="path">
          <el-input v-model="form.path" :placeholder="t('system.menu.enterPath')" />
        </el-form-item>

        <!-- Menu: component -->
        <el-form-item v-if="form.menuType === '1'" :label="t('system.menu.component')" prop="component">
          <el-input v-model="form.component" :placeholder="t('system.menu.enterComponent')" />
        </el-form-item>

        <!-- Menu & Button: permission -->
        <el-form-item v-if="form.menuType === '1' || form.menuType === '2'" :label="t('system.menu.permission')" prop="permission">
          <el-input v-model="form.permission" :placeholder="t('system.menu.enterPermission')" />
        </el-form-item>

        <!-- Menu: keepAlive -->
        <el-form-item v-if="form.menuType === '1'" :label="t('system.menu.cache')" prop="keepAlive">
          <el-switch v-model="form.keepAlive" />
        </el-form-item>

        <!-- Directory & Menu: visible -->
        <el-form-item v-if="form.menuType === '0' || form.menuType === '1'" :label="t('system.menu.isVisible')" prop="visible">
          <el-switch v-model="form.visible" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('system.menu.cancel') }}</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">{{ t('system.menu.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { SysMenu } from '@/types/api'
import { getMenuTree, createMenu, updateMenu, deleteMenu } from '@/api/admin'

const { t } = useI18n()

// --- State ---
const loading = ref(false)
const submitLoading = ref(false)
const menuTree = ref<SysMenu[]>([])
const isExpand = ref(true)
const refreshTable = ref(true)

const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()

const initForm = (): SysMenu => ({
  menuId: 0,
  menuName: '',
  permission: '',
  path: '',
  component: '',
  parentId: 0,
  icon: '',
  sortOrder: 0,
  menuType: '0',
  keepAlive: false,
  visible: true,
})

const form = reactive<SysMenu>(initForm())

// --- Computed ---
const dialogTitle = computed(() => (isEdit.value ? t('system.menu.editMenu') : t('system.menu.addMenu')))

/** Build parent tree options - prepend a root node for parentId=0 */
const parentTreeOptions = computed(() => {
  const root: SysMenu = {
    menuId: 0,
    menuName: t('system.menu.rootDirectory'),
    permission: '',
    path: '',
    component: '',
    parentId: -1,
    icon: '',
    sortOrder: 0,
    menuType: '0',
    keepAlive: false,
    visible: true,
    children: menuTree.value,
  }
  return [root]
})

const formRules = computed<FormRules>(() => ({
  menuName: [{ required: true, message: t('system.menu.enterMenuName'), trigger: 'blur' }],
  menuType: [{ required: true, message: t('system.menu.menuType'), trigger: 'change' }],
  path: [
    {
      required: form.menuType === '0' || form.menuType === '1',
      message: t('system.menu.enterPath'),
      trigger: 'blur',
    },
  ],
  component: [
    {
      required: form.menuType === '1',
      message: t('system.menu.enterComponent'),
      trigger: 'blur',
    },
  ],
  permission: [
    {
      required: form.menuType === '2',
      message: t('system.menu.enterPermission'),
      trigger: 'blur',
    },
  ],
}))

// --- Methods ---
async function fetchTree() {
  loading.value = true
  try {
    const { data } = await getMenuTree()
    menuTree.value = data.data || []
  } finally {
    loading.value = false
  }
}

function toggleExpand() {
  refreshTable.value = false
  isExpand.value = !isExpand.value
  nextTick(() => {
    refreshTable.value = true
  })
}

function resetForm() {
  Object.assign(form, initForm())
  formRef.value?.resetFields()
}

/** Open dialog for adding a menu. If parent is provided, add as child. */
function handleAdd(parent?: SysMenu) {
  isEdit.value = false
  Object.assign(form, initForm())
  if (parent) {
    form.parentId = parent.menuId
    // directory -> default child: menu; menu -> default child: button
    form.menuType = parent.menuType === '0' ? '1' : '2'
  } else {
    form.parentId = 0
    form.menuType = '0'
  }
  dialogVisible.value = true
}

function handleEdit(row: SysMenu) {
  isEdit.value = true
  Object.assign(form, {
    menuId: row.menuId,
    menuName: row.menuName,
    permission: row.permission,
    path: row.path,
    component: row.component,
    parentId: row.parentId,
    icon: row.icon,
    sortOrder: row.sortOrder,
    menuType: row.menuType,
    keepAlive: row.keepAlive,
    visible: row.visible,
    children: undefined,
  })
  dialogVisible.value = true
}

async function handleDelete(row: SysMenu) {
  if (row.children && row.children.length > 0) {
    ElMessage.warning(t('system.menu.hasChildrenWarning'))
    return
  }
  await ElMessageBox.confirm(t('system.menu.deleteConfirm', { name: row.menuName }), t('system.menu.operation'), {
    confirmButtonText: t('system.menu.confirm'),
    cancelButtonText: t('system.menu.cancel'),
    type: 'warning',
  })
  try {
    await deleteMenu(row.menuId)
    ElMessage.success(t('system.menu.deleteSuccess'))
    fetchTree()
  } catch {
    ElMessage.error(t('system.menu.deleteFailed'))
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  submitLoading.value = true
  try {
    const payload: Partial<SysMenu> = {
      menuName: form.menuName,
      permission: form.permission,
      path: form.path,
      component: form.component,
      parentId: form.parentId,
      icon: form.icon,
      sortOrder: form.sortOrder,
      menuType: form.menuType,
      keepAlive: form.keepAlive,
      visible: form.visible,
    }
    if (isEdit.value) {
      payload.menuId = form.menuId
      await updateMenu(payload)
      ElMessage.success(t('system.menu.updateSuccess'))
    } else {
      await createMenu(payload)
      ElMessage.success(t('system.menu.addSuccess'))
    }
    dialogVisible.value = false
    fetchTree()
  } catch {
    ElMessage.error(isEdit.value ? t('system.menu.updateFailed') : t('system.menu.addFailed'))
  } finally {
    submitLoading.value = false
  }
}

onMounted(fetchTree)
</script>

<style lang="scss" scoped>
.menu-management {
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }
}
</style>