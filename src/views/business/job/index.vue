<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getJobPage,
  createJob,
  updateJob,
  deleteJob,
  pauseJob,
  resumeJob,
  runJobOnce,
  getJobLogPage,
  cleanJobLog,
  getJobUpstreams,
  setJobUpstreams,
} from '@/api/business'
import type { SysJob, SysJobLog } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

/**
 * 定时任务页：
 *  - 任务 CRUD / 启停 / 立即执行一次
 *  - Cron 助手（提供 5 个常用预设）
 *  - 执行日志查看
 *  - 任务依赖：选择上游任务
 */
const loading = ref(false)
const list = ref<SysJob[]>([])
const total = ref(0)
const query = reactive({ current: 1, size: 10, keyword: '', status: '' })

const visible = ref(false)
const isEdit = ref(false)
const form = reactive<SysJob>({
  jobId: undefined,
  jobName: '',
  jobGroup: 'DEFAULT',
  invokeTarget: '',
  jobParam: '',
  cronExpression: '',
  misfirePolicy: '1',
  concurrent: '1',
  status: '1',
  alertOnFailure: false,
  alertUserIds: '',
  remark: '',
})

const upstreamIds = ref<number[]>([])

const logVisible = ref(false)
const logQuery = reactive({ current: 1, size: 10, jobId: undefined as number | undefined, status: '' })
const logList = ref<SysJobLog[]>([])
const logTotal = ref(0)
const logLoading = ref(false)

const cronPresets = computed(() => [
  { label: t('job.cronEveryMinute'), value: '0 * * * * ?' },
  { label: t('job.cronEvery5Min'), value: '0 */5 * * * ?' },
  { label: t('job.cronDaily2am'), value: '0 0 2 * * ?' },
  { label: t('job.cronWeeklyMon'), value: '0 0 0 ? * 1' },
  { label: t('job.cronMonthly1st'), value: '0 0 0 1 * ?' },
])

async function load() {
  loading.value = true
  try {
    const { data } = await getJobPage(query)
    list.value = data.data.records
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    jobId: undefined,
    jobName: '',
    jobGroup: 'DEFAULT',
    invokeTarget: '',
    jobParam: '',
    cronExpression: '',
    misfirePolicy: '1',
    concurrent: '1',
    status: '1',
    alertOnFailure: false,
    alertUserIds: '',
    remark: '',
  })
  upstreamIds.value = []
}

function openAdd() {
  isEdit.value = false
  resetForm()
  visible.value = true
}

async function openEdit(row: SysJob) {
  isEdit.value = true
  resetForm()
  Object.assign(form, row)
  visible.value = true
  // 加载上游依赖
  try {
    const res = await getJobUpstreams(row.jobId!)
    upstreamIds.value = res.data.data || []
  } catch {
    upstreamIds.value = []
  }
}

async function submit() {
  if (!form.jobName?.trim()) return ElMessage.warning(t('job.nameRequired'))
  if (!form.invokeTarget?.trim()) return ElMessage.warning(t('job.targetRequired'))
  if (!form.cronExpression?.trim()) return ElMessage.warning(t('job.cronRequired'))
  try {
    if (isEdit.value) {
      await updateJob(form)
    } else {
      await createJob(form)
    }
    if (form.jobId) {
      await setJobUpstreams(form.jobId, upstreamIds.value)
    }
    ElMessage.success(t('job.saveSuccess'))
    visible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(t('job.saveFailed') + (e?.message || e))
  }
}

async function remove(row: SysJob) {
  try {
    await ElMessageBox.confirm(t('job.deleteConfirm', { name: row.jobName }), t('job.confirmTitle'), { type: 'warning' })
  } catch { return }
  try {
    await deleteJob(row.jobId!)
    ElMessage.success(t('job.deleted'))
    load()
  } catch (e: any) {
    ElMessage.error(t('job.deleteFailed') + (e?.message || e))
  }
}

