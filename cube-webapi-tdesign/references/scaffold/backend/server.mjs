/**
 * 魔方 WebApi 内置模块 Mock 后端（零依赖，纯 Node http）
 * 端口：3001
 * 覆盖：登录 / 菜单树 / 实体 GetPage + CRUD + 分页 + 排序 + 搜索 + 树形 + 只读 + 外键 lookups
 *
 * 运行：node backend/server.mjs
 * 契约严格对齐 cube-webapi-tdesign/references/metadata-contract.md：
 *  - 统一信封 { code, message, data, page?, stat? }
 *  - 所有响应 CamelCase 命名
 *  - 实体接口 /api/{area}/{controller}；**非实体端点无 /api 前缀**：/Auth/Login、/Admin/Index/GetMenuTree、/Cube/Apis
 *  - 令牌头只认 Authorization: Bearer <jwt>（发 Authentication 或只带 Cookie 均 401）
 */
import http from 'node:http';
import { URL } from 'node:url';

const PORT = 3001;

/* ----------------------------- 工具 ----------------------------- */
function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(json);
}
function ok(res, data, extra = {}) {
  send(res, 200, { code: 0, message: 'ok', data, ...extra });
}
function fail(res, code, message) {
  send(res, 200, { code, message, data: null });
}
function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      if (!buf) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch {
        resolve({});
      }
    });
  });
}

/** 造一个形如 JWT 的三段式令牌（payload 带 name，供前端 token.ts 解析显示名） */
function mockJwt(name) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ name, unique_name: name, exp: Math.floor(Date.now() / 1000) + 7200 }),
    'mock-signature',
  ].join('.');
}

