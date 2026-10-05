<template>
  <div class="entity-page">
    <ConfigView
      v-if="special && special.kind === 'config'"
      :area="area"
      :controller="controller"
      :title="title"
      :fields-kind="special.fieldsKind"
      :load-url="special.loadUrl"
      :save-url="special.saveUrl"
      :save-method="special.saveMethod"
    />
    <DbView
      v-else-if="special && special.kind === 'db'"
      :area="area"
      :controller="controller"
      :title="title"
    />
    <Component
      v-else-if="special"
      :is="special.view"
      :area="area"
      :controller="controller"
      :title="title"
    />
    <ListPage
      v-else
      :area="area"
      :controller="controller"
      :title="title"
      :search-param-map="searchParamMap"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ListPage from '@/components/cube/ListPage.vue';
import ConfigView from '@/components/cube/ConfigView.vue';
import DbView from '@/components/cube/DbView.vue';
import { SPECIAL_CONTROLLERS, type SpecialDescriptor } from '@/specialControllers';

/**
 * 泛型实体页：既可由显式薄页面通过 props 传入 area/controller（见 src/pages/admin/*），
 * 也可由泛型路由 /:area/:controller 通过路由参数驱动。新实体只需复制 5 行即可落地。
 * searchParamMap：透传给 ListPage（后端虚拟映射字段 → 真实查询字段，如 User.RoleID → roleIds）。
 *
 * 单列处理（非实体控制器）：命中「区域作用域注册表」SPECIAL_CONTROLLERS 的控制器渲染专属组件，
 * 不进 ListPage。两类典型：
 *  - ConfigController<T>（系统配置类，【无 GetPage】但有 GetFields，单对象 + Update）→ ConfigView；
 *  - ControllerBaseX 派生但非实体的控制器（【无 GetPage】，自定义端点，如 Db）→ 各自专属页。
 * 注册表以 `area/controller` 为键（防跨区重名碰撞），且【必须显式策划】——命名不可靠
 * （`*Config`/`Parameter` 多为实体，真正 Config 反而不带 Config 名）。新增特殊控制器只在
 * src/specialControllers.ts 追加一条映射即可，无需新增路由、无需改动本文件。
 */
const props = defineProps<{
  area?: string;
  controller?: string;
  title?: string;
  searchParamMap?: Record<string, string>;
}>();
const route = useRoute();

const area = computed(() => props.area ?? (route.params.area as string));
const controller = computed(() => props.controller ?? (route.params.controller as string));
const title = computed(() => props.title ?? `${area.value} / ${controller.value}`);
// 命中单列处理注册表 → 渲染其专属组件；否则走标准 ListPage
const special = computed<SpecialDescriptor | null>(
  () => SPECIAL_CONTROLLERS[`${area.value}/${controller.value}`] ?? null,
);
</script>
