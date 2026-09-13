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
//           框架信息 `/Cube/*`（含 `/Cube/Apis`、`/Cube/Lookup`）、附件图片小写前缀 `/cube/*`、
//           静态资源 `/Content/*`、**菜单树 `^/Admin/Index/`（正则，见下）**。
// 切勿代理：`/Admin`、`/Asset` 等「业务区 SPA 路由」——它们由 Vue Router 在浏览器内处理，
//           一旦被转发到后端就会 404（浏览器硬刷新 /entity/Asset/AssetItem 时最明显）。
//
// ⚠️ 铁律 H3（2026-09-13 实测）：菜单树等**非实体系统端点不带 `/api` 前缀**，因此光有 `/api`
//    规则覆盖不到它。漏配的表现极其隐蔽——请求落到 SPA 兜底、返回 `Content-Type: text/html`
//    的 index.html，axios 解析失败 → **菜单静默为空（无报错、无 401、无 404）**。
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
      // 菜单树 /Admin/Index/GetMenuTree（Area 内属性路由 [area]/[controller]/[action]，无 /api）。
      // vite 把以 `^` 开头的 key 视为 RegExp，故用正则精确锁定 Index 控制器。
      // ⚠️ 切勿写成 '/Admin'：会把前端页面路由 /Admin/User 一并转发到后端，硬刷新变 GET 404。
      '^/Admin/Index/': { target: API_TARGET, changeOrigin: true },
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
