<script setup lang="ts">
/**
 * FileView —— 文件管理页（`NewLife.Cube.Areas.Admin.Controllers.FileController`）。
 *
 * 归属：Area 控制器 ⇒ **必须带 `/api`**（`/api/Admin/File/...`，见 api/http.ts 铁律 H2）。
 * FileController **不是实体控制器**（无 GetPage）⇒ 单列专用页，不能进 ListPage。
 *
 * 端点（动作签名取自 NewLife.Cube 6.15.2026.901 官方 XML 文档）：
 *   GET  /api/Admin/File?path=&searchPattern=&order=   目录列表（Index）
 *   POST /api/Admin/File/Upload        (path, file)      上传（multipart）
 *   GET  /api/Admin/File/Download?path=                  下载（文件流）
 *   POST /api/Admin/File/Delete?path=                    删除
 *   POST /api/Admin/File/Compress?path=                  压缩
 *   POST /api/Admin/File/Decompress?path=                解压缩
 *
 * ⚠️ 契约边界：官方文档只给**动作签名**、不给**响应结构**。故列表行做**自适应**渲染
 *    （目录/文件的判定兼容 type / isDir / directory / 名称后缀 多种形态），
 *    未知结构由 `DataProbe` 摊开确认，不靠猜字段名导致静默空白。
 *
 * 上传为何不用 t-upload：其内置 XHR 不带 `Authorization: Bearer`（铁律 H2 的唯一鉴权头），
 *   会 401。故走本工程唯一 HTTP 层（axios 实例）手工 FormData 上传。
 *
 * 模块化（对标 MVC 分部视图）：工具栏 / 面包屑 / 列表 / 探针各自成块，可按需替换。
 */
import { computed, onMounted, ref } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { getApi, postApi } from '@/api/http';
import http from '@/api/http';
import { normalizeRows } from '@/api/useEntityResource';
import DataProbe from './DataProbe.vue';

const props = withDefaults(
  defineProps<{ area?: string; controller?: string; title?: string }>(),
  { area: 'Admin', controller: 'File', title: '' },
);

const area = computed(() => props.area);
const controller = computed(() => props.controller);
const title = computed(() => props.title || '文件管理');
const base = computed(() => `/${area.value}/${controller.value}`);

const loading = ref(false);
const uploading = ref(false);
const path = ref('');
const rawRows = ref<any[]>([]);
const rawPayload = ref<any>(null);

/* ----------------------------- 工具 ----------------------------- */
function joinPath(dir: string, name: string): string {
  const n = name.replace(/\/+$/, '');
  if (!dir) return n;
  return `${dir.replace(/\/+$/, '')}/${n}`;
}
function parentPath(p: string): string {
  const s = p.replace(/\/+$/, '');
  const i = s.lastIndexOf('/');
  return i <= 0 ? '' : s.slice(0, i);
}
/** 目录判定：兼容多种后端形态，最后按名称特征兜底 */
function isDir(r: any): boolean {
  if (r?.type === 1 || r?.type === 'directory' || r?.type === 'folder') return true;
  if (r?.isDir === true || r?.directory === true || r?.IsDirectory === true) return true;
  if (typeof r?.type === 'string' && /dir|folder/i.test(r.type)) return true;
  const name = String(r?.name ?? r?.Name ?? '');
  return name.endsWith('/');
}
function entryName(r: any): string {
  return String(r?.name ?? r?.Name ?? '').replace(/\/+$/, '');
}
function entrySize(r: any): number | null {
  const v = r?.size ?? r?.Size ?? r?.length ?? r?.Length;
  return typeof v === 'number' ? v : null;
}
function humanSize(n: number | null): string {
  if (n === null) return '-';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
function entryTime(r: any): string {
  return String(r?.lastWrite ?? r?.LastWrite ?? r?.lastWriteTime ?? r?.LastWriteTime ?? r?.time ?? '-');
}

/** 面包屑（每段可点回上一级） */
const crumbs = computed(() => {
  const parts = path.value.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const out: { label: string; path: string }[] = [{ label: '根目录', path: '' }];
  let acc = '';
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p;
    out.push({ label: p, path: acc });
  }
  return out;
});

/* ----------------------------- 加载 ----------------------------- */
const rows = computed(() => normalizeRows(rawRows.value).map((r: any) => ({ ...r, __name: entryName(r), __isDir: isDir(r) })));

const columns = [
  { colKey: '__name', title: '名称', ellipsis: true, minWidth: 260 },
  { colKey: '__size', title: '大小', width: 120 },
  { colKey: '__time', title: '修改时间', width: 190 },
  { colKey: 'operation', title: '操作', width: 200, fixed: 'right' as const },
];

function sizeOf(row: any): string {
  return row.__isDir ? '-' : humanSize(entrySize(row));
}

async function load() {
  loading.value = true;
  try {
    const env: any = await getApi<any>(base.value, { path: path.value });
    const payload = env && typeof env === 'object' && 'code' in env ? env.data : env;
    rawPayload.value = payload;
    // 兼容：裸数组 / { rows } / { page.rows } / { list } / { items }
    let arr: any[] = [];
    if (Array.isArray(payload)) arr = payload;
    else if (Array.isArray(payload?.rows)) arr = payload.rows;
    else if (Array.isArray(payload?.page?.rows)) arr = payload.page.rows;
    else if (Array.isArray(payload?.list)) arr = payload.list;
    else if (Array.isArray(payload?.items)) arr = payload.items;
    rawRows.value = arr;
  } catch (e: any) {
    MessagePlugin.error(e?.message || '加载目录失败');
    rawRows.value = [];
  } finally {
    loading.value = false;
  }
}

