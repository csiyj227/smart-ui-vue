<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { clearLoginLog, getLoginLogPage } from '@/api/admin'
import type { SysLoginLog } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const { t } = useI18n()
const list = ref<SysLoginLog[]>([])
const total = ref(0)

const query = reactive({
  current: 1,
  size: 10,
  username: '',
  status: '',
  loginType: '',
})

// 详情弹窗
const detailVisible = ref(false)
const detailRow = ref<SysLoginLog | null>(null)

const load = async () => {
  loading.value = true
  try {
    const { data } = await getLoginLogPage(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

const reset = () => {
  query.username = ''
  query.status = ''
  query.loginType = ''
  query.current = 1
  load()
}

const clear = async () => {
  try {
    await ElMessageBox.confirm(t('system.loginLog.clearConfirm'), t('common.tip'), {
      type: 'warning',
    })
  } catch { return }
  try {
    await clearLoginLog()
    ElMessage.success(t('system.loginLog.clearSubmitted'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.loginLog.clearFailed', { error: e?.message || e }))
  }
}

const showDetail = (row: SysLoginLog) => {
  detailRow.value = row
  detailVisible.value = true
}

// 状态枚举：与后端 LoginEventType / SysLoginLog.status 对齐
const STATUS_MAP = computed(() => ({
  '0': { label: t('system.loginLog.statusSuccess'), type: 'success' as const },
  '1': { label: t('system.loginLog.statusFailed'), type: 'danger' as const },
  '2': { label: t('system.loginLog.statusLocked'), type: 'warning' as const },
  '3': { label: t('system.loginLog.statusLogout'), type: 'info' as const },
}))
const statusOf = (s?: string) => (STATUS_MAP.value as Record<string, { label: string; type: string }>)[String(s ?? '')] ?? { label: s ?? '-', type: 'info' as const }

const TYPE_MAP = computed(() => ({
  password: t('system.loginLog.typePassword'),
  sms: t('system.loginLog.typeSms'),
  social: t('system.loginLog.typeSocial'),
  refresh_token: t('system.loginLog.typeRefreshToken'),
  logout: t('system.loginLog.typeLogout'),
}))
const typeOf = (tVal?: string) => (TYPE_MAP.value as any)[String(tVal ?? '')] ?? (tVal || '-')

onMounted(load)
</script>

<template>
  <div class="login-log-page">
    <!-- 搜索栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.username"
        :placeholder="t('system.loginLog.username')"
        clearable
        style="width: 180px"
        @keyup.enter="load"
      />
      <el-select v-model="query.status" :placeholder="t('system.loginLog.status')" clearable style="width: 140px">
        <el-option :label="t('system.loginLog.statusSuccess')" value="0" />
        <el-option :label="t('system.loginLog.statusFailed')" value="1" />
        <el-option :label="t('system.loginLog.statusLocked')" value="2" />
        <el-option :label="t('system.loginLog.statusLogout')" value="3" />
      </el-select>
      <el-select v-model="query.loginType" :placeholder="t('system.loginLog.loginType')" clearable style="width: 160px">
        <el-option :label="t('system.loginLog.typePassword')" value="password" />
        <el-option :label="t('system.loginLog.typeSms')" value="sms" />
        <el-option :label="t('system.loginLog.typeSocial')" value="social" />
        <el-option :label="t('system.loginLog.typeRefreshToken')" value="refresh_token" />
        <el-option :label="t('system.loginLog.typeLogout')" value="logout" />
      </el-select>
      <el-button type="primary" @click="load">{{ t('system.loginLog.search') }}</el-button>
      <el-button @click="reset">{{ t('system.loginLog.reset') }}</el-button>
      <el-button type="danger" plain @click="clear">{{ t('system.loginLog.clearOld') }}</el-button>
    </div>

    <!-- 列表 -->
    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" :label="'ID'" width="80" />
      <el-table-column prop="username" :label="t('system.loginLog.username')" width="140" show-overflow-tooltip />
      <el-table-column :label="t('system.loginLog.loginType')" width="120">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ typeOf(row.loginType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.loginLog.status')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="(statusOf(row.status).type as any)">{{ statusOf(row.status).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ip" :label="t('system.onlineUser.ip')" width="140" show-overflow-tooltip />
      <el-table-column prop="msg" :label="t('system.loginLog.message')" min-width="200" show-overflow-tooltip />
      <el-table-column :label="t('system.loginLog.time')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.loginLog.operation')" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">{{ t('system.loginLog.detail') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
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

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="t('system.loginLog.detailTitle')" width="640px">
      <el-descriptions v-if="detailRow" :column="2" border size="small">
        <el-descriptions-item :label="'ID'">{{ detailRow.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.username')">{{ detailRow.username || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.userId')">{{ detailRow.userId ?? '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.tenantId')">{{ detailRow.tenantId ?? '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.loginType')">{{ typeOf(detailRow.loginType) }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.status')">
          <el-tag size="small" :type="(statusOf(detailRow.status).type as any)">
            {{ statusOf(detailRow.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('system.onlineUser.ip')">{{ detailRow.ip || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.location')">{{ detailRow.location || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.time')">{{ detailRow.createTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('system.onlineUser.userAgent')" :span="2">
          <span class="ua-text">{{ detailRow.userAgent || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('system.loginLog.message')" :span="2">{{ detailRow.msg || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detailRow.accessToken" :label="t('system.onlineUser.token')" :span="2">
          <span class="token-text">{{ detailRow.accessToken }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<style scoped>
.login-log-page {
  padding: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.ua-text,
.token-text {
  word-break: break-all;
  color: #606266;
  font-family: 'Menlo', Consolas, monospace;
  font-size: 12px;
}
</style>