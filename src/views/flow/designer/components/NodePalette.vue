<!--
  左侧节点面板：分组展示 8 种节点 + 顶部搜索 + 拖拽源。

  设计动机：
    1. 钉钉/飞书审批的节点面板都是「分组 + 卡片」式，比 jnpf 那种纵向
       平铺的单列列表更易扫描；
    2. 卡片整体作为 draggable 源，hover 显示 tooltip 帮助文字 ——
       新人不用看文档就能理解每种节点；
    3. 搜索框过滤的是 label + description，不区分大小写，方便查找
       「我想要什么」而不是「叫什么」。

  与画布通信：
    通过 HTML5 native drag-and-drop。dragstart 时 setData("application/smart-flow-node-kind", kind)，
    画布的 ondrop 用 getData 读出 kind 并调 useFlowGraph().addNode()。
    不用 VueFlow 自带的 drag handler 是因为它对外部源支持不好。
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElIcon, ElInput, ElTooltip } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { NODE_KINDS, NODE_KIND_META, type FlowNodeKind } from '@/types/flow';

/**
 * 节点分组：把 8 种节点分成「事件 / 任务 / 网关」三组，符合 BPMN 的
 * 心智模型，也是设计师最熟悉的组织方式。
 */
const NODE_GROUPS: { title: string; kinds: FlowNodeKind[] }[] = [
  { title: '事件', kinds: ['START', 'END'] },
  { title: '任务', kinds: ['APPROVE', 'NOTIFY', 'SCRIPT'] },
  { title: '网关', kinds: ['BRANCH', 'PARALLEL', 'JOINT'] },
];

const keyword = ref('');

const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return NODE_GROUPS;
  return NODE_GROUPS.map((g) => ({
    title: g.title,
    kinds: g.kinds.filter((k) => {
      const meta = NODE_KIND_META[k];
      return (
        meta.label.toLowerCase().includes(kw) ||
        meta.description.toLowerCase().includes(kw) ||
        k.toLowerCase().includes(kw)
      );
    }),
  })).filter((g) => g.kinds.length > 0);
});

/**
 * dragstart 时把节点类型放到 dataTransfer。
 *
 * 用「自定义 mime type」而不是 text/plain 是为了：
 *   - 避免和外部拖入的纯文本/链接抢通道；
 *   - 画布的 ondrop 可以靠 type 区分「我自己的节点拖入」vs「文件拖入」。
 */
const onDragStart = (e: DragEvent, kind: FlowNodeKind) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData('application/smart-flow-node-kind', kind);
  // 额外注册一个带 kind 的 MIME type —— dragover 阶段浏览器出于安全考虑
  // 不让 getData()，但 dataTransfer.types 数组是可读的。把 kind 编码到
  // type name 里，画布就能在 dragover 阶段知道正在拖什么类型的节点，
  // 从而用正确的尺寸计算辅助线（圆形 80px vs 矩形 180px 差距很大）。
  e.dataTransfer.setData(`application/smart-flow-kind-${kind.toLowerCase()}`, '');
  e.dataTransfer.effectAllowed = 'move';
};

// 校验过 NODE_KINDS 必有 START/END，把它们用作 IDE 索引下钻入口而已
void NODE_KINDS;
</script>

<template>
  <aside class="flow-palette">
    <div class="flow-palette__search">
      <ElInput
        v-model="keyword"
        placeholder="搜索节点..."
        :prefix-icon="Search"
        clearable
        size="small"
      />
    </div>

    <div class="flow-palette__scroll">
      <div v-for="group in filteredGroups" :key="group.title" class="flow-palette__group">
        <div class="flow-palette__group-title">{{ group.title }}</div>
        <div class="flow-palette__items">
          <ElTooltip
            v-for="kind in group.kinds"
            :key="kind"
            :content="NODE_KIND_META[kind].description"
            placement="right"
            :show-after="500"
          >
            <div
              class="flow-palette__card"
              draggable="true"
              :style="{ '--kind-color': NODE_KIND_META[kind].color }"
              @dragstart="onDragStart($event, kind)"
            >
              <ElIcon class="flow-palette__card-icon">
                <component :is="NODE_KIND_META[kind].icon" />
              </ElIcon>
              <span class="flow-palette__card-label">{{ NODE_KIND_META[kind].label }}</span>
            </div>
          </ElTooltip>
        </div>
      </div>

      <div v-if="filteredGroups.length === 0" class="flow-palette__empty">
        没有匹配的节点
      </div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.flow-palette {
  width: 220px;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);

  &__search {
    padding: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px 16px;
  }

  &__group {
    margin-top: 12px;

    &:first-child {
      margin-top: 4px;
    }
  }

  &__group-title {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
    padding-left: 4px;
  }

  &__items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  &__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 6px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
    cursor: grab;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    user-select: none;

    &:hover {
      border-color: var(--kind-color);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    &:active {
      cursor: grabbing;
    }
  }

  &__card-icon {
    font-size: 18px;
    color: var(--kind-color);
  }

  &__card-label {
    font-size: 12px;
    color: var(--el-text-color-primary);
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}
</style>
