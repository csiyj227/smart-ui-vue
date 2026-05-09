<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createOauthClient, deleteOauthClient, getOauthClientPage, updateOauthClient } from '@/api/admin'
import type { SysOauthClient } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const loading = ref(false)
const list = ref<SysOauthClient[]>([])
const total = ref(0)
const visible = ref(false)
const isEdit = ref(false)
const query = reactive({ current: 1, size: 10 })
const form = reactive<SysOauthClient>({
  clientId: '',
  clientSecret: '',
  scope: 'server',
  authorizedGrantTypes: 'password,refresh_token,client_credentials,sms',
  accessTokenValidity: 43200,
  refreshTokenValidity: 2592000,
  tenantId: 1,
})

const load = async () => {
  loading.value = true
  try {
    const { data } = await getOauthClientPage(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, {
    clientId: '',
    clientSecret: '',
    scope: 'server',
    authorizedGrantTypes: 'password,refresh_token,client_credentials,sms',
    accessTokenValidity: 43200,
    refreshTokenValidity: 2592000,
    tenantId: 1,
  })
  visible.value = true
}

const openEdit = (row: SysOauthClient) => {
  isEdit.value = true
  Object.assign(form, { ...row, clientSecret: '' })
  visible.value = true
}

const submit = async () => {
  if (!form.clientId?.trim()) return ElMessage.warning(t('system.client.clientIdRequired'))
  if (!isEdit.value && !form.clientSecret?.trim()) return ElMessage.warning(t('system.client.clientSecretRequired'))
  try {
    if (isEdit.value) await updateOauthClient(form)
    else await createOauthClient(form)
    ElMessage.success(isEdit.value ? t('system.client.updateSuccess') : t('system.client.addSuccess'))
    visible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(t('system.client.saveFailed', { error: e?.message || e }))
  }
}

const remove = async (row: SysOauthClient) => {
  try {
    await ElMessageBox.confirm(t('system.client.deleteConfirm', { clientId: row.clientId }), t('common.tip'), { type: 'warning' })
  } catch { return }
  try {
    await deleteOauthClient(row.clientId)
    ElMessage.success(t('system.client.deleteSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.client.deleteFailed', { error: e?.message || e }))
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-button type="primary" @click="openAdd">{{ t('system.client.add') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="clientId" label="Client ID" min-width="160" show-overflow-tooltip />
      <el-table-column prop="scope" :label="t('system.client.scope')" width="120" />
      <el-table-column prop="authorizedGrantTypes" :label="t('system.client.authorizedGrantTypes')" min-width="240" show-overflow-tooltip />
      <el-table-column prop="accessTokenValidity" :label="t('system.client.accessTokenValidity')" width="140" align="center" />
      <el-table-column prop="refreshTokenValidity" :label="t('system.client.refreshTokenValidity')" width="140" align="center" />
      <el-table-column :label="t('system.client.createTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.client.operation')" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ t('system.client.edit') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('system.client.delete') }}</el-button>
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

    <el-dialog v-model="visible" :title="isEdit ? t('system.client.editTitle') : t('system.client.addTitle')" width="620px">
      <el-form :model="form" label-width="120px">
        <el-form-item :label="t('system.client.clientId')" required><el-input v-model="form.clientId" :disabled="isEdit" /></el-form-item>
        <el-form-item :label="t('system.client.clientSecret')" :required="!isEdit">
          <el-input v-model="form.clientSecret" :placeholder="isEdit ? t('system.client.leaveEmptyNoChange') : ''" />
        </el-form-item>
        <el-form-item :label="t('system.client.scope')"><el-input v-model="form.scope" /></el-form-item>
        <el-form-item :label="t('system.client.authorizedGrantTypesLabel')"><el-input v-model="form.authorizedGrantTypes" /></el-form-item>
        <el-form-item :label="t('system.client.accessTokenValidityLabel')"><el-input-number v-model="form.accessTokenValidity" :min="60" /></el-form-item>
        <el-form-item :label="t('system.client.refreshTokenValidityLabel')"><el-input-number v-model="form.refreshTokenValidity" :min="60" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('system.client.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>