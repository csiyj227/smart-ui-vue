<template>
  <div class="dict-container">
    <!-- Dict Type Panel -->
    <el-card class="dict-card">
      <!-- Search Bar -->
      <div class="search-bar">
        <div class="search-fields">
          <el-input
            v-model="dictQuery.typeCode"
            :placeholder="t('system.dict.enterTypeCode')"
            clearable
            style="width: 180px"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
          <el-input
            v-model="dictQuery.typeName"
            :placeholder="t('system.dict.enterTypeName')"
            clearable
            style="width: 180px"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
          <el-select
            v-model="dictQuery.status"
            :placeholder="t('system.dict.status')"
            clearable
            style="width: 120px"
            @change="handleSearch"
          >
            <el-option :label="t('system.dict.statusNormal')" value="0" />
            <el-option :label="t('system.dict.statusDisabled')" value="1" />
          </el-select>
          <el-button type="primary" @click="handleSearch">{{ t('system.dict.search') }}</el-button>
          <el-button @click="resetDictQuery">{{ t('system.dict.reset') }}</el-button>
        </div>
        <el-button type="primary" @click="handleAddDict">{{ t('system.dict.addDict') }}</el-button>
      </div>

      <!-- Dict Type Table -->
      <el-table
        :data="dictList"
        v-loading="dictLoading"
        border
        highlight-current-row
        @row-click="handleDictRowClick"
        class="dict-table"
      >
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="typeCode" :label="t('system.dict.typeCode')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="typeName" :label="t('system.dict.typeName')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="description" :label="t('system.dict.description')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="systemFlag" :label="t('system.dict.systemFlag')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.systemFlag ? 'primary' : 'info'" size="small">
              {{ row.systemFlag ? t('system.dict.yes') : t('system.dict.no') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="t('system.dict.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
              {{ row.status === '0' ? t('system.dict.statusNormal') : t('system.dict.statusDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.dict.operation')" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="handleEditDict(row)">{{ t('system.dict.edit') }}</el-button>
            <el-button type="primary" link size="small" @click.stop="handleDictRowClick(row)">{{ t('system.dict.items') }}</el-button>
            <el-button type="danger" link size="small" @click.stop="handleDeleteDict(row)">{{ t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="dictPage.current"
          v-model:page-size="dictPage.size"
          :total="dictPage.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @change="fetchDictList"
        />
      </div>
    </el-card>

    <!-- Add/Edit Dict Dialog -->
    <el-dialog
      v-model="dictDialogVisible"
      :title="dictForm.id ? t('system.dict.editDict') : t('system.dict.addDictTitle')"
      width="520px"
      destroy-on-close
    >
      <el-form
        ref="dictFormRef"
        :model="dictForm"
        :rules="dictFormRules"
        label-width="90px"
      >
        <el-form-item :label="t('system.dict.typeCode')" prop="typeCode">
          <el-input v-model="dictForm.typeCode" :placeholder="t('system.dict.enterTypeCode')" :disabled="!!dictForm.id" />
        </el-form-item>
        <el-form-item :label="t('system.dict.typeName')" prop="typeName">
          <el-input v-model="dictForm.typeName" :placeholder="t('system.dict.enterTypeName')" />
        </el-form-item>
        <el-form-item :label="t('system.dict.description')" prop="description">
          <el-input v-model="dictForm.description" type="textarea" :rows="3" :placeholder="t('system.dict.enterDescription')" />
        </el-form-item>
        <el-form-item :label="t('system.dict.systemFlag')" prop="systemFlag">
          <el-switch v-model="dictForm.systemFlag" />
        </el-form-item>
        <el-form-item :label="t('system.dict.status')" prop="status">
          <el-radio-group v-model="dictForm.status">
            <el-radio value="0">{{ t('system.dict.statusNormal') }}</el-radio>
            <el-radio value="1">{{ t('system.dict.statusDisabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="dictSubmitLoading" @click="handleDictSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- Dict Item Dialog -->
    <el-dialog
      v-model="itemDialogVisible"
      :title="t('system.dict.itemManagement') + ' - ' + (currentDict?.typeName || '')"
      width="800px"
      destroy-on-close
    >
      <div class="item-toolbar">
        <span class="item-type-info">
          {{ t('system.dict.codeLabel') }}: <el-tag size="small">{{ currentDict?.typeCode }}</el-tag>
        </span>
        <el-button type="primary" @click="handleAddItem">{{ t('system.dict.addItem') }}</el-button>
      </div>

      <el-table
        :data="itemList"
        v-loading="itemLoading"
        border
        class="dict-table"
      >
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="itemLabel" :label="t('system.dict.itemLabel')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="itemValue" :label="t('system.dict.itemValue')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="description" :label="t('system.dict.description')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="sortOrder" :label="t('system.dict.sortOrder')" width="80" align="center" />
        <el-table-column prop="status" :label="t('system.dict.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
              {{ row.status === '0' ? t('system.dict.statusNormal') : t('system.dict.statusDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.dict.operation')" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEditItem(row)">{{ t('system.dict.edit') }}</el-button>
            <el-button type="danger" link size="small" @click="handleDeleteItem(row)">{{ t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Add/Edit Dict Item Dialog (nested) -->
    <el-dialog
      v-model="itemFormDialogVisible"
      :title="itemForm.id ? t('system.dict.editItem') : t('system.dict.addItemTitle')"
      width="500px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="itemFormRef"
        :model="itemForm"
        :rules="itemFormRules"
        label-width="80px"
      >
        <el-form-item :label="t('system.dict.itemLabel')" prop="itemLabel">
          <el-input v-model="itemForm.itemLabel" :placeholder="t('system.dict.enterItemLabel')" />
        </el-form-item>
        <el-form-item :label="t('system.dict.itemValue')" prop="itemValue">
          <el-input v-model="itemForm.itemValue" :placeholder="t('system.dict.enterItemValue')" />
        </el-form-item>
        <el-form-item :label="t('system.dict.description')" prop="description">
          <el-input v-model="itemForm.description" type="textarea" :rows="3" :placeholder="t('system.dict.enterDescription')" />
        </el-form-item>
        <el-form-item :label="t('system.dict.sortOrder')" prop="sortOrder">
          <el-input-number v-model="itemForm.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item :label="t('system.dict.status')" prop="status">
          <el-radio-group v-model="itemForm.status">
            <el-radio value="0">{{ t('system.dict.statusNormal') }}</el-radio>
            <el-radio value="1">{{ t('system.dict.statusDisabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemFormDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="itemSubmitLoading" @click="handleItemSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { SysDict, SysDictItem } from '@/types/api'
import {
  getDictPage,
  getDictByTypeCode,
  createDict,
  updateDict,
  deleteDict,
  createDictItem,
  updateDictItem,
  deleteDictItem
} from '@/api/admin'

const { t } = useI18n()

// ==================== Dict Type List ====================

const dictLoading = ref(false)
const dictList = ref<SysDict[]>([])
const dictQuery = reactive({ typeCode: '', typeName: '', status: '' })
const dictPage = reactive({ current: 1, size: 10, total: 0 })

function handleSearch() {
  dictPage.current = 1
  fetchDictList()
}

function resetDictQuery() {
  dictQuery.typeCode = ''
  dictQuery.typeName = ''
  dictQuery.status = ''
  dictPage.current = 1
  fetchDictList()
}

async function fetchDictList() {
  dictLoading.value = true
  try {
    const { data } = await getDictPage({
      current: dictPage.current,
      size: dictPage.size,
      ...dictQuery
    })
    dictList.value = data.data.records
    dictPage.total = data.data.total
  } finally {
    dictLoading.value = false
  }
}

// ==================== Dict Type Dialog ====================

const dictDialogVisible = ref(false)
const dictSubmitLoading = ref(false)
const dictFormRef = ref<FormInstance>()
const dictForm = reactive({
  id: 0,
  typeCode: '',
  typeName: '',
  description: '',
  systemFlag: false,
  status: '0',
  tenantId: 0
})

const dictFormRules: FormRules = {
  typeCode: [{ required: true, message: t('system.dict.enterTypeCode'), trigger: 'blur' }],
  typeName: [{ required: true, message: t('system.dict.enterTypeName'), trigger: 'blur' }]
}

function resetDictForm() {
  dictForm.id = 0
  dictForm.typeCode = ''
  dictForm.typeName = ''
  dictForm.description = ''
  dictForm.systemFlag = false
  dictForm.status = '0'
  dictForm.tenantId = 0
}

function handleAddDict() {
  resetDictForm()
  dictDialogVisible.value = true
}

function handleEditDict(row: SysDict) {
  dictForm.id = row.id
  dictForm.typeCode = row.typeCode
  dictForm.typeName = row.typeName
  dictForm.description = row.description
  dictForm.systemFlag = row.systemFlag
  dictForm.status = row.status
  dictForm.tenantId = row.tenantId
  dictDialogVisible.value = true
}

async function handleDictSubmit() {
  if (!dictFormRef.value) return
  await dictFormRef.value.validate()
  dictSubmitLoading.value = true
  try {
    if (dictForm.id) {
      await updateDict({ ...dictForm })
      ElMessage.success(t('system.dict.updateSuccess'))
    } else {
      await createDict({ ...dictForm })
      ElMessage.success(t('system.dict.addSuccess'))
    }
    dictDialogVisible.value = false
    fetchDictList()
  } catch {
    ElMessage.error(dictForm.id ? t('system.dict.updateFailed') : t('system.dict.addFailed'))
  } finally {
    dictSubmitLoading.value = false
  }
}

async function handleDeleteDict(row: SysDict) {
  try {
    await ElMessageBox.confirm(t('system.dict.deleteDictConfirm', { name: row.typeName }), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await deleteDict(row.id)
    ElMessage.success(t('system.dict.deleteSuccess'))
    fetchDictList()
  } catch {
    ElMessage.error(t('system.dict.deleteFailed'))
  }
}

// ==================== Dict Item Dialog ====================

const itemDialogVisible = ref(false)
const itemLoading = ref(false)
const itemList = ref<SysDictItem[]>([])
const currentDict = ref<SysDict | null>(null)

function handleDictRowClick(row: SysDict) {
  currentDict.value = row
  itemDialogVisible.value = true
  fetchItemList(row.typeCode)
}

async function fetchItemList(typeCode: string) {
  itemLoading.value = true
  try {
    const { data } = await getDictByTypeCode(typeCode)
    itemList.value = data.data
  } finally {
    itemLoading.value = false
  }
}

// ==================== Dict Item Form Dialog ====================

const itemFormDialogVisible = ref(false)
const itemSubmitLoading = ref(false)
const itemFormRef = ref<FormInstance>()
const itemForm = reactive({
  id: 0,
  dictId: 0,
  itemLabel: '',
  itemValue: '',
  description: '',
  sortOrder: 0,
  status: '0',
  tenantId: 0
})

const itemFormRules: FormRules = {
  itemLabel: [{ required: true, message: t('system.dict.enterItemLabel'), trigger: 'blur' }],
  itemValue: [{ required: true, message: t('system.dict.enterItemValue'), trigger: 'blur' }]
}

function resetItemForm() {
  itemForm.id = 0
  itemForm.dictId = currentDict.value?.id ?? 0
  itemForm.itemLabel = ''
  itemForm.itemValue = ''
  itemForm.description = ''
  itemForm.sortOrder = 0
  itemForm.status = '0'
  itemForm.tenantId = currentDict.value?.tenantId ?? 0
}

function handleAddItem() {
  resetItemForm()
  itemFormDialogVisible.value = true
}

function handleEditItem(row: SysDictItem) {
  itemForm.id = row.id
  itemForm.dictId = row.dictId
  itemForm.itemLabel = row.itemLabel
  itemForm.itemValue = row.itemValue
  itemForm.description = row.description
  itemForm.sortOrder = row.sortOrder
  itemForm.status = row.status
  itemForm.tenantId = row.tenantId
  itemFormDialogVisible.value = true
}

async function handleItemSubmit() {
  if (!itemFormRef.value) return
  await itemFormRef.value.validate()
  itemSubmitLoading.value = true
  try {
    if (itemForm.id) {
      await updateDictItem({ ...itemForm })
      ElMessage.success(t('system.dict.updateSuccess'))
    } else {
      itemForm.dictId = currentDict.value?.id ?? 0
      await createDictItem({ ...itemForm })
      ElMessage.success(t('system.dict.addSuccess'))
    }
    itemFormDialogVisible.value = false
    if (currentDict.value) {
      fetchItemList(currentDict.value.typeCode)
    }
  } catch {
    ElMessage.error(itemForm.id ? t('system.dict.updateFailed') : t('system.dict.addFailed'))
  } finally {
    itemSubmitLoading.value = false
  }
}

async function handleDeleteItem(row: SysDictItem) {
  try {
    await ElMessageBox.confirm(t('system.dict.deleteItemConfirm', { name: row.itemLabel }), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await deleteDictItem(row.id)
    ElMessage.success(t('system.dict.deleteSuccess'))
    if (currentDict.value) {
      fetchItemList(currentDict.value.typeCode)
    }
  } catch {
    ElMessage.error(t('system.dict.deleteFailed'))
  }
}

// ==================== Init ====================

onMounted(() => {
  fetchDictList()
})
</script>

<style lang="scss" scoped>
.dict-container {
  background: var(--color-bg, #f5f7fa);
  min-height: 100%;
  box-sizing: border-box;
}

.dict-card {
  :deep(.el-card__body) {
    padding: 16px;
  }
}

.search-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.search-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dict-table {
  width: 100%;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.item-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.item-type-info {
  font-size: 14px;
  color: var(--color-text-regular, #606266);
}
</style>