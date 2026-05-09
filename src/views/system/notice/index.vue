<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createNotice, deleteNotice, getNoticePage, updateNotice } from '@/api/admin'
import type { SysNotice } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

const loading = ref(false)
const visible = ref(false)
const isEdit = ref(false)
const list = ref<SysNotice[]>([])
const total = ref(0)
const query = reactive({ current: 1, size: 10, noticeTitle: '', status: '' })
const form = reactive<SysNotice>({
  noticeId: undefined,
  noticeTitle: '',
  noticeType: '1',
  noticeContent: '',
  publisher: '',
  priority: '2',
  status: '1',
})

const PRIORITY_MAP: Record<string, { label: string; type: 'info' | 'warning' | 'danger' }> = {
  '1': { label: t('system.notice.priorityLow'), type: 'info' },
  '2': { label: t('system.notice.priorityMedium'), type: 'warning' },
  '3': { label: t('system.notice.priorityHigh'), type: 'danger' },
}

const load = async () => {
  loading.value = true
  try {
    const { data } = await getNoticePage(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, {
    noticeId: undefined,
    noticeTitle: '',
    noticeType: '1',
    noticeContent: '',
    publisher: '',
    priority: '2',
    status: '1',
  })
  visible.value = true
}

const openEdit = (row: SysNotice) => {
  isEdit.value = true
  Object.assign(form, row)
  visible.value = true
}

const submit = async () => {
  if (!form.noticeTitle?.trim()) return ElMessage.warning(t('system.notice.titleRequired'))
  if (!form.noticeContent?.trim()) return ElMessage.warning(t('system.notice.contentRequired'))
  try {
    if (isEdit.value) await updateNotice(form)
    else await createNotice(form)
    ElMessage.success(isEdit.value ? t('system.notice.updateSuccess') : t('system.notice.addSuccess'))
    visible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(t('system.notice.saveFailed', { error: e?.message || e }))
  }
}

const remove = async (row: SysNotice) => {
  try {
    await ElMessageBox.confirm(t('system.notice.deleteConfirm', { title: row.noticeTitle }), t('common.tip'), { type: 'warning' })
  } catch { return }
  try {
    await deleteNotice(row.noticeId!)
    ElMessage.success(t('system.notice.deleteSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.notice.deleteFailed', { error: e?.message || e }))
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-input v-model="query.noticeTitle" :placeholder="t('system.notice.title')" clearable style="width: 220px" @keyup.enter="load" />
      <el-button type="primary" @click="load">{{ t('system.notice.search') }}</el-button>
      <el-button @click="openAdd">{{ t('system.notice.add') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="noticeId" label="ID" width="80" />
      <el-table-column prop="noticeTitle" :label="t('system.notice.title')" min-width="200" show-overflow-tooltip />
      <el-table-column :label="t('system.notice.type')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.noticeType === '1' ? 'primary' : 'success'">
            {{ row.noticeType === '1' ? t('system.notice.typeNotification') : t('system.notice.typeAnnouncement') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.notice.priority')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="PRIORITY_MAP[row.priority]?.type || 'info'">
            {{ PRIORITY_MAP[row.priority]?.label || row.priority }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.notice.status')" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === '1' ? 'success' : 'info'">
            {{ row.status === '1' ? t('system.notice.statusPublished') : t('system.notice.statusDraft') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="publisher" :label="t('system.notice.publisher')" width="120" show-overflow-tooltip />
      <el-table-column :label="t('system.notice.publishTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.publishTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.notice.createTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.notice.operation')" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ t('system.notice.edit') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('system.notice.delete') }}</el-button>
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

    <el-dialog v-model="visible" :title="isEdit ? t('system.notice.editTitle') : t('system.notice.addTitle')" width="680px">
      <el-form :model="form" label-width="90px">
        <el-form-item :label="t('system.notice.title')" required><el-input v-model="form.noticeTitle" /></el-form-item>
        <el-form-item :label="t('system.notice.type')">
          <el-select v-model="form.noticeType">
            <el-option :label="t('system.notice.typeNotification')" value="1" />
            <el-option :label="t('system.notice.typeAnnouncement')" value="2" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('system.notice.publisher')"><el-input v-model="form.publisher" /></el-form-item>
        <el-form-item :label="t('system.notice.priority')">
          <el-select v-model="form.priority">
            <el-option :label="t('system.notice.priorityLow')" value="1" />
            <el-option :label="t('system.notice.priorityMedium')" value="2" />
            <el-option :label="t('system.notice.priorityHigh')" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('system.notice.status')">
          <el-select v-model="form.status">
            <el-option :label="t('system.notice.statusDraft')" value="0" />
            <el-option :label="t('system.notice.statusPublished')" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('system.notice.content')" required>
          <el-input v-model="form.noticeContent" type="textarea" :rows="6" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('system.notice.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>