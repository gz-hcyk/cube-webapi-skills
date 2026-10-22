<script setup lang="ts">
/**
 * AccountView —— 个人资料 / 安全中心（**页面组织照 MVC 版 `User/Info.cshtml`**）。
 *
 * 版式基线见 references/mvc-page-organization.md：
 *   页内导航（_User_Nav）→ 个人信息头卡 → 若干分区卡片（基础信息 / 联系方式 / 身份信息 /
 *   登录信息）→ 居中操作栏 → 危险区（安全中心：注销账号）。
 *   分区标题栏、间距、只读字段的呈现方式全部对齐 MVC；颜色一律走设计令牌。
 *
 * 承载的 4 个子功能（与 MVC 的 4 个平级动作页一一对应，此处用页内导航切换）：
 *   基础信息（Info）/ 修改密码（ChangePassword）/ 第三方授权（Binds）/ 租户信息（TenantSetting）
 *
 * 端点（`http` 已含 /api；根族用 `rawHttp`，见 api/http.ts 文件头的前缀判据）：
 *   - `GET  /Admin/User/Info`        / `POST /Admin/User/Info`（整对象回存）
 *   - `POST /Admin/User/UploadFile`  （form-data，字段名 file；返回 data.url 或 data 字符串）
 *   - `POST /Admin/User/ChangePassword`（challengeRequired 时带 challengeId + 密文）
 *   - `GET  /Mfa/Status` / `GET /Mfa/Setup` / `POST /Mfa/Activate` / `POST /Mfa/Disable`（根族）
 *   - `GET  /Admin/UserConnect?userId=`（第三方授权列表）/ `POST /Admin/UserConnect/Delete?id=`
 *   - `POST /Admin/User/CloseAccount`（注销账号）
 *
 * 契约未实测处一律用 DataProbe 摊开原始返回，不猜字段。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http, { API_BASE, getApi, getRaw, postApi, postRaw, serverUrl } from '@/api/http';
import { getTenant, getTenantCode } from '@/api/token';
import { encryptPassword } from '@/api/crypto';
import { useAuthStore } from '@/stores/auth';
import PageNav from '@/components/cube/PageNav.vue';
import PageSection from '@/components/cube/PageSection.vue';
import ProfileHeader from '@/components/cube/ProfileHeader.vue';
import DataProbe from '@/components/cube/DataProbe.vue';
import TenantSwitcher from '@/components/cube/TenantSwitcher.vue';
import { userCenterNav } from '@/pageNav';

const auth = useAuthStore();

/** 当前页内分区 */
const tab = ref<'basic' | 'password' | 'binds' | 'tenant'>('basic');

/* ----------------------------- 用户资料 ----------------------------- */
const loading = ref(false);
const saving = ref(false);
const error = ref('');
/** 原始返回（DataProbe 用） */
const rawInfo = ref<any>(null);
/** 表单（只放可编辑字段，避免把服务端字段乱回传） */
const form = reactive<Record<string, any>>({
  id: '',
  name: '',
  displayName: '',
  sex: 0,
  birthday: '',
  mail: '',
  mobile: '',
  code: '',
  avatar: '',
  remark: '',
  logins: 0,
  lastLogin: '',
  lastLoginIP: '',
  enable: true,
  roleNames: [] as string[],
  departmentName: '',
  ssoName: '',
});
/** 完整原始对象：保存时与表单合并回传，避免丢掉未展示字段 */
let originalUser: Record<string, any> = {};

/** 大小写宽容取值 */
function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const real = lower.get(k.toLowerCase());
    if (real && obj[real] !== undefined && obj[real] !== null) return obj[real];
  }
  return undefined;
}

/** 角色名列表（后端可能给 roles / Roles / roleNames / RoleNames） */
function readRoles(d: any): string[] {
  const arr = pick(d, 'roles', 'Roles', 'roleNames', 'RoleNames');
  if (Array.isArray(arr)) {
    return arr
      .map((r: any) => (typeof r === 'string' ? r : String(pick(r, 'name', 'Name', 'displayName', 'DisplayName') ?? '')))
      .filter(Boolean);
  }
  // 单角色字段兜底
  const one = pick(d, 'roleName', 'RoleName', 'role', 'Role');
  return one ? [String(typeof one === 'string' ? one : (pick(one, 'name', 'Name') ?? ''))].filter(Boolean) : [];
}

