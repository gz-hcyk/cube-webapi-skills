<script setup lang="ts">
import ListPage from '@/components/cube/ListPage.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SPECIAL_CONTROLLERS } from '@/specialControllers'

/**
 * 泛型实体页：由路由 `/entity/:area/:controller` 驱动（菜单 url 归一化后指向此路由）。
 *
 * 分发依据 = `src/specialControllers.ts` 的**显式注册表**（技能 §4.17 / §4.18）：
 *   - 命中注册表 → 专用页（ConfigController<T> → ConfigView；ControllerBaseX → DbView 等）；
 *   - 未命中 → 标准 ListPage（`GetPage` 元数据驱动，零业务页代码）。
 *
 * ⚠️【命名不可靠】：MailConfig / OAuthConfig / Parameter 等带 Config 名的其实是实体控制器
 *   （有 GetPage，应走 ListPage），而真正的 ConfigController<T> 反而叫 Cube / Sys / XCode / Core。
 *   故注册表必须显式策划，禁止用命名启发式自动判定。
 */
const props = defineProps<{
  area: string
  controller: string
  title?: string
  readOnly?: boolean
}>()

const route = useRoute()

// 宿主页面/路由可透传：固定查询参数 extra、搜索参数名映射 searchParamMap
const extra = computed<Record<string, any> | undefined>(() => (route.query.extra as any) || undefined)
const readOnly = computed(() => props.readOnly === true || route.query.readOnly === '1')

const specialKey = computed(() => `${props.area}/${props.controller}`)
const special = computed(() => SPECIAL_CONTROLLERS[specialKey.value])
</script>

<template>
  <component
    :is="special?.view || ListPage"
    :area="area"
    :controller="controller"
    :title="title"
    :read-only="readOnly"
    :extra="extra"
    :fields-kind="special?.fieldsKind"
  />
</template>