async function toggle(row: SysJob) {
  try {
    if (row.status === '1') {
      await pauseJob(row.jobId!)
      ElMessage.success(t('job.paused'))
    } else {
      await resumeJob(row.jobId!)
      ElMessage.success(t('job.resumed'))
    }
    load()
  } catch (e: any) {
    ElMessage.error(t('job.operationFailed') + (e?.message || e))
  }
}

async function runOnce(row: SysJob) {
  try {
    await runJobOnce(row.jobId!)
    ElMessage.success(t('job.triggered'))
  } catch (e: any) {
    ElMessage.error(t('job.triggerFailed') + (e?.message || e))
  }
}

async function showLogs(row: SysJob) {
  logQuery.jobId = row.jobId
  logQuery.current = 1
  logVisible.value = true
  loadLogs()
}

async function loadLogs() {
  logLoading.value = true
  try {
    const { data } = await getJobLogPage(logQuery)
    logList.value = data.data.records
    logTotal.value = data.data.total
  } finally {
    logLoading.value = false
  }
}

async function clearLogs() {
  await ElMessageBox.confirm(t('job.logCleanConfirm'), t('job.confirmTitle'))
  const { data } = await cleanJobLog(30)
  ElMessage.success(t('job.logCleaned', { count: data.data }))
  loadLogs()
}

