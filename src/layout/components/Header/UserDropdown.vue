<template>
  <el-dropdown trigger="click" @command="handleCommand">
    <div class="user-dropdown">
      <el-avatar :size="32" :src="avatarUrl">
        {{ initials }}
      </el-avatar>
      <span class="username">{{ username }}</span>
      <el-icon><ArrowDown /></el-icon>
    </div>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="home">
          <el-icon><HomeFilled /></el-icon>{{ $t('layout.home') }}
        </el-dropdown-item>
        <el-dropdown-item command="profile">
          <el-icon><User /></el-icon>{{ $t('layout.profile') }}
        </el-dropdown-item>
        <el-dropdown-item divided command="lock">
          <el-icon><Lock /></el-icon>{{ $t('layout.lockScreen') }}
        </el-dropdown-item>
        <el-dropdown-item command="logout">
          <el-icon><SwitchButton /></el-icon>{{ $t('layout.logout') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const username = computed(() => userStore.userInfo?.username || 'User')
const avatarUrl = computed(() => userStore.userInfo?.avatar || '')
const initials = computed(() => username.value.charAt(0).toUpperCase())

function handleCommand(command: string) {
  switch (command) {
    case 'home':
      router.push('/')
      break
    case 'profile':
      router.push('/profile')
      break
    case 'lock':
      appStore.lock()
      break
    case 'logout':
      userStore.logout()
      router.push('/login')
      break
  }
}
</script>

<style lang="scss" scoped>
.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  transition: all var(--transition-fast);

  &:hover {
    background-color: var(--color-primary-subtle);
    border-color: var(--color-primary-glow);
  }

  :deep(.el-avatar) {
    background: var(--gradient-primary);
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
  }

  .username {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--color-text);
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .el-icon {
    color: var(--color-text-muted);
    font-size: 12px;
    transition: transform var(--transition-fast);
  }

  &:hover .el-icon {
    color: var(--color-primary);
  }
}
</style>