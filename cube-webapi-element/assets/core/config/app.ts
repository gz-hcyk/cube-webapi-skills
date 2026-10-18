/**
 * 项目级配置（铁律 E5-L1：登录页文案必须按项目重写，禁止保留模板话术）
 * 落位：src/config/app.ts
 *
 * 新项目生成时，这里三项必须改：
 *   tagline    一句定位语（业务语言，不写技术栈）
 *   highlights 2~4 条核心能力
 *   subtitle   表单上方一行说明
 */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || '魔方管理平台';

export const PROJECT = {
  name: APP_TITLE,
  /** 例：设备接入 · 协议配置 · 运行监控 */
  tagline: '统一接入 · 集中管理 · 可视运营',
  /** 例：['多协议设备接入', '实体元数据驱动', '多租户数据隔离'] */
  highlights: ['统一身份与权限', '元数据驱动的业务页面', '多租户数据隔离'],
  /** 例：'使用企业账号登录控制台' */
  subtitle: '使用管理员账号登录控制台',
};

export const DEFAULT_ROUTE = '/dashboard';
