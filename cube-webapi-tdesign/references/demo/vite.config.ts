import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// 契约（2026-09-13 实测）：
//   实体接口 /api/{area}/{controller}；
//   非实体系统端点**一律无 /api 前缀**：菜单 /Admin/Index/GetMenuTree、字典 /Cube/Lookup、
//   签名清单 /Cube/Apis、登录/MFA /Auth/* /Mfa/*。
//   附件图片 /cube/*（小写）；静态资源 /Content/*。
// 开发态经 dev server 代理转发（默认指向本机 mock 后端 3001）。
//
// ⚠️ 切勿代理 /Admin、/Asset 等「业务区 SPA 路由」：它们由 Vue Router 在浏览器内处理，
//    一旦转发到后端，浏览器硬刷新这些路径就会 404。
//    ⚠️ 但菜单接口**不在 /api 下**，`/api` 规则覆盖不到它——必须用正则 `^/Admin/Index/` 精确
//    代理 Index 控制器（vite 把以 `^` 开头的 key 视为 RegExp）。漏配的后果是请求落到 SPA 兜底、
//    返回 index.html，axios 解析失败 → **菜单静默为空**（无报错、无 401、无 404）。
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
      // 菜单树 /Admin/Index/GetMenuTree —— 无 /api 前缀，需正则单独代理（切勿写成 '/Admin'）
      '^/Admin/Index/': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Auth': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Mfa': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      // 覆盖 /Cube/Apis、/Cube/Lookup、/Cube/Info（非实体根级控制器）
      '/Cube': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/Content': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      // 附件/图片资源（上传返回的 filePath 相对路径，如 /cube/image?id=...）
      '/cube': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
