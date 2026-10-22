<script setup lang="ts">
/**
 * PageNav —— 内置功能页的页内导航（**对齐 MVC 版 `_User_Nav` / `_Object_Nav`**）。
 *
 * 版式取自 `NewLife.CubeNC/wwwroot/Content/profile.css` 的 `.profile-tabs`：
 * 白底卡片、tab 项 12px/14px 内距、悬停浅底、选中 3px 主色下划线 + 加粗。
 * 颜色一律走设计令牌，**不得照抄 MVC 的 #2b7dbc**（否则暗色/换肤失效）。
 *
 * 两种形态（对应 MVC 的两份分部视图）：
 *   - `tabs` （默认）：用户中心，一行 tab，底部下划线；超出宽度横向滚动（同 MVC 移动端处理）
 *   - `pills`        ：系统设置，胶囊态；支持子项下拉（「更多设置」）
 *
 * 导航项的语义（`kind`）由 `pageNav.ts` 声明：
 *   - `tab`  → 触发 `select` 事件，由宿主切换页内分区（不跳路由）
 *   - `link` → 走 `router.push(to)`
 * 这样同一个组件既能承载「平级页串联」，也能承载「页内分区」，与 MVC 的观感一致。
 *
 * 详见 references/mvc-page-organization.md。
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { PageNavItem } from '../../pageNav';

const props = withDefaults(
  defineProps<{
    items: PageNavItem[];
    /** 视觉形态：tabs（用户中心）/ pills（系统设置） */
    variant?: 'tabs' | 'pills';
    /** 当前页内分区 key（kind='tab' 的高亮依据）；缺省按路由匹配 link 项 */
    modelValue?: string;
  }>(),
  { variant: 'tabs', modelValue: '' },
);

const emit = defineEmits<{
  /** kind='tab' 的项被点击：key 即分区标识 */
  (e: 'update:modelValue', key: string): void;
  (e: 'select', key: string): void;
}>();

const router = useRouter();
const route = useRoute();

/** 判断某项是否高亮：显式 active 优先，其次 tab 项比对 modelValue，link 项比对当前路由 */
function isActive(it: PageNavItem): boolean {
  if (it.active) return true;
  if (it.children?.some((c) => isActive(c))) return true;
  if (it.kind === 'tab') return it.key === props.modelValue;
  if (it.to) return it.to === route.fullPath || it.to === route.path;
  return false;
}

/** 子项下拉的选项（TDesign 需要 content/value 结构） */
function childOptions(it: PageNavItem) {
  return (it.children ?? []).map((c) => ({
    content: c.label,
    value: c.key,
    active: isActive(c),
  }));
}

/**
 * t-dropdown 的 @click 参数在不同版本间形状不一（裸值 / 选项对象 / undefined），
 * 与 BasicLayout 的处理保持一致：入参用 unknown 收敛（避免模板表达式的逆变类型问题），
 * 内部再统一成字符串分支。
 */
function onChildClick(parent: PageNavItem, d: unknown) {
  const value = d && typeof d === 'object' ? (d as { value?: string | number }).value : d;
  const child = (parent.children ?? []).find((c) => c.key === String(value));
  if (child) go(child);
}

function go(it: PageNavItem) {
  if (it.disabled || it.children?.length) return;
  if (it.kind === 'tab') {
    emit('update:modelValue', it.key);
    emit('select', it.key);
    return;
  }
  if (it.to) {
    // 已是当前地址则不重复 push（避免多余历史记录）
    if (it.to !== route.fullPath) router.push(it.to);
    emit('select', it.key);
  }
}

const navClass = computed(() => ['cube-page-nav', `is-${props.variant}`]);
</script>

<template>
  <nav :class="navClass">
    <ul class="cpn-list">
      <li v-for="it in items" :key="it.key" class="cpn-item" :class="{ active: isActive(it), disabled: it.disabled }">
        <!-- 有子项 → 下拉（对齐 _Object_Nav 的「更多设置」）。
             ⚠️ 模板表达式不支持 TS 语法（`as` / 类型标注都会编译失败），
             故载荷类型在 script 内用 unknown 收敛（见 onChildClick）。 -->
        <t-dropdown v-if="it.children?.length" :options="childOptions(it)" trigger="hover" @click="(d) => onChildClick(it, d)">
          <a class="cpn-link" role="button">
            <t-icon v-if="it.icon" :name="it.icon" class="cpn-icon" />
            <span>{{ it.label }}</span>
            <t-icon name="chevron-down" size="14px" class="cpn-caret" />
          </a>
        </t-dropdown>
        <a v-else class="cpn-link" role="button" @click="go(it)">
          <t-icon v-if="it.icon" :name="it.icon" class="cpn-icon" />
          <span>{{ it.label }}</span>
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* 容器：白底卡片，与 MVC .profile-tabs 同构（间距/描边/圆角/阴影全部走令牌） */
.cube-page-nav {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-1);
  margin-bottom: 16px;
  padding: 0 12px;
  overflow: hidden;
}
.cpn-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}
.cpn-item { flex: 0 0 auto; }
.cpn-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: color 0.2s, border-color 0.2s, background-color 0.2s;
  white-space: nowrap;
  user-select: none;
}
.cpn-link:hover { background: var(--td-bg-color-container-hover); color: var(--td-brand-color); }
.cpn-icon { color: var(--td-text-color-placeholder); }
.cpn-item.active .cpn-link {
  color: var(--td-brand-color);
  font-weight: 700;
  border-bottom-color: var(--td-brand-color);
  background: transparent;
}
.cpn-item.active .cpn-icon { color: var(--td-brand-color); }
.cpn-item.disabled .cpn-link { color: var(--td-text-color-disabled); cursor: not-allowed; }
.cpn-caret { color: var(--td-text-color-placeholder); }

/* 胶囊形态（系统设置）：去掉下划线，改圆角底 */
.is-pills .cpn-list { padding: 8px 0; }
.is-pills .cpn-link {
  border-bottom: none;
  border-radius: var(--td-radius-default);
  padding: 8px 14px;
}
.is-pills .cpn-item.active .cpn-link {
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
}

/* 窄屏：横向滚动（同 MVC profile.css 的 767px 断点处理） */
@media (max-width: 767px) {
  .cpn-list { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cpn-link { padding: 10px; font-size: 13px; }
}
</style>
