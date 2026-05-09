<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createRoute, deleteRoute, getRouteList, updateRoute } from '@/api/admin'
import type { SysRouteConf } from '@/types/api'

const { t } = useI18n()

const loading = ref(false)
const list = ref<SysRouteConf[]>([])
const visible = ref(false)
const isEdit = ref(false)
const form = reactive<SysRouteConf>({
  id: undefined,
  routeName: '',
  routeId: '',
  predicates: '',
  filters: '',
  uri: '',
  sortOrder: 0,
  status: '0',
})

const load = async () => {
  loading.value = true
  try {
    const { data } = await getRouteList()
    list.value = data.data
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, { id: undefined, routeName: '', routeId: '', predicates: '', filters: '', uri: '', sortOrder: 0, status: '0' })
  visible.value = true
}

const openEdit = (row: SysRouteConf) => {
  isEdit.value = true
  Object.assign(form, row)
  visible.value = true
}

const submit = async () => {
  if (!form.routeName?.trim()) return ElMessage.warning(t('system.route.enterRouteName'))
  if (!form.routeId?.trim()) return ElMessage.warning(t('system.route.enterRouteId'))
  try {
    if (isEdit.value) await updateRoute(form)
    else await createRoute(form)
    ElMessage.success(isEdit.value ? t('system.route.updateSuccess') : t('system.route.addSuccess'))
    visible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(t('system.route.saveFailed') + '：' + (e?.message || e))
  }
}

const remove = async (row: SysRouteConf) => {
  try {
    await ElMessageBox.confirm(t('system.route.deleteConfirm', { name: row.routeName }), t('common.warning'), { type: 'warning' })
  } catch { return }
  try {
    await deleteRoute(row.id!)
    ElMessage.success(t('system.route.deleteSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.route.deleteFailed') + '：' + (e?.message || e))
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-button type="primary" @click="load">{{ t('system.route.refresh') }}</el-button>
      <el-button @click="openAdd">{{ t('system.route.add') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="routeName" :label="t('system.route.routeName')" min-width="140" show-overflow-tooltip />
      <el-table-column prop="routeId" :label="t('system.route.routeId')" min-width="140" show-overflow-tooltip />
      <el-table-column prop="uri" :label="t('system.route.targetUri')" min-width="180" show-overflow-tooltip />
      <el-table-column prop="predicates" :label="t('system.route.predicates')" min-width="220" show-overflow-tooltip />
      <el-table-column prop="filters" :label="t('system.route.filters')" min-width="220" show-overflow-tooltip />
      <el-table-column prop="sortOrder" :label="t('system.route.sortOrder')" width="80" align="center" />
      <el-table-column :label="t('system.route.operation')" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ t('system.route.edit') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('system.route.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" :title="isEdit ? t('system.route.editTitle') : t('system.route.addTitle')" width="760px">
      <el-form :model="form" label-width="100px">
        <el-form-item :label="t('system.route.routeName')" required><el-input v-model="form.routeName" /></el-form-item>
        <el-form-item :label="t('system.route.routeId')" required><el-input v-model="form.routeId" /></el-form-item>
        <el-form-item :label="t('system.route.targetUri')"><el-input v-model="form.uri" :placeholder="t('system.route.uriPlaceholder')" /></el-form-item>
        <el-form-item :label="t('system.route.predicates')"><el-input v-model="form.predicates" type="textarea" :rows="3" /></el-form-item>
        <el-form-item :label="t('system.route.filters')"><el-input v-model="form.filters" type="textarea" :rows="3" /></el-form-item>
        <el-form-item :label="t('system.route.sortOrder')"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('system.route.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>