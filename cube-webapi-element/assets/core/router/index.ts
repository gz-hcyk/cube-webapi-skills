import { createRouter, createWebHistory } from 'vue-router';
import { isAuthed } from '@/api/token';
import { APP_TITLE, DEFAULT_ROUTE } from '@/config/app';
import BasicLayout from '@/layouts/BasicLayout.vue';

/**
 * 路由（落位：src/router/index.ts，替换 create-vue 生成的同名文件）
 *
 * 关键设计：业务路由**只有一条** `/:area/:controller`。
 * 菜单来自后端，前端不再为每个实体注册路由——这是"模板继承"在路由层的体现。
 * 需要专属页面的控制器，再追加一条静态路由（静态优先于动态匹配）。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: BasicLayout,
      redirect: DEFAULT_ROUTE,
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          // 后端菜单 url 归一化后形如 /Admin/User；带子路径的（/Admin/User/Detail）也能接住
          path: ':area/:controller/:rest(.*)*',
          name: 'entity',
          component: () => import('@/views/EntityView.vue'),
          props: true,
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: DEFAULT_ROUTE },
  ],
});

router.beforeEach((to) => {
  const authed = isAuthed();

  if (!to.meta.public && !authed) {
    return { path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  }
  if (to.path === '/login' && authed) return { path: DEFAULT_ROUTE };
  return true;
});

router.afterEach((to) => {
  const title = to.meta.title as string | undefined;
  document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE;
});

export default router;