/* ----------------------------- 实体注册表 ----------------------------- */
// 每个字段：{ name(camel), displayName, type, length?, nullable?, primaryKey?, isIdentity?, sortable?, readOnly?, map? }
// list/addForm/editForm/detail/search 为字段 name 数组，决定该视图显示哪些字段
const REGISTRY = {
  Admin: {
    User: {
      setting: { enableAdd: true, isReadOnly: false, enableSelect: true, enableToolbar: true },
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        name: { name: 'name', displayName: '登录名', type: 'String', length: 50, nullable: false, sortable: true },
        displayName: { name: 'displayName', displayName: '显示名', type: 'String', length: 50, nullable: false },
        roleID: { name: 'roleID', displayName: '角色', type: 'Int32', nullable: false },
        departmentID: { name: 'departmentID', displayName: '部门', type: 'Int32', nullable: true },
        mail: { name: 'mail', displayName: '邮箱', type: 'String', length: 100, nullable: true },
        mobile: { name: 'mobile', displayName: '手机号', type: 'String', length: 20, nullable: true },
        // lovCode 以 `List.` 开头 ⇒ controlOf 判为 'lov-list' ⇒ 表单用 LovListField 弹窗。
        // roleLovID（单值）与 roleIds（多值，name 以 IDs 结尾 ⇒ multiple）覆盖两种模式。
        roleLovID: { name: 'roleLovID', displayName: '角色(单选)', type: 'Int32', nullable: true, lovCode: 'List.Admin.Role' },
        roleIds: { name: 'roleIds', displayName: '角色(多选)', type: 'String', length: 200, nullable: true, lovCode: 'List.Admin.Role' },
        enabled: { name: 'enabled', displayName: '启用', type: 'Boolean', nullable: false },
        createTime: { name: 'createTime', displayName: '创建时间', type: 'DateTime', nullable: true, readOnly: true },
      },
      list: ['name', 'displayName', 'roleID', 'departmentID', 'mail', 'enabled', 'createTime'],
      addForm: ['name', 'displayName', 'roleID', 'roleLovID', 'roleIds', 'departmentID', 'mail', 'mobile', 'enabled'],
      editForm: ['name', 'displayName', 'roleID', 'roleLovID', 'roleIds', 'departmentID', 'mail', 'mobile', 'enabled'],
      detail: ['id', 'name', 'displayName', 'roleID', 'roleLovID', 'roleIds', 'departmentID', 'mail', 'mobile', 'enabled', 'createTime'],
      search: ['name', 'roleID', 'departmentID', 'enabled'],
      rows: [
        { id: 1, name: 'admin', displayName: '超级管理员', roleID: 1, departmentID: 1, mail: 'admin@cube.local', mobile: '13800000000', enabled: true, createTime: '2026-01-01 09:00:00' },
        // roleLovID=3 / roleIds='1,2'：供**编辑态 id→名称回显**验证（审计员 / 管理员、普通用户）
        { id: 2, name: 'zhangsan', displayName: '张三', roleID: 2, roleLovID: 3, roleIds: '1,2', departmentID: 2, mail: 'zhang@cube.local', mobile: '13800000001', enabled: true, createTime: '2026-02-11 10:20:00' },
        { id: 3, name: 'lisi', displayName: '李四', roleID: 2, departmentID: 3, mail: 'li@cube.local', mobile: '13800000002', enabled: false, createTime: '2026-03-05 14:05:00' },
      ],
    },
    Role: {
      setting: { enableAdd: true, isReadOnly: false },
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        name: { name: 'name', displayName: '角色名', type: 'String', length: 50, nullable: false, sortable: true },
        remark: { name: 'remark', displayName: '备注', type: 'String', length: 200, nullable: true },
        sort: { name: 'sort', displayName: '排序', type: 'Int32', nullable: true },
        isSystem: { name: 'isSystem', displayName: '系统内置', type: 'Boolean', nullable: false },
        // kindID：取值来自枚举值集 Enum.Admin.RoleKind（供 LovListField 列翻译演示）
        kindID: { name: 'kindID', displayName: '来源', type: 'Int32', nullable: false, map: { '1': '内置', '2': '自定义' } },
      },
      list: ['name', 'remark', 'sort', 'isSystem'],
      addForm: ['name', 'remark', 'sort', 'isSystem'],
      editForm: ['name', 'remark', 'sort', 'isSystem'],
      detail: ['id', 'name', 'remark', 'sort', 'isSystem'],
      search: ['name'],
      // 24 行：默认 pageSize=20 → 2 页，供 LovListField 的分页 / 跨页已选统计验证
      rows: [
        { id: 1, name: '管理员', remark: '系统管理员组', sort: 0, isSystem: true, kindID: 1 },
        { id: 2, name: '普通用户', remark: '常规业务用户', sort: 1, isSystem: false, kindID: 2 },
        { id: 3, name: '审计员', remark: '只读审计权限', sort: 2, isSystem: false, kindID: 1 },
        { id: 4, name: '资产管理员', remark: '资产台账维护', sort: 3, isSystem: false, kindID: 2 },
        { id: 5, name: '仓库管理员', remark: '仓库出入库操作', sort: 4, isSystem: false, kindID: 2 },
        { id: 6, name: '采购员', remark: '采购申请与执行', sort: 5, isSystem: false, kindID: 2 },
        { id: 7, name: '验收员', remark: '到货验收登记', sort: 6, isSystem: false, kindID: 2 },
        { id: 8, name: '申领审核员', remark: '申领单审批', sort: 7, isSystem: false, kindID: 2 },
        { id: 9, name: '盘点员', remark: '盘点任务执行', sort: 8, isSystem: false, kindID: 2 },
        { id: 10, name: '财务核算员', remark: '金额与折旧核算', sort: 9, isSystem: false, kindID: 2 },
        { id: 11, name: '部门资产员', remark: '本部门资产查询', sort: 10, isSystem: false, kindID: 2 },
        { id: 12, name: '教师', remark: '教职工基础账号', sort: 11, isSystem: false, kindID: 2 },
        { id: 13, name: '班主任', remark: '班级领用登记', sort: 12, isSystem: false, kindID: 2 },
        { id: 14, name: '实验室管理员', remark: '实验器材管理', sort: 13, isSystem: false, kindID: 2 },
        { id: 15, name: '危险品管理员', remark: '危化品双人双锁', sort: 14, isSystem: false, kindID: 1 },
        { id: 16, name: '报废鉴定员', remark: '报损报废鉴定', sort: 15, isSystem: false, kindID: 2 },
        { id: 17, name: '调拨经办人', remark: '跨仓调拨经办', sort: 16, isSystem: false, kindID: 2 },
        { id: 18, name: '报表查看员', remark: '报表只读查看', sort: 17, isSystem: false, kindID: 2 },
        { id: 19, name: '数据导出员', remark: '台账导出', sort: 18, isSystem: false, kindID: 2 },
        { id: 20, name: '附件管理员', remark: '附件上传维护', sort: 19, isSystem: false, kindID: 2 },
        { id: 21, name: '移动端用户', remark: '移动端扫码作业', sort: 20, isSystem: false, kindID: 2 },
        { id: 22, name: '访客', remark: '只读演示账号', sort: 21, isSystem: false, kindID: 2 },
        { id: 23, name: '集成账号', remark: '第三方系统对接', sort: 22, isSystem: false, kindID: 1 },
        { id: 24, name: '只读备份', remark: '备份只读账号', sort: 23, isSystem: false, kindID: 1 },
      ],
    },
    Department: {
      setting: { enableAdd: true, isReadOnly: false },
      // 含 parentID → 列表自动树形（t-enhanced-table），表单 ParentID 自动树形下拉
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        name: { name: 'name', displayName: '部门名称', type: 'String', length: 50, nullable: false, sortable: true },
        parentID: { name: 'parentID', displayName: '上级部门', type: 'Int32', nullable: true },
        code: { name: 'code', displayName: '部门编码', type: 'String', length: 30, nullable: true },
        managerName: { name: 'managerName', displayName: '负责人', type: 'String', length: 30, nullable: true },
        sort: { name: 'sort', displayName: '排序', type: 'Int32', nullable: true },
        enabled: { name: 'enabled', displayName: '启用', type: 'Boolean', nullable: false },
      },
      list: ['name', 'parentID', 'code', 'managerName', 'sort', 'enabled'],
      addForm: ['name', 'parentID', 'code', 'managerName', 'sort', 'enabled'],
      editForm: ['name', 'parentID', 'code', 'managerName', 'sort', 'enabled'],
      detail: ['id', 'name', 'parentID', 'code', 'managerName', 'sort', 'enabled'],
      search: ['name', 'enabled'],
      rows: [
        { id: 1, name: '总公司', parentID: 0, code: 'HQ', managerName: '王总', sort: 0, enabled: true },
        { id: 2, name: '技术研发部', parentID: 1, code: 'RD', managerName: '张三', sort: 1, enabled: true },
        { id: 3, name: '物联网组', parentID: 2, code: 'IOT', managerName: '李四', sort: 2, enabled: true },
        { id: 4, name: '市场部', parentID: 1, code: 'MKT', managerName: '赵六', sort: 3, enabled: true },
      ],
    },
    Menu: {
      setting: { enableAdd: true, isReadOnly: false },
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        name: { name: 'name', displayName: '菜单名称', type: 'String', length: 50, nullable: false, sortable: true },
        parentID: { name: 'parentID', displayName: '上级菜单', type: 'Int32', nullable: true },
        url: { name: 'url', displayName: '链接', type: 'String', length: 100, nullable: true },
        icon: { name: 'icon', displayName: '图标', type: 'String', length: 30, nullable: true },
        permission: { name: 'permission', displayName: '权限', type: 'String', length: 50, nullable: true },
        sort: { name: 'sort', displayName: '排序', type: 'Int32', nullable: true },
        visible: { name: 'visible', displayName: '显示', type: 'Boolean', nullable: false },
      },
      list: ['name', 'parentID', 'url', 'icon', 'permission', 'sort', 'visible'],
      addForm: ['name', 'parentID', 'url', 'icon', 'permission', 'sort', 'visible'],
      editForm: ['name', 'parentID', 'url', 'icon', 'permission', 'sort', 'visible'],
      detail: ['id', 'name', 'parentID', 'url', 'icon', 'permission', 'sort', 'visible'],
      search: ['name', 'visible'],
      rows: [
        { id: 1, name: '系统管理', parentID: 0, url: '', icon: 'setting', permission: '', sort: 0, visible: true },
        { id: 2, name: '用户管理', parentID: 1, url: 'Admin/User', icon: 'user', permission: '', sort: 1, visible: true },
        { id: 3, name: '角色管理', parentID: 1, url: 'Admin/Role', icon: 'usergroup', permission: '', sort: 2, visible: true },
        { id: 4, name: '监控运维', parentID: 0, url: '', icon: 'chart', permission: '', sort: 5, visible: true },
        { id: 5, name: '系统日志', parentID: 4, url: 'Sys/Log', icon: 'logs', permission: '', sort: 6, visible: true },
      ],
    },
    Permission: {
      setting: { enableAdd: true, isReadOnly: false },
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        name: { name: 'name', displayName: '权限名', type: 'String', length: 50, nullable: false, sortable: true },
        resource: { name: 'resource', displayName: '资源', type: 'String', length: 50, nullable: true },
        action: { name: 'action', displayName: '动作', type: 'String', length: 30, nullable: true },
        roleID: { name: 'roleID', displayName: '角色', type: 'Int32', nullable: true },
        remark: { name: 'remark', displayName: '备注', type: 'String', length: 200, nullable: true },
      },
      list: ['name', 'resource', 'action', 'roleID', 'remark'],
      addForm: ['name', 'resource', 'action', 'roleID', 'remark'],
      editForm: ['name', 'resource', 'action', 'roleID', 'remark'],
      detail: ['id', 'name', 'resource', 'action', 'roleID', 'remark'],
      search: ['name', 'roleID'],
      rows: [
        { id: 1, name: '用户查看', resource: 'Admin/User', action: 'Detail', roleID: 2, remark: '查看用户' },
        { id: 2, name: '用户管理', resource: 'Admin/User', action: 'Update', roleID: 1, remark: '编辑用户' },
        { id: 3, name: '日志审计', resource: 'Sys/Log', action: 'Detail', roleID: 3, remark: '查看日志' },
      ],
    },
  },
  Sys: {
    Config: {
      // 系统参数：不开放新增（enableAdd:false），但可编辑/删除
      setting: { enableAdd: false, isReadOnly: false },
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        name: { name: 'name', displayName: '参数名', type: 'String', length: 50, nullable: false, sortable: true },
        value: { name: 'value', displayName: '参数值', type: 'String', length: 200, nullable: false },
        category: { name: 'category', displayName: '分类', type: 'String', length: 50, nullable: true },
        remark: { name: 'remark', displayName: '说明', type: 'String', length: 200, nullable: true },
        updateTime: { name: 'updateTime', displayName: '更新时间', type: 'DateTime', nullable: true, readOnly: true },
      },
      list: ['name', 'value', 'category', 'remark', 'updateTime'],
      addForm: ['name', 'value', 'category', 'remark'],
      editForm: ['name', 'value', 'category', 'remark'],
      detail: ['id', 'name', 'value', 'category', 'remark', 'updateTime'],
      search: ['name', 'category'],
      rows: [
        { id: 1, name: 'SysName', value: '魔方控制台', category: '基础', remark: '系统显示名称', updateTime: '2026-01-01 00:00:00' },
        { id: 2, name: 'EnableTenant', value: 'true', category: '租户', remark: '是否启用多租户', updateTime: '2026-02-01 00:00:00' },
        { id: 3, name: 'PageSize', value: '20', category: '基础', remark: '默认分页大小', updateTime: '2026-03-01 00:00:00' },
      ],
    },
    Log: {
      // 系统日志：只读（isReadOnly:true）→ 无新增/编辑/删除按钮
      setting: { enableAdd: false, isReadOnly: true },
      fields: {
        id: { name: 'id', displayName: '编号', type: 'Int32', primaryKey: true, isIdentity: true },
        level: { name: 'level', displayName: '级别', type: 'Int32', nullable: false, sortable: true, map: { 1: '信息', 2: '警告', 3: '错误', 4: '严重' } },
        category: { name: 'category', displayName: '分类', type: 'String', length: 50, nullable: true },
        message: { name: 'message', displayName: '消息', type: 'String', length: 500, nullable: true },
        userName: { name: 'userName', displayName: '操作人', type: 'String', length: 50, nullable: true },
        createTime: { name: 'createTime', displayName: '时间', type: 'DateTime', nullable: true, readOnly: true },
      },
      list: ['level', 'category', 'message', 'userName', 'createTime'],
      addForm: [],
      editForm: [],
      detail: ['id', 'level', 'category', 'message', 'userName', 'createTime'],
      search: ['level', 'category', 'userName'],
      rows: [
        { id: 1, level: 3, category: '登录', message: '用户 admin 登录失败次数过多', userName: 'admin', createTime: '2026-08-28 08:12:00' },
        { id: 2, level: 1, category: '系统', message: '服务启动完成', userName: 'system', createTime: '2026-08-28 08:00:00' },
        { id: 3, level: 2, category: '设备', message: '设备 DEV-001 离线超过 5 分钟', userName: 'system', createTime: '2026-08-28 09:30:00' },
        { id: 4, level: 4, category: '异常', message: '数据库写入超时', userName: 'system', createTime: '2026-08-28 10:05:00' },
      ],
    },
  },
};

