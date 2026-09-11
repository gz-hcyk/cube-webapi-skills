import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// 契约（2026-09 实测）：
//   实体接口 /api/{area}/{controller}；菜单 /api/Admin/Index/GetMenuTree；
//   登录/MFA /Auth/* /Mfa/*（不带 /api 前缀）；附件图片 /cube/*；静态资源 /Content/*。
// 开发态经 dev server 代理转发（默认指向本机 mock 后端 3001）。
//
// ⚠️ 切勿代理 /Admin、/Asset 等「业务区 SPA 路由」：它们由 Vue Router 在浏览器内处理，
//    一旦转发到后端，浏览器硬刷新这些路径就会 404。
//    注意菜单接口本身在 /api/Admin/... 下，已被 `/api` 规则覆盖，无需单独代理 /Admin。
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
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Auth': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Mfa': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Cube': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Content': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      // 附件/图片资源（上传返回的 filePath 相对路径，如 /cube/image?id=...）
      '/cube': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
