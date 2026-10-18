<template>
  <section class="cube-page">
    <!-- 页头：标题 + 说明 + 主操作。所有实体页共用这一个骨架 -->
    <header class="cube-page__head">
      <div class="cube-page__title">
        <h1>{{ pageTitle }}</h1>
        <p>{{ description || `共 ${resource.total.value} 条记录` }}</p>
      </div>
      <div class="cube-page__actions">
        <el-button :icon="Refresh" :loading="resource.loading.value" @click="reload">刷新</el-button>
        <el-button v-if="resource.canAdd.value && !resource.error.value" type="primary" :icon="Plus" @click="openCreate">新增</el-button>
      </div>
    </header>

    <!-- 搜索区：关键词 + 元数据生成的字段条件（超过 3 个折叠） -->
    <el-card class="cube-card cube-card--filter" shadow="never">
      <el-form :inline="true" class="cube-search" @submit.prevent="onSearch">
        <el-form-item label="关键词">
          <el-input
            v-model="keyword"
            :prefix-icon="Search"
            placeholder="搜索名称、编码或备注"
            clearable
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
        </el-form-item>

        <el-form-item v-for="it in visibleSearchItems" :key="it.prop" :label="it.label">
          <FieldControl v-model="searchModel[it.prop]" :item="it" />
        </el-form-item>

        <el-form-item class="cube-search__btns">
          <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
          <el-button v-if="searchItems.length > SEARCH_VISIBLE" link type="primary" @click="searchExpanded = !searchExpanded">
            {{ searchExpanded ? '收起' : `展开 ${searchItems.length - SEARCH_VISIBLE} 项` }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据区 -->
    <el-card class="cube-card" shadow="never">
      <div class="cube-toolbar">
        <div class="cube-toolbar__left">
          <span class="cube-toolbar__count">
            共 <b>{{ resource.total.value }}</b> 条
            <template v-if="resource.isTree.value">（树形结构，一次加载全部用于保持父子完整）</template>
          </span>
        </div>
        <div class="cube-toolbar__right">
          <el-tooltip content="导出当前筛选结果" placement="top">
            <el-button :icon="Download" text :loading="exporting" @click="onExport">导出</el-button>
          </el-tooltip>
        </div>
      </div>

      <el-alert
        v-if="resource.error.value"
        class="cube-table-alert"
        type="error"
        :title="resource.error.value"
        :closable="false"
        show-icon
      >
        <template #default>
          <el-button link type="primary" @click="reload">重新加载</el-button>
        </template>
      </el-alert>

      <el-table
        v-loading="resource.loading.value"
        class="cube-table"
        :data="tableData"
        :row-key="rowKey"
        :tree-props="treeProps"
        :default-expand-all="resource.isTree.value"
        :indent="16"
        border
        stripe
        highlight-current-row
        @sort-change="onSortChange"
        @row-dblclick="onRowDblclick"
      >
        <el-table-column
          v-for="col in columns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :align="col.align"
          :sortable="col.sortable ? 'custom' : false"
          :show-overflow-tooltip="col.control !== 'switch' && !isMulti(col.field)"
        >
          <template #default="{ row }">
            <el-tag
              v-if="col.control === 'switch'"
              :type="row[col.prop] ? 'success' : 'info'"
              effect="light"
              round
              size="small"
            >
              {{ row[col.prop] ? '是' : '否' }}
            </el-tag>

            <span v-else-if="isMulti(col.field)" class="cube-cell__tags">
              <el-tag
                v-for="(t, i) in multiLabels(col.field, row[col.prop], lookups)"
                :key="i"
                size="small"
                effect="plain"
                round
              >
                {{ t }}
              </el-tag>
              <span v-if="!multiLabels(col.field, row[col.prop], lookups).length" class="cube-cell--muted">—</span>
            </span>

            <a
              v-else-if="col.control === 'upload' && row[col.prop]"
              :href="serverUrl(row[col.prop])"
              target="_blank"
              rel="noopener"
              @click.stop
            >
              查看附件
            </a>

            <span v-else class="cube-cell" :class="{ 'cube-cell--muted': isEmpty(row[col.prop]) }">
              {{ display(col.field, row[col.prop]) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" :width="actionWidth" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
            <el-button v-if="resource.canEdit.value" link type="primary" @click.stop="openEdit(row)">编辑</el-button>
            <el-button v-if="resource.canDelete.value" link type="danger" @click.stop="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <div class="cube-empty">
            <el-empty :description="resource.error.value ? '加载失败，请重试' : emptyText" :image-size="88" />
            <el-button
              v-if="resource.canAdd.value && !resource.error.value"
              type="primary"
              :icon="Plus"
              @click="openCreate"
            >
              新增第一条
            </el-button>
          </div>
        </template>
      </el-table>

      <div v-if="!resource.isTree.value" class="cube-pager">
        <el-pagination
          :current-page="resource.pageIndex.value"
          :page-size="resource.pageSize.value"
          :total="resource.total.value"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="resource.changePage"
          @size-change="resource.changeSize"
        />
      </div>
    </el-card>

    <!-- 新增 / 编辑：由元数据生成表单，实体页不需要自己的表单代码 -->
    <FormDialog
      v-model="formVisible"
      :resource="resource"
      :mode="formMode"
      :row="editingRow"
      :title="formTitle"
      :upload-path="uploadPath"
      @saved="reload"
    />

    <!-- 详情：只读；父表详情可在此扩展子表区域 -->
    <DetailDrawer
      v-model="detailVisible"
      :resource="resource"
      :row="detailRow"
      :title="`${pageTitle}详情`"
      :lookups="lookups"
      :can-edit="resource.canEdit.value"
      @edit="onEditFromDetail"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download, Plus, Refresh, RefreshLeft, Search } from '@element-plus/icons-vue';
import FieldControl from './FieldControl.vue';
import FormDialog from './FormDialog.vue';
import DetailDrawer from './DetailDrawer.vue';
import { serverUrl } from '@/api/http';
import { useEntityResource } from '@/api/useEntityResource';
import {
  buildColumns,
  buildFormItems,
  isMultiValue,
  isUnsetValue,
  labelOf,
  multiLabels,
  toSearchParams,
  type DataField,
} from '@/api/fieldRender';

/**
 * 实体列表页基类（对应 MVC 的共享 List.cshtml）
 * 新实体页只需：
 *   <ListPage area="Admin" controller="User" title="用户管理" />
 * 列表列、表单、详情、树形、权限、分页全部由 GetPage 元数据推导。
 */
const props = withDefaults(
  defineProps<{
    area: string;
    controller: string;
    title?: string;
    description?: string;
    pageSize?: number;
    /** 虚拟映射字段 → 真实查询字段，如 { roleID: 'roleIds' } */
    searchParamMap?: Record<string, string>;
    /** 上传接口完整路径，默认 `${base}/UploadFile` */
    uploadPath?: string;
  }>(),
  { title: '', description: '', pageSize: 20, searchParamMap: () => ({}), uploadPath: '' },
);

const SEARCH_VISIBLE = 2;

const resource = useEntityResource({
  area: () => props.area,
  controller: () => props.controller,
  pageSize: props.pageSize,
});

const pageTitle = computed(() => props.title || props.controller);
const lookups = computed(() => resource.lookups.value);
const columns = computed(() => buildColumns(resource.listFields.value));
const searchItems = computed(() =>
  buildFormItems(resource.searchFields.value, {
    mode: 'search',
    onlyEditable: false,
    // 不传 lookups 时，搜索栏的 CategoryID 会渲成空下拉（表单有、搜索没有）
    lookups: resource.lookups.value,
  }),
);

const keyword = ref('');
const searchModel = reactive<Record<string, any>>({});
const searchExpanded = ref(false);
const visibleSearchItems = computed(() =>
  searchExpanded.value ? searchItems.value : searchItems.value.slice(0, SEARCH_VISIBLE),
);

const rowKey = 'id';
const treeProps = { children: 'children', hasChildren: 'hasChildren' };
const tableData = computed(() => (resource.isTree.value ? resource.treeRows.value : resource.rows.value));

const actionWidth = computed(() => {
  const n = 1 + (resource.canEdit.value ? 1 : 0) + (resource.canDelete.value ? 1 : 0);
  return n * 56 + 24;
});

const emptyText = computed(() => (keyword.value ? '没有匹配的记录，试试换个关键词' : '暂无数据，可先新增一条'));

/* ------------------------------ 搜索 ------------------------------ */

function onSearch() {
  const params = toSearchParams(resource.searchFields.value, searchModel, props.searchParamMap);
  if (keyword.value.trim()) params.Q = keyword.value.trim();
  resource.applySearch(params);
}

function onReset() {
  keyword.value = '';
  for (const key of Object.keys(searchModel)) delete searchModel[key];
  resource.resetSearch();
}

/* ------------------------------ 排序 / 翻页 ------------------------------ */

function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  resource.changeSort(prop, order);
}

function reload() {
  resource.refresh().catch((e: any) => ElMessage.error(e?.message || '加载失败'));
}

/* ------------------------------ 表单 / 详情 ------------------------------ */

const formVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingRow = ref<Record<string, any> | null>(null);

const formTitle = computed(() => `${formMode.value === 'create' ? '新增' : '编辑'}${pageTitle.value}`);

const uploadPath = computed(() => props.uploadPath || `${resource.base.value}/UploadFile`);

function openCreate() {
  formMode.value = 'create';
  editingRow.value = null;
  formVisible.value = true;
}

function openEdit(row: Record<string, any>) {
  formMode.value = 'edit';
  editingRow.value = { ...row };
  formVisible.value = true;
}

const detailVisible = ref(false);
const detailRow = ref<Record<string, any> | null>(null);

function openDetail(row: Record<string, any>) {
  if (resource.setting.value.enableSelect === false) return;
  detailRow.value = { ...row };
  detailVisible.value = true;
}

function onRowDblclick(row: Record<string, any>) {
  if (resource.setting.value.enableTableDoubleClick === false) return;
  openDetail(row);
}

function onEditFromDetail(row: Record<string, any>) {
  detailVisible.value = false;
  openEdit(row);
}

/* ------------------------------ 删除 / 导出 ------------------------------ */

async function onDelete(row: Record<string, any>) {
  try {
    await ElMessageBox.confirm(
      `确定删除这条记录吗？删除后不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return; // 用户取消
  }
  try {
    await resource.remove(row.id);
    ElMessage.success('已删除');
    reload();
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
}

const exporting = ref(false);
async function onExport() {
  exporting.value = true;
  try {
    const params = toSearchParams(resource.searchFields.value, searchModel, props.searchParamMap);
    if (keyword.value.trim()) params.Q = keyword.value.trim();
    await resource.exportFile('csv', params);
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}

/* ------------------------------ 展示辅助 ------------------------------ */

function isMulti(f: DataField) {
  return isMultiValue(f);
}

function isEmpty(v: unknown) {
  return isUnsetValue(v);
}

function display(f: DataField, v: unknown) {
  if (isEmpty(v)) return '—';
  return labelOf(f, v, lookups.value);
}

onMounted(() => resource.init());

defineExpose({ resource, reload, openCreate, openEdit });
</script>

<style scoped>
.cube-table-alert {
  margin-bottom: 12px;
}
</style>
