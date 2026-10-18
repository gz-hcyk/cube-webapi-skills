/**
 * 颜色工具（落位：src/utils/color.ts）
 * 只做一件事：把一个品牌色抖出 Element Plus 需要的那套色阶，
 * 使"改一个主色 = 全站协调"成立（否则只有按钮变色，hover/选中底色还是旧的蓝）。
 */

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeHex(input: string): string {
  let hex = String(input || '').trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#2563eb';
  return '#' + hex.toLowerCase();
}

function toRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  const p = (v: number) => clamp(Math.round(v)).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}

/** 与目标色混合：weight=0 返回 color，weight=1 返回 target */
export function mix(color: string, target: string, weight: number): string {
  const [r1, g1, b1] = toRgb(color);
  const [r2, g2, b2] = toRgb(target);
  return toHex(r1 + (r2 - r1) * weight, g1 + (g2 - g1) * weight, b1 + (b2 - b1) * weight);
}

/** 压暗（weight=0.2 → 暗 20%） */
export function shade(color: string, weight = 0.2): string {
  return mix(color, '#000000', weight);
}

/** 提亮 */
export function tint(color: string, weight = 0.2): string {
  return mix(color, '#ffffff', weight);
}

/**
 * 生成 Element Plus 主色阶。
 * light-3/5/7/8/9 依次向白色插值，dark-2 压暗 20%——与官方 CSS 变量的语义一致。
 */
export function elementPrimaryPalette(base: string): Record<string, string> {
  const c = normalizeHex(base);
  return {
    '--el-color-primary': c,
    '--el-color-primary-light-3': tint(c, 0.3),
    '--el-color-primary-light-5': tint(c, 0.5),
    '--el-color-primary-light-7': tint(c, 0.7),
    '--el-color-primary-light-8': tint(c, 0.8),
    '--el-color-primary-light-9': tint(c, 0.9),
    '--el-color-primary-dark-2': shade(c, 0.2),
  };
}

/** 默认政务蓝在深色底上的色阶，与 theme-dark.css 保持同一组数字。 */
const DARK_BRAND_PALETTE: Record<string, string> = {
  '--el-color-primary': '#4d84f5',
  '--el-color-primary-light-3': '#3a6ad4',
  '--el-color-primary-light-5': '#2c53a8',
  '--el-color-primary-light-7': '#203d7c',
  '--el-color-primary-light-8': '#1a315f',
  '--el-color-primary-light-9': '#15264a',
  '--el-color-primary-dark-2': '#6f9cff',
};

/**
 * 暗色色阶。浅色 light-9 是近白，写进 html inline 会盖掉 theme-dark.css，
 * 选中菜单和当前行会变成一块浅色。深色下 light-* 改为向页面底混合。
 */
export function elementPrimaryPaletteDark(base: string): Record<string, string> {
  const c = normalizeHex(base);
  if (c === '#2563eb') return { ...DARK_BRAND_PALETTE };
  const primary = tint(c, 0.18);
  const surface = '#0f1115';
  return {
    '--el-color-primary': primary,
    '--el-color-primary-light-3': mix(primary, surface, 0.4),
    '--el-color-primary-light-5': mix(primary, surface, 0.55),
    '--el-color-primary-light-7': mix(primary, surface, 0.7),
    '--el-color-primary-light-8': mix(primary, surface, 0.78),
    '--el-color-primary-light-9': mix(primary, surface, 0.86),
    '--el-color-primary-dark-2': tint(c, 0.35),
  };
}

/** 计算相对亮度，用于自动决定覆盖在品牌色上的文字用白还是黑（WCAG 对比度） */
export function isLightColor(color: string): boolean {
  const [r, g, b] = toRgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5;
}
