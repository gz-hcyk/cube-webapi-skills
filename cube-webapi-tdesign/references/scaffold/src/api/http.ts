/**
 * 魔方 WebApi 前端基础 HTTP 层（唯一请求层，铁律 H1）。
 * 落地为 src/api/http.ts，配套 src/api/token.ts（令牌键统一 assets_token）。
 *
 * 契约要点（依据 NewLife.Cube 官方 WebAPI 接口规范 + 项目实况实测）：
 *  - 统一响应信封：{ code, message, data, traceId?, page, stat, fieldErrors? }
 *  - 实体接口前缀 /api/{area}/{controller}（**http 实例 baseURL 已带 /api，调用方勿再写 /api**）
 *  - Auth/SSO/Cube/菜单 等非实体控制器【不带】/api 前缀（rawHttp 实例，baseURL 为后端根地址）
 *  - 鉴权头：仅 Authorization: Bearer <jwt>（铁律 H2；不再发 Authentication 头）
 *  - 多租户：X-Tenant（租户 Code，主）+ X-Tenant-Id（legacy 兼容）
 *  - Cookie / Query(?token=) 由后端自动识别
 *
 * ★ **`/api` 前缀契约（勿视为前端硬编码常量）**
 *   `/api` 不来自 appsettings，而由 NewLife.Cube 的 **`CubeSetting.ApiPrefixes`** 决定
 *   （落库配置，默认 `/api`，支持多前缀如 `/api,/api/v1`）。其语义是**「剥前缀别名」**：
 *   请求命中前缀时由 `ApiPrefixRewriteMiddleware` 做 **Path Rewrite**（非 3xx 重定向）
 *   转发到真实路由。因此「后端换前缀」是合法运维动作，须按此契约应对：
 *     1. 前端**唯一**前缀来源 = 下方 `API_BASE`，必要时用 `VITE_API_BASE` 显式覆盖；
 *     2. 后端变更前缀时**推荐多前缀并存**（如 `/api,/api/v2`），新旧前端双活、迁移不断服；
 *     3. 后端现成端点（`/Auth/LoginConfig`、`/api/Cube/Info`）**均不暴露**该前缀，
 *        故**不做运行时发现**——发现本身也要依赖一个无前缀的固定引导端点，属鸡生蛋。
 *
 * ⚠️ **本层不做全局 camelize**（对齐项目实况）：后端实体行数据为 PascalCase，键名归一
 *     下移到消费端（`utils/camel.ts` 的 `camel`/`camelize` + `useEntityResource.normalizeRows`），
 *     避免「信封整体 camelize 把值集键 `Enum.X` 改写成 `enum.X`」这类副作用。
 *
 * ─────────────────────── 部署形态（管理后台前端单独部署） ───────────────────────
 * 支持两种部署形态，靠环境变量 VITE_SERVER_BASE 切换，代码零改动：
 *
 *  A) 同源部署（默认，VITE_SERVER_BASE 留空）
 *     · dev：vite dev server 把 /api、/Auth、/Mfa、/Admin、/Cube、/Content 代理到后端；
 *     · 生产：前端由 nginx 托管、API 经同一域名反代到后端。
 *     此时 http → `/api`，rawHttp → 相对当前域名根路径（与历史行为完全一致）。
 *
 *  B) 独立域名 + 跨域直连（生产推荐，VITE_SERVER_BASE=https://api.example.edu.cn）
 *     · 前端静态资源托管在独立域名，浏览器直接跨域调后端；
 *     · nginx 只服务静态文件、**不需要反向代理**；
 *     · 跨域放行由后端 Cube 的 CorsOrigins 负责（⚠️ 落库配置：Membership 库
 *       Parameter 表 Category='Cube' / Name='CorsOrigins'，写 appsettings 不生效）。
 *     此时 http → `${VITE_SERVER_BASE}/api`，rawHttp → `${VITE_SERVER_BASE}`。
 *
 * ⚠️ 单独部署最易踩的坑：登录 `POST /Auth/Login` 等框架端点**不带 /api 前缀**。
 *    历史上它们由 rawHttp（无 baseURL）以相对当前域名发出，恰好被后端 Kestrel 自托管接住；
 *    一旦前端搬去独立域名，相对地址就会打到前端静态服务器 → 登录 404。
 *    故 rawHttp 必须显式指向后端根地址（下方 SERVER_BASE）。
 */
import axios from 'axios'
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  getToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  getTenantCode,
  setTenantCode,
  getTenant,
} from './token'

/* ----------------------------- 类型契约 ----------------------------- */
export interface ApiEnvelope<T> {
  code: number // 0 成功；401 未登录；403 无权限；400 参数错误；500 服务器错误
  message: string
  data: T
  traceId?: string
  page?: PageModel
  stat?: any // 统计/合计行（可选）
  // 后端可选返回（如开启 EnableFieldValidation）：逐字段校验错误
  fieldErrors?: { field: string; message: string }[]
}
export interface PageModel {
  pageIndex: number
  pageSize: number
  totalCount: number
  pageCount?: number
  sort?: string
  desc?: boolean
}
export interface ApiListEnvelope<T> extends ApiEnvelope<T[]> {
  page: PageModel
  stat?: T
}

