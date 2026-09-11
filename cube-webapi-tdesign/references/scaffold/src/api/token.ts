// 令牌与租户的本地持久化 + 归一化工具
//
// 契约依据（docs/16-前端接口契约实测报告.md / troubleshooting G1）：
//   登录响应令牌键名实测为 **snake_case**（access_token / refresh_token / expire_in），
//   但文档与 dll 反射给出的是 PascalCase。故一律走 normToken 三向兜底，不硬编码单一命名。

const TOKEN_KEY = 'assets_token'
const TENANT_KEY = 'assets_tenant'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(t: string): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 隐私模式等场景静默 */
  }
}

export function clearToken(): void {
  setToken('')
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

// ---- 多租户（单校多校区）：登录响应头捕获租户 Code，请求拦截器注入 X-Tenant / X-Tenant-Id ----

export function getTenant(): string {
  try {
    return localStorage.getItem(TENANT_KEY) || ''
  } catch {
    return ''
  }
}

export function setTenant(code: string): void {
  try {
    if (code) localStorage.setItem(TENANT_KEY, code)
    else localStorage.removeItem(TENANT_KEY)
  } catch {
    /* noop */
  }
}

export function clearTenant(): void {
  setTenant('')
}