async function loadInfo() {
  loading.value = true;
  error.value = '';
  try {
    const env = await getApi<any>('/Admin/User/Info');
    if (env.code !== 0) throw new Error(env.message || '加载用户资料失败');
    const d = env.data ?? {};
    rawInfo.value = d;
    originalUser = d;
    form.id = pick(d, 'id', 'ID') ?? '';
    form.name = String(pick(d, 'name', 'Name') ?? '');
    form.displayName = String(pick(d, 'displayName', 'DisplayName') ?? '');
    form.sex = Number(pick(d, 'sex', 'Sex') ?? 0) || 0;
    form.birthday = String(pick(d, 'birthday', 'Birthday') ?? '');
    form.mail = String(pick(d, 'mail', 'Mail', 'email', 'Email') ?? '');
    form.mobile = String(pick(d, 'mobile', 'Mobile') ?? '');
    form.code = String(pick(d, 'code', 'Code') ?? '');
    form.avatar = String(pick(d, 'avatar', 'Avatar') ?? '');
    form.remark = String(pick(d, 'remark', 'Remark') ?? '');
    form.logins = Number(pick(d, 'logins', 'Logins') ?? 0) || 0;
    form.lastLogin = String(pick(d, 'lastLogin', 'LastLogin') ?? '');
    form.lastLoginIP = String(pick(d, 'lastLoginIP', 'LastLoginIP') ?? '');
    form.enable = pick(d, 'enable', 'Enable') !== false;
    form.roleNames = readRoles(d);
    form.departmentName = String(pick(d, 'departmentName', 'DepartmentName') ?? '');
    form.ssoName = String(pick(d, 'ssoName', 'SsoName') ?? '');
  } catch (e: any) {
    error.value = e?.message || '加载用户资料失败';
  } finally {
    loading.value = false;
  }
}

/** 头卡数据（MVC 固定 4 项统计） */
const headerName = computed(() => form.displayName || form.name);
const headerStats = computed(() => [
  { label: '登录次数', value: form.logins },
  { label: '最后登录', value: form.lastLogin },
  { label: '部门', value: form.departmentName },
  { label: '最后登录 IP', value: form.lastLoginIP },
]);

/** 页内导航（复刻 _User_Nav；本人四项 + 关联数据跳转项） */
const navItems = computed(() =>
  userCenterNav({
    userId: form.id,
    isSelf: true,
  }),
);