/* ----------------------------- 部署基址 ----------------------------- */

/**
 * 后端根地址（独立部署的唯一开关）。
 * - 留空（默认）→ 同源部署：所有请求相对当前域名发出（dev 代理 / 生产反代）。
 * - 设为后端完整源（如 https://api.example.edu.cn）→ 独立域名跨域直连。
 * 末尾斜杠自动归一（`https://x/` 与 `https://x` 等价）。
 */
export const SERVER_BASE = (import.meta.env.VITE_SERVER_BASE || '').replace(/\/+$/, '')

/**
 * 实体接口基址（供 `/api/{area}/{controller}` 使用）。
 * 优先取显式覆盖 VITE_API_BASE；否则由 SERVER_BASE 派生；同源时回落 `/api`。
 */
export const API_BASE = import.meta.env.VITE_API_BASE || (SERVER_BASE ? `${SERVER_BASE}/api` : '/api')

/**
 * 应用基址（由 vite `base` 注入，恒以 `/` 结尾，如 `/` 或 `/admin/`）。
 * 用于「整页跳转」类场景（401 跳登录页），保证子路径部署时不跳出应用。
 */
const APP_BASE = import.meta.env.BASE_URL || '/'
/** 登录页绝对路径（应用基址 + login），供 window.location 整页跳转使用 */
const LOGIN_PATH = `${APP_BASE}login`

/**
 * 把后端返回的资源相对地址（如 `/Uploads/a.png`、`Content/x.jpg`）解析为可跨域访问的地址。
 * - 独立部署（SERVER_BASE 非空）时必须使用，否则浏览器会去前端域名找文件 → 404；
 * - 绝对地址（`http(s)://`、`//`）、内联地址（`data:`/`blob:`）原样返回；
 * - 同源部署时原样返回，行为与改造前一致。
 */
export function serverUrl(u?: string | null): string {
  const s = String(u ?? '')
  if (!s) return ''
  if (/^(https?:)?\/\//i.test(s) || /^(data|blob):/i.test(s)) return s
  if (!SERVER_BASE) return s
  return SERVER_BASE + (s.startsWith('/') ? s : '/' + s)
}

/* ----------------------------- 拦截器 ----------------------------- */

/**
 * 401 统一处理：清令牌 + 整页跳转登录页。
 * - 用 window.location.href（整页刷新）而非 router.push：api 层引用 router 会形成
 *   循环依赖，且整页刷新后路由守卫（to.path !== '/login' && !auth.token → /login）自然生效。
 * - 跳转地址取「应用基址 + login」（LOGIN_PATH），子路径单独部署时不会跳出应用。
 * - 已在 /login 页则不跳转：登录接口密码错误同样返回 401，此时 Promise.reject 由
 *   LoginView 自己捕获提示「用户名或密码错误」，避免跳转自身造成刷新循环。
 */
function handleUnauthorized() {
  clearTokens()
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.href = LOGIN_PATH
  }
}

/**
 * 401 自动刷新令牌（对齐文档 §6 刷新令牌轮换）。
 * - 认证类端点（/Auth/Login、/Auth/Refresh、/Auth/LoginConfig、/Auth/Challenge、/Mfa/）不参与刷新，避免循环；
 * - 其余受保护接口 401 时，用 refreshToken 调 /Auth/Refresh 续期一次，
 *   成功后用新 accessToken 重放原请求；刷新失败再跳登录页。
 * - 用模块级 inFlight 守卫，避免并发请求同时刷新。
 */
