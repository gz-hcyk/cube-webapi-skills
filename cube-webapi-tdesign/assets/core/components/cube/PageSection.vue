<script setup lang="ts">
/**
 * PageSection —— 分区卡片（**对齐 MVC 版 `.form-section`**）。
 *
 * 版式取自 `NewLife.CubeNC/wwwroot/Content/profile.css`：
 *   标题栏 12px/20px、15px 粗体、浅底、下分隔线、图标主色 8px 间距；
 *   内容区 20px/24px/6px；卡片 1px 描边 + 4px 圆角 + 轻阴影；卡片间距 16px。
 * 颜色/圆角/阴影全部取令牌，暗色模式下自动成立。
 *
 * 用途：内置功能页（个人资料、改密、绑定、值集配置…）一律用它分区，
 * 不要自己写卡片样式——否则同一产品里会出现两套卡片外观。
 *
 * 详见 references/mvc-page-organization.md §二。
 */
withDefaults(
  defineProps<{
    /** 分区标题（省略则不渲染标题栏） */
    title?: string;
    /** 标题图标（TDesign 图标名） */
    icon?: string;
    /** 内容区是否去掉默认内距（表格类内容用） */
    flush?: boolean;
  }>(),
  { title: '', icon: '', flush: false },
);
</script>

<template>
  <section class="cube-section">
    <header v-if="title || $slots.extra" class="cs-head">
      <div class="cs-title">
        <t-icon v-if="icon" :name="icon" class="cs-icon" />
        <span>{{ title }}</span>
      </div>
      <div class="cs-extra"><slot name="extra" /></div>
    </header>
    <div class="cs-body" :class="{ 'is-flush': flush }">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="cs-foot"><slot name="footer" /></footer>
  </section>
</template>

<style scoped>
.cube-section {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-1);
  margin-bottom: 16px;
  overflow: hidden;
}
.cs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: var(--td-bg-color-secondarycontainer);
  border-bottom: 1px solid var(--td-component-stroke);
}
.cs-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--td-text-color-primary);
  min-width: 0;
}
.cs-icon { color: var(--td-brand-color); }
.cs-extra { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.cs-body { padding: 20px 24px 6px; }
.cs-body.is-flush { padding: 0; }
.cs-foot {
  padding: 12px 24px;
  border-top: 1px solid var(--td-component-stroke);
  background: var(--td-bg-color-container);
}

@media (max-width: 767px) {
  .cs-head { padding: 10px 16px; }
  .cs-body { padding: 16px 16px 2px; }
}
</style>
