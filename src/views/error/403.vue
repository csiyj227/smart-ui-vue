<template>
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-code">403</h1>
      <p class="error-text">抱歉，您没有权限访问此页面</p>
      <el-button type="primary" @click="router.push('/')">返回首页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style lang="scss" scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: var(--color-bg);
}

.error-content {
  text-align: center;

  .error-code {
    font-size: 120px;
    font-weight: 700;
    color: var(--color-danger);
    line-height: 1;
    opacity: 0.3;
  }

  .error-text {
    font-size: 18px;
    color: var(--color-text-muted);
    margin: 16px 0 32px;
  }
}
</style>