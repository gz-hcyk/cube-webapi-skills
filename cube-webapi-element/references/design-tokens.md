# 设计令牌与组件规格

> 落地文件：`assets/core/styles/tokens.css`（浅色）、`theme-dark.css`（深色）、`page.css`（版式）。
> 改视觉只改这三处 + `setting.ts` 的 `DEFAULT_BRAND`，业务页里**不写颜色和尺寸魔法数字**。

## 1. 设计立场

后台产品的"好看"不来自装饰，来自三件事：**层级清楚、密度合适、状态齐全**。

- **层级清楚**：一屏最多三层（页头 / 内容卡 / 表内），用背景差和 1px 边框分层，不靠重阴影。
- **密度合适**：表格行 48px、表头 44px、表单控件 32px——比 Element Plus 默认松一点，比"大屏展示"紧一点。
- **状态齐全**：加载、空、错、无权限、禁用，五个状态都有专门样式，不允许出现"白屏"。

## 2. 颜色

### 2.1 品牌色（政务蓝）

| Token | 值 | 用途 |
|---|---|---|
| `--el-color-primary` | `#2563eb` | 主按钮、选中态、链接、焦点环 |
| `--el-color-primary-light-3` | `#6692f1` | hover 边框 |
| `--el-color-primary-light-5` | `#92b1f5` | 次级分隔 |
| `--el-color-primary-light-7` | `#bed0f9` | 选中边框 |
| `--el-color-primary-light-8` | `#d3e0fb` | 头像底、轻标签 |
| `--el-color-primary-light-9` | `#e9effd` | **选中行 / 激活菜单底色** |
| `--el-color-primary-dark-2` | `#1e4fbc` | 按下态、渐变深端 |

**对比度**：`#2563eb` 对白底 4.6:1，白字对它 4.6:1 —— 满足 WCAG AA（正文 4.5:1）。
`--el-color-primary-light-9` 上的深色文字对底色 > 10:1，可安全用作浅底标签。

### 2.2 语义色

| 语义 | 值 | 使用场景 |
|---|---|---|
| success | `#16a34a` | 启用、成功、通过 |
| warning | `#f59e0b` | 待处理、需注意（不做主按钮） |
| danger | `#dc2626` | 删除、失败、停用 |
| info | `#64748b` | 中性提示、次要标签 |

### 2.3 中性色

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| 页面底 | `#f5f6f8` | `#0f1115` | body / 内容区 |
| 卡片底 | `#ffffff` | `#161a21` | 卡片、表格、弹窗 |
| 主文字 | `#111827` | `#e8eaee` | 标题、表格主列 |
| 常规文字 | `#374151` | `#c2c7d0` | 正文、表单值 |
| 次要文字 | `#6b7280` | `#8e95a3` | 说明、表头、计数 |
| 占位 | `#9ca3af` | `#6b7280` | placeholder、空值「—」 |
| 边框 | `#e5e7eb` | `#262b35` | 卡片、分割线 |
| 浅边框 | `#eef0f4` | `#1e222a` | 表格内线 |

## 3. 字体

- 字族：`Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`
- 数字表格建议开 `font-variant-numeric: tabular-nums`（金额、编号列对齐）。

| 层级 | 字号 / 行高 / 字重 | 用途 |
|---|---|---|
| 页面标题 | 20 / 28 / 600 | 页头 `h1` |
| 卡片标题 | 14 / 22 / 600 | 卡片 header |
| 正文 | 14 / 22 / 400 | 表单、段落 |
| 表格 | 13 / 20 / 400 | 单元格、搜索标签 |
| 辅助 | 12 / 18 / 400 | 说明、计数、面包屑尾项 |
| 数字强调 | 20 / 26 / 600 | 工作台统计值 |

字距：标题 `-0.01em`（中文不明显，英文更紧致）；正文 0。

## 4. 间距（8px 栅格）

`4 / 8 / 12 / 16 / 24 / 32 / 48`

| 位置 | 值 |
|---|---|
| 页面 padding | 20（窄屏 12） |
| 卡片内边距 | 16 20 |
| 卡片间距 | 16 |
| 表单行距 | 18（底部） |
| 表单项标签与控件 | 8 |
| 按钮组间距 | 8 |
| 表格单元格横向 | 12 |

## 5. 圆角 / 阴影 / 动效

