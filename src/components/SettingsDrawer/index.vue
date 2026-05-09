<template>
  <el-drawer v-model="visible" :title="t('settings.title')" direction="rtl" size="320px" :append-to-body="true">
    <div class="settings-content">
      <!-- Theme Color -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.themeColor') }}</div>
        <div class="color-swatches">
          <div
            v-for="color in PRESET_COLORS"
            :key="color"
            class="color-swatch"
            :class="{ active: themeStore.primaryColor === color }"
            :style="{ backgroundColor: color }"
            @click="themeStore.setPrimaryColor(color)"
          >
            <el-icon v-if="themeStore.primaryColor === color" color="#fff"><Check /></el-icon>
          </div>
          <el-color-picker v-model="customColor" @change="(val: string | null) => val && themeStore.setPrimaryColor(val)" />
        </div>
      </div>

      <!-- Dark Mode -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.themeMode') }}</div>
        <div class="setting-row">
          <span class="setting-label">
            <el-icon><Moon /></el-icon>{{ t('settings.darkMode') }}
          </span>
          <el-switch v-model="themeStore.isDark" />
        </div>
      </div>

      <!-- Accessibility -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.accessibility') }}</div>
        <div class="setting-row">
          <span class="setting-label">
            <el-icon><View /></el-icon>{{ t('settings.weakMode') }}
          </span>
          <el-switch :model-value="themeStore.isWeak" @change="(val: string | number | boolean) => themeStore.setWeak(!!val)" />
        </div>
        <div class="setting-row">
          <span class="setting-label">
            <el-icon><Film /></el-icon>{{ t('settings.grayMode') }}
          </span>
          <el-switch :model-value="themeStore.isGray" @change="(val: string | number | boolean) => themeStore.setGray(!!val)" />
        </div>
        <div class="setting-row">
          <span class="setting-label">
            <el-icon><Stamp /></el-icon>{{ t('settings.watermark') }}
          </span>
          <el-switch v-model="themeStore.showWatermark" />
        </div>
      </div>

      <!-- Layout Mode -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.layoutMode') }}</div>
        <div class="layout-switcher">
          <div
            class="layout-option"
            :class="{ active: themeStore.layoutMode === 'default' }"
            @click="themeStore.setLayoutMode('default')"
          >
            <div class="layout-preview default-preview">
              <div class="preview-sidebar" />
              <div class="preview-content">
                <div class="preview-header" />
                <div class="preview-main" />
              </div>
            </div>
            <span>{{ t('settings.layoutDefault') }}</span>
          </div>
          <div
            class="layout-option"
            :class="{ active: themeStore.layoutMode === 'classic' }"
            @click="themeStore.setLayoutMode('classic')"
          >
            <div class="layout-preview classic-preview">
              <div class="preview-topbar" />
              <div class="preview-main" />
            </div>
            <span>{{ t('settings.layoutClassic') }}</span>
          </div>
        </div>
      </div>

      <!-- Component Size -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.componentSize') }}</div>
        <el-radio-group :model-value="themeStore.componentSize" @change="(val: any) => val && themeStore.setComponentSize(val)">
          <el-radio-button value="small">{{ t('settings.sizeSmall') }}</el-radio-button>
          <el-radio-button value="default">{{ t('settings.sizeDefault') }}</el-radio-button>
          <el-radio-button value="large">{{ t('settings.sizeLarge') }}</el-radio-button>
        </el-radio-group>
      </div>

      <!-- Display Settings -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.display') }}</div>
        <div class="setting-row">
          <span class="setting-label">{{ t('settings.showLogo') }}</span>
          <el-switch v-model="themeStore.showLogo" />
        </div>
        <div class="setting-row">
          <span class="setting-label">{{ t('settings.showTagsView') }}</span>
          <el-switch v-model="themeStore.showTagsView" />
        </div>
        <div class="setting-row">
          <span class="setting-label">{{ t('settings.showBreadcrumb') }}</span>
          <el-switch v-model="themeStore.showBreadcrumb" />
        </div>
        <div class="setting-row">
          <span class="setting-label">{{ t('settings.showFooter') }}</span>
          <el-switch v-model="themeStore.showFooter" />
        </div>
      </div>

      <!-- Reset -->
      <div class="settings-footer">
        <el-button type="danger" plain @click="showResetConfirm = true">{{ t('settings.resetDefault') }}</el-button>
      </div>
    </div>
  </el-drawer>

  <!-- Reset confirm dialog — use el-dialog (not ElMessageBox API) so importStyle: sass works -->
  <el-dialog
    v-model="showResetConfirm"
    :title="t('common.tip')"
    width="360px"
    :append-to-body="true"
    :close-on-click-modal="true"
  >
    <span style="font-size: 14px; color: var(--color-text-regular);">{{ t('settings.resetConfirm') }}</span>
    <template #footer>
      <el-button @click="showResetConfirm = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="confirmReset">{{ t('common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { PRESET_COLORS } from '@/types/theme'
import { setWatermark, removeWatermark } from '@/utils/watermark'

const { t } = useI18n()

const visible = defineModel<boolean>({ default: false })

const themeStore = useThemeStore()
const userStore = useUserStore()
const customColor = ref(themeStore.primaryColor)
const showResetConfirm = ref(false)

// Watermark: watch the toggle
watch(() => themeStore.showWatermark, (val) => {
  if (val) {
    const name = userStore.userInfo?.username || 'Smart Admin'
    setWatermark(name)
  } else {
    removeWatermark()
  }
}, { immediate: true })

function confirmReset() {
  themeStore.resetTheme()
  customColor.value = themeStore.primaryColor
  showResetConfirm.value = false
}
</script>

<style lang="scss" scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 12px;
  }
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;

  .color-swatch {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast);
    border: 2px solid transparent;

    &:hover {
      transform: scale(1.15);
    }

    &.active {
      border-color: var(--color-text);
      transform: scale(1.15);
    }
  }
}

.layout-switcher {
  display: flex;
  gap: 16px;

  .layout-option {
    cursor: pointer;
    text-align: center;
    transition: all var(--transition-fast);

    span {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      color: var(--color-text-muted);
    }

    &.active span {
      color: var(--color-primary);
      font-weight: 600;
    }
  }
}

.layout-preview {
  width: 60px;
  height: 44px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-border);
  padding: 4px;
  display: flex;
  gap: 2px;
  overflow: hidden;
  transition: border-color var(--transition-fast);

  .active & {
    border-color: var(--color-primary);
  }
}

.default-preview {
  .preview-sidebar {
    width: 14px;
    height: 100%;
    background-color: var(--sidebar-bg);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .preview-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preview-header {
    height: 8px;
    background-color: var(--color-border);
    border-radius: 1px;
  }

  .preview-main {
    flex: 1;
    background-color: var(--color-bg);
    border-radius: 1px;
  }
}

.classic-preview {
  flex-direction: column;

  .preview-topbar {
    height: 10px;
    background-color: var(--color-primary);
    border-radius: 1px;
    flex-shrink: 0;
  }

  .preview-main {
    flex: 1;
    background-color: var(--color-bg);
    border-radius: 1px;
  }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;

  .setting-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--color-text-regular);
  }
}

.settings-footer {
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
}
</style>