/* ----------------------------- 菜单树（仅含当前用户有权限的节点） ----------------------------- */
const MENU_TREE = [
  {
    text: '系统管理',
    children: [
      { text: '用户管理', url: 'Admin/User' },
      { text: '角色管理', url: 'Admin/Role' },
      { text: '部门管理', url: 'Admin/Department' },
      { text: '菜单管理', url: 'Admin/Menu' },
      { text: '权限管理', url: 'Admin/Permission' },
    ],
  },
  {
    text: '监控运维',
    children: [
      { text: '系统参数', url: 'Sys/Config' },
      { text: '系统日志', url: 'Sys/Log' },
    ],
  },
];

/* ----------------------------- 鉴权 ----------------------------- */
/**
 * 令牌校验：**只认 `Authorization: Bearer <jwt>`**（与 SKILL.md §六 / 实测契约一致）。
 * ⚠️ 历史缺陷：本 Mock 曾只读 `authentication` 头 —— 而前端唯一 HTTP 层固定下发
 * `Authorization`，导致登录成功后所有受保护接口 401。此处两个头都接受，避免再踩。
 * （真实后端同样只认 `Authorization`；接受 `Authentication` 仅为兼容旧演示脚本。）
 */
function authOk(req) {
  const h = req.headers['authorization'] || req.headers['authentication'];
  return !!h && String(h).trim() !== '';
}

