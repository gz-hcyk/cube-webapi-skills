/**
 * 鉴权 store（登录 / 菜单 / 登出）
 * 落位：src/stores/auth.ts
 *
 * 契约要点：
 *  · 登录 POST /Auth/Login（根族，不带 /api），body { username, password }
 *  · 令牌字段可能是 access_token / accessToken / AccessToken，统一走 normToken
 *  · 菜单 GET /api/Admin/Index/GetMenuTree（区域族，必须带 /api）
 *  · 权限位不在独立接口里，而以 GetPage.setting 与菜单树为准
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { getRaw, postRaw } from '@/api/http';
import {
  clearTenant,
  clearTokens,
  getToken,
  getUsernameFromToken,
  normToken,
  setTokens,
} from '@/api/token';
import { normalizeMenus, type MenuNode } from '@/utils/menu';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken());
  const username = ref(getUsernameFromToken());
  const menus = ref<MenuNode[]>([]);
  const menuLoaded = ref(false);
  const logging = ref(false);

  const isLoggedIn = computed(() => !!token.value);

  /** 登录：成功后立即持久化令牌，租户由响应头 X-Tenant 在拦截器里落盘 */
  async function login(userName: string, password: string): Promise<void> {
    logging.value = true;
    try {
      const res = await postRaw<any>('/Auth/Login', { username: userName, password });
      const payload = normToken(res?.data);
      if (!payload.accessToken) throw new Error(res?.message || '登录失败，请检查账号密码');
      setTokens(payload.accessToken, payload.refreshToken, payload.expireIn);
      token.value = payload.accessToken;
      username.value = getUsernameFromToken() || userName;
    } finally {
      logging.value = false;
    }
  }

  /** 菜单：全局只拉一次；换账号/刷新页面后重新拉 */
  async function loadMenus(force = false): Promise<MenuNode[]> {
    if (menuLoaded.value && !force) return menus.value;
    const res = await getRaw<MenuNode[]>('/api/Admin/Index/GetMenuTree');
    menus.value = normalizeMenus(res?.data ?? []);
    menuLoaded.value = true;
    return menus.value;
  }

  async function logout(): Promise<void> {
    try {
      await postRaw('/Auth/Logout');
    } catch {
      /* 后端未实现登出接口也不阻断前端清理 */
    }
    clearTokens();
    clearTenant();
    token.value = '';
    username.value = '';
    menus.value = [];
    menuLoaded.value = false;
  }

  return { token, username, menus, menuLoaded, logging, isLoggedIn, login, loadMenus, logout };
});
