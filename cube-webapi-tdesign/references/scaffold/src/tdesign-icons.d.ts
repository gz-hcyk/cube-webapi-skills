// tdesign-icons-vue-next 未提供顶层 index.d.ts（包里只有 esm/components/*.d.ts 单文件声明，
// package.json 也无 types/typings 字段）→ TS 报 TS7016「implicitly has an 'any' type」。
//
// 这里补一个模块声明，覆盖项目实际用到的图标；新增图标时同步在此追加一行即可。
declare module 'tdesign-icons-vue-next' {
  import type { Component } from 'vue'

  export const DashboardIcon: Component
  export const ServerIcon: Component
  export const SwapIcon: Component
  export const UsergroupIcon: Component
  export const UserIcon: Component
  export const ViewListIcon: Component
  export const ViewModuleIcon: Component
  export const SettingIcon: Component
  export const HistoryIcon: Component
  export const KeyIcon: Component
  export const ShopIcon: Component
  export const ControlPlatformIcon: Component
  export const MenuIcon: Component
  export const LockOnIcon: Component
  export const ChartIcon: Component
}