/* ----------------------------- 保存资料 ----------------------------- */
async function saveInfo() {
  saving.value = true;
  try {
    // 与原始对象合并回传：魔方 `POST /Admin/User/Info` 收的是整个 User 对象，
    // 只传改过的字段会把其余字段置空（最典型的是角色/部门被清掉）。
    const payload: Record<string, any> = {
      ...originalUser,
      ...form,
      // 大小写双写：后端实体属性为 PascalCase，部分版本按 camelCase 序列化读取
      Name: form.name,
      DisplayName: form.displayName,
      Sex: form.sex,
      Birthday: form.birthday || null,
      Mail: form.mail,
      Mobile: form.mobile,
      Code: form.code,
      Avatar: form.avatar,
      Remark: form.remark,
    };
    const env = await postApi<any>('/Admin/User/Info', payload);
    if (env.code !== 0) throw new Error(env.message || '保存失败');
    MessagePlugin.success('资料已保存');
    await loadInfo();
  } catch (e: any) {
    MessagePlugin.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function resetInfo() {
  if (rawInfo.value) {
    // 重新拉一次比手工回滚更可靠（避免漏字段）
    loadInfo();
    MessagePlugin.info('已还原为服务端当前值');
  }
}

/* ----------------------------- 头像上传 ----------------------------- */
const uploading = ref(false);
async function onAvatarChange(files: any) {
  const file = Array.isArray(files) ? files[0]?.raw ?? files[0] : files?.raw ?? files;
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    // 魔方上传契约：字段名固定 file（见 FormDialog 的 upload-url 说明）
    fd.append('file', file);
    const resp = await http.post('/Admin/User/UploadFile', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const env = resp?.data ?? {};
    if (env.code !== 0) throw new Error(env.message || '上传失败');
    const d = env.data;
    const url = typeof d === 'string' ? d : String(pick(d, 'url', 'Url', 'filePath', 'FilePath', 'path', 'Path') ?? '');
    if (!url) throw new Error('上传成功但未返回地址');
    form.avatar = url;
    MessagePlugin.success('头像已上传，保存后生效');
  } catch (e: any) {
    MessagePlugin.error(e?.message || '头像上传失败');
  } finally {
    uploading.value = false;
  }
}

const avatarUrl = computed(() => (form.avatar ? serverUrl(form.avatar) : ''));

/* ----------------------------- 修改密码 ----------------------------- */
const pwd = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdSaving = ref(false);
/** SSO 登录的账号无需旧密码（对齐 MVC `requireOldPass = Model.SsoName.IsNullOrEmpty()`） */
const requireOldPass = computed(() => !form.ssoName);

async function changePassword() {
  if (!pwd.newPassword || !pwd.confirmPassword) {
    MessagePlugin.warning('请填写新密码与确认密码');
    return;
  }
  if (pwd.newPassword !== pwd.confirmPassword) {
    MessagePlugin.warning('两次输入的新密码不一致');
    return;
  }
  if (requireOldPass.value && !pwd.oldPassword) {
    MessagePlugin.warning('请填写当前密码');
    return;
  }
  pwdSaving.value = true;
  try {
    let challengeId = '';
    let newPassword: string = pwd.newPassword;
    // 后端要求挑战响应时先取公钥加密（与登录同一实现，见 api/crypto.ts）
    try {
      const cfg = await auth.getLoginConfig();
      if (cfg?.security?.challengeRequired) {
        const ch = await auth.getChallenge();
        if (ch?.publicKey) {
          const enc = await encryptPassword(pwd.newPassword, ch.publicKey);
          if (enc) {
            newPassword = enc;
            challengeId = ch.challengeId;
          }
        }
      }
    } catch {
      /* 取不到配置就按明文提交（后端 AllowPlainPassword 时可用） */
    }
    const env = await postApi<any>('/Admin/User/ChangePassword', {
      oldPassword: pwd.oldPassword,
      newPassword,
      confirmPassword: newPassword,
      challengeId,
    });
    if (env.code !== 0) throw new Error(env.message || '修改失败');
    MessagePlugin.success('密码已修改');
    pwd.oldPassword = '';
    pwd.newPassword = '';
    pwd.confirmPassword = '';
  } catch (e: any) {
    MessagePlugin.error(e?.message || '修改密码失败');
  } finally {
    pwdSaving.value = false;
  }
}

/* ----------------------------- 两步验证（MFA） ----------------------------- */
/**
 * ★ 实测（6.15.2026.901）：`/Mfa/*` 端点存在，但 `LoginConfig.security.mfaAvailable=false`
 * 表示该部署**未对用户开放** MFA。此时点「绑定验证器」必然失败。
 * 故整个分区按 `mfaAvailable` 显隐——不给用户一个点了就报错的按钮。
 */
const mfaAvailable = ref(false);
const mfa = reactive<{ enabled: boolean; loading: boolean; setup: any; code: string }>({
  enabled: false,
  loading: false,
  setup: null,
  code: '',
});
const rawMfa = ref<any>(null);

async function loadMfa() {
  mfa.loading = true;
  try {
    const env = await getRaw<any>('/Mfa/Status');
    rawMfa.value = env;
    if (env.code === 0) {
      const d = env.data ?? {};
      mfa.enabled = pick(d, 'enabled', 'Enabled', 'isEnabled', 'IsEnabled') === true;
    }
  } catch {
    // MFA 未启用/端点不可达：静默保持关闭态，不阻断页面
  } finally {
    mfa.loading = false;
  }
}

async function setupMfa() {
  mfa.loading = true;
  try {
    const env = await getRaw<any>('/Mfa/Setup');
    rawMfa.value = env;
    if (env.code !== 0) throw new Error(env.message || '获取验证器信息失败');
    mfa.setup = env.data ?? null;
    mfa.code = '';
  } catch (e: any) {
    MessagePlugin.error(e?.message || '获取验证器信息失败');
  } finally {
    mfa.loading = false;
  }
}

async function activateMfa() {
  if (!mfa.code) {
    MessagePlugin.warning('请输入验证器上的 6 位验证码');
    return;
  }
  mfa.loading = true;
  try {
    const env = await postRaw<any>('/Mfa/Activate', { code: mfa.code });
    if (env.code !== 0) throw new Error(env.message || '启用失败');
    MessagePlugin.success('两步验证已启用');
    mfa.setup = null;
    await loadMfa();
  } catch (e: any) {
    MessagePlugin.error(e?.message || '启用失败');
  } finally {
    mfa.loading = false;
  }
}

async function disableMfa() {
  mfa.loading = true;
  try {
    const env = await postRaw<any>('/Mfa/Disable', { code: mfa.code || '' });
    if (env.code !== 0) throw new Error(env.message || '关闭失败');
    MessagePlugin.success('两步验证已关闭');
    await loadMfa();
  } catch (e: any) {
    MessagePlugin.error(e?.message || '关闭失败');
  } finally {
    mfa.loading = false;
  }
}

/* ----------------------------- 第三方授权 ----------------------------- */
const binds = ref<any[]>([]);
const bindsLoading = ref(false);
const rawBinds = ref<any>(null);

async function loadBinds() {
  bindsLoading.value = true;
  try {
    // ★ 实测（6.15.2026.901）：`GET User/Binds()` 是第三方授权的权威端点。
    //   不要用 UserConnect（那是「关联账号」实体表，语义不同）。
    const env = await getApi<any>('/Admin/User/Binds');
    rawBinds.value = env;
    const d = env.data;
    binds.value = Array.isArray(d) ? d : [];
  } catch (e: any) {
    binds.value = [];
    rawBinds.value = { error: e?.message };
  } finally {
    bindsLoading.value = false;
  }
}

async function unbind(row: any) {
  // 解绑以 Sso 的 id 为准（Binds 返回项通常带 id / name / provider）
  const id = row?.id ?? row?.ID ?? row?.name ?? row?.Name;
  if (id == null) return;
  const label = String(row?.nickName ?? row?.NickName ?? row?.name ?? row?.Name ?? '该账号');
  if (!window.confirm(`确定解绑「${label}」？解绑后将无法用该账号登录。`)) return;
  try {
    // ★ 实测：`GET Sso/UnBind(String id)` —— 解绑是 GET，不是 POST
    const env = await getRaw<any>('/Sso/UnBind', { id });
    if (env.code !== 0) throw new Error(env.message || '解绑失败');
    MessagePlugin.success('已解绑');
    await loadBinds();
  } catch (e: any) {
    MessagePlugin.error(e?.message || '解绑失败');
  }
}

/* ----------------------------- 导出个人数据（危险区替代「注销账号」） ----------------------------- */
/**
 * ★ 实测（6.15.2026.901）：**没有 `User/CloseAccount`**（User 控制器 24 个动作里无此项），
 * 故 MVC 版 Info.cshtml 的「注销账号」在 WebApi 部署上无端点可用 —— 不做成按钮，
 * 否则又是一个点了必报错的死路。
 *
 * 保留「导出个人数据」：`GET User/ExportFile(String format)` 实测存在，属个人信息可携带权的
 * 正当实现，语义与 MVC 版该区块一致（同为安全中心区块）。
 */
function exportMyData() {
  // API_BASE 已含 `/api`（同源为 `/api`，独立部署为 `${SERVER_BASE}/api`）
  const q = new URLSearchParams({ format: 'json' });
  window.open(`${API_BASE}/Admin/User/ExportFile?${q.toString()}`, '_blank');
}

/* ----------------------------- 分区切换时按需加载 ----------------------------- */
function onTabChange(key: string) {
  if (key === 'binds') loadBinds();
  if (key === 'password' && mfaAvailable.value) loadMfa();
}

onMounted(async () => {
  await loadInfo();
  // MFA 是否对用户开放以 LoginConfig 为准（实测该部署 mfaAvailable=false）
  try {
    const cfg = await auth.getLoginConfig();
    mfaAvailable.value = cfg?.security?.mfaAvailable === true;
  } catch {
    mfaAvailable.value = false;
  }
});

/* 展示用的当前租户 */
const tenantLabel = computed(() => getTenantCode() || getTenant() || '默认租户');
</script>

<template>
  <div class="page-wrap">
    <!-- 页内导航：对齐 MVC `_User_Nav` -->
    <PageNav :items="navItems" v-model="tab" @select="onTabChange" />

    <t-alert v-if="error" theme="error" :message="error" class="page-err" />

    <!-- 个人信息头卡：对齐 MVC `.profile-card`（资料页才有） -->
    <ProfileHeader
      v-if="tab === 'basic'"
      :name="headerName"
      :username="form.name"
      :avatar="avatarUrl"
      :roles="form.roleNames"
      :stats="headerStats"
    />

    <!-- ========== ① 基础信息（Info） ========== -->
    <template v-if="tab === 'basic'">
      <t-form :data="form" label-align="right" label-width="110px" :disabled="loading">
        <PageSection title="基础信息" icon="user">
          <div class="field-grid">
            <t-form-item label="登录名">
              <t-input v-model="form.name" disabled />
              <div class="help-text">登录名不可修改</div>
            </t-form-item>
            <t-form-item label="显示名">
              <t-input v-model="form.displayName" placeholder="用于界面展示" />
            </t-form-item>
            <t-form-item label="性别">
              <t-select
                v-model="form.sex"
                :options="[
                  { value: 0, label: '未知' },
                  { value: 1, label: '男' },
                  { value: 2, label: '女' },
                ]"
              />
            </t-form-item>
            <t-form-item label="生日">
              <t-date-picker v-model="form.birthday" value-type="YYYY-MM-DD" clearable placeholder="选择日期" />
            </t-form-item>
          </div>
        </PageSection>

        <PageSection title="联系方式" icon="mail">
          <div class="field-grid">
            <t-form-item label="邮箱">
              <t-input v-model="form.mail" placeholder="用于接收通知与找回密码" />
            </t-form-item>
            <t-form-item label="手机">
              <t-input v-model="form.mobile" type="tel" placeholder="用于短信验证" />
            </t-form-item>
          </div>
        </PageSection>

        <PageSection title="身份信息" icon="lock-on">
          <div class="field-grid">
            <t-form-item label="编码">
              <t-input v-model="form.code" placeholder="业务编码，可留空" />
            </t-form-item>
            <t-form-item label="角色">
              <div class="readonly-value">
                <t-tag v-for="r in form.roleNames" :key="r" theme="primary" variant="light" size="small">{{ r }}</t-tag>
                <span v-if="!form.roleNames.length" class="help-text">未分配角色</span>
              </div>
              <div class="help-text">角色由管理员在「角色管理」中授权</div>
            </t-form-item>
            <t-form-item label="部门">
              <div class="readonly-value">{{ form.departmentName || '—' }}</div>
            </t-form-item>
            <t-form-item label="头像">
              <div class="avatar-upload">
                <t-avatar :image="avatarUrl || undefined" :size="'80px'" class="avatar-thumb">
                  {{ (headerName || '?').slice(0, 1) }}
                </t-avatar>
                <t-upload
                  :auto-upload="false"
                  accept="image/*"
                  :disabled="uploading"
                  :show-upload-progress="false"
                  @change="onAvatarChange"
                >
                  <t-button variant="outline" :loading="uploading">选择图片</t-button>
                </t-upload>
              </div>
              <div class="help-text">支持 JPG / PNG，建议 200×200 以上</div>
            </t-form-item>
          </div>
        </PageSection>

        <PageSection title="登录信息" icon="time">
          <div class="field-grid">
            <t-form-item label="登录次数">
              <div class="readonly-value">{{ form.logins }}</div>
            </t-form-item>
            <t-form-item label="最后登录">
              <div class="readonly-value">{{ form.lastLogin || '—' }}</div>
            </t-form-item>
            <t-form-item label="最后登录 IP">
              <div class="readonly-value">{{ form.lastLoginIP || '—' }}</div>
            </t-form-item>
            <t-form-item label="备注">
              <t-textarea v-model="form.remark" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="选填" />
            </t-form-item>
          </div>
        </PageSection>
      </t-form>

      <!-- 操作栏：对齐 MVC `.profile-actions`（居中，主/次按钮） -->
      <div class="profile-actions">
        <t-button theme="primary" :loading="saving" @click="saveInfo">保存</t-button>
        <t-button theme="default" :disabled="saving" @click="resetInfo">取消</t-button>
      </div>

      <!-- 安全中心：导出个人数据（对齐 MVC Info.cshtml 末尾的独立安全区块）。
           ⚠️ 不提供「注销账号」：实测 6.15 无 User/CloseAccount 端点，做了也是死路。 -->
      <PageSection title="安全中心" icon="lock-on">
        <t-form label-align="right" label-width="110px">
          <t-form-item label="个人数据">
            <div class="danger-row">
              <t-button theme="default" variant="outline" @click="exportMyData">导出个人数据</t-button>
              <span class="help-text danger-tip">导出当前账号的资料与关联数据（JSON），便于备份或迁移。</span>
            </div>
          </t-form-item>
        </t-form>
      </PageSection>

      <DataProbe :data="rawInfo" label="User/Info 响应结构" />
    </template>

    <!-- ========== ② 修改密码（ChangePassword）+ 两步验证 ========== -->
    <template v-else-if="tab === 'password'">
      <PageSection title="修改密码" icon="lock-on">
        <t-form label-align="right" label-width="110px" class="narrow-form">
          <t-form-item label="登录名">
            <t-input :value="form.name" disabled />
            <div v-if="!requireOldPass" class="help-text">当前通过 {{ form.ssoName }} 登录，无需修改密码</div>
          </t-form-item>
          <t-form-item v-if="requireOldPass" label="当前密码">
            <t-input v-model="pwd.oldPassword" type="password" placeholder="请输入当前密码" />
          </t-form-item>
          <t-form-item label="新密码">
            <t-input v-model="pwd.newPassword" type="password" placeholder="请输入新密码" />
          </t-form-item>
          <t-form-item label="确认新密码">
            <t-input v-model="pwd.confirmPassword" type="password" placeholder="请再次输入新密码" />
            <div class="help-text">两次输入必须一致</div>
          </t-form-item>
        </t-form>
        <template #footer>
          <t-space>
            <t-button theme="primary" :loading="pwdSaving" :disabled="!requireOldPass && !form.ssoName" @click="changePassword">
              保存
            </t-button>
          </t-space>
        </template>
      </PageSection>

      <!-- 两步验证仅在 LoginConfig.security.mfaAvailable=true 时出现 -->
      <PageSection v-if="mfaAvailable" title="两步验证" icon="lock-on">
        <t-form label-align="right" label-width="110px" class="narrow-form">
          <t-form-item label="当前状态">
            <t-tag :theme="mfa.enabled ? 'success' : 'default'" variant="light">
              {{ mfa.enabled ? '已启用' : '未启用' }}
            </t-tag>
          </t-form-item>
          <t-form-item v-if="!mfa.enabled" label="操作">
            <t-button variant="outline" :loading="mfa.loading" @click="setupMfa">绑定验证器</t-button>
          </t-form-item>
          <template v-if="mfa.setup">
            <t-form-item label="验证器密钥">
              <t-input :value="String(mfa.setup.secret ?? mfa.setup.Secret ?? '')" readonly />
            </t-form-item>
            <t-form-item label="绑定链接">
              <t-input :value="String(mfa.setup.uri ?? mfa.setup.Uri ?? mfa.setup.qrCodeUri ?? '')" readonly />
              <div class="help-text">用验证器 App 扫描/录入后，输入下方 6 位验证码完成绑定</div>
            </t-form-item>
          </template>
          <t-form-item v-if="mfa.setup || mfa.enabled" label="验证码">
            <t-input v-model="mfa.code" placeholder="6 位验证码" style="max-width: 200px" />
          </t-form-item>
        </t-form>
        <template #footer>
          <t-space>
            <t-button v-if="mfa.setup" theme="primary" :loading="mfa.loading" @click="activateMfa">启用</t-button>
            <t-button v-else-if="mfa.enabled" theme="danger" variant="outline" :loading="mfa.loading" @click="disableMfa">
              关闭两步验证
            </t-button>
          </t-space>
        </template>
      </PageSection>

      <DataProbe :data="rawMfa" label="MFA 响应结构" />
    </template>

    <!-- ========== ③ 第三方授权（Binds） ========== -->
    <template v-else-if="tab === 'binds'">
      <PageSection title="第三方授权" icon="link">
        <template #extra>
          <t-button size="small" variant="outline" :loading="bindsLoading" @click="loadBinds">刷新</t-button>
        </template>
        <ul v-if="binds.length" class="oauth-list">
          <li v-for="(b, i) in binds" :key="b.id ?? b.ID ?? i">
            <div class="oauth-logo">
              <t-icon name="link" />
            </div>
            <div class="oauth-name">
              {{ b.provider ?? b.Provider ?? b.name ?? b.Name ?? '第三方账号' }}
              <span class="oauth-nick">{{ b.nickName ?? b.NickName ?? b.openId ?? b.OpenId ?? '' }}</span>
            </div>
            <div class="oauth-action">
              <t-link theme="danger" @click="unbind(b)">解绑</t-link>
            </div>
          </li>
        </ul>
        <t-empty v-else :description="bindsLoading ? '加载中…' : '尚未绑定任何第三方账号'" />
        <div class="help-text bind-tip">新增绑定：在登录页选择第三方登录，登录后自动关联。</div>
        <DataProbe :data="rawBinds" label="UserConnect 响应结构" />
      </PageSection>
    </template>

    <!-- ========== ④ 租户信息（TenantSetting） ========== -->
    <template v-else-if="tab === 'tenant'">
      <PageSection title="租户信息" icon="building">
        <t-form label-align="right" label-width="110px" class="narrow-form">
          <t-form-item label="当前租户">
            <div class="readonly-value">{{ tenantLabel }}</div>
            <div class="help-text">租户由登录响应头下发，切换后需重新加载数据</div>
          </t-form-item>
          <t-form-item label="切换租户">
            <TenantSwitcher />
          </t-form-item>
        </t-form>
      </PageSection>
    </template>
  </div>
</template>

<style scoped>
/* 页面容器：对齐 MVC `.profile-wrap`（max-width 1200 居中） */
.page-wrap { max-width: 1200px; margin: 0 auto; }
.page-err { margin-bottom: 12px; }

/* 两列字段栅格（对齐 MVC `row > col-sm-6`，每行两列） */
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
}
.readonly-value {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 32px;
  color: var(--td-text-color-primary);
  word-break: break-all;
}
.help-text {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-top: 4px;
  line-height: 1.5;
}
.avatar-upload { display: flex; align-items: center; gap: 16px; }
.avatar-thumb { flex: 0 0 80px; box-shadow: var(--td-shadow-1); }