/* ----------------------------- 业务处理 ----------------------------- */
function handleGetPage(area, controller, res) {
  const ent = REGISTRY[area]?.[controller];
  if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);
  // ⚠️ 真实 Cube 字段描述符的类型键是 **typeName**（fieldRender 依此选控件）；
  //    mock 内部注册表用 `type` 简写 → 下发时补齐 typeName，否则 Boolean/DateTime
  //    控件全部退化成文本输入（实测「启用」渲染成 input "true"）。
  const pick = (names) => names.map((n) => { const f = { ...ent.fields[n] }; if (f.type && !f.typeName) f.typeName = f.type; return f });
  ok(res, {
    setting: ent.setting,
    list: pick(ent.list),
    addForm: pick(ent.addForm),
    editForm: pick(ent.editForm),
    detail: pick(ent.detail),
    search: pick(ent.search),
  });
}

function handleIndex(area, controller, url, res) {
  const ent = REGISTRY[area]?.[controller];
  if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);
  const q = Object.fromEntries(url.searchParams.entries());
  let rows = ent.rows.slice();
  // Q 关键词：跨所有字符串字段模糊匹配（与真实 Cube 一致；前端字符串搜索统一走 Q，
  // 见 fieldRender.buildSearchParams —— 字段参数在部分 Cube 变体上不生效）
  const kw = String(q.Q || q.q || '').trim();
  if (kw) {
    rows = rows.filter((r) =>
      Object.keys(r).some((k) => typeof r[k] === 'string' && r[k].includes(kw)),
    );
  }
  // 搜索过滤（camelCase 字段名）
  for (const f of ent.search) {
    const key = ent.fields[f.name] ? ent.fields[f.name].name : f.name;
    const v = q[key];
    if (v === undefined || v === '' || v == null) continue;
    rows = rows.filter((r) => {
      const rv = r[key];
      if (typeof rv === 'string') return rv.includes(v);
      return String(rv) === String(v);
    });
  }
  // 排序
  const sort = q.sort;
  if (sort && ent.fields[sort]) {
    const desc = q.desc === 'true' || q.desc === '1';
    rows.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
      return 0;
    });
  }
  const total = rows.length;
  const pageIndex = parseInt(q.pageIndex || '1', 10);
  const pageSize = parseInt(q.pageSize || '20', 10);
  const start = (pageIndex - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);
  ok(res, paged, {
    page: { pageIndex, pageSize, totalCount: total, pageCount: Math.ceil(total / pageSize) || 1 },
  });
}

