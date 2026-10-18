/**
 * 令牌 / 租户 / 用户偏好持久化（唯一事实源，铁律 E3）
 * 落位：src/api/token.ts
 *
 * 任何组件、任何 store 都不得自行 localStorage.getItem('...token')。
 * 键名统一 cube_* 前缀；check-project.mjs 会校验全工程只有本文件出现这些键。
 */

const TOKEN_KEY = 'cube_token';
const REFRESH_KEY = 'cube_refresh_token';
const EXPIRE_KEY = 'cube_token_expire';
const TENANT_ID_KEY = 'cube_tenant';
const TENANT_CODE_KEY = 'cube_tenant_code';
const UI_KEY = 'cube_ui_prefs';

function read(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* 隐私模式 / 存储被禁用：静默降级，不阻断业务 */
  }
}

/* ------------------------------ 令牌 ------------------------------ */

export function getToken(): string {
  return read(TOKEN_KEY);
}

export function getRefreshToken(): string {
  return read(REFRESH_KEY);
}

export function getTokenExpire(): number {
  return Number(read(EXPIRE_KEY)) || 0;
}

/**
 * 写令牌。
 * Cube 6.15 的 expire_in 实测可能为 0，而 JWT 自身 exp 有效——0 不写本地过期时间，
 * 是否登录只看 access token 是否存在，过期以 401 为准。
 */
export function setTokens(access: string, refresh?: string, expireIn?: number): void {
  write(TOKEN_KEY, access);
  if (refresh !== undefined) write(REFRESH_KEY, refresh);
  if (expireIn) write(EXPIRE_KEY, String(Date.now() + expireIn * 1000));
}

export function clearTokens(): void {
  write(TOKEN_KEY, '');
  write(REFRESH_KEY, '');
  write(EXPIRE_KEY, '');
}

export function isAuthed(): boolean {
  return !!getToken();
}

/** 登录响应令牌字段三向兼容：camelCase / PascalCase / snake_case */
export interface TokenPayload {
  accessToken: string;
  refreshToken: string;
  expireIn: number;
}

export function normToken(raw: any): TokenPayload {
  const o = raw ?? {};
  return {
    accessToken: o.accessToken ?? o.AccessToken ?? o.access_token ?? '',
    refreshToken: o.refreshToken ?? o.RefreshToken ?? o.refresh_token ?? '',
    expireIn: Number(o.expireIn ?? o.ExpireIn ?? o.expire_in ?? 0) || 0,
  };
}

function b64urlDecode(input: string): string {
  const pad = input.length % 4;
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  const bin = atob(b64);
  let out = '';
  for (let i = 0; i < bin.length; i++) out += '%' + ('00' + bin.charCodeAt(i).toString(16)).slice(-2);
  try {
    return decodeURIComponent(out);
  } catch {
    return bin;
  }
}

/** 从 JWT payload 取显示名（claim 名各版本不一，逐个兜底） */
export function getUsernameFromToken(): string {
  const token = getToken();
  const parts = token.split('.');
  if (parts.length < 2) return '';
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]));
    return payload.name || payload.unique_name || payload.preferred_username || payload.Username || '';
  } catch {
    return '';
  }
}

/* ------------------------------ 多租户 ------------------------------ */

export function getTenant(): string {
  return read(TENANT_ID_KEY);
}

export function setTenant(id: string): void {
  write(TENANT_ID_KEY, id);
}

export function getTenantCode(): string {
  return read(TENANT_CODE_KEY);
}

/** 由 http.ts 响应拦截器从登录响应头 X-Tenant 捕获写入 */
export function setTenantCode(code: string): void {
  write(TENANT_CODE_KEY, code);
}

export function clearTenant(): void {
  write(TENANT_ID_KEY, '');
  write(TENANT_CODE_KEY, '');
}

/* ------------------------------ UI 偏好 ------------------------------ */

export interface UiPrefs {
  theme: 'light' | 'dark' | 'auto';
  brand: string;
  compact: boolean;
  collapsed: boolean;
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  theme: 'light',
  brand: '#2563eb',
  compact: false,
  collapsed: false,
};

export function getUiPrefs(): UiPrefs {
  try {
    const raw = read(UI_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    return { ...DEFAULT_UI_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

export function setUiPrefs(prefs: UiPrefs): void {
  write(UI_KEY, JSON.stringify(prefs));
}
