/// <reference types="vite/client" />

/**
 * 环境变量类型（落位：src/types/env.d.ts）
 * 与 .env.local 保持一一对应，避免 import.meta.env.VITE_XXX 拼错时静默变 undefined。
 */
interface ImportMetaEnv {
  /** 系统名（登录页、侧栏品牌位显示） */
  readonly VITE_APP_TITLE?: string;
  /** 后端根地址；留空 = 同源部署（dev 走 vite 代理 / 生产走 nginx 反代） */
  readonly VITE_SERVER_BASE?: string;
  /** 实体接口基址；一般不需要填，留空自动为 /api */
  readonly VITE_API_BASE?: string;
}
