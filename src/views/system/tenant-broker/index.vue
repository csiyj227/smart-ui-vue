<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  exitTenantBroker,
  getCurrentTenantBroker,
  getTenantBrokerSwitched,
  getTenantBrokerTenants,
  switchTenantBroker,
} from '@/api/admin'
import type { SysTenant } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

const tenants = ref<SysTenant[]>([])
const currentTenant = ref<number | null>(null)
const switched = ref(false)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const [a, b, c] = await Promise.all([
      getTenantBrokerTenants(),
      getCurrentTenantBroker(),
      getTenantBrokerSwitched(),
    ])
    tenants.value = a.data.data
    currentTenant.value = b.data.data
    switched.value = c.data.data
  } catch (e: any) {
    ElMessage.error(t('system.tenantBroker.loadFailed') + '：' + (e?.message || e))
  } finally {
    loading.value = false
  }
}

const doSwitch = async (row: SysTenant) => {
  try {
    await ElMessageBox.confirm(t('system.tenantBroker.switchConfirm', { name: row.tenantName }), t('common.warning'), { type: 'warning' })
  } catch { return }
  try {
    await switchTenantBroker(row.id!)
    ElMessage.success(t('system.tenantBroker.switchSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.tenantBroker.switchFailed') + '：' + (e?.message || e))
  }
}

const exitSwitch = async () => {
  try {
    await ElMessageBox.confirm(t('system.tenantBroker.exitConfirm'), t('common.warning'), { type: 'warning' })
  } catch { return }
  try {
    await exitTenantBroker()
    ElMessage.success(t('system.tenantBroker.exitSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.tenantBroker.operationFailed') + '：' + (e?.message || e))
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-tag size="large">{{ t('system.tenantBroker.currentTenant') }}：{{ currentTenant ?? '-' }}</el-tag>
      <el-tag size="large" :type="switched ? 'warning' : 'success'">
        {{ t('system.tenantBroker.switchStatus') }}：{{ switched ? t('system.tenantBroker.switched') : t('system.tenantBroker.default') }}
      </el-tag>
      <el-button type="primary" @click="load">{{ t('system.tenantBroker.refresh') }}</el-button>
      <el-button :disabled="!switched" @click="exitSwitch">{{ t('system.tenantBroker.exitSwitch') }}</el-button>
    </div>

    <el-table :data="tenants" v-loading="loading" border stripe>
      <el-table-column prop="id" :label="t('system.tenantBroker.tenantId')" width="100" align="center" />
      <el-table-column prop="tenantName" :label="t('system.tenantBroker.tenantName')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="tenantCode" :label="t('system.tenantBroker.tenantCode')" min-width="160" show-overflow-tooltip />
      <el-table-column :label="t('system.tenantBroker.status')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === '0' ? 'success' : 'info'">
            {{ row.status === '0' ? t('system.tenantBroker.statusNormal') : t('system.tenantBroker.statusDisabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.tenantBroker.createTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.tenantBroker.operation')" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="currentTenant === row.id"
            @click="doSwitch(row)"
          >
            {{ currentTenant === row.id ? t('system.tenantBroker.currentBtn') : t('system.tenantBroker.switchToBtn') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>