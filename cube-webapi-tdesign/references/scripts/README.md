# 资产体检脚本

两个零依赖脚本，用于定期给技能资产做「死文件 / 悬空引用 / 副本漂移」体检。

```bash
node references/scripts/scan-assets-dead.mjs   # 零引用源码文件（含入口白名单判断提示）
node references/scripts/scan-assets-refs.mjs   # ① 文档悬空引用 ② assets ↔ scaffold 副本一致性
# 换技能目录：SKILL_DIR=/path/to/skill node ...
```

## 读结果的三个坑（重要）

1. **「零引用」≠「无用」**。入口文件天然零引用：`main.ts` / `App.vue` / `router/index.ts` /
   `vite.config.ts` / `*.d.ts` / `backend/server.mjs` / 验收脚本自身。删它们等于删工程。
   真正该处理的是「**非入口**且零引用、且文档无承诺」的文件。
2. **正则必须允许扩展名**：路径常写成 `'@/layouts/BasicLayout.vue'`，若模式写成
   `from ['"][^'"]*BasicLayout['"]`（不许 `.vue`）会**全部漏匹配**，把活文件误报成死文件。
   本脚本已按 `stem(\.(vue|ts|mjs|js))?` 处理。
3. **资产拷贝模板的"零引用"是常态**：`assets/optional/*` 是给使用者按需拷的，
   不被 scaffold 引用很正常。判定要看**文档是否承诺该能力**（见 `assets/archive/README.md` 的分界标准）。

## 本次体检结论（2026-09-10）

- 删运行产物 23 个（17 张 CDP 截图 + 3 log + 3 result.json，约 900KB），体积 2.3M → 1.4M；
  已加根 `.gitignore` 防再次入库。
- 悬空引用 2 处已修：`assets/LoginView.vue` → `assets/core/pages/LoginView.vue`；
  `assets/api.ts`（已删除的反面教材）改叙述避免误报。
- 死引用 1 处已修：SKILL.md 仍把已下线的 `ListNavbar/ListSearchBar/ListToolbar/ListFooter`
  列为「基类组件」。
- `assets/archive/` **保留**（有意归档，README 有复活说明），不是无用文件。
- 新增标注：`references/demo/` **未装依赖、未编译**（源码级参考）；`assets/optional/` 的
  `CodeEditor.vue` / `IconPicker.vue` 在 scaffold 无副本 → 未经 `vue-tsc`，已标「取用前须验证」。
- **后续：用户确认删除 `CodeEditor.vue`**（`assets/optional/` 与 `references/demo/` 两份）。
  关键判据：主链路 `fieldRender.controlOf` **不产出** `code-editor`、`FormDialog` **无该分支**
  → 它从未真正接线，属「规划中资产」。相关文档（SKILL.md 资产表、`assets/README.md`、
  `field-renderers.md` §7/§9、`scaffold/README.md`）已同步为「已删除 / 未实现，按多行文本渲染」。