const candidateUpstreams = () =>
  list.value.filter((j) => j.jobId !== form.jobId).map((j) => ({ label: `${j.jobName} (#${j.jobId})`, value: j.jobId }))

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <el-input v-model="query.keyword" :placeholder="t('job.jobName')" clearable style="width: 200px" @keyup.enter="load" />
      <el-select v-model="query.status" :placeholder="t('job.status')" clearable style="width: 120px" @change="load">
        <el-option :label="t('job.statusNormal')" value="1" />
        <el-option :label="t('job.statusPaused')" value="0" />
      </el-select>
      <el-button type="primary" @click="load">{{ t('job.search') }}</el-button>
      <el-button @click="openAdd">{{ t('job.addJob') }}</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="jobId" :label="t('job.colId')" width="70" />
      <el-table-column prop="jobName" :label="t('job.jobName')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="jobGroup" :label="t('job.colGroup')" width="100" />
      <el-table-column prop="invokeTarget" :label="t('job.colInvokeTarget')" min-width="200" show-overflow-tooltip />
      <el-table-column prop="cronExpression" :label="t('job.colCron')" width="160" />
      <el-table-column :label="t('job.status')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === '1' ? 'success' : 'info'">
            {{ row.status === '1' ? t('job.statusNormal') : t('job.statusPaused') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('job.colConcurrent')" width="80">
        <template #default="{ row }">{{ row.concurrent === '1' ? t('job.concurrentForbid') : t('job.concurrentAllow') }}</template>
      </el-table-column>
      <el-table-column :label="t('job.colAlertOnFailure')" width="90">
        <template #default="{ row }">{{ row.alertOnFailure ? t('job.yes') : t('job.no') }}</template>
      </el-table-column>
      <el-table-column :label="t('job.colCreateTime')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('job.colAction')" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="runOnce(row)">{{ t('job.runNow') }}</el-button>
          <el-button link @click="toggle(row)">{{ row.status === '1' ? t('job.pause') : t('job.resume') }}</el-button>
          <el-button link @click="showLogs(row)">{{ t('job.logs') }}</el-button>
          <el-button link type="primary" @click="openEdit(row)">{{ t('job.edit') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('job.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        :total="total"
        layout="total, prev, pager, next, jumper"
        @current-change="load"
      />
    </div>

    <!-- 任务编辑弹窗 -->
    <el-dialog v-model="visible" :title="isEdit ? t('job.editJob') : t('job.addJob')" width="780px">
      <el-form :model="form" label-width="110px">
        <el-form-item :label="t('job.jobName')" required>
          <el-input v-model="form.jobName" />
        </el-form-item>
        <el-form-item :label="t('job.formGroup')">
          <el-input v-model="form.jobGroup" :placeholder="t('job.formGroupPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('job.formTarget')" required>
          <el-input
            v-model="form.invokeTarget"
            :placeholder="t('job.formTargetPlaceholder')"
          />
          <div class="hint">{{ t('job.formTargetHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('job.formParam')">
          <el-input v-model="form.jobParam" type="textarea" :rows="2" :placeholder="t('job.formParamPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('job.formCron')" required>
          <el-input v-model="form.cronExpression" :placeholder="t('job.formCronPlaceholder')" />
          <div class="hint">
            {{ t('job.formCronHint') }}
            <el-link
              v-for="p in cronPresets"
              :key="p.value"
              type="primary"
              @click="form.cronExpression = p.value"
              style="margin-right: 12px"
            >{{ p.label }}</el-link>
          </div>
        </el-form-item>
        <el-form-item :label="t('job.formMisfirePolicy')">
          <el-select v-model="form.misfirePolicy">
            <el-option :label="t('job.misfireRunNow')" value="1" />
            <el-option :label="t('job.misfireRunOnce')" value="2" />
            <el-option :label="t('job.misfireIgnore')" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('job.formConcurrent')">
          <el-select v-model="form.concurrent">
            <el-option :label="t('job.concurrentForbidOption')" value="1" />
            <el-option :label="t('job.concurrentAllowOption')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('job.formStatus')">
          <el-select v-model="form.status">
            <el-option :label="t('job.statusNormal')" value="1" />
            <el-option :label="t('job.statusPaused')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('job.formAlert')">
          <el-switch v-model="form.alertOnFailure" />
        </el-form-item>
        <el-form-item :label="t('job.formAlertUsers')">
          <el-input v-model="form.alertUserIds" :placeholder="t('job.formAlertUsersPlaceholder')" />
        </el-form-item>
        <el-form-item v-if="isEdit" :label="t('job.formUpstream')">
          <el-select
            v-model="upstreamIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
            :placeholder="t('job.formUpstreamPlaceholder')"
          >
            <el-option
              v-for="o in candidateUpstreams()"
              :key="o.value"
              :label="o.label"
              :value="o.value!"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('job.formRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t('job.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('job.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 执行日志弹窗 -->
    <el-dialog v-model="logVisible" :title="t('job.logTitle')" width="900px">
      <div class="toolbar" style="margin-bottom: 12px">
        <el-select v-model="logQuery.status" :placeholder="t('job.status')" clearable style="width: 120px" @change="loadLogs">
          <el-option :label="t('job.logStatusSuccess')" value="0" />
          <el-option :label="t('job.logStatusFail')" value="1" />
        </el-select>
        <el-button @click="loadLogs">{{ t('job.logRefresh') }}</el-button>
        <el-button type="danger" @click="clearLogs">{{ t('job.logCleanBtn') }}</el-button>
      </div>
      <el-table :data="logList" v-loading="logLoading" border max-height="420">
        <el-table-column prop="logId" :label="t('job.logColId')" width="70" />
        <el-table-column prop="triggerType" :label="t('job.logColTrigger')" width="100" />
        <el-table-column :label="t('job.logColStatus')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'">
              {{ row.status === '0' ? t('job.logStatusSuccess') : t('job.logStatusFail') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('job.logColStartTime')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.startTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('job.logColDuration')" width="90">
          <template #default="{ row }">{{ row.durationMs }}{{ t('job.logDurationUnit') }}</template>
        </el-table-column>
        <el-table-column prop="result" :label="t('job.logColResult')" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">{{ row.status === '0' ? row.result : row.exceptionInfo }}</template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 12px">
        <el-pagination
          v-model:current-page="logQuery.current"
          v-model:page-size="logQuery.size"
          :total="logTotal"
          layout="total, prev, pager, next"
          @current-change="loadLogs"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.hint {
  margin-top: 6px;
  color: #888;
  font-size: 12px;
}
</style>
