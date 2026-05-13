<template>
  <div class="field-property-panel">
    <el-form label-position="top" size="small">
      <!-- 全局配置模式 -->
      <template v-if="!field">
        <el-divider content-position="left">表单全局配置</el-divider>

        <el-form-item label="标签位置">
          <el-radio-group v-model="localConfig.labelPosition" @change="handleConfigChange">
            <el-radio-button value="top">顶部</el-radio-button>
            <el-radio-button value="left">左侧</el-radio-button>
            <el-radio-button value="right">右侧</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="标签宽度">
          <el-input v-model="localConfig.labelWidth" placeholder="如: 100px" @change="handleConfigChange" />
        </el-form-item>

        <el-form-item label="表单尺寸">
          <el-radio-group v-model="localConfig.size" @change="handleConfigChange">
            <el-radio-button value="large">大</el-radio-button>
            <el-radio-button value="default">默认</el-radio-button>
            <el-radio-button value="small">小</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </template>

      <!-- 字段配置模式 -->
      <template v-else>
        <el-tabs v-model="activeTab">
          <!-- 属性 Tab -->
          <el-tab-pane label="属性" name="property">
            <!-- 通用属性 -->
            <el-divider content-position="left">通用属性</el-divider>

            <el-form-item label="字段标识">
              <el-input v-model="field.fieldKey" disabled />
            </el-form-item>

            <el-form-item label="字段标签">
              <el-input v-model="localField!.label" @change="handleFieldChange('label', $event)" />
            </el-form-item>

            <el-form-item label="占位提示">
              <el-input v-model="localField!.placeholder" @change="handleFieldChange('placeholder', $event)" />
            </el-form-item>

            <el-form-item label="栅格跨度">
              <el-slider
                v-model="localField!.span"
                :min="1"
                :max="24"
                :show-input="true"
                @change="(val) => handleFieldChange('span', val)"
              />
            </el-form-item>

            <el-form-item label="只读">
              <el-switch v-model="localField!.readonly" @change="(val) => handleFieldChange('readonly', val)" />
            </el-form-item>

            <el-form-item label="隐藏">
              <el-switch v-model="localField!.hidden" @change="(val) => handleFieldChange('hidden', val)" />
            </el-form-item>

            <!-- 特定类型属性 -->
            <template v-if="specificTypeFields.length > 0">
              <el-divider content-position="left">类型专属配置</el-divider>

              <!-- SELECT 类型 -->
              <template v-if="field.fieldType === 'SELECT'">
                <el-form-item label="选项列表">
                  <div class="option-editor">
                    <div v-for="(option, index) in localField!.options" :key="index" class="option-row">
                      <el-input v-model="option.label" placeholder="标签" size="small" style="width: 45%" @change="handleOptionsChange" />
                      <el-input v-model="option.value" placeholder="值" size="small" style="width: 45%" @change="handleOptionsChange" />
                      <el-button type="danger" size="small" icon="Delete" @click="removeOption(index)" />
                    </div>
                    <el-button type="primary" size="small" icon="Plus" @click="addOption">添加选项</el-button>
                  </div>
                </el-form-item>

                <el-form-item label="多选">
                  <el-switch v-model="localField!.multiple" @change="(val) => handleFieldChange('multiple', val)" />
                </el-form-item>
              </template>

              <!-- NUMBER 类型 -->
              <template v-if="field.fieldType === 'NUMBER'">
                <el-form-item label="精度">
                  <el-input-number v-model="localField!.precision" :min="0" @change="(val) => handleFieldChange('precision', val)" />
                </el-form-item>

                <el-form-item label="步进">
                  <el-input-number v-model="localField!.step" :min="0" @change="(val) => handleFieldChange('step', val)" />
                </el-form-item>
              </template>

              <!-- DATE 类型 -->
              <template v-if="field.fieldType === 'DATE'">
                <el-form-item label="日期类型">
                  <el-select v-model="localField!.dateType" @change="(val) => handleFieldChange('dateType', val)">
                    <el-option label="日期" value="date" />
                    <el-option label="日期时间" value="datetime" />
                    <el-option label="日期范围" value="daterange" />
                    <el-option label="日期时间范围" value="datetimerange" />
                    <el-option label="月份" value="month" />
                    <el-option label="年份" value="year" />
                  </el-select>
                </el-form-item>

                <el-form-item label="日期格式">
                  <el-input v-model="localField!.dateFormat" placeholder="如: YYYY-MM-DD" @change="handleFieldChange('dateFormat', $event)" />
                </el-form-item>
              </template>

              <!-- UPLOAD 类型 -->
              <template v-if="field.fieldType === 'UPLOAD'">
                <el-form-item label="允许文件类型">
                  <el-input v-model="localField!.acceptFileTypes" placeholder="如: .jpg,.png,.pdf" @change="handleFieldChange('acceptFileTypes', $event)" />
                </el-form-item>

                <el-form-item label="最大文件数">
                  <el-input-number v-model="localField!.maxFileCount" :min="1" @change="(val) => handleFieldChange('maxFileCount', val)" />
                </el-form-item>

                <el-form-item label="单文件最大大小(MB)">
                  <el-input-number v-model="localField!.maxFileSizeMb" :min="1" @change="(val) => handleFieldChange('maxFileSizeMb', val)" />
                </el-form-item>
              </template>

              <!-- RICH_TEXT 类型 -->
              <template v-if="field.fieldType === 'RICH_TEXT'">
                <el-form-item label="编辑器高度">
                  <el-input-number v-model="localField!.editorHeight" :min="100" @change="(val) => handleFieldChange('editorHeight', val)" />
                </el-form-item>
              </template>

              <!-- CASCADER 类型 -->
              <template v-if="field.fieldType === 'CASCADER'">
                <el-form-item label="级联选项(JSON)">
                  <el-input
                    v-model="cascaderOptionsJson"
                    type="textarea"
                    :rows="6"
                    placeholder='[{"label": "选项1", "value": "1"}]'
                    @change="handleCascaderOptionsChange"
                  />
                </el-form-item>
              </template>

              <!-- USER_SELECT/DEPT_SELECT/ROLE_SELECT 类型 -->
              <template v-if="['USER_SELECT', 'DEPT_SELECT', 'ROLE_SELECT'].includes(field.fieldType)">
                <el-form-item label="多选">
                  <el-switch v-model="localField!.multiple" @change="(val) => handleFieldChange('multiple', val)" />
                </el-form-item>
              </template>

              <!-- TABS 类型 -->
              <template v-if="field.fieldType === 'TABS'">
                <el-form-item label="标签页管理">
                  <div class="tab-manager">
                    <div v-for="(tab, index) in localField!.tabs" :key="tab.key" class="tab-row">
                      <el-input v-model="tab.label" placeholder="标签名称" size="small" style="flex: 1" @change="handleTabsChange" />
                      <el-button type="danger" size="small" icon="Delete" @click="removeTab(index)" />
                    </div>
                    <el-button type="primary" size="small" icon="Plus" @click="addTab">添加标签页</el-button>
                  </div>
                </el-form-item>
              </template>

              <!-- GRID 类型 -->
              <template v-if="field.fieldType === 'GRID'">
                <el-form-item label="列管理">
                  <div class="grid-manager">
                    <div v-for="(col, index) in localField!.columns" :key="index" class="grid-row">
                      <el-input-number v-model="col.span" :min="1" :max="24" size="small" style="width: 60%" @change="handleColumnsChange" />
                      <el-button type="danger" size="small" icon="Delete" @click="removeColumn(index)" />
                    </div>
                    <el-button type="primary" size="small" icon="Plus" @click="addColumn">添加列</el-button>
                  </div>
                </el-form-item>
              </template>
            </template>
          </el-tab-pane>

          <!-- 校验 Tab（仅非布局字段显示） -->
          <el-tab-pane v-if="!isLayoutField" label="校验" name="validation">
            <el-divider content-position="left">校验规则</el-divider>

            <el-form-item label="必填">
              <el-switch v-model="localValidation.required" @change="(val) => handleValidationChange('required', val)" />
            </el-form-item>

            <el-form-item label="必填提示">
              <el-input v-model="localValidation.requiredMessage" @change="handleValidationChange('requiredMessage', $event)" />
            </el-form-item>

            <!-- INPUT/TEXTAREA 专属校验 -->
            <template v-if="['INPUT', 'TEXTAREA'].includes(field.fieldType)">
              <el-form-item label="最小长度">
                <el-input-number v-model="localValidation.minLength" :min="0" @change="(val) => handleValidationChange('minLength', val)" />
              </el-form-item>

              <el-form-item label="最大长度">
                <el-input-number v-model="localValidation.maxLength" :min="0" @change="(val) => handleValidationChange('maxLength', val)" />
              </el-form-item>
            </template>

            <!-- NUMBER 专属校验 -->
            <template v-if="field.fieldType === 'NUMBER'">
              <el-form-item label="最小值">
                <el-input-number v-model="localValidation.min" @change="(val) => handleValidationChange('min', val)" />
              </el-form-item>

              <el-form-item label="最大值">
                <el-input-number v-model="localValidation.max" @change="(val) => handleValidationChange('max', val)" />
              </el-form-item>
            </template>

            <el-form-item label="正则表达式">
              <el-input v-model="localValidation.pattern" placeholder="如: ^[0-9]+$" @change="handleValidationChange('pattern', $event)" />
            </el-form-item>

            <el-form-item label="正则提示">
              <el-input v-model="localValidation.patternMessage" @change="handleValidationChange('patternMessage', $event)" />
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FormFieldSchema, FormGlobalConfig, SelectOption, FormTabPane, FormGridColumn } from '@/types/form'

