<template>
  <div class="log-container">
    <el-card shadow="never">
      <!-- Search Bar -->
      <div class="search-bar">
        <div class="search-fields">
          <el-input
            v-model="query.title"
            :placeholder="t('system.log.title')"
            clearable
            style="width: 180px"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
          <el-select
            v-model="query.logType"
            :placeholder="t('system.log.logType')"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option :label="t('system.log.typeOperation')" value="0" />
            <el-option :label="t('system.log.typeLogin')" value="1" />
            <el-option :label="t('system.log.typeAccess')" value="2" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            :range-separator="t('system.log.to')"
            :start-placeholder="t('system.log.startDate')"
            :end-placeholder="t('system.log.endDate')"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="handleSearch"
          />
          <el-button type="primary" @click="handleSearch">{{ t('system.log.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('system.log.reset') }}</el-button>
        </div>
      </div>

      <!-- Table -->
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        highlight-current-row
        class="log-table"
      >
        <el-table-column prop="logType" :label="t('system.log.logType')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="logTypeTagMap[row.logType] || 'info'" size="small">
              {{ logTypeLabelMap[row.logType] || row.logType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" :label="t('system.log.title')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="serviceId" :label="t('system.log.serviceId')" width="120" show-overflow-tooltip />
        <el-table-column prop="requestUri" :label="t('system.log.requestUri')" min-width="160" show-overflow-tooltip />
        <el-table-column prop="httpMethod" :label="t('system.log.httpMethod')" width="100" align="center" />
        <el-table-column prop="traceId" :label="t('system.log.traceId')" width="160" show-overflow-tooltip />
        <el-table-column prop="createBy" :label="t('system.log.operator')" width="100" show-overflow-tooltip />
        <el-table-column prop="executionTime" :label="t('system.log.executionTime')" width="120" align="center">
          <template #default="{ row }">
            <span :class="{ 'slow-query': row.executionTime > 3000 }">
              {{ row.executionTime }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.log.createTime')" width="180">
            <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
          </el-table-column>
        <el-table-column :label="t('system.log.operation')" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">{{ t('system.log.detail') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="page.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @change="fetchData"
        />
      </div>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      :title="t('system.log.detailTitle')"
      width="700px"
      destroy-on-close
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('system.log.logType')">
          <el-tag :type="logTypeTagMap[currentLog?.logType || ''] || 'info'" size="small">
            {{ logTypeLabelMap[currentLog?.logType || ''] || currentLog?.logType }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('system.log.title')">{{ currentLog?.title }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.serviceId')">{{ currentLog?.serviceId }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.httpMethod')">{{ currentLog?.httpMethod }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.requestUri')" :span="2">{{ currentLog?.requestUri }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.className')">{{ currentLog?.className }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.methodName')">{{ currentLog?.methodName }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.remoteAddr')">{{ currentLog?.remoteAddr }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.executionTime')">{{ currentLog?.executionTime }} ms</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.operator')">{{ currentLog?.createBy }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.createTime')">{{ formatDateTime(currentLog?.createTime) }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.traceId')" :span="2">
          <el-text v-if="(currentLog as any)?.traceId" type="info" size="small" style="font-family: monospace">{{ (currentLog as any).traceId }}</el-text>
          <span v-else style="color: var(--el-text-color-disabled)">—</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('system.log.userAgent')" :span="2">{{ currentLog?.userAgent }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.log.params')" :span="2">
          <pre class="log-pre">{{ formatJson(currentLog?.params) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item :label="t('system.log.exception')" :span="2">
          <pre v-if="currentLog?.exception" class="log-pre log-exception">{{ currentLog.exception }}</pre>
          <span v-else class="no-exception">{{ t('system.log.none') }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">{{ t('system.log.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SysLog } from '@/types/api'
import { getLogPage } from '@/api/admin'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

const logTypeLabelMap: Record<string, string> = {
  '0': t('system.log.typeOperation'),
  '1': t('system.log.typeLogin'),
  '2': t('system.log.typeAccess'),
}

const logTypeTagMap: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  '0': 'primary',
  '1': 'success',
  '2': 'warning',
}

const loading = ref(false)
const tableData = ref<SysLog[]>([])
const dateRange = ref<[string, string] | null>(null)
const query = reactive({
  title: '',
  logType: '',
})
const page = reactive({
  current: 1,
  size: 10,
  total: 0,
})

function handleSearch() {
  page.current = 1
  fetchData()
}

function resetQuery() {
  query.title = ''
  query.logType = ''
  dateRange.value = null
  page.current = 1
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const params: any = {
      current: page.current,
      size: page.size,
      ...query,
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.createTimeStart = dateRange.value[0]
      params.createTimeEnd = dateRange.value[1]
    }
    const { data } = await getLogPage(params)
    tableData.value = data.data.records
    page.total = data.data.total
  } finally {
    loading.value = false
  }
}

// Detail dialog
const detailVisible = ref(false)
const currentLog = ref<SysLog | null>(null)

function handleView(row: SysLog) {
  currentLog.value = row
  detailVisible.value = true
}

function formatJson(str?: string): string {
  if (!str) return ''
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style lang="scss" scoped>
.log-container {
  background: var(--color-bg, #f5f7fa);
  min-height: 100%;
  box-sizing: border-box;
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

.log-table {
  width: 100%;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.slow-query {
  color: var(--el-color-danger, #f56c6c);
  font-weight: bold;
}

.log-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
}

.log-exception {
  color: var(--el-color-danger, #f56c6c);
}

.no-exception {
  color: var(--el-color-success, #67c23a);
}
</style>