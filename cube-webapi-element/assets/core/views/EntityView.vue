<template>
  <ListPage
    v-if="area && controller"
    :key="`${area}/${controller}`"
    :area="area"
    :controller="controller"
    :title="title"
  />
  <el-result v-else icon="warning" title="路由参数缺失" sub-title="页面地址应为 /{area}/{controller}" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ListPage from '@/components/cube/ListPage.vue';
import { useAuthStore } from '@/stores/auth';
import { flattenLeaves, menuPath } from '@/utils/menu';

/**
 * 泛型实体页（模板继承的"最后一公里"）
 *
 * 路由 /:area/:controller 直接吃后端菜单 url，因此**新增实体不需要新增页面文件**。
 * 若某个实体需要专属布局，只写一个薄页面：
 *   <ListPage area="Lab" controller="LabAsset" title="资产管理" />
 * 然后给路由加一条静态规则即可，其余逻辑保持不变。
 */
const route = useRoute();
const auth = useAuthStore();

const area = computed(() => String(route.params.area ?? ''));
const controller = computed(() => String(route.params.controller ?? ''));

/** 标题优先用菜单里的中文名，其次退回控制器名（避免面包屑出现英文） */
const title = computed(() => {
  const path = `/${area.value}/${controller.value}`;
  const hit = flattenLeaves(auth.menus).find((n) => menuPath(n) === path);
  return hit?.displayName || controller.value;
});
</script>
