<template>
  <!-- 外观设置的唯一 UI 入口：右下角悬浮齿轮（铁律 E7 的第三处接线） -->
  <el-tooltip content="外观设置" placement="left">
    <button class="cube-setting-trigger" type="button" aria-label="外观设置" @click="visible = true">
      <el-icon :size="18"><Setting /></el-icon>
    </button>
  </el-tooltip>

  <el-drawer v-model="visible" title="外观设置" size="320px" class="cube-setting-drawer">
    <div class="cube-setting">
      <section class="cube-setting__block">
        <h4 class="cube-setting__label">主题模式</h4>
        <el-radio-group :model-value="setting.themeMode" class="cube-setting__themes" @change="onTheme">
          <el-radio-button value="light">
            <el-icon><Sunny /></el-icon>
            <span>浅色</span>
          </el-radio-button>
          <el-radio-button value="dark">
            <el-icon><Moon /></el-icon>
            <span>深色</span>
          </el-radio-button>
          <el-radio-button value="auto">
            <el-icon><Monitor /></el-icon>
            <span>跟随系统</span>
          </el-radio-button>
        </el-radio-group>
      </section>

      <section class="cube-setting__block">
        <h4 class="cube-setting__label">品牌色</h4>
        <div class="cube-setting__colors">
          <button
            v-for="p in setting.BRAND_PRESETS"
            :key="p.value"
            type="button"
            class="cube-swatch"
            :class="{ 'is-active': setting.brand.toLowerCase() === p.value.toLowerCase() }"
            :style="{ background: p.value }"
            :title="p.name"
            :aria-label="p.name"
            @click="setting.setBrand(p.value)"
          >
            <el-icon v-if="setting.brand.toLowerCase() === p.value.toLowerCase()"><Check /></el-icon>
          </button>

          <el-color-picker
            :model-value="setting.brand"
            :predefine="setting.BRAND_PRESETS.map((p) => p.value)"
            size="small"
            @change="onCustomColor"
          />
        </div>
        <p class="cube-setting__hint">主色会同步到按钮、选中态、链接与图表系列色。</p>
      </section>

      <section class="cube-setting__block">
        <div class="cube-setting__row">
          <div>
            <h4 class="cube-setting__label">紧凑模式</h4>
            <p class="cube-setting__hint">表格行高与卡片内边距收紧，适合数据密集型页面。</p>
          </div>
          <el-switch :model-value="setting.compact" @change="(v: string | number | boolean) => setting.setCompact(!!v)" />
        </div>
      </section>

      <section class="cube-setting__block">
        <div class="cube-setting__row">
          <div>
            <h4 class="cube-setting__label">侧边栏折叠</h4>
            <p class="cube-setting__hint">折叠后只保留图标，给内容区更多宽度。</p>
          </div>
          <el-switch :model-value="setting.collapsed" @change="() => setting.toggleCollapsed()" />
        </div>
      </section>

      <el-button class="cube-setting__reset" text @click="setting.reset()">恢复默认外观</el-button>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Check, Monitor, Moon, Setting, Sunny } from '@element-plus/icons-vue';
import { useSettingStore } from '@/stores/setting';
import type { UiPrefs } from '@/api/token';

/**
 * 外观设置面板：主题 / 品牌色 / 密度 / 侧栏。
 * 不写成"设置页"——它是随时可调的工具，不应该占一个菜单位。
 */
const setting = useSettingStore();
const visible = ref(false);

function onTheme(value: string | number | boolean | undefined) {
  setting.setTheme(String(value) as UiPrefs['theme']);
}

function onCustomColor(value: string | null) {
  if (value) setting.setBrand(value);
}
</script>

<style scoped>
.cube-setting-trigger {
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 50%;
  box-shadow: var(--cube-shadow-md);
  cursor: pointer;
  z-index: 2000;
  transition: all var(--cube-duration) var(--cube-ease);
}

.cube-setting-trigger:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
  transform: rotate(30deg) scale(1.05);
}

.cube-setting__block + .cube-setting__block {
  margin-top: 24px;
}

.cube-setting__label {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cube-setting__themes {
  width: 100%;
}

.cube-setting__themes :deep(.el-radio-button) {
  flex: 1;
}

.cube-setting__themes :deep(.el-radio-button__inner) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  font-size: 12px;
}

.cube-setting__colors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.cube-swatch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: #fff;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: transform var(--cube-duration) var(--cube-ease);
}

.cube-swatch:hover {
  transform: scale(1.08);
}

.cube-swatch.is-active {
  border-color: var(--el-bg-color);
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

.cube-setting__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cube-setting__hint {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.cube-setting__reset {
  margin-top: 32px;
  color: var(--el-text-color-secondary);
}
</style>
