<template>
  <!-- 递归渲染菜单：支持后端下发任意层级，不为"三级菜单"再写一套 -->
  <template v-for="node in nodes" :key="node.id">
    <el-sub-menu v-if="node.children && node.children.length" :index="indexOf(node)">
      <template #title>
        <el-icon><component :is="resolveIcon(node)" /></el-icon>
        <span class="cube-menu__text">{{ node.displayName }}</span>
      </template>
      <MenuItems :nodes="node.children" />
    </el-sub-menu>

    <el-menu-item v-else :index="indexOf(node)">
      <el-icon><component :is="resolveIcon(node)" /></el-icon>
      <template #title>
        <span class="cube-menu__text">{{ node.displayName }}</span>
      </template>
    </el-menu-item>
  </template>
</template>

<script setup lang="ts">
import { resolveIcon, type MenuNode } from '@/utils/menu';

/**
 * 菜单项（递归组件）
 * index 用 `menu-<id>` 而不是 url：后端 url 可能重复或带 /Index 后缀，
 * 用 id 保证 el-menu 的 index 全局唯一，选中态才不会串。
 */
defineProps<{ nodes: MenuNode[] }>();

function indexOf(node: MenuNode): string {
  return `menu-${node.id}`;
}
</script>

<style scoped>
.cube-menu__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
