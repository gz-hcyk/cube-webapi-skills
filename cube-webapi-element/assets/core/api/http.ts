/**
 * 唯一 HTTP 层（铁律 E3）
 * 落位：src/api/http.ts
 *
 * ┌ 两套实例，按「控制器有没有 [Area]」分工，而不是按「是不是系统接口」：
 * │   http    baseURL = /api  → 区域族：业务实体 /api/{area}/{controller}、
 * │                            框架区域控制器 /api/Admin/Index/GetMenuTree
 * └   rawHttp baseURL = 后端根 → 根族：/Auth/*、/Mfa/*、/Sso/*、/Cube/*、/Content/*
 *
 * ⚠️ 漏写 /api（或给根族多写 /api）都不会报错：
 *    请求会落到前端 SPA 兜底，返回 200 + text/html，axios 解析出 undefined，
 *    表现为「菜单/列表静默为空，无 401、无 404」——最难查的一类 bug。
 *
 * ⚠️ 鉴权头只发一个：Authorization: Bearer <jwt>。
 *    实测发 Authentication、或只带 Cookie(.Cube.Session) 均 401。
 */
import axios from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  clearTokens,
  getRefreshToken,
  getTenant,
  getTenantCode,
  getToken,
  setTenantCode,
  setTokens,
} from './token';

/* ------------------------------ 契约类型 ------------------------------ */

export interface PageModel {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  pageCount?: number;
  sort?: string;
  desc?: boolean;
}

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
  page?: PageModel;
  stat?: T;
  fieldErrors?: { field: string; message: string }[];
}

export interface ApiListEnvelope<T> extends ApiEnvelope<T[]> {
  page: PageModel;
}

/* ------------------------------ 部署基址 ------------------------------ */

/** 后端根地址：留空 = 同源部署（dev 走 vite 代理，生产走 nginx 反代） */
export const SERVER_BASE = String(import.meta.env.VITE_SERVER_BASE || '').replace(/\/+$/, '');

/** 实体接口基址：/api（或独立域名下的 https://api.xxx/api） */
export const API_BASE = import.meta.env.VITE_API_BASE || (SERVER_BASE ? `${SERVER_BASE}/api` : '/api');

const APP_BASE = import.meta.env.BASE_URL || '/';
const LOGIN_PATH = `${APP_BASE}login`;

/** 把后端返回的相对资源地址解析成可访问地址（独立域名部署时必须用） */
export function serverUrl(input?: string | null): string {
  const s = String(input ?? '');
  if (!s) return '';
  if (/^(https?:)?\/\//i.test(s) || /^(data|blob):/i.test(s)) return s;
  if (!SERVER_BASE) return s;
  return SERVER_BASE + (s.startsWith('/') ? s : '/' + s);
}

/* ------------------------------ 401 处理 ------------------------------ */

function handleUnauthorized(): void {
  clearTokens();
  if (window.location.pathname !== LOGIN_PATH) window.location.href = LOGIN_PATH;
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/Auth/Login') ||
    url.includes('/Auth/Refresh') ||
    url.includes('/Auth/LoginConfig') ||
    url.includes('/Auth/Logout') ||
    url.includes('/Mfa/')
  );
}

let refreshInFlight: Promise<boolean> | null = null;

/** 用 refresh_token 续期一次；并发请求共用同一个 Promise，避免刷新风暴 */
function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const resp = await rawHttp.post<ApiEnvelope<any>>('/Auth/Refresh', { refreshToken: rt });
      const body = resp.data;
      const data = body?.data ?? {};
      const access = data.accessToken ?? data.access_token ?? data.AccessToken;
      if (body?.code === 0 && access) {
        setTokens(access, data.refreshToken ?? data.refresh_token ?? rt, data.expireIn ?? data.expire_in);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/* ------------------------------ 拦截器 ------------------------------ */

function attach(instance: AxiosInstance): void {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);

    // 多租户：登录响应头 X-Tenant 下发租户 Code，此后每个请求带上
    const tenantCode = getTenantCode();
    if (tenantCode) config.headers.set('X-Tenant', tenantCode);
    const tenantId = getTenant();
    if (tenantId) config.headers.set('X-Tenant-Id', tenantId);

    return config;
  });

  instance.interceptors.response.use(
    (resp: AxiosResponse) => {
      const body = resp.data as ApiEnvelope<unknown>;

      // 信封级错误：HTTP 200 但 code !== 0
      if (body && typeof body.code === 'number' && body.code !== 0) {
        if (body.code === 401) handleUnauthorized();
        const err: any = new Error(body.message || '请求失败');
        err.code = body.code;
        err.fieldErrors = body.fieldErrors;
        return Promise.reject(err);
      }

      const tenant = resp.headers?.['x-tenant'] ?? resp.headers?.['X-Tenant'];
      if (tenant) setTenantCode(String(tenant));

      return resp;
    },
    async (error: any) => {
      const status = error?.response?.status;
      const url: string | undefined = error?.config?.url;

      if (status === 401 && !isAuthEndpoint(url) && getRefreshToken()) {
        const ok = await tryRefresh();
        if (ok && error?.config) {
          const token = getToken();
          if (token) error.config.headers.set('Authorization', `Bearer ${token}`);
          return instance.request(error.config);
        }
        handleUnauthorized();
        return Promise.reject(error);
      }

      if (status === 401) handleUnauthorized();
      return Promise.reject(error);
    },
  );
}

/* ------------------------------ 实例 ------------------------------ */

export const http: AxiosInstance = axios.create({ baseURL: API_BASE, timeout: 30000 });
export const rawHttp: AxiosInstance = axios.create({ baseURL: SERVER_BASE, timeout: 30000 });

attach(http);
attach(rawHttp);

/* ------------------------------ 便捷方法 ------------------------------ */

/** 区域族：调用方写 `/{area}/{controller}`，**不要再写 /api** */
export async function getApi<T>(url: string, params?: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const r = await http.get<ApiEnvelope<T>>(url, { params });
  return r.data;
}

export async function postApi<T>(url: string, data?: unknown): Promise<ApiEnvelope<T>> {
  const r = await http.post<ApiEnvelope<T>>(url, data);
  return r.data;
}

export async function putApi<T>(url: string, data?: unknown): Promise<ApiEnvelope<T>> {
  const r = await http.put<ApiEnvelope<T>>(url, data);
  return r.data;
}

export async function deleteApi<T>(url: string, params?: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const r = await http.delete<ApiEnvelope<T>>(url, { params });
  return r.data;
}

/**
 * 根族：路径写全。
 *   /Auth/Login、/Mfa/Verify、/Cube/Lookup     ← 不带 /api
 *   /api/Admin/Index/GetMenuTree               ← 带 /api（IndexController 挂 [AdminArea]）
 */
export async function getRaw<T>(url: string, params?: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const r = await rawHttp.get<ApiEnvelope<T>>(url, { params });
  return r.data;
}

export async function postRaw<T>(url: string, data?: unknown): Promise<ApiEnvelope<T>> {
  const r = await rawHttp.post<ApiEnvelope<T>>(url, data);
  return r.data;
}

export { isAuthEndpoint };
export default http;
