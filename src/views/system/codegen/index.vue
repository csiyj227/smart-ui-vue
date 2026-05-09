<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createGenTable, createGenTemplate, createGenTemplateGroup,
  deleteGenTable, deleteGenTemplate, deleteGenTemplateGroup,
  generateCode, getGenTablePage, getGenTemplateGroupList, getGenTemplateList,
  updateGenTable, updateGenTemplate, updateGenTemplateGroup,
  // 新增：导入 / 下载
  downloadGenZip, listDatabaseTables, importDatabaseTables,
} from '@/api/admin'
import type { GenTable, GenTemplate, GenTemplateGroup } from '@/types/api'

const { t } = useI18n()
const tableLoading = ref(false), templateLoading = ref(false), groupLoading = ref(false)
const tableList = ref<GenTable[]>([]), groupList = ref<GenTemplateGroup[]>([]), templateList = ref<GenTemplate[]>([])
const tableTotal = ref(0); const currentGroupId = ref<number>()
const query = reactive({ current: 1, size: 10 })
const tableVisible = ref(false), groupVisible = ref(false), templateVisible = ref(false)
const tableEdit = ref(false), groupEdit = ref(false), templateEdit = ref(false)
const tableForm = reactive<GenTable>({ id: undefined, tableName: '', className: '', packageName: 'com.smart', moduleName: 'system', businessName: '', functionName: '', functionAuthor: 'admin', genType: '0', tplCategory: '0', genPath: '/' })
const groupForm = reactive<GenTemplateGroup>({ id: undefined, groupName: '', groupCode: '', description: '' })
const templateForm = reactive<GenTemplate>({ id: undefined, groupId: 0, templateName: '', templateCode: '', templateContent: '', filePath: '', fileExtension: '.java', sortOrder: 0 })
const generated = ref<Record<string,string>>({})
const loadTables = async()=>{ tableLoading.value=true; try{ const {data}=await getGenTablePage(query); tableList.value=data.data.records; tableTotal.value=data.data.total } finally{ tableLoading.value=false } }
const loadGroups = async()=>{ groupLoading.value=true; try{ const {data}=await getGenTemplateGroupList(); groupList.value=data.data; if(!currentGroupId.value && groupList.value.length){ currentGroupId.value=groupList.value[0].id; await loadTemplates() } } finally{ groupLoading.value=false } }
const loadTemplates = async()=>{ if(!currentGroupId.value) return; templateLoading.value=true; try{ const {data}=await getGenTemplateList(currentGroupId.value); templateList.value=data.data } finally{ templateLoading.value=false } }
const submitTable = async()=>{ if(tableEdit.value) await updateGenTable(tableForm); else await createGenTable(tableForm); ElMessage.success(t('system.codegen.saveSuccess')); tableVisible.value=false; loadTables() }
const submitGroup = async()=>{ if(groupEdit.value) await updateGenTemplateGroup(groupForm); else await createGenTemplateGroup(groupForm); ElMessage.success(t('system.codegen.saveSuccess')); groupVisible.value=false; loadGroups() }
const submitTemplate = async()=>{ templateForm.groupId = currentGroupId.value || templateForm.groupId; if(templateEdit.value) await updateGenTemplate(templateForm); else await createGenTemplate(templateForm); ElMessage.success(t('system.codegen.saveSuccess')); templateVisible.value=false; loadTemplates() }
const doGenerate = async(row:GenTable)=>{ const {data}=await generateCode(row.id!); generated.value=data.data; ElMessage.success(t('system.codegen.generateSuccess')) }

// ──────────────────── 下载 zip ────────────────────
const doDownload = async (row: GenTable) => {
  // 后端用 blob 返回；这里自己组装 a 标签触发浏览器下载
  const res: any = await downloadGenZip(row.id!)
  // 兼容 axios 包装：data 在 res.data；裸 fetch 直接是 res
  const blob: Blob = res?.data instanceof Blob ? res.data : (res instanceof Blob ? res : new Blob([res?.data ?? res]))
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${row.className || 'code'}_${row.id}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
  ElMessage.success(t('system.codegen.downloadStarted'))
}

// ──────────────────── 从数据库导入 ────────────────────
const importVisible = ref(false)
const importLoading = ref(false)
const importKeyword = ref('')
const dbTables = ref<Array<{ table_name: string; table_comment: string }>>([])
const selectedDbTables = ref<string[]>([])

const openImport = async () => {
  importVisible.value = true
  importKeyword.value = ''
  selectedDbTables.value = []
  await searchDbTables()
}

const searchDbTables = async () => {
  importLoading.value = true
  try {
    const { data } = await listDatabaseTables(importKeyword.value || undefined)
    dbTables.value = (data.data || []) as any
  } finally {
    importLoading.value = false
  }
}