interface Props {
  field: FormFieldSchema | null
  formConfig: FormGlobalConfig
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update-field': [fieldKey: string, updates: Partial<FormFieldSchema>]
  'update-config': [updates: Partial<FormGlobalConfig>]
}>()

// 布局字段类型
const LAYOUT_FIELD_TYPES = ['GROUP', 'TABS', 'GRID']

// 判断是否为布局字段
const isLayoutField = computed(() => {
  return props.field ? LAYOUT_FIELD_TYPES.includes(props.field.fieldType) : false
})

// 需要显示特定类型属性的字段类型
const specificTypeFields = computed(() => {
  if (!props.field) return []
  const types = ['SELECT', 'NUMBER', 'DATE', 'UPLOAD', 'RICH_TEXT', 'CASCADER', 'USER_SELECT', 'DEPT_SELECT', 'ROLE_SELECT', 'TABS', 'GRID']
  return types.filter(type => type === props.field?.fieldType)
})

// 全局配置本地副本
const localConfig = ref<FormGlobalConfig>({ ...props.formConfig })

// 字段本地副本
const localField = ref<FormFieldSchema | null>(null)

// 校验规则本地副本
const localValidation = ref(props.field?.validation || {})

// 级联选项 JSON 字符串
const cascaderOptionsJson = computed({
  get() {
    if (localField.value?.cascaderOptions) {
      return JSON.stringify(localField.value.cascaderOptions, null, 2)
    }
    return ''
  },
  set(val: string) {
    // 在 handleCascaderOptionsChange 中处理
  }
})

