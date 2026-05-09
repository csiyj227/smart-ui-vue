<script setup lang="ts">
/**
 * 出差申请详情嵌入组件 —— 纯只读展示，可被流程任务处理页面作为子组件引入。
 *
 * Props:
 *   - applyId: 出差申请 ID，组件内部自行加载数据
 */
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElDescriptions, ElDescriptionsItem, ElTag, ElSkeleton, ElEmpty } from 'element-plus';
import { getTravelApplyById } from '@/api/travel';
import type { BizTravelApply } from '@/types/travel';
import { TRAVEL_STATUS_LABEL, TRAVEL_STATUS_TAG } from '@/types/travel';

interface Props {
  applyId: number | null | undefined;
}

const props = defineProps<Props>();
const { t } = useI18n();

const loading = ref(false);
const detail = ref<BizTravelApply | null>(null);

async function loadDetail(id: number | null | undefined) {
  if (!id) {
    detail.value = null;
    return;
  }
  loading.value = true;
  try {
    const res = await getTravelApplyById(id) as any;
    detail.value = res.data?.data ?? null;
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => props.applyId, (newId) => loadDetail(newId), { immediate: true });
</script>

<template>
  <div class="travel-detail">
    <ElSkeleton v-if="loading" :rows="6" animated />

    <template v-else-if="detail">
      <ElDescriptions :column="2" border>
        <ElDescriptionsItem :label="t('biz.travel.applyNoLabel')">{{ detail.applyNo }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.statusLabel')">
          <ElTag :type="(TRAVEL_STATUS_TAG[detail.status!] as any) || 'info'" size="small">
            {{ TRAVEL_STATUS_LABEL[detail.status!] || detail.status }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.applicantLabelForm')">{{ detail.applicantName }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.deptLabel')">{{ detail.deptName || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.reasonLabel')" :span="2">{{ detail.reason }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.colDeparture')">{{ detail.departure }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.destinationLabel')">{{ detail.destination }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.startTimeLabel')">{{ detail.startTime }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.endTimeLabel')">{{ detail.endTime }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.transportLabel')">{{ detail.transport }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.estimatedCostLabel')">
          {{ detail.estimatedCost != null ? `¥${Number(detail.estimatedCost).toFixed(2)}` : '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.remarkLabel')" :span="2">{{ detail.remark || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.colStartTime')">{{ detail.createTime }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="t('biz.travel.colUpdateTime')">{{ detail.updateTime }}</ElDescriptionsItem>
      </ElDescriptions>
    </template>

    <ElEmpty v-else :description="t('biz.travel.noData')" :image-size="60" />
  </div>
</template>

<style lang="scss" scoped>
.travel-detail {
  min-height: 100px;
}
</style>
