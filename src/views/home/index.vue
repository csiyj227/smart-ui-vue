<template>
  <div class="dashboard">
    <!-- Welcome Banner -->
    <div class="welcome-banner">
      <div class="welcome-info">
        <h2 class="welcome-greeting">{{ greeting }}，{{ userStore.userInfo?.realName || userStore.userInfo?.username || t('home.user') }}</h2>
        <p class="welcome-desc">{{ t('home.welcomeDesc') }}</p>
      </div>
      <div class="welcome-date">
        <p class="date-day">{{ currentDate }}</p>
        <p class="date-week">{{ currentWeek }}</p>
      </div>
    </div>

    <!-- Stat Cards -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6" v-for="stat in statCards" :key="stat.label">
        <div class="stat-card" :style="{ '--accent': stat.color }">
          <div class="stat-card__info">
            <span class="stat-card__value">{{ stat.value }}</span>
            <span class="stat-card__label">{{ t(`home.${stat.label}`) }}</span>
          </div>
          <div class="stat-card__icon">
            <el-icon :size="28"><component :is="stat.icon" /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Charts Row -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="16">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span class="card-title">{{ t('home.visitTrend') }}</span>
          </template>
          <div ref="trendChartRef" class="chart-container" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span class="card-title">{{ t('home.featureDistribution') }}</span>
          </template>
          <div ref="pieChartRef" class="chart-container" />
        </el-card>
      </el-col>
    </el-row>

    <!-- Quick Nav + System Info -->
    <el-row :gutter="16" class="bottom-row">
      <el-col :xs="24" :lg="14">
        <el-card shadow="never" class="quick-card">
          <template #header>
            <span class="card-title">{{ t('home.quickNav') }}</span>
          </template>
          <div class="quick-grid">
            <div
              v-for="nav in quickNavs"
              :key="nav.path"
              class="quick-item"
              @click="router.push(nav.path)"
            >
              <div class="quick-item__icon" :style="{ background: nav.bg }">
                <el-icon :size="22" :color="nav.color"><component :is="nav.icon" /></el-icon>
              </div>
              <span class="quick-item__label">{{ nav.label }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card shadow="never" class="info-card">
          <template #header>
            <span class="card-title">{{ t('home.systemInfo') }}</span>
          </template>
          <div class="info-list">
            <div v-for="item in systemInfo" :key="item.label" class="info-item">
              <span class="info-item__label">{{ item.label }}</span>
              <span class="info-item__value">{{ item.value }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { User, Monitor, Document, Setting, DataAnalysis, PieChart } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

// Greeting based on time of day
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return t('home.greetingLateNight')
  if (h < 9) return t('home.greetingMorning')
  if (h < 12) return t('home.greetingForenoon')
  if (h < 14) return t('home.greetingNoon')
  if (h < 18) return t('home.greetingAfternoon')
  return t('home.greetingEvening')
})

const currentDate = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const currentWeek = computed(() => {
  const weekKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return t(`home.weekdays.${weekKeys[new Date().getDay()]}`)
})

// Stat cards — mock data for now, replace with API later
const statCards = ref([
  { label: 'visits', value: '12,846', icon: markRaw(Monitor), color: '#6366F1' },
  { label: 'onlineUsers', value: '38', icon: markRaw(User), color: '#10B981' },
  { label: 'systemUsers', value: '156', icon: markRaw(DataAnalysis), color: '#F59E0B' },
  { label: 'menuCount', value: '0', icon: markRaw(Document), color: '#EF4444' },
])

// Count menus from permission store
const menuCount = computed(() => {
  let count = 0
  const walk = (menus: any[]) => {
    for (const m of menus) {
      if (m.menuType !== '2') count++
      if (m.children) walk(m.children)
    }
  }
  walk(permissionStore.menuList)
  return count
})
statCards.value[3].value = String(menuCount.value || 0)

// Quick navigation — derived from user permissions
const quickNavs = computed(() => {
  const perms = userStore.permissions
  const navs: { label: string; path: string; icon: any; color: string; bg: string }[] = []
  const addIf = (perm: string, label: string, path: string, icon: any, color: string) => {
    if (perms.includes(perm) || userStore.roles.includes('ADMIN')) {
      navs.push({ label, path, icon: markRaw(icon), color, bg: color + '18' })
    }
  }
  addIf('sys_user_view', t('home.userMgmt'), '/system/user', User, '#6366F1')
  addIf('sys_role_view', t('home.roleMgmt'), '/system/role', DataAnalysis, '#10B981')
  addIf('sys_menu_view', t('home.menuMgmt'), '/system/menu', Document, '#F59E0B')
  addIf('sys_dept_view', t('home.deptMgmt'), '/system/dept', PieChart, '#0EA5E9')
  addIf('sys_dict_view', t('home.dictMgmt'), '/system/dict', Setting, '#8B5CF6')
  return navs
})

