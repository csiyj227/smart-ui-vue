<template>
  <div class="header-right">
    <SearchToggle />
    <FullscreenToggle />
    <LocaleToggle />
    <NotificationIcon />
    <SettingsIcon @open-settings="$emit('openSettings')" />
    <UserDropdown />
  </div>
</template>

<script setup lang="ts">
import SearchToggle from './SearchToggle.vue'
import FullscreenToggle from './FullscreenToggle.vue'
import LocaleToggle from './LocaleToggle.vue'
import NotificationIcon from './NotificationIcon.vue'
import SettingsIcon from './SettingsIcon.vue'
import UserDropdown from './UserDropdown.vue'

defineEmits<{ openSettings: [] }>()
</script>

<style lang="scss" scoped>
.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>