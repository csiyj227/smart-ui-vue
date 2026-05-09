import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/theme/mixins" as *;`,
      },
    },
  },
  server: {
    port: 8888,
    proxy: {
      // 业务接口走 /api 前缀，dev 下 vite 转发到后端 8080，生产由 nginx 反代
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // 文件下载/预览：<img src="/system/file/download/{id}"> 这种「资源直链」浏览器不会带 /api 前缀
      // 也不会带 Authorization 头，所以单独再代理一份到后端，且后端这两个路径必须 permitAll
      '/system/file/download': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/system/file/preview': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})