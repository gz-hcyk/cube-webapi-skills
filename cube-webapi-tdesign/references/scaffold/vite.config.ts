import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// ============================ 代理目标（唯一必改项） ============================
// 真实 NewLife.Cube 后端地址。开发态由 dev server 转发，避免跨域与令牌头问题。
//   Windows(cmd):        set VITE_API_TARGET=http://127.0.0.1:5052
//   PowerShell:          $env:VITE_API_TARGET="http://127.0.0.1:5052"
//   Git Bash / macOS:    VITE_API_TARGET=http://127.0.0.1:5052 npm run dev
// 缺省 127.0.0.1:5052 对应 `cube-webapi-backend` 脚手架默认 http 端口。
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:5052'

// ============================ 代理范围（勿画蛇添足） ============================
// 必须代理：实体与元数据接口 `/api/*`、登录/令牌 `/Auth/*` `/Mfa/*` `/Sso/*`、
//           框架信息 `/Cube/*`、附件图片小写前缀 `/cube/*`、静态资源 `/Content/*`。
// 切勿代理：`/Admin`、`/Asset` 等「业务区 SPA 路由」——它们由 Vue Router 在浏览器内处理，
//           一旦被转发到后端就会 404（浏览器硬刷新 /entity/Asset/AssetItem 时最明显）。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/Auth': { target: API_TARGET, changeOrigin: true },
      '/Mfa': { target: API_TARGET, changeOrigin: true },
      '/Sso': { target: API_TARGET, changeOrigin: true },
      '/Cube': { target: API_TARGET, changeOrigin: true },
      '/cube': { target: API_TARGET, changeOrigin: true },
      '/Content': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    // 拆 vendor：消除 chunk > 500KB 告警，并让 vue/tdesign 长期缓存。
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          tdesign: ['tdesign-vue-next', 'tdesign-icons-vue-next'],
          vendor: ['axios'],
        },
      },
    },
  },
})