function handleDetail(area, controller, id, res) {
  const ent = REGISTRY[area]?.[controller];
  if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);
  const row = ent.rows.find((r) => String(r.id) === String(id));
  if (!row) return fail(res, 404, '记录不存在');
  ok(res, row);
}

function handleInsert(area, controller, body, res) {
  const ent = REGISTRY[area]?.[controller];
  if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);
  const newId = ent.rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  // 前端提交 PascalCase（真实 Cube 契约），mock 行统一 camelCase → 归一化避免大小写双键
  const norm = {};
  for (const k of Object.keys(body)) {
    const ck = k.charAt(0).toLowerCase() + k.slice(1);
    if (ck.toLowerCase() === 'id') continue;
    norm[ck] = body[k];
  }
  const row = { ...norm, id: newId };
  if (ent.fields.createTime) row.createTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (ent.fields.updateTime) row.updateTime = row.createTime;
  ent.rows.push(row);
  ok(res, row);
}

function handleUpdate(area, controller, id, body, res) {
  const ent = REGISTRY[area]?.[controller];
  if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);
  const row = ent.rows.find((r) => String(r.id) === String(id));
  if (!row) return fail(res, 404, '记录不存在');
  // 前端按真实 Cube 契约提交 **PascalCase**（RoleLovID/RoleIds…），mock 行是 camelCase；
  // 归一化首字母小写再合并，避免同一字段出现大小写两份键（详情读回时消费端 camelize 会互相覆盖）。
  const patch = {};
  for (const k of Object.keys(body)) {
    const ck = k.charAt(0).toLowerCase() + k.slice(1);
    if (ck.toLowerCase() === 'id') continue;
    patch[ck] = body[k];
  }
  Object.assign(row, patch);
  if (ent.fields.updateTime) row.updateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  ok(res, row);
}

