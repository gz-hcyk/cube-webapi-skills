// Vite 环境变量类型声明（all 模板原生 src/types/env.d.ts + 本技能新增变量）
// tsconfig 已配 `types: ["vite/client", ...]`，故无需再写 `/// <reference types="vite/client" />`。
interface ImportMetaEnv {
  // —— tdesign-starter（all 模板）自带 ——
  readonly VITE_IS_REQUEST_PROXY: string;
  readonly VITE_API_URL: string;
  readonly VITE_API_URL_PREFIX: string;
  /** 前端路由 base（createWebHistory 用） */
  readonly VITE_BASE_URL: string;
  // —— cube-webapi-tdesign 新增（api/http.ts 基址派生 + vite proxy target）——
  /** 后端基址，同源部署留空（`/api` 自动落同源根） */
  readonly VITE_SERVER_BASE: string;
  /** 显式覆盖 `/api` 前缀（后端 `CubeSetting.ApiPrefixes` 非默认时用） */
  readonly VITE_API_BASE: string;
  /** 仅 dev 生效：vite proxy 的 target，指向真实后端（写 `127.0.0.1`，勿 `localhost`） */
  readonly VITE_API_TARGET: string;
  /** 图像字段（itemType=image）上传端点覆盖；缺省回落 `/{area}/{controller}/UploadFile` */
  readonly VITE_UPLOAD_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
