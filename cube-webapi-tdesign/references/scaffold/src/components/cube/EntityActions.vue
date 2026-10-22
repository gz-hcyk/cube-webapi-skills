<script setup lang="ts">
/**
 * EntityActions —— 实体列表的「额外行操作」渲染器（**对齐 MVC 版行内按钮**）。
 *
 * 数据来自 `src/entityActions.ts` 的声明式配置，按 `area/controller` 命中即渲染；
 * 未配置的实体零渲染、零请求。新增动作只改配置表，不动本组件。
 *
 * 行为纪律：
 *  - 破坏性动作必须有 `confirm`（配置表里强制），确认框文案支持 `{name}` 占位；
 *  - 请求走 `http` 实例（baseURL 已含 `/api`），**参数默认走 query**——魔方的动作端点
 *    形如 `POST /api/Admin/User/RevokeTokens?id=1`，不是 RESTful 路径参数；
 *  - 失败一律 `MessagePlugin.error` 显式提示，**不静默吞错**（静默失败是最难排的一类）；
 *  - 成功后调用宿主的 `reload`（ListPage 传 `reloadAfterMutation`，树形表走 loadAll）。
 *
 * 客户端动作（`client`）不发请求，由本组件打开内置面板（目前只有 `lov-config`）。
 */
import { computed, ref } from 'vue';
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
import http from '../../api/http';
import { actionsOf, type EntityAction, type Row } from '../../entityActions';
import LovConfigDrawer from './LovConfigDrawer.vue';

const props = defineProps<{
  area: string;
  controller: string;
  row: Row;
  /** GetPage.setting（用于 hideWhen 收敛） */
  setting?: Record<string, any>;
  /** 动作成功后的重载回调（由 ListPage 提供） */
  reload?: () => void;
}>();

/** 行显示名（与配置表 confirm 的 {name} 同口径） */
function rowName(row: Row): string {
  const r = row as Record<string, any>;
  return String(r?.name ?? r?.Name ?? r?.title ?? r?.Title ?? r?.id ?? r?.ID ?? '');
}

/** 命中配置 + 通过行级/设置级显隐过滤 */
const list = computed<EntityAction[]>(() =>
  actionsOf(props.area, props.controller).filter((a) => {
    if (a.hideWhen && a.hideWhen(props.setting ?? {})) return false;
    if (a.visible && !a.visible(props.row)) return false;
    return true;
  }),
);

/** 正在执行的动作 key（按钮 loading，防重复点击） */
const pendingKey = ref('');

/** 值集配置抽屉 */
const lovOpen = ref(false);
const lovId = ref<string | number>('');
const lovTitle = ref('');

function confirmText(a: EntityAction): string {
  return String(a.confirm ?? '').replace(/\{name\}/g, rowName(props.row) || '当前记录');
}

/**
 * 执行请求型动作。
 * ⚠️ 参数走 query：魔方动作端点的签名是 `Action(Int32 id)` / `Action(String name)`，
 *    ASP.NET Core 默认从 query 绑定；放 body 会绑不到 → 后端按 id=0 处理（静默做错事）。
 */
async function exec(a: EntityAction): Promise<void> {
  if (!a.url) return;
  pendingKey.value = a.key;
  try {
    const params = a.params ? a.params(props.row) : { id: (props.row as any).id ?? (props.row as any).ID };
    const body = typeof a.body === 'function' ? (a.body as (row: Row) => unknown)(props.row) : (a.body ?? null);
    const resp =
      a.method === 'GET'
        ? await http.get(a.url, { params })
        : await http.post(a.url, body, { params });
    const env = resp?.data as { code?: number; message?: string } | undefined;
    if (env && typeof env.code === 'number' && env.code !== 0) {
      MessagePlugin.error(env.message || '操作失败');
      return;
    }
    MessagePlugin.success(a.success || '操作成功');
    props.reload?.();
  } catch (e: any) {
    // 网络层/业务层错误都要落地成用户可见提示（不静默）
    MessagePlugin.error(e?.message || '操作失败，请稍后重试');
  } finally {
    pendingKey.value = '';
  }
}

function run(a: EntityAction): void {
  // 客户端动作：打开内置面板，不发请求
  if (a.client === 'lov-config') {
    lovId.value = (props.row as any).id ?? (props.row as any).ID ?? '';
    lovTitle.value = rowName(props.row);
    lovOpen.value = true;
    return;
  }
  if (!a.confirm) {
    exec(a);
    return;
  }
  const dlg = DialogPlugin.confirm({
    header: a.text,
    body: confirmText(a),
    theme: a.theme === 'danger' ? 'danger' : 'warning',
    confirmBtn: { content: '确定', theme: a.theme === 'danger' ? 'danger' : 'primary' },
    onConfirm: async () => {
      dlg.hide();
      await exec(a);
    },
  });
}
</script>

<template>
  <template v-for="a in list" :key="a.key">
    <t-link
      :theme="a.theme || 'default'"
      :disabled="pendingKey === a.key"
      class="entity-action"
      @click="run(a)"
    >
      {{ a.text }}
    </t-link>
  </template>

  <!-- 值集配置（客户端动作）：不透传 visible 给抽屉，由抽屉自身控制 -->
  <LovConfigDrawer
    v-if="lovOpen"
    :visible="lovOpen"
    :lov-id="lovId"
    :lov-name="lovTitle"
    @close="lovOpen = false"
    @saved="reload?.()"
  />
</template>

<style scoped>
.entity-action { white-space: nowrap; }
</style>