function handleDelete(area, controller, id, res) {
  const ent = REGISTRY[area]?.[controller];
  if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);
  const idx = ent.rows.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) return fail(res, 404, '记录不存在');
  ent.rows.splice(idx, 1);
  ok(res, null);
}

/* ----------------------------- 值集（LovController） ----------------------------- */
/**
 * LIST 型值集定义，模拟后端 `/api/Admin/Lov/Meta` 的下发形态。
 * ⚠️ 真实后端 `data` 下键为**小写驼峰**（`meta` / `inlineEnums`，System.Text.Json Web 策略产物），
 * 本 Mock 沿用 PascalCase（`Meta` / `InlineEnums`）——**http 层已无全局 camelize**，两种写法
 * 靠 useLov 的双向兜底（`r.data.meta ?? r.data.Meta`）都能吃下，故 Mock 不改数据 shape 也兼容。
 *
 * 两个 LIST 定义刻意覆盖 LovListField 的**两条取数通道**：
 *  · `List.Admin.Role`      RequestUrl 以 `/` 开头 → 前端**直连** getApi（不经代理）
 *  · `List.Admin.RoleProxy` 只给控制器名 + ProxyRequest:true → **服务端代理**
 *                           `POST /api/Admin/Lov/ListData`
 * 另附一个 ENUM 型值集，供 LovListField 的 `refLovCode` 列翻译（inlineEnums）演示。
 */
const LOV_TABLE_COLUMNS = [
  { Field: 'name', Title: '角色名', Sort: 1 },
  { Field: 'remark', Title: '备注', Sort: 2 },
  { Field: 'kindID', Title: '来源', Width: 100, Align: 'center', Sort: 3, RefLovCode: 'Enum.Admin.RoleKind' },
  { Field: 'sort', Title: '排序', Width: 90, Align: 'center', Sort: 4 },
];
const LOV_SEARCH_FIELDS = [{ Field: 'name', Title: '角色名', ComponentType: 'input', Sort: 1 }];