/* 操作栏：居中双按钮（对齐 MVC `.profile-actions`） */
.profile-actions {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-1);
  padding: 16px 24px;
  text-align: center;
  margin-bottom: 16px;
}
.profile-actions :deep(.t-button) { min-width: 100px; margin: 0 6px; }

.danger-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.danger-tip { margin-top: 0; }
.narrow-form { max-width: 560px; }
.bind-tip { padding: 8px 0 4px; }

/* 第三方授权列表（对齐 MVC `.oauth-list`） */
.oauth-list { list-style: none; margin: 0; padding: 0; }
.oauth-list li {
  display: flex;
  align-items: center;
  padding: 14px 6px;
  border-bottom: 1px solid var(--td-component-stroke);
}
.oauth-list li:last-child { border-bottom: none; }
.oauth-logo {
  width: 44px;
  height: 44px;
  margin-right: 14px;
  flex: 0 0 44px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-secondarycontainer);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
}
.oauth-name { flex: 1; min-width: 0; font-weight: 600; color: var(--td-text-color-primary); }
.oauth-nick {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--td-text-color-placeholder);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oauth-action { min-width: 60px; text-align: right; }

@media (max-width: 767px) {
  .field-grid { grid-template-columns: 1fr; }
  .oauth-list li { flex-wrap: wrap; }
}
</style>
