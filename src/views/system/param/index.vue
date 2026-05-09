<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createParam, deleteParam, getParamPage, updateParam } from '@/api/admin'
import type { SysPublicParam } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

const loading = ref(false)
const list = ref<SysPublicParam[]>([])
const total = ref(0)
const visible = ref(false)
const isEdit = ref(false)
const query = reactive({ current: 1, size: 10, paramName: '', paramKey: '', paramType: '', status: '' })
const form = reactive<SysPublicParam>({
  id: undefined,
  paramName: '',
  paramKey: '',
  paramValue: '',
  paramType: '0',
  status: '0',
  tenantId: 1,
})

const load = async () => {
  loading.value = true
  try {
    const { data } = await getParamPage(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, { id: undefined, paramName: '', paramKey: '', paramValue: '', paramType: '0', status: '0', tenantId: 1 })
  visible.value = true
}

const openEdit = (row: SysPublicParam) => {
  isEdit.value = true
  Object.assign(form, row)
  visible.value = true
}

const submit = async () => {
  if (!form.paramName?.trim()) return ElMessage.warning(t('system.param.nameRequired'))
  if (!form.paramKey?.trim()) return ElMessage.warning(t('system.param.keyRequired'))
  try {
    if (isEdit.value) await updateParam(form)
    else await createParam(form)
    ElMessage.success(isEdit.value ? t('system.param.updateSuccess') : t('system.param.addSuccess'))
    visible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(t('system.param.saveFailed', { error: e?.message || e }))
  }
}

const remove = async (row: SysPublicParam) => {
  try {
    await ElMessageBox.confirm(t('system.param.deleteConfirm', { paramName: row.paramName }), t('common.tip'), { type: 'warning' })
  } catch { return }
  try {
    await deleteParam(row.id!)
    ElMessage.success(t('system.param.deleteSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.param.deleteFailed', { error: e?.message || e }))
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-input v-model="query.paramName" :placeholder="t('system.param.paramName')" clearable style="width: 180px" @keyup.enter="load" />
      <el-input v-model="query.paramKey" :placeholder="t('system.param.paramKey')" clearable style="width: 180px" @keyup.enter="load" />
      <el-button type="primary" @click="load">{{ t('system.param.search') }}</el-button>
      <el-button @click="openAdd">{{ t('system.param.add') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="paramName" :label="t('system.param.paramName')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="paramKey" :label="t('system.param.paramKey')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="paramValue" :label="t('system.param.paramValue')" min-width="200" show-overflow-tooltip />
      <el-table-column :label="t('system.param.paramType')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.paramType === '0' ? 'warning' : 'primary'">
            {{ row.paramType === '0' ? t('system.param.typeSystem') : t('system.param.typeBusiness') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.param.status')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === '0' ? 'success' : 'info'">
            {{ row.status === '0' ? t('system.param.statusNormal') : t('system.param.statusDisabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.param.createTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.param.operation')" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ t('system.param.edit') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('system.param.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <el-dialog v-model="visible" :title="isEdit ? t('system.param.editTitle') : t('system.param.addTitle')" width="620px">
      <el-form :model="form" label-width="90px">
        <el-form-item :label="t('system.param.paramName')" required><el-input v-model="form.paramName" /></el-form-item>
        <el-form-item :label="t('system.param.paramKey')" required><el-input v-model="form.paramKey" /></el-form-item>
        <el-form-item :label="t('system.param.paramValue')"><el-input v-model="form.paramValue" type="textarea" :rows="4" /></el-form-item>
        <el-form-item :label="t('system.param.paramType')">
          <el-select v-model="form.paramType">
            <el-option :label="t('system.param.typeSystem')" value="0" />
            <el-option :label="t('system.param.typeBusiness')" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('system.param.status')">
          <el-select v-model="form.status">
            <el-option :label="t('system.param.statusNormal')" value="0" />
            <el-option :label="t('system.param.statusDisabled')" value="1" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('system.param.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>