function openDir(row: any) {
  path.value = joinPath(path.value, row.__name);
  load();
}
function goPath(p: string) {
  path.value = p;
  load();
}

/* ----------------------------- 上传 ----------------------------- */
const fileInput = ref<HTMLInputElement | null>(null);
function pickFile() {
  fileInput.value?.click();
}
async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('path', path.value);
    fd.append('file', file);
    // 经唯一 HTTP 层上传（自动带 Bearer 令牌），axios 自行设置 multipart 边界
    await http.post(`${base.value}/Upload`, fd);
    MessagePlugin.success('上传成功');
    await load();
  } catch {
    MessagePlugin.error('上传失败');
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

/* ----------------------------- 行操作 ----------------------------- */
async function download(row: any) {
  const full = joinPath(path.value, row.__name);
  try {
    const r = await http.get(`${base.value}/Download`, { params: { path: full }, responseType: 'blob' });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.__name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e: any) {
    MessagePlugin.error(e?.message || '下载失败');
  }
}

function remove(row: any) {
  const full = joinPath(path.value, row.__name);
  const dlg = DialogPlugin.confirm({
    header: '删除确认',
    body: `确定删除「${row.__name}」？该操作不可撤销。`,
    theme: 'danger',
    onConfirm: async () => {
      dlg.hide();
      try {
        // 无请求体的动作型端点：query 传 path（axios.post 第三参才是 config）
        await http.post(`${base.value}/Delete`, null, { params: { path: full } });
        MessagePlugin.success('已删除');
        await load();
      } catch (e: any) {
        MessagePlugin.error(e?.message || '删除失败');
      }
    },
  });
}

async function compress(row: any, decompress = false) {
  const full = joinPath(path.value, row.__name);
  try {
    await http.post(`${base.value}/${decompress ? 'Decompress' : 'Compress'}`, null, { params: { path: full } });
    MessagePlugin.success(decompress ? '已解压' : '已压缩');
    await load();
  } catch (e: any) {
    MessagePlugin.error(e?.message || (decompress ? '解压失败' : '压缩失败'));
  }
}

onMounted(load);
</script>

<template>
  <div class="file-view">
    <t-card :title="title" :bordered="false">
      <template #actions>
        <t-space>
          <t-button theme="primary" :loading="uploading" @click="pickFile">
            <template #icon><t-icon name="upload" /></template>上传
          </t-button>
          <t-button variant="outline" :loading="loading" @click="load">刷新</t-button>
        </t-space>
      </template>

      <!-- 面包屑（对标 MVC 分部视图：路径导航独立成块） -->
      <div class="crumb">
        <template v-for="(c, i) in crumbs" :key="c.path">
          <t-link theme="primary" @click="goPath(c.path)">{{ c.label }}</t-link>
          <span v-if="i < crumbs.length - 1" class="sep">/</span>
        </template>
        <t-tag v-if="path" size="small" variant="light" class="cur">{{ path }}</t-tag>
      </div>

      <t-table
        row-key="__name"
        table-layout="auto"
        :data="rows"
        :columns="columns"
        :loading="loading"
        stripe
        max-height="560"
      >
        <template #__name="{ row }">
          <span class="fn">
            <t-icon :name="row.__isDir ? 'folder' : 'file'" class="fn-icon" :class="{ dir: row.__isDir }" />
            <t-link v-if="row.__isDir" theme="primary" @click="openDir(row)">{{ row.__name }}</t-link>
            <span v-else>{{ row.__name }}</span>
          </span>
        </template>
        <template #__size="{ row }">{{ sizeOf(row) }}</template>
        <template #__time="{ row }">{{ entryTime(row) }}</template>
        <template #operation="{ row }">
          <t-space size="small">
            <t-link v-if="!row.__isDir" theme="primary" @click="download(row)">下载</t-link>
            <t-link theme="default" @click="compress(row, false)">压缩</t-link>
            <t-link v-if="!row.__isDir" theme="default" @click="compress(row, true)">解压</t-link>
            <t-link theme="danger" @click="remove(row)">删除</t-link>
          </t-space>
        </template>
      </t-table>

      <template #footer>
        <div class="tip">文件根目录由后端 `CubeSetting.UploadPath` 决定；本页所有路径均为相对该目录的路径。</div>
      </template>

      <!-- 隐藏的文件选择器：走唯一 HTTP 层上传，避免 t-upload 缺鉴权头导致 401 -->
      <input ref="fileInput" type="file" class="hidden-input" @change="onFilePicked" />

      <DataProbe :data="rawPayload ?? rawRows" label="目录列表响应结构" />
    </t-card>
  </div>
</template>

<style scoped>
.crumb { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
.crumb .sep { color: var(--td-text-color-placeholder); }
.crumb .cur { margin-left: 8px; }
.fn { display: inline-flex; align-items: center; gap: 6px; }
.fn-icon { color: var(--td-text-color-placeholder); }
.fn-icon.dir { color: var(--td-warning-color); }
.tip { font-size: 12px; color: var(--td-text-color-secondary); }
.hidden-input { display: none; }
</style>
