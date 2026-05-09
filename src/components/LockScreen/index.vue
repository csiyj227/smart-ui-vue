<template>
  <transition name="fade">
    <div v-if="appStore.lockScreen" class="lock-screen">
      <div class="lock-bg" />
      <div class="lock-content">
        <!-- Clock -->
        <div class="lock-clock">
          <div class="clock-time">{{ hours }}:{{ minutes }}</div>
          <div class="clock-seconds">{{ seconds }}</div>
          <div class="clock-date">{{ dateStr }}</div>
        </div>

        <!-- Unlock area -->
        <div class="lock-unlock-area">
          <!-- 头像优先用用户真实头像，加载失败 / 没设置头像时回退到首字母占位 -->
          <el-avatar :size="64" :src="avatarUrl || undefined" class="lock-avatar">
            {{ initials }}
          </el-avatar>
          <div class="lock-username">{{ displayName }}</div>

          <div v-if="!showPasswordInput" class="slide-to-unlock">
            <div class="slide-track" ref="trackRef">
              <div
                class="slide-thumb"
                :class="{ 'is-snapping': isSnapping }"
                :style="{ left: thumbLeft + 'px' }"
                @mousedown.prevent="onMouseDown"
                @touchstart.prevent="onTouchStart"
              >
                <el-icon><Right /></el-icon>
              </div>
              <span class="slide-text" :style="{ opacity: String(slideTextOpacity) }">滑动解锁</span>
            </div>
          </div>

          <div v-else class="password-input-wrapper">
            <!-- 包一层是为了把抖动动画作用在整个 input + 按钮组合上，否则只抖按钮看着很怪 -->
            <div
              class="password-input-area"
              :class="{ 'is-shaking': isShaking, 'has-error': hasError }"
            >
              <el-input
                ref="passwordInputRef"
                v-model="password"
                type="password"
                placeholder="请输入密码解锁"
                prefix-icon="Lock"
                show-password
                :disabled="unlocking"
                @keyup.enter="handleUnlock"
                @input="hasError = false"
              />
              <el-button type="primary" :icon="Unlock" circle :loading="unlocking" @click="handleUnlock" />
            </div>
            <!-- macOS / Windows 风格的小字提示：固定占位高度防止上下跳动 -->
            <div class="password-hint" :class="{ 'is-error': hasError }">
              <span v-if="hintMessage">{{ hintMessage }}</span>
              <!-- 没错误时也保留占位，避免输入框位置跳变 -->
              <span v-else class="hint-placeholder">&nbsp;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { verifyPassword } from '@/api/auth'
import { Unlock } from '@element-plus/icons-vue'
import type { InputInstance } from 'element-plus'

const appStore = useAppStore()
const userStore = useUserStore()

const password = ref('')
const showPasswordInput = ref(false)
const now = ref(new Date())
let timer: ReturnType<typeof setInterval>

const hours = computed(() => String(now.value.getHours()).padStart(2, '0'))
const minutes = computed(() => String(now.value.getMinutes()).padStart(2, '0'))
const seconds = computed(() => String(now.value.getSeconds()).padStart(2, '0'))

const dateStr = computed(() => {
  const d = now.value
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

// 锁屏卡片上展示的优先级：真实姓名 > 用户名 > 默认 'User'
const displayName = computed(() => userStore.userInfo?.realName || userStore.userInfo?.username || 'User')
const initials = computed(() => displayName.value.charAt(0).toUpperCase())
// 真实头像 URL（来自 /user/info 接口）。空字符串 → el-avatar 不渲染 img，自动 fallback 到 slot 里的 initials
const avatarUrl = computed(() => userStore.userInfo?.avatar || '')

// ── Slide to unlock ───────────────────────────────────────────────────
const THUMB_PAD = 4
const THUMB_SIZE = 36

const trackRef = ref<HTMLElement>()
const thumbLeft = ref(THUMB_PAD)
const isSnapping = ref(false)

const maxLeft = computed(() => {
  if (!trackRef.value) return 240
  return trackRef.value.offsetWidth - THUMB_SIZE - THUMB_PAD
})

const slideTextOpacity = computed(() => {
  const progress = (thumbLeft.value - THUMB_PAD) / (maxLeft.value - THUMB_PAD)
  return Math.max(0, 1 - progress * 2).toFixed(2)
})

function startDrag(startClientX: number) {
  const startLeft = thumbLeft.value
  isSnapping.value = false

  const onMove = (clientX: number) => {
    const delta = clientX - startClientX
    thumbLeft.value = Math.max(THUMB_PAD, Math.min(maxLeft.value, startLeft + delta))
    if (thumbLeft.value >= maxLeft.value) finish(true)
  }

  const onMouseMove = (e: MouseEvent) => onMove(e.clientX)
  const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX)

  const finish = (unlocked: boolean) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)

    if (unlocked) {
      showPasswordInput.value = true
    } else {
      // Snap thumb back with transition
      isSnapping.value = true
      thumbLeft.value = THUMB_PAD
    }
  }

  const onMouseUp = () => finish(false)
  const onTouchEnd = () => finish(false)

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
}

const onMouseDown = (e: MouseEvent) => startDrag(e.clientX)
const onTouchStart = (e: TouchEvent) => startDrag(e.touches[0].clientX)

// ── Unlock ────────────────────────────────────────────────────────────
const unlocking = ref(false)
// 模仿 macOS/Windows 锁屏：错误时输入框抖动 + 下方红色小字提示
// （ElMessage 在锁屏遮罩之上即便 zIndex 拉到 10000 也常被设计稿/iframe 遮挡，体验割裂，弃用）
const isShaking = ref(false)
const hasError = ref(false)
const hintMessage = ref('')
const passwordInputRef = ref<InputInstance>()

