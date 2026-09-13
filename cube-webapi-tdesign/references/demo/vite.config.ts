import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// 契约（2026-09-13 实测）：
//   实体接口 /api/{area}/{controller}；
//   根族系统端点**无 /api 前缀**：字典 /Cube/Lookup、/Auth/Login；
//   ⚠️ 菜单 /api/Admin/Index/GetMenuTree 属**区域族**，**必带 /api**（旧版本写无前缀是错的）
//   签名清单 /Cube/Apis、登录/MFA /Auth/* /Mfa/*。
//   附件图片 /cube/*（小写）；静态资源 /Content/*。
// 开发态经 dev server 代理转发（默认指向本机 mock 后端 3001）。
//
// ⚠️ 切勿代理 /Admin、/Asset 等「业务区 SPA 路由」：它们由 Vue Router 在浏览器内处理，
//    一旦转发到后端，浏览器硬刷新这些路径就会 404。
//    ⚠️ 旧版本曾要求额外加正则 `^/Admin/Index/`（前提是「菜单端点不带 /api」）——**该前提已被推翻**
//    （菜单真实端点是 `/api/Admin/Index/GetMenuTree`，属区域族），故该条规则已删除，
//    `'/api'` 一条即覆盖。漏配代理的后果是请求落到 SPA 兜底、返回 index.html，
//    axios 解析失败 → **菜单静默为空**（无报错、无 401、无 404）。
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
      // 菜单树 /api/Admin/Index/GetMenuTree 已被上方 '/api' 规则覆盖（区域族）。
      // ⚠️ 切勿写成 '/Admin' 前缀匹配（会把前端页面路由一起转发）。
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
