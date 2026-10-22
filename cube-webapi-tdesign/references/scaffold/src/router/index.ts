import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthed } from '@/api/token';
import LoginView from '@/pages/LoginView.vue';
import RegisterView from '@/pages/RegisterView.vue';
import ForgotPasswordView from '@/pages/ForgotPasswordView.vue';
import BasicLayout from '@/layouts/BasicLayout.vue';
import EntityPage from '@/pages/EntityPage.vue';
import DashboardView from '@/pages/DashboardView.vue';
import AccountView from '@/pages/AccountView.vue';
import ActivateView from '@/pages/ActivateView.vue';
import SsoCallbackView from '@/pages/SsoCallbackView.vue';

/**
 * 免登录页（认证族）：登录 / 注册 / 忘记密码 / 账号激活。
 * 与业务页分离——业务页一律要过守卫，认证页已登录时反向跳回 dashboard。
 * 认证族端点在**根族**（无 [Area]），故不走 /api 前缀（见 SKILL.md §H2 判据）。
 */
export const GUEST_PATHS = ['/login', '/register', '/forgot-password', '/activate'];

/**
 * 公开路径：**未登录可进、已登录也可进**。
 * SSO 回跳页必须在此列——它要做的是「把令牌写进本地」，若被「已登录 → dashboard」规则
 * 反向跳走，令牌就永远落不了库（表现为第三方登录后仍在登录页）。
 */
export const PUBLIC_PATHS = ['/sso-callback'];

/**
 * 组件可视化验证页（**仅 DEV 注册**，生产构建不暴露；连同对应 .vue 一起可整段删除）：
 *   /theme    —— 设计令牌板 ThemeShowcase（SKILL.md §4.14 的可视化验证入口）
 *   /lov-demo —— LIST 型值集弹窗 LovListField（SKILL.md §4.20.2）
 */
const devRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      { path: 'theme', name: 'theme', component: () => import('@/components/cube/ThemeShowcase.vue') },
      { path: 'lov-demo', name: 'lov-demo', component: () => import('@/pages/LovDemoView.vue') },
    ]
  : [];

// 路由表（铁律 M1/M3）
// 业务菜单的唯一权威是后端 GET /api/Admin/Index/GetMenuTree（**区域族必带 /api**，见 SKILL.md H2）：这里只注册「壳 + 泛型实体页」，
// 业务菜单绝不硬编码；登录后默认落地 /dashboard（品牌点击亦回 /dashboard）。
// history 用 createWebHistory（生产需 Nginx `try_files $uri $uri/ /index.html` 回退）；
// 若部署环境不支持，可换 createWebHashHistory，其余代码无需改动。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView },
    // 认证族：账号激活（支持 ?token=&account= 邮件直达）
    { path: '/activate', name: 'activate', component: ActivateView },
    // 第三方登录回跳落地页（公开路径，见上 PUBLIC_PATHS 说明）
    { path: '/sso-callback', name: 'sso-callback', component: SsoCallbackView },
    {
      path: '/',
      component: BasicLayout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', component: DashboardView },
        // 个人资料 / 安全中心（内置功能页，组织照 MVC 版 User/Info）
        { path: 'account', name: 'account', component: AccountView },
        // 通用实体页：Asset 区 26 个实体零新增页，均由元数据驱动
        { path: 'entity/:area/:controller', name: 'entity', component: EntityPage, props: true },
        // DEV 专用组件验证页（生产构建为空数组）
        ...devRoutes,
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.beforeEach((to) => {
  const isGuest = GUEST_PATHS.includes(to.path);
  const isPublic = PUBLIC_PATHS.includes(to.path);
  // 未登录访问业务页 → 去登录（redirect 记住来路，登录后可回跳）
  if (!isGuest && !isPublic && !isAuthed()) return { path: '/login', query: { redirect: to.fullPath } };
  // 已登录再访问认证页 → 回 dashboard（注册 / 忘记密码 / 激活同此规则）
  if (isGuest && isAuthed()) return '/dashboard';
  return true;
});

export default router;