| Token | 值 | 用途 |
|---|---|---|
| `--cube-radius-control` | 8px | 按钮、输入框、菜单项 |
| `--cube-radius-card` | 12px | 卡片、弹窗、抽屉 |
| `--cube-shadow-sm` | `0 1px 2px rgba(16,24,40,.05)` | 卡片静态 |
| `--cube-shadow-md` | `0 4px 12px rgba(16,24,40,.08)` | 卡片 hover、悬浮按钮 |
| `--cube-shadow-lg` | `0 12px 32px rgba(16,24,40,.12)` | 弹窗、抽屉 |
| `--cube-duration` | 160ms | 所有交互过渡 |
| `--cube-ease` | `cubic-bezier(.4,0,.2,1)` | 标准缓动 |

暗色下阴影几乎不可见，改用**背景差 + 边框**分层（`html.dark .cube-card { box-shadow:none }`）。

## 6. 布局尺寸

| 项 | 值 |
|---|---|
| 侧栏宽 | 232px，折叠 64px |
| 顶栏高 | 56px |
| 内容最大宽 | 1600px（居中） |
| 登录页左栏 | ≥ 980px 显示，宽 44%（最小 360px） |
| 断点 | 560 / 768 / 900 / 1200 |

## 7. 组件规格

### 按钮
高度 32（默认）/ 40（large）；圆角 8；主按钮不用渐变，hover 只变 `primary-dark-2`；
表格行内操作一律 `link` 类型，右对齐，最多 3 个。

### 表格
- 表头 44px，底色 `--el-fill-color-lighter`，文字 12–13px、次要色、`font-weight:500`；
- 行 48px，hover 用 `--el-fill-color-light`，不加斑马纹 + 边框同时存在（二选一，默认 `border + stripe` 在密集表格里可读性更好）；
- 文本列单行截断 + tooltip；标签列允许换行；
- 操作列 `fixed="right"`，宽度 = 按钮数 × 56 + 24。

### 表单
- 标签右对齐，宽 104px；
- 两列栅格，textarea / 富文本 / 上传 / 日期范围占满整行；
- 分组 > 1 用 `el-tabs`，tab 标题即 `category`；
- 校验信息在控件下方 12px，不弹 toast 代替行内提示；
- 保存中禁用整个表单 + 关闭按钮。

### 弹窗 / 抽屉
- 新增/编辑：`el-dialog` 宽 640（单组）/ 820（多组），`align-center`，点遮罩不关闭；
- 详情：`el-drawer` 480–520px，先给概要头（标题 + 状态 + 更新时间），再分区列字段；
- 危险操作：`el-message-box` 二次确认，确认按钮用 danger，文案写清"不可恢复"。

### 空 / 加载 / 错误
| 状态 | 呈现 |
|---|---|
| 首次加载 | `v-loading` + 表格骨架行（不要整页 spinner） |
| 空数据 | `el-empty` 88px 图 + 一句可行动的文案 + 主操作按钮 |
| 加载失败 | 表内 `el-alert` + 「重新加载」，不跳白屏 |
| 无权限 | 隐藏入口；直达 URL 时由后端 403，前端提示"无访问权限" |

## 8. 暗色模式

Element Plus 通过 `html.dark` 切换，暗色 CSS 变量来自 `element-plus/theme-chalk/dark/css-vars.css`。
本技能在其上做三件事：

1. 把主色换成更亮的 `#4d84f5`（深底上原色偏闷）；
2. 页面底 `#0f1115`、卡片 `#161a21`、侧栏 `#10131a`——三层递进，不是"全黑"；
3. 卡片去阴影，改边框分层。

切换逻辑：`setting.ts` → `apply()` → `classList.toggle('dark')` + 主色阶 inline 变量；
`theme === 'auto'` 时监听 `prefers-color-scheme`。

## 9. 无障碍（WCAG AA）

- 正文对比度 ≥ 4.5:1，大字号 ≥ 3:1；
- 所有可交互元素有 `:focus-visible` 2px 主色环（`tokens.css` 已全局定义）；
- 点击目标 ≥ 32px（表格行内 link 按钮靠 `el-button` 默认 padding 保证）；
- 支持 `prefers-reduced-motion`（全局关闭动画）；
- 状态不能只靠颜色：开关用「是/否」文字 + 颜色，标签带文字；
- 表单 label 与控件通过 `el-form-item` 的 `label`/`prop` 关联，禁止只有 placeholder 没有 label。

## 10. 换品牌色的唯一流程

1. `tokens.css` 的 `--el-color-primary` 及色阶（7 个变量）；
2. `stores/setting.ts` 的 `DEFAULT_BRAND`；
3. `SettingPanel` 的 `BRAND_PRESETS` 首位；
4. 若换色幅度大，同步检查 `AuthShell` 左栏渐变（`#0a1a33 → #1d4ed8`）。

其余色阶由 `utils/color.ts` 的 `elementPrimaryPalette()` 在运行时按主色推导，不需要手写。
