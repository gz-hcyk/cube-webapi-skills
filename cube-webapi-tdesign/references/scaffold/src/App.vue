<template>
  <t-config-provider :global-config="{ classPrefix: 't' }">
    <router-view />
  </t-config-provider>
</template>

<script setup lang="ts">
// 应用根：仅承载路由出口。登录门禁与外壳（侧栏/顶栏）由 router 与 BasicLayout 负责。
</script>
