/**
 * 令牌与租户持久化（唯一事实源，铁律 H1）。
 * 所有令牌读写必须经本模块，组件不得自行 localStorage.getItem/setItem 令牌。
 *
 * 键名约定（对齐项目实况 @skill:cube-webapi-tdesign 铁律 H1）：
 *   assets_token          访问令牌（JWT）
 *   assets_refresh_token  刷新令牌
 *   assets_token_expire   过期时间戳（毫秒）
 * 租户键沿用项目既有约定（cube_tenant / cube_tenant_code），与令牌键隔离。
 *
 * ── 并存的两套 API（勿再各写一份 localStorage） ──────────────────────────────
 * 1) 推荐（新代码一律用这套，对齐项目实况）：
 *    getToken / getRefreshToken / setTokens(access, refresh, expireIn?) / clearTokens
 *    getTenant / getTenantCode / setTenantCode
 * 2) 兼容（历史模板导出，保留以免破坏既有组件：stores/auth.ts、router/index.ts、BasicLayout.vue）：
 *    setToken / clearToken / isAuthed / normToken / getUsernameFromToken / clearTenant
 *
 * 令牌键名歧义说明：登录响应令牌键名实测为 **snake_case**（access_token / refresh_token /
 * expire_in），但文档与 dll 反射给出 PascalCase。故 `normToken` 一律三向兜底
 * （camelCase / PascalCase / snake_case），不硬编码单一命名。
 *
 * 所有读写均带 try/catch：隐私模式 / 禁用存储 / 非浏览器环境静默降级，不抛异常。
 */

const TOKEN_KEY = 'assets_token'
const REFRESH_KEY = 'assets_refresh_token'
const EXPIRE_KEY = 'assets_token_expire'
const TENANT_KEY = 'cube_tenant'
const TENANT_CODE_KEY = 'cube_tenant_code'

/* ------------------------------ 读写原语 ------------------------------ */

function read(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function write(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* 隐私模式等场景静默 */
  }
}

/* ------------------------------ 令牌：推荐 API ------------------------------ */

export function getToken(): string {
  return read(TOKEN_KEY)
}

export function getRefreshToken(): string {
  return read(REFRESH_KEY)
}

/** 过期时间戳（毫秒）；无则返回 0。 */
export function getTokenExpire(): number {
  return Number(read(EXPIRE_KEY)) || 0
}

/** 写访问/刷新令牌（含过期时间戳）。无 expireIn 时不更新过期时间。 */
export function setTokens(access: string, refresh: string, expireIn?: number): void {
  write(TOKEN_KEY, access)
  write(REFRESH_KEY, refresh)
  if (expireIn) write(EXPIRE_KEY, String(Date.now() + expireIn * 1000))
}

/** 清空全部令牌（登出 / 401 跳登录时调用）。 */
export function clearTokens(): void {
  write(TOKEN_KEY, '')
  write(REFRESH_KEY, '')
  write(EXPIRE_KEY, '')
}

/* ------------------------------ 令牌：兼容 API ------------------------------ */

export function setToken(t: string): void {
  write(TOKEN_KEY, t)
}

export function clearToken(): void {
  clearTokens()
}

export function isAuthed(): boolean {
  return !!getToken()
}

export interface NormToken {
  accessToken: string
  refreshToken: string
  expireIn: number
}

/** 三向兜底：camelCase / PascalCase / snake_case */
export function normToken(d: any): NormToken {
  const o = d ?? {}
  return {
    accessToken: o.accessToken ?? o.AccessToken ?? o.access_token ?? '',
    refreshToken: o.refreshToken ?? o.RefreshToken ?? o.refresh_token ?? '',
    expireIn: o.expireIn ?? o.ExpireIn ?? o.Expire ?? o.expire_in ?? 0,
  }
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '')
  const bin = atob(b64)
  let out = ''
  for (let i = 0; i < bin.length; i++) out += '%' + ('00' + bin.charCodeAt(i).toString(16)).slice(-2)
  try {
    return decodeURIComponent(out)
  } catch {
    return bin
  }
}

/** 从 JWT payload 取显示名（Cube 的 claim 可能是 name / unique_name / displayName） */
export function getUsernameFromToken(): string {
  const t = getToken()
  if (!t) return ''
  const parts = t.split('.')
  if (parts.length < 2) return ''
  try {
    const p = JSON.parse(b64urlDecode(parts[1]))
    return p.name || p.unique_name || p.preferred_username || p.Username || p.displayName || ''
  } catch {
    return ''
  }
}

/* ---------------- 多租户（单校多校区）：请求拦截器注入 X-Tenant / X-Tenant-Id ---------------- */

/** 租户 Id（legacy，`X-Tenant-Id` 头的值）。 */
export function getTenant(): string {
  return read(TENANT_KEY)
}

export function setTenant(id: string): void {
  write(TENANT_KEY, id)
}

/** 租户 Code（主，`X-Tenant` 头的值）。登录响应头 `X-Tenant` 由 http.ts 响应拦截器捕获写入。 */
export function getTenantCode(): string {
  return read(TENANT_CODE_KEY)
}

export function setTenantCode(code: string): void {
  write(TENANT_CODE_KEY, code)
}

/** 兼容别名：清空租户（只清 legacy 的 Id 键，保留 Code）。 */
export function clearTenant(): void {
  write(TENANT_KEY, '')
}