const LOV_DEFS = {
  'List.Admin.Role': {
    LovCode: 'List.Admin.Role',
    Type: 'LIST',
    Name: '角色（前端直连）',
    ValueField: 'ID',
    LabelField: 'Name',
    ListConfig: {
      RequestUrl: '/api/Admin/Role',
      Method: 'GET',
      Pageable: true,
      PageNumField: 'pageIndex',
      PageSizeField: 'pageSize',
      ProxyRequest: false,
    },
    SearchFields: LOV_SEARCH_FIELDS,
    TableColumns: LOV_TABLE_COLUMNS,
  },
  'List.Admin.RoleProxy': {
    LovCode: 'List.Admin.RoleProxy',
    Type: 'LIST',
    Name: '角色（服务端代理）',
    ValueField: 'ID',
    LabelField: 'Name',
    ListConfig: {
      RequestUrl: 'Admin/Role',
      Method: 'POST',
      Pageable: true,
      PageNumField: 'pageIndex',
      PageSizeField: 'pageSize',
      ProxyRequest: true,
    },
    SearchFields: LOV_SEARCH_FIELDS,
    TableColumns: LOV_TABLE_COLUMNS,
  },
};

/** ENUM 型值集（`Meta` 的 InlineEnums 下发，供 refLovCode 列翻译） */
const LOV_ENUMS = {
  'Enum.Admin.RoleKind': [
    { Value: 1, Label: '内置' },
    { Value: 2, Label: '自定义' },
  ],
};

