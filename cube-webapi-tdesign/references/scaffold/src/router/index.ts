import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthed } from '@/api/token';
import LoginView from '@/pages/LoginView.vue';
import BasicLayout from '@/layouts/BasicLayout.vue';
import EntityPage from '@/pages/EntityPage.vue';
import DashboardView from '@/pages/DashboardView.vue';

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
    {
      path: '/',
      component: BasicLayout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', component: DashboardView },
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
  if (to.path !== '/login' && !isAuthed()) return '/login';
  if (to.path === '/login' && isAuthed()) return '/dashboard';
  return true;
});

export default router;
