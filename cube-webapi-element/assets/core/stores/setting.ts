/**
 * 外观 store（品牌色 / 明暗 / 紧凑密度 / 侧栏折叠）
 * 落位：src/stores/setting.ts
 *
 * 铁律 E7：默认品牌色 = 政务蓝 #2563eb，三处同源：
 *   src/styles/tokens.css 的 --el-color-primary
 *   src/stores/setting.ts 的 DEFAULT_BRAND
 *   SettingPanel 的品牌色预设首位
 * 改色时三处一起改；只改一处 → 首屏会闪一下旧蓝。
 */
import { computed, reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_UI_PREFS, getUiPrefs, setUiPrefs, type UiPrefs } from '@/api/token';
import { elementPrimaryPalette, elementPrimaryPaletteDark } from '@/utils/color';

export const DEFAULT_BRAND = '#2563eb';

export const BRAND_PRESETS = [
  { name: '政务蓝', value: '#2563eb' },
  { name: '深海蓝', value: '#0f4c9e' },
  { name: '青碧', value: '#0d9488' },
  { name: '黛紫', value: '#6d28d9' },
  { name: '曜石', value: '#334155' },
  { name: '朱砂', value: '#b91c1c' },
];

export const useSettingStore = defineStore('setting', () => {
  const prefs = reactive<UiPrefs>({ ...DEFAULT_UI_PREFS });
  const isDark = ref(false);

  const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const brand = computed(() => prefs.brand || DEFAULT_BRAND);
  const themeMode = computed(() => prefs.theme);
  const compact = computed(() => prefs.compact);
  const collapsed = computed(() => prefs.collapsed);

  function resolvedDark(): boolean {
    if (prefs.theme === 'dark') return true;
    if (prefs.theme === 'light') return false;
    return !!media?.matches;
  }

  /** 把偏好写进 DOM：暗色 class + 主色阶 inline 变量（CSS 变量优先级高于样式表，切色即时生效） */
  function apply(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const dark = resolvedDark();
    isDark.value = dark;
    root.classList.toggle('dark', dark);
    root.classList.toggle('compact', !!prefs.compact);

    const palette = dark ? elementPrimaryPaletteDark(brand.value) : elementPrimaryPalette(brand.value);
    for (const [key, value] of Object.entries(palette)) root.style.setProperty(key, value);
    root.style.setProperty('--cube-brand', palette['--el-color-primary'] ?? brand.value);
  }

  function persist(): void {
    setUiPrefs({ ...prefs });
  }

  function setTheme(mode: UiPrefs['theme']): void {
    prefs.theme = mode;
  }

  function setBrand(color: string): void {
    prefs.brand = color || DEFAULT_BRAND;
  }

  function setCompact(value: boolean): void {
    prefs.compact = value;
  }

  function toggleCollapsed(): void {
    prefs.collapsed = !prefs.collapsed;
  }

  function reset(): void {
    Object.assign(prefs, DEFAULT_UI_PREFS);
  }

  /** 启动时调用（main.ts） */
  function load(): void {
    Object.assign(prefs, getUiPrefs());
    apply();
    media?.addEventListener?.('change', () => {
      if (prefs.theme === 'auto') apply();
    });
  }

  watch(prefs, () => {
    apply();
    persist();
  }, { deep: true });

  return {
    prefs,
    isDark,
    brand,
    themeMode,
    compact,
    collapsed,
    DEFAULT_BRAND,
    BRAND_PRESETS,
    load,
    apply,
    setTheme,
    setBrand,
    setCompact,
    toggleCollapsed,
    reset,
  };
});