/** GET /api/Admin/Lov/Meta?lovCode=A,B —— 逗号多 code 一次拉取；未指定则返回全部 */
function handleLovMeta(url, res) {
  const codes = String(url.searchParams.get('lovCode') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const want = codes.length ? codes : Object.keys(LOV_DEFS);
  const meta = want.map((c) => LOV_DEFS[c]).filter(Boolean);
  const inlineEnums = {};
  for (const c of want) if (LOV_ENUMS[c]) inlineEnums[c] = LOV_ENUMS[c];
  return ok(res, { Meta: meta, InlineEnums: inlineEnums });
}

/** 通用分页（`pageSize>=1000` 视为取全量，与真实后端一致） */
function pageOf(rows, params) {
  const pageIndex = Number(params.pageIndex) || 1;
  const pageSize = Number(params.pageSize) || 20;
  const totalCount = rows.length;
  const data =
    pageSize >= 1000
      ? rows
      : rows.slice((pageIndex - 1) * pageSize, (pageIndex - 1) * pageSize + pageSize);
  return { data, pageIndex, pageSize, totalCount };
}

/** POST /api/Admin/Lov/ListData —— 服务端代理取数（ProxyRequest=true 时由前端调用） */
function handleLovListData(body, res) {
  const def = LOV_DEFS[body.lovCode];
  if (!def) return fail(res, 404, `未注册值集 ${body.lovCode}`);
  let rows = (REGISTRY.Admin.Role?.rows || []).slice();
  const kw = String(body.Q || body.q || '').trim();
  if (kw) {
    rows = rows.filter((r) =>
      Object.keys(r).some((k) => typeof r[k] === 'string' && r[k].includes(kw)),
    );
  }
  const p = pageOf(rows, body);
  return ok(res, p.data, {
    page: { pageIndex: p.pageIndex, pageSize: p.pageSize, totalCount: p.totalCount },
  });
}

/* ----------------------------- 路由 ----------------------------- */
const server = http.createServer(async (req, res) => {
  // 预检
  if (req.method === 'OPTIONS') return send(res, 204, '');

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // 登录配置（开放）：前端 LoginView 读 title/copyright 动态组装登录页，拉不到会静默降级
  if (method === 'GET' && path === '/Auth/LoginConfig') {
    return ok(res, {
      title: '低值易耗品管理系统',
      name: '低值易耗品管理系统',
      copyright: '©2002-2026 NewLife Powered by .NET · Mock Backend',
      loginTip: '演示账号：任意账号 + 任意密码',
      logo: '',
      loginBackground: '',
    });
  }

  // 登录（开放）：契约 `POST /Auth/Login` body `{ username, password }`，
  // 令牌键名 **snake_case**（access_token / refresh_token / expire_in），
  // 与 token.ts 的 normToken 三向兜底一致。
  if (method === 'POST' && path === '/Auth/Login') {
    const body = await readBody(req);
    if (!body.username || !body.password) return fail(res, 400, '用户名或密码为空');
    return ok(res, {
      access_token: mockJwt(String(body.username)),
      refresh_token: 'mock-refresh-' + Date.now(),
      expire_in: 7200,
    });
  }

  // 登录（旧 MVC/SSO 端点，保留兼容旧脚本）
  if (method === 'POST' && path === '/Admin/User/Login') {
    const body = await readBody(req);
    if (body.userName && body.password) {
      return ok(res, { token: 'mock-jwt-' + Date.now(), user: { name: body.userName, isAdmin: true } });
    }
    return fail(res, 400, '用户名或密码错误');
  }

  // 菜单树（需登录）
  // ⚠️ 契约：前端唯一 HTTP 层走 `getRaw('/Admin/Index/GetMenuTree')`（**不带 /api 前缀**——
  //    该端点是 Area 内属性路由 [area]/[controller]/[action]，实测带 /api 会 404）。
  //    历史缺陷：Mock 只匹配带前缀路径 → 落到实体正则（area=Admin,ctrl=Index）→ 404 → 侧边栏恒空。
  //    此处两种写法都接受，便于对照排障；真实后端**只认不带前缀的那条**。
  if (method === 'GET' && (path === '/Admin/Index/GetMenuTree' || path === '/api/Admin/Index/GetMenuTree')) {
    if (!authOk(req)) return fail(res, 401, '未登录');
    return ok(res, MENU_TREE);
  }

  // 实体路由 /api/{area}/{controller}[/{id}][/GetPage]
  const m = path.match(/^\/api\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  if (m) {
    const area = m[1];
    const controller = m[2];
    const seg = m[3]; // 可能为 id 或 'GetPage'
    if (!authOk(req)) return fail(res, 401, '未登录');

    // 值集接口 /api/Admin/Lov/{Meta|ListData}（LovController，非实体控制器，无 GetPage）
    if (controller === 'Lov' && seg === 'Meta' && method === 'GET') return handleLovMeta(url, res);
    if (controller === 'Lov' && seg === 'ListData' && method === 'POST') {
      const body = await readBody(req);
      return handleLovListData(body, res);
    }

    // 元数据页
    if (seg === 'GetPage' && method === 'GET') return handleGetPage(area, controller, res);
    const ent = REGISTRY[area]?.[controller];
    if (!ent) return fail(res, 404, `未找到实体 ${area}/${controller}`);

    // 详情
    if (seg && method === 'GET') return handleDetail(area, controller, seg, res);
    if (seg && method === 'PUT') {
      const body = await readBody(req);
      return handleUpdate(area, controller, seg, body, res);
    }
    if (seg && method === 'DELETE') return handleDelete(area, controller, seg, res);

    // 列表
    if (!seg && method === 'GET') return handleIndex(area, controller, url, res);
    // 新增
    if (!seg && method === 'POST') {
      const body = await readBody(req);
      return handleInsert(area, controller, body, res);
    }
    // ★ 更新（真实 Cube 契约：`PUT /api/{area}/{controller}`，主键在 **body** 里，非路径段）
    //    历史缺陷：Mock 只接受 `PUT .../{id}` → 前端按真实契约 PUT 到控制器根 → 落到 405。
    if (!seg && method === 'PUT') {
      const body = await readBody(req);
      const id = body.id ?? body.ID;
      if (id == null) return fail(res, 400, '缺少主键 id');
      return handleUpdate(area, controller, id, body, res);
    }
    // ★ 删除（真实 Cube 契约：`DELETE /api/{area}/{controller}?id=xxx`，主键在 **query**）
    if (!seg && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return fail(res, 400, '缺少主键 id');
      return handleDelete(area, controller, id, res);
    }
    return fail(res, 405, '方法不允许');
  }

  // 健康检查
  if (path === '/') return ok(res, { service: 'cube-webapi-mock', port: PORT });
  return fail(res, 404, 'Not Found');
});

server.listen(PORT, () => {
  console.log(`[cube-mock] 魔方 WebApi Mock 后端已启动: http://localhost:${PORT}`);
  console.log('[cube-mock] 内置模块: Admin(User/Role/Department/Menu/Permission), Sys(Config/Log)');
});