let refreshInFlight: Promise<boolean> | null = null
function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const rt = getRefreshToken()
    if (!rt) return false
    try {
      const r = await rawHttp.post<
        ApiEnvelope<{ accessToken: string; refreshToken: string; expireIn: number }>
      >('/Auth/Refresh', { refreshToken: rt })
      const body = r.data
      const d: any = body?.data ?? {}
      if (body && body.code === 0 && d?.accessToken) {
        setTokens(d.accessToken, d.refreshToken || rt, d.expireIn)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/** 认证类端点判定（这些端点的 401 不触发自动刷新，交由页面自行提示）。 */
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false
  return (
    url.includes('/Auth/Login') ||
    url.includes('/Auth/Refresh') ||
    url.includes('/Auth/LoginConfig') ||
    url.includes('/Auth/Challenge') ||
    url.includes('/Mfa/')
  )
}

function attachInterceptors(instance: AxiosInstance) {
  // 请求拦截：注入令牌（仅 Authorization: Bearer，铁律 H2）+ 租户（多租户）
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token) {
      // 铁律 H2：后端只认 Authorization: Bearer <jwt>（兼容 NewLife.Cube 剥 Bearer 前缀）。
      // 发 Authentication 头、或只带 Cookie(.Cube.Session) 都会 401 → 表现为「登录成功但列表/菜单全空」。
      config.headers.set('Authorization', 'Bearer ' + token)
    }
    // 多租户：X-Tenant（租户 Code，主）+ X-Tenant-Id（兼容读取）。Code 取自登录响应头 X-Tenant
    const tenantCode = getTenantCode()
    if (tenantCode) config.headers.set('X-Tenant', tenantCode)
    const tenantId = getTenant()
    if (tenantId) config.headers.set('X-Tenant-Id', tenantId)
    return config
  })

  // 响应拦截：统一 code / 401（HTTP 状态 401 与信封 code=401 都要处理）
  instance.interceptors.response.use(
    (resp: AxiosResponse) => {
      const body = resp.data as ApiEnvelope<unknown>
      if (body && typeof body.code === 'number' && body.code !== 0) {
        // 信封 code=401（部分后端以 200 承载 401 语义）
        if (body.code === 401) handleUnauthorized()
        // 业务错误统一抛出，由调用方捕获
        return Promise.reject(new Error(body.message || '请求失败'))
      }
      // 捕获登录/任意响应头里的租户编码（SsoController 登录成功后写 X-Tenant=tenant.Code），
      // 持久化供后续请求经 X-Tenant 头携带，对齐官方多租户契约。
      const tHeader = resp.headers?.['x-tenant'] ?? resp.headers?.['X-Tenant']
      if (tHeader) setTenantCode(String(tHeader))
      return resp
    },
    async (error: any) => {
      const status = error?.response?.status
      const url: string | undefined = error?.config?.url
      // HTTP 状态 401 + 非认证端点 + 有 refreshToken → 尝试刷新并重放一次
      if (status === 401 && !isAuthEndpoint(url) && getRefreshToken()) {
        const ok = await tryRefresh()
        if (ok && error?.config) {
          const tk = getToken()
          if (tk) error.config.headers.set('Authorization', 'Bearer ' + tk)
          return instance.request(error.config)
        }
        handleUnauthorized()
        return Promise.reject(error)
      }
      // HTTP 状态 401（认证端点 / 无 refreshToken）：清令牌 + 跳登录页
      if (status === 401) handleUnauthorized()
      return Promise.reject(error)
    },
  )
}

/* ----------------------------- 实例 ----------------------------- */
// 实体接口实例（带 /api 前缀，供 EntityController 使用）
// 同源 → `/api`；独立部署 → `${SERVER_BASE}/api`（见文件头「部署形态」）
export const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})
// 非实体接口实例（Auth/SSO/Cube 菜单/Mfa 等，不带 /api 前缀）
// 同源 → baseURL 为空串（axios 视为相对当前域名根路径，与历史行为一致）；
// 独立部署 → `${SERVER_BASE}`（后端根地址）。**这是「登录 404」的唯一根因修复点。**
export const rawHttp: AxiosInstance = axios.create({
  baseURL: SERVER_BASE,
  timeout: 30000,
})

attachInterceptors(http)
attachInterceptors(rawHttp)

/* ----------------------------- 便捷方法（实体 /api） -----------------------------
 * baseURL 已带 /api，故调用方写 `/{area}/{controller}`（**不要再写 /api 前缀**，否则双重前缀 404）。
 */
export async function getApi<T>(url: string, params?: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const r = await http.get<ApiEnvelope<T>>(url, { params })
  return r.data
}
export async function postApi<T>(url: string, data?: unknown): Promise<ApiEnvelope<T>> {
  const r = await http.post<ApiEnvelope<T>>(url, data)
  return r.data
}
export async function putApi<T>(url: string, data?: unknown): Promise<ApiEnvelope<T>> {
  const r = await http.put<ApiEnvelope<T>>(url, data)
  return r.data
}
export async function deleteApi<T>(url: string): Promise<ApiEnvelope<T>> {
  const r = await http.delete<ApiEnvelope<T>>(url)
  return r.data
}

/* ----------------------------- 便捷方法（非 /api，如登录/菜单） -----------------------------
 * rawHttp baseURL = 后端根地址：
 *  - 框架端点写 `/Auth/Login`、`/Mfa/Verify`；
 *  - 系统端点写**全路径** `/api/Admin/Index/GetMenuTree`（该端点自身就带 /api，勿省）。
 */
export async function getRaw<T>(url: string, params?: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const r = await rawHttp.get<ApiEnvelope<T>>(url, { params })
  return r.data
}
export async function postRaw<T>(url: string, data?: unknown): Promise<ApiEnvelope<T>> {
  const r = await rawHttp.post<ApiEnvelope<T>>(url, data)
  return r.data
}

export { isAuthEndpoint }
export default http