// 错误反馈：抖动一次 + 显示红字 + 自动选中已输入内容方便重输
function triggerErrorFeedback(message: string) {
  hintMessage.value = message
  hasError.value = true
  isShaking.value = false
  // 强制下一帧再加 class，确保连续两次错误时动画能重新触发（同名 class 不会重播）
  nextTick(() => {
    isShaking.value = true
    setTimeout(() => { isShaking.value = false }, 500) // 与 keyframes 时长保持一致
  })
  // 全选已输入文本，符合 macOS 锁屏体验：用户直接覆盖输入即可
  nextTick(() => {
    const innerInput = passwordInputRef.value?.input as HTMLInputElement | undefined
    innerInput?.select()
  })
}

async function handleUnlock() {
  if (!password.value) {
    triggerErrorFeedback('请输入密码')
    return
  }
  unlocking.value = true
  try {
    // 注意：request.post 返回的是 AxiosResponse<R<boolean>>
    //   response.data       = R<boolean> = { code, msg, data: boolean, ok }
    //   response.data.data  = 真正的 boolean
    // 之前写法 const { data } = await verifyPassword(...) 拿到的 data 是 R<boolean> 整个对象，
    // 对象在 if(data) 里永远 truthy → 任何输入都解锁，这是历史 bug。
    const response = await verifyPassword(password.value)
    const matched = response.data?.data === true
    if (matched) {
      appStore.unlock()
      password.value = ''
      showPasswordInput.value = false
      hasError.value = false
      hintMessage.value = ''
    } else {
      triggerErrorFeedback('密码错误，请重试')
    }
  } catch {
    triggerErrorFeedback('验证失败，请稍后重试')
  } finally {
    unlocking.value = false
  }
}

// Reset slider state every time lock screen activates
watch(() => appStore.lockScreen, (locked) => {
  if (locked) {
    thumbLeft.value = THUMB_PAD
    isSnapping.value = false
    showPasswordInput.value = false
    password.value = ''
    // 重置错误态，避免上次锁屏的红字残留
    hasError.value = false
    hintMessage.value = ''
    isShaking.value = false
  }
})

// 切到密码输入态时自动聚焦输入框，避免用户还要手动点一下
watch(showPasswordInput, async (show) => {
  if (show) {
    await nextTick()
    passwordInputRef.value?.focus()
  }
})

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.lock-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #0F172A 0%, #1a1535 50%, var(--color-primary-dark) 100%);
  backdrop-filter: blur(20px);
}

.lock-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}

.lock-clock {
  text-align: center;
  color: #fff;

  .clock-time {
    font-size: 96px;
    font-weight: 200;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .clock-seconds {
    font-size: 24px;
    font-weight: 300;
    opacity: 0.7;
    margin-top: 8px;
  }

  .clock-date {
    font-size: 18px;
    font-weight: 400;
    opacity: 0.6;
    margin-top: 12px;
  }
}

.lock-unlock-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .lock-avatar {
    background-color: var(--color-primary);
    font-size: 24px;
    font-weight: 600;
  }

  .lock-username {
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
  }
}

.slide-to-unlock {
  width: 280px;

  .slide-track {
    position: relative;
    height: 44px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    .slide-thumb {
      position: absolute;
      top: 4px;
      width: 36px;
      height: 36px;
      background: var(--color-primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      cursor: grab;
      user-select: none;
      touch-action: none;

      &:active {
        cursor: grabbing;
      }

      &.is-snapping {
        transition: left var(--transition-normal);
      }
    }

    .slide-text {
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
      user-select: none;
      pointer-events: none;
      transition: opacity var(--transition-fast);
    }
  }
}

// 输入区外层包装：把输入框 + 提示文字垂直排列，输入框宽度固定避免抖动时父级布局回流
.password-input-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 280px;
}

.password-input-area {
  display: flex;
  gap: 8px;
  width: 100%;
  // transform-origin 居中，抖动时视觉重心稳定
  transform-origin: center center;

  // macOS 风格：错误时输入框边框变红 + 透出微红底色，强化错误感知
  &.has-error {
    :deep(.el-input .el-input__wrapper) {
      border-color: rgba(245, 108, 108, 0.7) !important;
      background: rgba(245, 108, 108, 0.08) !important;
      box-shadow: 0 0 0 1px rgba(245, 108, 108, 0.3) inset !important;
    }
  }

  // 抖动动画：模仿 macOS 登录界面错误反馈，左右各偏移两次后回正
  // 用 cubic-bezier 让节奏更紧凑，振幅由大到小衰减，比线性 shake 更"贵气"
  &.is-shaking {
    animation: lock-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  :deep(.el-input) {
    .el-input__wrapper {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: none;
      transition: border-color 0.2s, background 0.2s;

      .el-input__inner {
        color: #fff;

        &::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
      }
    }
  }
}

// 提示行：固定 24px 高度防止上下跳动；默认透明占位，错误时淡入红色文案
.password-hint {
  margin-top: 8px;
  height: 18px;
  line-height: 18px;
  font-size: 13px;
  color: transparent;
  user-select: none;
  transition: color 0.2s;

  &.is-error {
    color: #ff6b6b; // 比 EP 默认 danger 更亮一点，深色背景上更醒目
  }

  .hint-placeholder {
    visibility: hidden; // 占位但完全不可见，保证布局稳定
  }
}

// macOS 锁屏抖动关键帧：6 次衰减振荡，振幅 ±10px → ±2px
@keyframes lock-shake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-8px); }
  40%, 60% { transform: translateX(8px); }
}
</style>