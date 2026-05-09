<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  cleanupOnlineUser,
  forceLogoutOnlineToken,
  forceLogoutOnlineUser,
  getOnlineUserCount,
  getOnlineUserList,
} from '@/api/admin'
import type { OnlineUser } from '@/types/api'
import { useUserStore } from '@/stores/user'
import { formatDateTime } from '@/utils/format'

const userStore = useUserStore()
const { t } = useI18n()
const currentUserId = computed(() => Number(userStore.userInfo?.userId ?? 0))

const loading = ref(false)
const list = ref<OnlineUser[]>([])
const count = ref(0)

const load = async () => {
  loading.value = true
  try {
    const [a, b] = await Promise.all([getOnlineUserList(), getOnlineUserCount()])
    list.value = (a.data.data || []) as OnlineUser[]
    count.value = b.data.data || 0
  } finally {
    loading.value = false
  }
}

const isSelf = (row: OnlineUser): boolean => {
  if (!currentUserId.value) return false
  return Number(row.userId) === currentUserId.value
}

// 取 token 的短哈希展示，避免列表里露完整 token
const tokenShort = (token?: string): string => {
  if (!token) return '-'
  if (token.length <= 16) return token
  return token.slice(0, 8) + '...' + token.slice(-6)
}

const logoutByUser = async (row: OnlineUser) => {
  const self = isSelf(row)
  const tip = self
    ? t('system.onlineUser.logoutSelfWarning')
    : t('system.onlineUser.logoutUserConfirm', { username: row.username || row.userId })
  try {
    await ElMessageBox.confirm(tip, t('system.onlineUser.logoutUserTitle'), {
      type: self ? 'error' : 'warning',
      confirmButtonText: self ? t('system.onlineUser.confirmLogoutSelf') : t('system.onlineUser.confirm'),
    })
  } catch { return }
  try {
    await forceLogoutOnlineUser(Number(row.userId))
    ElMessage.success(t('system.onlineUser.logoutSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.onlineUser.logoutFailed', { error: e?.message || e }))
  }
}

const logoutByToken = async (row: OnlineUser) => {
  const token = row.token || row.tokenHash || row.accessToken
  if (!token) {
    ElMessage.warning(t('system.onlineUser.noToken'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('system.onlineUser.logoutByTokenConfirm', { token: tokenShort(String(token)) }),
      t('system.onlineUser.logoutByTokenTitle'),
      { type: 'warning' },
    )
  } catch { return }
  try {
    await forceLogoutOnlineToken(String(token))
    ElMessage.success(t('system.onlineUser.logoutByTokenSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.onlineUser.logoutFailed', { error: e?.message || e }))
  }
}

const cleanup = async () => {
  try {
    await ElMessageBox.confirm(t('system.onlineUser.cleanupConfirm'), t('system.onlineUser.cleanupTitle'), {
      type: 'info',
    })
  } catch { return }
  try {
    await cleanupOnlineUser()
    ElMessage.success(t('system.onlineUser.cleanupSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.onlineUser.cleanupFailed', { error: e?.message || e }))
  }
}

onMounted(load)
</script>

<template>
  <div class="online-user-page">
    <div class="toolbar">
      <el-tag type="success" size="large">{{ t('system.onlineUser.onlineCount') }}{{ count }}</el-tag>
      <el-button type="primary" @click="load">{{ t('system.onlineUser.refresh') }}</el-button>
      <el-button type="warning" plain @click="cleanup">{{ t('system.onlineUser.cleanup') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="userId" :label="t('system.onlineUser.userId')" width="90" align="center" />
      <el-table-column :label="t('system.onlineUser.username')" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.username || '-' }}</span>
          <el-tag v-if="isSelf(row)" size="small" type="success" style="margin-left: 6px">{{ t('system.onlineUser.self') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="realName" :label="t('system.onlineUser.realName')" width="120" show-overflow-tooltip />
      <el-table-column prop="tenantId" :label="t('system.onlineUser.tenantId')" width="80" align="center" />
      <el-table-column prop="ip" :label="t('system.onlineUser.ip')" width="140" show-overflow-tooltip />
      <el-table-column prop="userAgent" :label="t('system.onlineUser.userAgent')" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="ua-text">{{ row.userAgent || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.onlineUser.loginTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.loginTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.onlineUser.token')" width="180">
        <template #default="{ row }">
          <span class="token-text">{{ tokenShort(row.token || row.tokenHash || row.accessToken) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.onlineUser.operation')" width="240" fixed="right" align="center">
        <template #default="{ row }">
          <div class="op-cell">
            <el-button size="small" type="danger" plain @click="logoutByUser(row)">{{ t('system.onlineUser.logoutByUser') }}</el-button>
            <el-button size="small" type="warning" plain @click="logoutByToken(row)">{{ t('system.onlineUser.logoutByToken') }}</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.online-user-page {
  padding: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.ua-text {
  color: #909399;
  font-size: 12px;
}
.token-text {
  color: #606266;
  font-family: 'Menlo', Consolas, monospace;
  font-size: 12px;
}
/* .op-cell 公共样式见全局 element-override.scss */

/*
 * 注：fixed 列样式 + .op-cell 操作列布局已抽到全局
 * src/theme/element-override.scss，所有 <el-table> 自动生效。
 * 本页面不再重复定义这些样式。
 */
</style>