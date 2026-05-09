<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ElCard, ElForm, ElFormItem, ElInput, ElButton, ElSelect, ElOption,
  ElDatePicker, ElInputNumber, ElMessage, ElDivider, ElDescriptions,
  ElDescriptionsItem, ElTag,
} from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { getTravelApplyById, createTravelApply, updateTravelApply } from '@/api/travel';
import type { BizTravelApply } from '@/types/travel';
import { TRANSPORT_OPTIONS, TRAVEL_STATUS_LABEL, TRAVEL_STATUS_TAG } from '@/types/travel';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

/** 模式判断：form = 新建/编辑，view = 只读查看 */
const isViewMode = computed(() => route.path.includes('/view/'));
const applyId = computed(() => {
  const id = route.params.id as string;
  return id ? Number(id) : null;
});
const isEdit = computed(() => !!applyId.value && !isViewMode.value);
const pageTitle = computed(() => {
  if (isViewMode.value) return t('biz.travel.viewTitle');
  return isEdit.value ? t('biz.travel.editTitle') : t('biz.travel.createTitle');
});

const loading = ref(false);
const submitting = ref(false);
const formRef = ref();
const formData = ref<BizTravelApply>({
  deptName: '',
  reason: '',
  departure: '',
  destination: '',
  startTime: '',
  endTime: '',
  transport: '',
  estimatedCost: 0,
  remark: '',
});

const rules = {
  reason: [{ required: true, message: t('biz.travel.reasonRequired'), trigger: 'blur' }],
  departure: [{ required: true, message: t('biz.travel.departureRequired'), trigger: 'blur' }],
  destination: [{ required: true, message: t('biz.travel.destinationRequired'), trigger: 'blur' }],
  startTime: [{ required: true, message: t('biz.travel.startTimeRequired'), trigger: 'change' }],
  endTime: [{ required: true, message: t('biz.travel.endTimeRequired'), trigger: 'change' }],
  transport: [{ required: true, message: t('biz.travel.transportRequired'), trigger: 'change' }],
};

async function loadDetail() {
  if (!applyId.value) return;
  loading.value = true;
  try {
    const res = await getTravelApplyById(applyId.value) as any;
    const data = res.data?.data;
    if (data) {
      formData.value = data;
    }
  } catch {
    ElMessage.error(t('biz.travel.loadDetailFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateTravelApply(formData.value);
      ElMessage.success(t('biz.travel.updateSuccess'));
    } else {
      const res = await createTravelApply(formData.value) as any;
      const saved = res.data?.data;
      ElMessage.success(t('biz.travel.createSuccess'));
      if (saved?.applyId) {
        router.replace(`/biz/travel/view/${saved.applyId}`);
        return;
      }
    }
    router.back();
  } catch {
    ElMessage.error(t('biz.travel.saveFailed'));
  } finally {
    submitting.value = false;
  }
}

function handleBack() {
  router.back();
}

onMounted(loadDetail);
</script>

<template>
  <div class="travel-form">
    <ElCard shadow="never">
      <template #header>
        <div class="travel-form__header">
          <ElButton :icon="ArrowLeft" link @click="handleBack">{{ t('biz.travel.back') }}</ElButton>
          <span class="travel-form__title">{{ pageTitle }}</span>
        </div>
      </template>

      <div v-loading="loading">
        <!-- 查看模式：用 Descriptions 展示 -->
        <template v-if="isViewMode && formData.applyId">
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem :label="t('biz.travel.applyNoLabel')">{{ formData.applyNo }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.statusLabel')">
              <ElTag :type="(TRAVEL_STATUS_TAG[formData.status!] as any) || 'info'" size="small">
                {{ TRAVEL_STATUS_LABEL[formData.status!] || formData.status }}
              </ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.applicantLabelForm')">{{ formData.applicantName }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.deptLabel')">{{ formData.deptName || '-' }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.reasonLabel')" :span="2">{{ formData.reason }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.departureLabel')">{{ formData.departure }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.destinationLabel')">{{ formData.destination }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.startTimeLabel')">{{ formData.startTime }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.endTimeLabel')">{{ formData.endTime }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.transportLabel')">{{ formData.transport }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.estimatedCostLabel')">
              {{ formData.estimatedCost != null ? `¥${Number(formData.estimatedCost).toFixed(2)}` : '-' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem :label="t('biz.travel.remarkLabel')" :span="2">{{ formData.remark || '-' }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('common.createTime')">{{ formData.createTime }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="t('common.updateTime')">{{ formData.updateTime }}</ElDescriptionsItem>
          </ElDescriptions>
        </template>

        <!-- 表单模式：新建 / 编辑 -->
        <template v-else>
          <ElForm
            ref="formRef"
            :model="formData"
            :rules="rules"
            label-width="100px"
            style="max-width: 700px; margin: 0 auto;"
          >
            <ElFormItem :label="t('biz.travel.deptLabel')" prop="deptName">
              <ElInput v-model="formData.deptName" :placeholder="t('biz.travel.deptNamePlaceholder')" />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.reasonLabel')" prop="reason">
              <ElInput
                v-model="formData.reason"
                type="textarea"
                :rows="3"
                :placeholder="t('biz.travel.reasonPlaceholder')"
                maxlength="500"
                show-word-limit
              />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.departureLabel')" prop="departure">
              <ElInput v-model="formData.departure" :placeholder="t('biz.travel.departurePlaceholder')" />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.destinationLabel')" prop="destination">
              <ElInput v-model="formData.destination" :placeholder="t('biz.travel.destinationPlaceholder')" />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.startTimeLabel')" prop="startTime">
              <ElDatePicker
                v-model="formData.startTime"
                type="datetime"
                :placeholder="t('biz.travel.startTimePlaceholder')"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.endTimeLabel')" prop="endTime">
              <ElDatePicker
                v-model="formData.endTime"
                type="datetime"
                :placeholder="t('biz.travel.endTimePlaceholder')"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.transportLabel')" prop="transport">
              <ElSelect v-model="formData.transport" :placeholder="t('biz.travel.transportPlaceholder')" style="width: 100%">
                <ElOption
                  v-for="opt in TRANSPORT_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.estimatedCostLabel')" prop="estimatedCost">
              <ElInputNumber
                v-model="formData.estimatedCost"
                :min="0"
                :precision="2"
                :step="100"
                controls-position="right"
                style="width: 100%"
              />
            </ElFormItem>
            <ElFormItem :label="t('biz.travel.remarkLabel')" prop="remark">
              <ElInput
                v-model="formData.remark"
                type="textarea"
                :rows="2"
                :placeholder="t('biz.travel.remarkPlaceholder')"
                maxlength="500"
                show-word-limit
              />
            </ElFormItem>

            <ElDivider />

            <ElFormItem>
              <ElButton type="primary" :loading="submitting" @click="handleSubmit">
                {{ isEdit ? t('biz.travel.saveEdit') : t('biz.travel.submitApply') }}
              </ElButton>
              <ElButton @click="handleBack">{{ t('biz.travel.cancel') }}</ElButton>
            </ElFormItem>
          </ElForm>
        </template>
      </div>
    </ElCard>
  </div>
</template>

<style lang="scss" scoped>
.travel-form {
  padding: 16px;

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}
</style>
