# cube-webapi-skills

WorkBuddy 技能版本管理仓库（GitHub 公开）。

## 包含的技能
- `cube-webapi-backend/` — NewLife.Cube 第三代 WebApi 开发技能
- `cube-webapi-tdesign/` — Cube WebApi 的 TDesign Vue Next 前端生成技能

## 本地加载方式
技能通过 Windows 目录联结（junction）链回 `~/.workbuddy/skills/`：
- `C:/Users/admin/.workbuddy/skills/cube-webapi-backend` → `cube-webapi-skills\cube-webapi-backend`
- `C:/Users/admin/.workbuddy/skills/cube-webapi-tdesign` → `cube-webapi-skills\cube-webapi-tdesign`

修改技能后，在此仓库执行 `git add -A && git commit && git push` 即可完成版本管理。
