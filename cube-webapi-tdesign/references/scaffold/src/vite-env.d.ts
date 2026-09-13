/// <reference types="vite/client" />

//https://cn.vitejs.dev/guide/env-and-mode.html#env-files
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/**
 * 环境变量声明（与 `src/api/http.ts` 的基址派生一一对应）
 *  - `VITE_SERVER_BASE`：后端基址（同源部署留空；跨域部署填如 `https://host:5070`）。路由/菜单等 `rawHttp` 端点以此为基址。
 *  - `VITE_API_BASE`：API 基址（实体 `http` 实例的 `baseURL`）。留空时自动派生为 `${VITE_SERVER_BASE}/api` 或 `/api`。
 *  - `VITE_API_TARGET`：仅 dev 用——`vite.config.ts` 代理（`/api` `/Auth` `/Mfa` `/cube` `/Content`）的目标地址。
 */
interface ImportMetaEnv {
  readonly VITE_SERVER_BASE?: string
  readonly VITE_API_BASE?: string
  readonly VITE_API_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