// 当前激活的 Tab
const activeTab = ref('property')

// 监听 field 变化，同步本地状态
watch(
  () => props.field,
  (newField) => {
    if (newField) {
      localField.value = { ...newField }
      localValidation.value = { ...(newField.validation || {}) }
    } else {
      localField.value = null
    }
  },
  { immediate: true, deep: true }
)

// 监听 formConfig 变化
watch(
  () => props.formConfig,
  (newConfig) => {
    localConfig.value = { ...newConfig }
  },
  { immediate: true, deep: true }
)

// 更新字段属性
const handleFieldChange = (key: keyof FormFieldSchema, value: any) => {
  if (!props.field) return
  emit('update-field', props.field.fieldKey, { [key]: value })
}

// 更新全局配置
const handleConfigChange = () => {
  emit('update-config', { ...localConfig.value })
}

// 更新校验规则
const handleValidationChange = (key: keyof typeof localValidation.value, value: any) => {
  localValidation.value[key] = value
  if (props.field) {
    emit('update-field', props.field.fieldKey, { validation: { ...localValidation.value } })
  }
}

// SELECT 选项管理
const addOption = () => {
  if (!localField.value) return
  if (!localField.value.options) {
    localField.value.options = []
  }
  localField.value!.options.push({ label: '', value: '' })
  handleOptionsChange()
}

const removeOption = (index: number) => {
  if (!localField.value?.options) return
  localField.value!.options.splice(index, 1)
  handleOptionsChange()
}

const handleOptionsChange = () => {
  if (props.field && localField.value?.options) {
    emit('update-field', props.field.fieldKey, { options: [...localField.value!.options] })
  }
}

// CASCADER 选项管理
const handleCascaderOptionsChange = () => {
  if (!props.field || !localField.value) return
  try {
    const parsed = JSON.parse(cascaderOptionsJson.value)
    emit('update-field', props.field.fieldKey, { cascaderOptions: parsed })
  } catch (e) {
    console.error('Invalid JSON for cascader options', e)
  }
}

// TABS 管理
const addTab = () => {
  if (!localField.value) return
  if (!localField.value.tabs) {
    localField.value.tabs = []
  }
  const newKey = `tab_${Date.now()}`
  localField.value!.tabs.push({ key: newKey, label: '新标签页', children: [] })
  handleTabsChange()
}

const removeTab = (index: number) => {
  if (!localField.value?.tabs) return
  localField.value!.tabs.splice(index, 1)
  handleTabsChange()
}

const handleTabsChange = () => {
  if (props.field && localField.value?.tabs) {
    emit('update-field', props.field.fieldKey, { tabs: [...localField.value!.tabs] })
  }
}

// GRID 列管理
const addColumn = () => {
  if (!localField.value) return
  if (!localField.value.columns) {
    localField.value.columns = []
  }
  localField.value!.columns.push({ span: 12, children: [] })
  handleColumnsChange()
}

const removeColumn = (index: number) => {
  if (!localField.value?.columns) return
  localField.value!.columns.splice(index, 1)
  handleColumnsChange()
}

const handleColumnsChange = () => {
  if (props.field && localField.value?.columns) {
    emit('update-field', props.field.fieldKey, { columns: [...localField.value!.columns] })
  }
}
</script>

<style scoped lang="scss">
.field-property-panel {
  height: 100%;
  overflow-y: auto;
  padding: 16px;

  &__section {
    margin-bottom: 16px;
  }

  .option-editor,
  .tab-manager,
  .grid-manager {
    width: 100%;

    .option-row,
    .tab-row,
    .grid-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }
  }

  :deep(.el-divider__text) {
    font-weight: 600;
    color: #303133;
  }

  :deep(.el-form-item) {
    margin-bottom: 16px;
  }
}
</style>
