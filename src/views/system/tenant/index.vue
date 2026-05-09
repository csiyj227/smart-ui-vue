<template>
  <div class="tenant-container">
    <el-card shadow="never">
      <!-- Search -->
      <div class="tenant-toolbar">
        <div class="tenant-toolbar__left">
          <el-input v-model="query.tenantName" :placeholder="t('system.tenant.tenantName')" clearable style="width: 200px" @clear="fetchData" @keyup.enter="fetchData">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-input v-model="query.tenantCode" :placeholder="t('system.tenant.tenantCode')" clearable style="width: 200px" @clear="fetchData" @keyup.enter="fetchData">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="query.status" :placeholder="t('system.tenant.status')" clearable style="width: 120px" @change="fetchData">
            <el-option :label="t('system.tenant.statusNormal')" value="0" />
            <el-option :label="t('system.tenant.statusDisabled')" value="1" />
          </el-select>
          <el-button type="primary" @click="fetchData">{{ t('system.tenant.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('system.tenant.reset') }}</el-button>
        </div>
        <el-button type="primary" @click="handleAdd">{{ t('system.tenant.add') }}</el-button>
      </div>

      <!-- Table -->
      <el-table v-loading="loading" :data="tableData" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="tenantName" :label="t('system.tenant.tenantName')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="tenantCode" :label="t('system.tenant.tenantCode')" width="140" />
        <el-table-column :label="t('system.tenant.startDate')" width="180">
          <template #default="{ row }">{{ formatDate(row.startTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('system.tenant.endDate')" width="180">
          <template #default="{ row }">{{ formatDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column prop="status" :label="t('system.tenant.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small">
              {{ row.status === '0' ? t('system.tenant.statusNormal') : t('system.tenant.statusDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.tenant.createTime')" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('system.tenant.operation')" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">{{ t('system.tenant.edit') }}</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">{{ t('system.tenant.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="tenant-pagination">
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
        <el-form-item :label="t('system.tenant.tenantName')" prop="tenantName">
          <el-input v-model="form.tenantName" :placeholder="t('system.tenant.enterTenantName')" />
        </el-form-item>
        <el-form-item :label="t('system.tenant.tenantCode')" prop="tenantCode">
          <el-input v-model="form.tenantCode" :placeholder="t('system.tenant.enterTenantCode')" :disabled="isEdit" />
        </el-form-item>
        <el-form-item :label="t('system.tenant.validityPeriod')" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            :range-separator="t('system.tenant.to')"
            :start-placeholder="t('system.tenant.startDate')"
            :end-placeholder="t('system.tenant.endDate')"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('system.tenant.status')" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="0">{{ t('system.tenant.statusNormal') }}</el-radio>
            <el-radio value="1">{{ t('system.tenant.statusDisabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('system.tenant.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from '@element-plus/icons-vue'
import { formatDate, formatDateTime } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { getTenantPage, getTenantById, createTenant, updateTenant, deleteTenant } from '@/api/admin'
import type { SysTenant } from '@/types/api'

const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const isEdit = ref(false)

const tableData = ref<SysTenant[]>([])
const query = reactive({ tenantName: '', tenantCode: '', status: '' })
const page = reactive({ current: 1, size: 10, total: 0 })

interface TenantForm {
  id: number
  tenantName: string
  tenantCode: string
  dateRange: string[]
  status: string
}

const defaultForm = (): TenantForm => ({
  id: 0,
  tenantName: '',
  tenantCode: '',
  dateRange: [],
  status: '0',
})

const form = reactive<TenantForm>(defaultForm())
const dialogTitle = computed(() => isEdit.value ? t('system.tenant.editTitle') : t('system.tenant.addTitle'))

const rules: FormRules = {
  tenantName: [{ required: true, message: t('system.tenant.enterTenantName'), trigger: 'blur' }],
  tenantCode: [{ required: true, message: t('system.tenant.enterTenantCode'), trigger: 'blur' }],
  dateRange: [{ required: true, message: t('system.tenant.validityPeriod'), trigger: 'change' }],
}

async function fetchData() {
  loading.value = true
  try {
    const { data } = await getTenantPage({ current: page.current, size: page.size, ...query })
    tableData.value = data.data.records
    page.total = data.data.total
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.tenantName = ''
  query.tenantCode = ''
  query.status = ''
  page.current = 1
  fetchData()
}

function handleAdd() {
  isEdit.value = false
  Object.assign(form, defaultForm())
  dialogVisible.value = true
}

async function handleEdit(row: SysTenant) {
  isEdit.value = true
  try {
    const { data } = await getTenantById(row.id)
    const tenant = data.data
    Object.assign(form, {
      id: tenant.id,
      tenantName: tenant.tenantName,
      tenantCode: tenant.tenantCode,
      dateRange: tenant.startTime && tenant.endTime ? [tenant.startTime, tenant.endTime] : [],
      status: tenant.status,
    })
    dialogVisible.value = true
  } catch {
    ElMessage.error(t('system.tenant.getInfoFailed'))
  }
}

async function handleDelete(row: SysTenant) {
  try {
    await ElMessageBox.confirm(t('system.tenant.deleteConfirm', { name: row.tenantName }), t('common.warning'), { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteTenant(row.id)
    ElMessage.success(t('system.tenant.deleteSuccess'))
    fetchData()
  } catch {
    ElMessage.error(t('system.tenant.deleteFailed'))
  }
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    // 后端 SysTenant.startTime / endTime 是 OffsetDateTime（要求带时区的完整时间戳，
    // 形如 2026-05-01T00:00:00+08:00），而 el-date-picker 默认输出 'YYYY-MM-DD'
    // 纯日期字符串，Jackson 反序列化会抛 "could not be parsed at index 10" 500 错误。
    // 这里把日期字符串补全为 ISO 时间戳：开始日期取当天 00:00:00、结束日期取 23:59:59，
    // 确保整个有效期当天都被覆盖。
    const payload = {
      id: form.id,
      tenantName: form.tenantName,
      tenantCode: form.tenantCode,
      startTime: toIsoStart(form.dateRange?.[0]),
      endTime: toIsoEnd(form.dateRange?.[1]),
      status: form.status,
    }
    if (isEdit.value) {
      await updateTenant(payload as any)
    } else {
      await createTenant(payload as any)
    }
    ElMessage.success(isEdit.value ? t('system.tenant.updateSuccess') : t('system.tenant.addSuccess'))
    dialogVisible.value = false
    fetchData()
  } catch {
    ElMessage.error(isEdit.value ? t('system.tenant.updateFailed') : t('system.tenant.addFailed'))
  } finally {
    submitting.value = false
  }
}

/**
 * 把 'YYYY-MM-DD' 转成 ISO offset-date-time（开始时刻）：
 *   '2026-05-01' → '2026-05-01T00:00:00+08:00'
 * 后端用 OffsetDateTime 接收，必须带时区。
 */
function toIsoStart(date: string | undefined | null): string | null {
  if (!date) return null
  return `${date}T00:00:00${getLocalTzOffset()}`
}

/**
 * 把 'YYYY-MM-DD' 转成 ISO offset-date-time（当天结束时刻）：
 *   '2026-06-30' → '2026-06-30T23:59:59+08:00'
 */
function toIsoEnd(date: string | undefined | null): string | null {
  if (!date) return null
  return `${date}T23:59:59${getLocalTzOffset()}`
}

/** 取本地时区的 ISO 偏移量，如 '+08:00' / '-05:00' */
function getLocalTzOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
.tenant-container {
  .tenant-toolbar {
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

  .tenant-pagination {
    display: flex;
    justify-content: flex-end;
    padding: 16px 0;
  }
}
</style>