import axios, { AxiosInstance } from 'axios'
import { getToken, clearToken } from './token'
import { camelize } from '@/utils/camel'

// baseURL 用根路径：本后端实体接口在 /{area}/{ctrl}（无 /api 前缀），鉴权在 /Auth/Login
const http: AxiosInstance = axios.create({ baseURL: '/', timeout: 20000 })

// 鉴权端点（不走自动刷新）：/Auth/Login、/Auth/LoginConfig、/Auth/Challenge、/Auth/Refresh、/Mfa/*
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false
  return (
    url.startsWith('/Auth/Login') ||
    url.startsWith('/Auth/LoginConfig') ||
    url.startsWith('/Auth/Challenge') ||
    url.startsWith('/Auth/Refresh') ||
    url.startsWith('/Mfa/')
  )
}

http.interceptors.request.use((cfg) => {
  const t = getToken()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

http.interceptors.response.use(
  (resp) => {
    const body = resp.data
    // 信封：code 存在且非 0 → 业务错误
    if (body && typeof body.code === 'number' && body.code !== 0) {
      return Promise.reject(new Error(body.message || `错误码 ${body.code}`))
    }
    resp.data = camelize(body)
    return resp
  },
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      clearToken()
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// 统一返回信封对象（含 data / page / stat 等）
export const getApi = <T = any>(u: string, p?: any): Promise<ApiEnvelope<T>> =>
  http.get<ApiEnvelope<T>>(u, { params: p }).then((r) => r.data)
export const postApi = <T = any>(u: string, d?: any): Promise<ApiEnvelope<T>> =>
  http.post<ApiEnvelope<T>>(u, d).then((r) => r.data)
export const putApi = <T = any>(u: string, d?: any): Promise<ApiEnvelope<T>> =>
  http.put<ApiEnvelope<T>>(u, d).then((r) => r.data)
export const deleteApi = <T = any>(u: string, p?: any): Promise<ApiEnvelope<T>> =>
  http.delete<ApiEnvelope<T>>(u, { params: p }).then((r) => r.data)

// 不带 baseURL 前缀的原始请求（登录/菜单等已在路径里带 /Auth、/Admin）
export const rawHttp: AxiosInstance = axios.create({ baseURL: '/', timeout: 20000 })
rawHttp.interceptors.request.use((cfg) => {
  const t = getToken()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
rawHttp.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && typeof body.code === 'number' && body.code !== 0) {
      return Promise.reject(new Error(body.message || `错误码 ${body.code}`))
    }
    resp.data = camelize(body)
    return resp
  },
  (err) => {
    if (err.response?.status === 401) {
      clearToken()
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(err)
  },
)

/**
 * 原始路径请求（路径自带完整前缀，如 /Auth/Login、/Admin/Index/GetMenuTree、/api/Asset/AssetItem）。
 * 与 getApi 的区别：getApi 的 baseURL 也是 '/'，两者等价；getRaw 仅为语义清晰保留，
 * 用于「非实体控制器」类端点（菜单树/Auth/Cube 元数据）。
 *
 * ⚠️ 唯一 HTTP 层：本项目**不得**再引入第二套 axios 实例（历史缺陷：技能模板遗留的
 * api.ts 使用另一套 localStorage 键名 cube_token，而 token.ts 用 assets_token，
 * 导致请求拦截器取不到令牌 → 所有 /api 请求 401 → 菜单树恒空）。
 */
/** Cube WebApi 统一响应信封（code/message/data/page） */
export interface ApiEnvelope<T = any> {
  code: number
  message?: string | null
  data: T
  page?: { pageIndex: number; pageSize: number; totalCount: number; pageCount?: number } | null
  stat?: any
}

export function getRaw<T = any>(u: string, p?: any): Promise<ApiEnvelope<T>> {
  return rawHttp.get<ApiEnvelope<T>>(u, { params: p }).then((r) => r.data)
}

export { isAuthEndpoint }
export default http
