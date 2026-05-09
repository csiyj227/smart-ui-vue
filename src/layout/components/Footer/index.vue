<template>
  <footer class="layout-footer">
    <span>Copyright &copy; {{ year }} Smart Admin</span>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<style lang="scss" scoped>
.layout-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  font-size: 12px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
  letter-spacing: 0.01em;

  span {
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    opacity: 0.7;
  }
}
</style>