// System info
const systemInfo = ref([
  { label: 'sysVersion', value: '1.0.0' },
  { label: 'frontendFramework', value: 'Vue 3 + Element Plus' },
  { label: 'backendFramework', value: 'Spring Boot 3.3' },
  { label: 'persistence', value: 'MyBatis-Plus 3.5' },
  { label: 'database', value: 'PostgreSQL 16' },
  { label: 'auth', value: 'OAuth2 + Redis' },
])

// ECharts — lazy import to reduce bundle size
const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let chartInstances: any[] = []

onMounted(async () => {
  try {
    const echarts = await import('echarts')
    initTrendChart(echarts)
    initPieChart(echarts)
  } catch {
    // ECharts not installed — charts will be blank
  }
})

onBeforeUnmount(() => {
  chartInstances.forEach(c => c?.dispose())
})

function initTrendChart(echarts: any) {
  if (!trendChartRef.value) return
  const chart = echarts.init(trendChartRef.value)
  chartInstances.push(chart)

  const weekKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const days = weekKeys.map(k => t(`home.weekdays.${k}`))
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: days, boundaryGap: false, axisLine: { lineStyle: { color: '#E2E4F0' } }, axisLabel: { color: '#9CA3C4' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F1FA' } }, axisLabel: { color: '#9CA3C4' } },
    series: [
      {
        name: t('home.chartVisits'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: '#6366F1' },
        itemStyle: { color: '#6366F1' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(99,102,241,0.25)' },
          { offset: 1, color: 'rgba(99,102,241,0.02)' },
        ]) },
        data: [820, 1230, 960, 1540, 1320, 780, 1050],
      },
    ],
  })

  const resize = () => chart.resize()
  window.addEventListener('resize', resize)
  chartInstances.push({ dispose: () => window.removeEventListener('resize', resize) } as any)
}

function initPieChart(echarts: any) {
  if (!pieChartRef.value) return
  const chart = echarts.init(pieChartRef.value)
  chartInstances.push(chart)

  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#9CA3C4', fontSize: 12 } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: [
          { value: 42, name: t('home.chartUserMgmt'), itemStyle: { color: '#6366F1' } },
          { value: 28, name: t('home.chartSysConfig'), itemStyle: { color: '#10B981' } },
          { value: 18, name: t('home.chartDataQuery'), itemStyle: { color: '#F59E0B' } },
          { value: 12, name: t('home.chartOther'), itemStyle: { color: '#0EA5E9' } },
        ],
      },
    ],
  })

  const resize = () => chart.resize()
  window.addEventListener('resize', resize)
  chartInstances.push({ dispose: () => window.removeEventListener('resize', resize) } as any)
}
</script>

<style lang="scss" scoped>
.dashboard {
  width: calc(100% + 32px);
  height: calc(100% + 32px);
  margin: -16px;
  padding: 20px;
  box-sizing: border-box;
}

// Welcome Banner
.welcome-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 32px;
  margin-bottom: 20px;
  background: var(--gradient-hero);
  border-radius: var(--radius-xl);
  color: #fff;
  box-shadow: var(--shadow-primary);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 20px 24px;
  }
}

.welcome-greeting {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 6px;
}

.welcome-desc {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.welcome-date {
  text-align: right;

  @media (max-width: 768px) {
    text-align: left;
  }
}

.date-day {
  font-size: 14px;
  margin: 0;
  opacity: 0.9;
}

.date-week {
  font-size: 13px;
  margin: 4px 0 0;
  opacity: 0.7;
}

// Stat Cards
.stat-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
  border-left: 4px solid var(--accent);

  &:hover {
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-2px);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__value {
    font-size: 26px;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.2;
  }

  &__label {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }
}

// Chart Cards
.chart-row {
  margin-bottom: 20px;
}

.chart-card {
  border-radius: var(--radius-lg);

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border-light);
  }

  :deep(.el-card__body) {
    padding: 16px 20px;
  }
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.chart-container {
  width: 100%;
  height: 300px;
}

// Bottom Row
.bottom-row {
  margin-bottom: 20px;
}

// Quick Nav
.quick-card {
  border-radius: var(--radius-lg);

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border-light);
  }
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--color-bg);
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
  }

  &__label {
    font-size: 13px;
    color: var(--color-text-regular);
  }
}

// System Info
.info-card {
  border-radius: var(--radius-lg);

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border-light);
  }
}

.info-list {
  display: flex;
  flex-direction: column;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);

  &:last-child {
    border-bottom: none;
  }

  &__label {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  &__value {
    font-size: 13px;
    color: var(--color-text);
    font-weight: 500;
  }
}
</style>