const submitImport = async () => {
  if (!selectedDbTables.value.length) {
    ElMessage.warning(t('system.codegen.selectAtLeastOneTable'))
    return
  }
  await ElMessageBox.confirm(
    t('system.codegen.importConfirm', { count: selectedDbTables.value.length }),
    t('common.warning'),
    { type: 'warning' },
  )
  const { data } = await importDatabaseTables(selectedDbTables.value)
  ElMessage.success(t('system.codegen.importSuccess', { count: data.data?.length ?? 0 }))
  importVisible.value = false
  loadTables()
}
const openTable=(row?:GenTable)=>{ tableEdit.value=!!row; Object.assign(tableForm,row||{ id:undefined, tableName:'', className:'', packageName:'com.smart', moduleName:'system', businessName:'', functionName:'', functionAuthor:'admin', genType:'0', tplCategory:'0', genPath:'/' }); tableVisible.value=true }
const openGroup=(row?:GenTemplateGroup)=>{ groupEdit.value=!!row; Object.assign(groupForm,row||{ id:undefined, groupName:'', groupCode:'', description:'' }); groupVisible.value=true }
const openTemplate=(row?:GenTemplate)=>{ templateEdit.value=!!row; Object.assign(templateForm,row||{ id:undefined, groupId: currentGroupId.value || 0, templateName:'', templateCode:'', templateContent:'', filePath:'', fileExtension:'.java', sortOrder:0 }); templateVisible.value=true }
const removeTable=async(row:GenTable)=>{ await deleteGenTable(row.id!); ElMessage.success(t('system.codegen.deleteSuccess')); loadTables() }
const removeGroup=async(row:GenTemplateGroup)=>{ await deleteGenTemplateGroup(row.id!); ElMessage.success(t('system.codegen.deleteSuccess')); loadGroups() }
const removeTemplate=async(row:GenTemplate)=>{ await deleteGenTemplate(row.id!); ElMessage.success(t('system.codegen.deleteSuccess')); loadTemplates() }
onMounted(async()=>{ await Promise.all([loadTables(), loadGroups()]) })
</script>
<template>
  <div class="codegen-page">
    <el-row :gutter="16">
      <!-- 左：表配置 + 生成结果 -->
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="head">
              <span>{{ t('system.codegen.tableCard') }}</span>
              <div style="display: flex; gap: 8px">
                <el-button type="primary" @click="openImport">{{ t('system.codegen.importFromDb') }}</el-button>
                <el-button @click="openTable()">{{ t('system.codegen.addTableConfig') }}</el-button>
              </div>
            </div>
          </template>
          <el-table :data="tableList" v-loading="tableLoading">
            <el-table-column prop="tableName" :label="t('system.codegen.tableName')" />
            <el-table-column prop="className" :label="t('system.codegen.className')" />
            <el-table-column prop="moduleName" :label="t('system.codegen.moduleName')" />
            <el-table-column prop="functionName" :label="t('system.codegen.functionName')" show-overflow-tooltip />
            <el-table-column :label="t('system.codegen.operation')" width="320" fixed="right" align="center">
              <template #default="{ row }">
                <div class="op-cell">
                  <el-button size="small" type="primary" plain @click="openTable(row)">{{ t('system.codegen.edit') }}</el-button>
                  <el-button size="small" type="success" plain @click="doGenerate(row)">{{ t('system.codegen.preview') }}</el-button>
                  <el-button size="small" type="warning" plain @click="doDownload(row)">{{ t('system.codegen.downloadZip') }}</el-button>
                  <el-button size="small" type="danger" plain @click="removeTable(row)">{{ t('system.codegen.delete') }}</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 16px; display: flex; justify-content: flex-end">
            <el-pagination
              v-model:current-page="query.current"
              v-model:page-size="query.size"
              :total="tableTotal"
              layout="total, prev, pager, next"
              background
              @current-change="loadTables"
            />
          </div>
        </el-card>

        <el-card style="margin-top: 16px">
          <template #header>
            <span>{{ t('system.codegen.generatedPreview', { count: Object.keys(generated).length }) }}</span>
          </template>
          <el-collapse v-if="Object.keys(generated).length">
            <el-collapse-item v-for="(content, key) in generated" :key="key" :title="String(key)">
              <pre class="code-block">{{ content }}</pre>
            </el-collapse-item>
          </el-collapse>
          <el-empty v-else :description="t('system.codegen.previewEmpty')" :image-size="60" />
        </el-card>
      </el-col>

      <!-- 右：模板组 + 模板（保留兼容旧用法，模板已默认走 classpath） -->
      <el-col :span="10">
        <el-card>
          <template #header>
            <div class="head">
              <span>{{ t('system.codegen.templateGroupCard') }}</span>
              <el-button @click="openGroup()">{{ t('system.codegen.addTemplateGroup') }}</el-button>
            </div>
          </template>
          <el-table :data="groupList" v-loading="groupLoading" @row-click="(row:any)=>{ currentGroupId=row.id; loadTemplates() }">
            <el-table-column prop="groupName" :label="t('system.codegen.groupName')" />
            <el-table-column prop="groupCode" :label="t('system.codegen.groupCode')" />
            <el-table-column :label="t('system.codegen.operation')" width="180" fixed="right" align="center">
              <template #default="{ row }">
                <div class="op-cell">
                  <el-button size="small" type="primary" plain @click.stop="openGroup(row)">{{ t('system.codegen.edit') }}</el-button>
                  <el-button size="small" type="danger" plain @click.stop="removeGroup(row)">{{ t('system.codegen.delete') }}</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card style="margin-top: 16px">
          <template #header>
            <div class="head">
              <span>{{ t('system.codegen.templateListCard') }}</span>
              <el-button @click="openTemplate()">{{ t('system.codegen.addTemplate') }}</el-button>
            </div>
          </template>
          <el-table :data="templateList" v-loading="templateLoading">
            <el-table-column prop="templateName" :label="t('system.codegen.templateName')" />
            <el-table-column prop="templateCode" :label="t('system.codegen.templateCode')" />
            <el-table-column :label="t('system.codegen.operation')" width="180" fixed="right" align="center">
              <template #default="{ row }">
                <div class="op-cell">
                  <el-button size="small" type="primary" plain @click="openTemplate(row)">{{ t('system.codegen.edit') }}</el-button>
                  <el-button size="small" type="danger" plain @click="removeTemplate(row)">{{ t('system.codegen.delete') }}</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 新增 / 编辑 表配置 -->
    <el-dialog v-model="tableVisible" :title="tableEdit ? t('system.codegen.editTableTitle') : t('system.codegen.addTableTitle')" width="680px">
      <el-form :model="tableForm" label-width="100px">
        <el-form-item :label="t('system.codegen.tableName')"><el-input v-model="tableForm.tableName" /></el-form-item>
        <el-form-item :label="t('system.codegen.className')"><el-input v-model="tableForm.className" /></el-form-item>
        <el-form-item :label="t('system.codegen.moduleName')"><el-input v-model="tableForm.moduleName" /></el-form-item>
        <el-form-item :label="t('system.codegen.businessName')"><el-input v-model="tableForm.businessName" /></el-form-item>
        <el-form-item :label="t('system.codegen.functionName')"><el-input v-model="tableForm.functionName" /></el-form-item>
        <el-form-item :label="t('system.codegen.packageName')"><el-input v-model="tableForm.packageName" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tableVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitTable">{{ t('system.codegen.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 新增 / 编辑 模板组 -->
    <el-dialog v-model="groupVisible" :title="groupEdit ? t('system.codegen.editGroupTitle') : t('system.codegen.addGroupTitle')" width="520px">
      <el-form :model="groupForm" label-width="90px">
        <el-form-item :label="t('system.codegen.groupName')"><el-input v-model="groupForm.groupName" /></el-form-item>
        <el-form-item :label="t('system.codegen.groupCode')"><el-input v-model="groupForm.groupCode" /></el-form-item>
        <el-form-item :label="t('system.codegen.description')"><el-input v-model="groupForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitGroup">{{ t('system.codegen.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 新增 / 编辑 模板 -->
    <el-dialog v-model="templateVisible" :title="templateEdit ? t('system.codegen.editTemplateTitle') : t('system.codegen.addTemplateTitle')" width="760px">
      <el-form :model="templateForm" label-width="100px">
        <el-form-item :label="t('system.codegen.templateName')"><el-input v-model="templateForm.templateName" /></el-form-item>
        <el-form-item :label="t('system.codegen.templateCode')"><el-input v-model="templateForm.templateCode" /></el-form-item>
        <el-form-item :label="t('system.codegen.filePath')"><el-input v-model="templateForm.filePath" /></el-form-item>
        <el-form-item :label="t('system.codegen.templateContent')"><el-input v-model="templateForm.templateContent" type="textarea" :rows="12" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitTemplate">{{ t('system.codegen.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 从数据库导入 -->
    <el-dialog v-model="importVisible" :title="t('system.codegen.importDialogTitle')" width="720px" destroy-on-close>
      <div style="display: flex; gap: 8px; margin-bottom: 12px">
        <el-input
          v-model="importKeyword"
          :placeholder="t('system.codegen.importSearchPlaceholder')"
          clearable
          style="width: 280px"
          @keyup.enter="searchDbTables"
        />
        <el-button type="primary" @click="searchDbTables">{{ t('system.codegen.importSearch') }}</el-button>
        <span style="margin-left: auto; color: #909399; font-size: 12px; line-height: 32px">
          {{ t('system.codegen.selectedCount', { selected: selectedDbTables.length, total: dbTables.length }) }}
        </span>
      </div>
      <el-table
        v-loading="importLoading"
        :data="dbTables"
        border
        max-height="420"
        @selection-change="(rows: any[]) => (selectedDbTables = rows.map(r => r.table_name))"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="table_name" :label="t('system.codegen.importTableName')" width="240" show-overflow-tooltip />
        <el-table-column prop="table_comment" :label="t('system.codegen.importComment')" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="importVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="!selectedDbTables.length" @click="submitImport">
          {{ t('system.codegen.importBtn', { count: selectedDbTables.length }) }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.code-block {
  white-space: pre-wrap;
  word-break: break-all;
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  max-height: 420px;
  overflow: auto;
  font-family: 'JetBrains Mono', 'Source Code Pro', Consolas, Monaco, monospace;
  font-size: 12px;
}
.op-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}
</style>