<script setup lang="ts">
/**
 * ProfileHeader —— 个人信息头卡（**对齐 MVC 版 `.profile-card`**）。
 *
 * 版式取自 `NewLife.CubeNC/wwwroot/Content/profile.css` + `User/Info.cshtml`：
 *   顶部 4px 主色边；96px 圆形头像（3px 白边 + 阴影，无头像时退回首字母）；
 *   名称 22px/700 + 用户名 14px 次级；角色徽章依次轮换主题色；
 *   底部浅底统计条：等分 4 列，数值 18px/700 主色，标签 12px 次要色。
 *
 * 数据来源：`GET /api/Admin/User/Info`（无该端点时由宿主传 route row）。
 * 只读展示，不含任何编辑行为——编辑在下方分区表单里。
 *
 * 详见 references/mvc-page-organization.md §二。
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 显示名（DisplayName） */
    name?: string;
    /** 登录名（Name） */
    username?: string;
    /** 头像地址（相对地址由宿主用 serverUrl() 解析） */
    avatar?: string;
    /** 角色名列表（渲染为徽章，主题色轮换） */
    roles?: string[];
    /** 统计项（MVC 固定 4 项：登录次数 / 最后登录 / 部门 / 最后登录 IP） */
    stats?: { label: string; value?: string | number | null }[];
  }>(),
  { name: '', username: '', avatar: '', roles: () => [], stats: () => [] },
);

/** 徽章主题轮换（MVC 用 Bootstrap 的 primary/success/info/warning/danger） */
const TAG_THEMES = ['primary', 'success', 'default', 'warning', 'danger'] as const;

const initial = computed(() => (props.name || props.username || '?').trim().slice(0, 1).toUpperCase());
const roleBadges = computed(() =>
  props.roles.filter(Boolean).map((label, i) => ({ label, theme: TAG_THEMES[i % TAG_THEMES.length] })),
);
/** 统计值兜底：空值显示占位横线，避免「数值区一片空白」 */
const statItems = computed(() =>
  props.stats.map((s) => ({ label: s.label, value: s.value === 0 || s.value ? String(s.value) : '—' })),
);
</script>

<template>
  <div class="profile-card">
    <div class="pc-head">
      <t-avatar :image="avatar || undefined" :size="'96px'" class="pc-avatar">{{ initial }}</t-avatar>
      <div class="pc-info">
        <div class="pc-name">
          {{ name || username || '未命名用户' }}
          <span v-if="username && name && username !== name" class="pc-username">{{ username }}</span>
        </div>
        <div v-if="roleBadges.length" class="pc-badges">
          <t-tag v-for="b in roleBadges" :key="b.label" :theme="b.theme" variant="light" size="small">{{ b.label }}</t-tag>
        </div>
      </div>
    </div>
    <div v-if="statItems.length" class="pc-stats">
      <div v-for="s in statItems" :key="s.label" class="pc-stat">
        <div class="pc-stat-num" :title="s.value">{{ s.value }}</div>
        <div class="pc-stat-label">{{ s.label }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 头卡：白底 + 1px 描边 + 顶部 3px 主色边（MVC 为 4px，此处按 TDesign 视觉略收） */
.profile-card {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-top: 3px solid var(--td-brand-color);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-1);
  margin-bottom: 16px;
  overflow: hidden;
}
.pc-head { display: flex; align-items: center; padding: 24px 28px 18px; }
.pc-avatar { flex: 0 0 96px; margin-right: 24px; box-shadow: var(--td-shadow-2); }
.pc-info { flex: 1; min-width: 0; }
.pc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--td-text-color-primary);
  margin-bottom: 6px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.pc-username { font-size: 14px; font-weight: 400; color: var(--td-text-color-placeholder); }
.pc-badges { display: flex; flex-wrap: wrap; gap: 6px; }

/* 统计条：浅底 + 等分 + 竖分隔线 */
.pc-stats {
  display: flex;
  background: var(--td-bg-color-secondarycontainer);
  border-top: 1px solid var(--td-component-stroke);
  padding: 14px 28px;
}
.pc-stat { flex: 1; text-align: center; border-right: 1px solid var(--td-component-stroke); min-width: 0; }
.pc-stat:last-child { border-right: none; }
.pc-stat-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--td-brand-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-stat-label { font-size: 12px; color: var(--td-text-color-placeholder); margin-top: 2px; }

@media (max-width: 767px) {
  .pc-head { flex-direction: column; text-align: center; padding: 20px 16px; }
  .pc-avatar { margin: 0 0 16px; }
  .pc-name { justify-content: center; }
  .pc-badges { justify-content: center; }
  .pc-stats { flex-wrap: wrap; padding: 10px 8px; }
  .pc-stat { flex: 0 0 50%; border-right: none; padding: 8px 0; }
}
</style>
