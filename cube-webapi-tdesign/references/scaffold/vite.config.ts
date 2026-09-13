import path from 'node:path';

import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import type { ConfigEnv, UserConfig } from 'vite';
import { loadEnv } from 'vite';
import { viteMockServe } from 'vite-plugin-mock';
import svgLoader from 'vite-svg-loader';

const CWD = process.cwd();

// ============================ 代理目标（唯一必改项） ============================
// 真实 NewLife.Cube 后端地址。开发态由 dev server 转发，避免跨域与令牌头问题。
//   Windows(cmd):        set VITE_API_TARGET=http://127.0.0.1:5052
//   PowerShell:          $env:VITE_API_TARGET="http://127.0.0.1:5052"
//   Git Bash / macOS:    VITE_API_TARGET=http://127.0.0.1:5052 npm run dev
// 缺省 127.0.0.1:5052 对应 `cube-webapi-backend` 脚手架默认 http 端口。
// ⚠️ 写 IP，勿写 localhost。
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:5052';

// https://vitejs.dev/config/
export default ({ mode }: ConfigEnv): UserConfig => {
  const { VITE_BASE_URL } = loadEnv(mode, CWD);
  return {
    base: VITE_BASE_URL,

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            hack: `true; @import (reference) "${path.resolve('src/styles/variables.less')}";`,
          },
          math: 'strict',
          javascriptEnabled: true,
        },
      },
    },

    plugins: [
      vue(),
      vueJsx(),
      // Mock 基础设施：默认关闭。需要契约替身时把 mock 文件放进 `mock/` 并置 enable: true。
      viteMockServe({
        mockPath: 'mock',
        enable: false,
      }),
      svgLoader(),
    ],

    server: {
      port: 3002,
      host: '0.0.0.0',
      allowedHosts: true,
      // ⚠️ 铁律 H3（2026-09-13 实测）：菜单树等**非实体系统端点不带 `/api` 前缀**，因此光有 `/api`
      //    规则覆盖不到它。漏配的表现极其隐蔽——请求落到 SPA 兜底、返回 `Content-Type: text/html`
      //    的 index.html，axios 解析失败 → **菜单静默为空（无报错、无 401、无 404）**。
      //    vite 把以 `^` 开头的 key 视为 RegExp，故用正则精确锁定 Index 控制器。
      //    ⚠️ 切勿写成 '/Admin'：会把前端页面路由 /Admin/User 一并转发到后端，硬刷新变 GET 404。
      proxy: {
        '/api': { target: API_TARGET, changeOrigin: true },
        '^/Admin/Index/': { target: API_TARGET, changeOrigin: true },
        '/Auth': { target: API_TARGET, changeOrigin: true },
        '/Mfa': { target: API_TARGET, changeOrigin: true },
        '/Sso': { target: API_TARGET, changeOrigin: true },
        '/Cube': { target: API_TARGET, changeOrigin: true },
        '/cube': { target: API_TARGET, changeOrigin: true },
        '/Content': { target: API_TARGET, changeOrigin: true },
      },
    },

    build: {
      // 拆 vendor：消除 chunk > 500KB 告警，并让 vue/tdesign 长期缓存。
      rolldownOptions: {
        output: {
          // ⚠️ 铁律 R4（2026-09-13 实测，vite@8 / rolldown）：对象形式的 manualChunks **已废弃**，
          //    其类型只剩 ManualChunksFunction（函数），写对象直接 TS2322，且运行时被忽略。
          //    对象式分包必须改用 output.codeSplitting.groups（CodeSplittingGroup[]，
          //    字段 name + test，可带 minSize / maxSize / minShareCount / priority）。
          //    源码证据：rolldown/dist/shared/define-config-*.d.mts
          //      manualChunks?: ManualChunksFunction;   // 注释明示 "object form is not supported"
          //      codeSplitting?: boolean | CodeSplittingOptions;  // groups?: CodeSplittingGroup[]
          //    ⚠️ manualChunks 与 codeSplitting 同时存在时，manualChunks 会被**静默忽略**。
          codeSplitting: {
            groups: [
              { name: 'vue', test: /node_modules[\\/](vue|vue-router|pinia)[\\/]/ },
              { name: 'tdesign', test: /node_modules[\\/](tdesign-vue-next|tdesign-icons-vue-next)[\\/]/ },
              { name: 'vendor', test: /node_modules[\\/]axios[\\/]/ },
            ],
          },
        },
        // https://github.com/vueuse/vueuse/issues/5387#issuecomment-4734186040
        onLog(level, log, defaultHandler) {
          if (log.code === 'INVALID_ANNOTATION') return null;
          else defaultHandler(level, log);
        },
      },
    },
  };
};
