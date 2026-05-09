<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createPost, deletePost, getPostPage, updatePost } from '@/api/admin'
import type { SysPost } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const list = ref<SysPost[]>([])
const total = ref(0)
const query = reactive({ current: 1, size: 10, postName: '', postCode: '', status: '' })
const form = reactive<SysPost>({ postId: undefined as any, postCode: '', postName: '', sortOrder: 0, status: '0', tenantId: 1 })

const load = async () => {
  loading.value = true
  try {
    const { data } = await getPostPage(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, { postId: undefined, postCode: '', postName: '', sortOrder: 0, status: '0', tenantId: 1 })
  dialogVisible.value = true
}

const openEdit = (row: SysPost) => {
  isEdit.value = true
  Object.assign(form, row)
  dialogVisible.value = true
}

const submit = async () => {
  if (!form.postCode?.trim()) return ElMessage.warning(t('system.post.postCodeRequired'))
  if (!form.postName?.trim()) return ElMessage.warning(t('system.post.postNameRequired'))
  try {
    if (isEdit.value) await updatePost(form)
    else await createPost(form)
    ElMessage.success(isEdit.value ? t('system.post.updateSuccess') : t('system.post.addSuccess'))
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(t('system.post.saveFailed') + '：' + (e?.message || e))
  }
}

const remove = async (row: SysPost) => {
  try {
    await ElMessageBox.confirm(t('system.post.deleteConfirm', { name: row.postName }), t('system.post.operation'), { type: 'warning' })
  } catch { return }
  try {
    await deletePost(row.postId)
    ElMessage.success(t('system.post.deleteSuccess'))
    load()
  } catch (e: any) {
    ElMessage.error(t('system.post.deleteFailed') + '：' + (e?.message || e))
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <el-input v-model="query.postName" :placeholder="t('system.post.enterPostName')" clearable style="width: 180px" @keyup.enter="load" />
      <el-input v-model="query.postCode" :placeholder="t('system.post.enterPostCode')" clearable style="width: 180px" @keyup.enter="load" />
      <el-button type="primary" @click="load">{{ t('system.post.query') }}</el-button>
      <el-button @click="openAdd">{{ t('system.post.add') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="postId" :label="t('system.post.id')" width="80" />
      <el-table-column prop="postCode" :label="t('system.post.postCode')" min-width="140" show-overflow-tooltip />
      <el-table-column prop="postName" :label="t('system.post.postName')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="sortOrder" :label="t('system.post.sortOrder')" width="80" align="center" />
      <el-table-column :label="t('system.post.status')" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'info'" size="small">
            {{ row.status === '0' ? t('system.post.statusNormal') : t('system.post.statusDisabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('system.post.createTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.post.operation')" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ t('system.post.edit') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('system.post.delete') }}</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? t('system.post.editPost') : t('system.post.addPost')" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item :label="t('system.post.postCode')" required><el-input v-model="form.postCode" /></el-form-item>
        <el-form-item :label="t('system.post.postName')" required><el-input v-model="form.postName" /></el-form-item>
        <el-form-item :label="t('system.post.sortOrder')"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
        <el-form-item :label="t('system.post.status')">
          <el-select v-model="form.status">
            <el-option :label="t('system.post.statusNormal')" value="0" />
            <el-option :label="t('system.post.statusDisabled')" value="1" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('system.post.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('system.post.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>