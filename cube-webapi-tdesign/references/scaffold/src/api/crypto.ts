/**
 * 密码加密（Challenge-Response）—— 认证与安全中心共用的单一实现。
 * 落地为 src/api/crypto.ts。
 *
 * ## 为什么单独成文件
 * 登录（`stores/auth.ts`）与「安全中心 → 修改密码」（`pages/AccountView.vue`）都需要
 * 用后端公钥加密密码。历史上加密逻辑只写在 auth store 内部（私有函数），第二个调用点
 * 只能复制一份 —— 这正是「同一规则两处实现、迟早不一致」的典型。故抽到本文件，
 * auth store 与安全中心都从这里导入。
 *
 * ## 契约
 * 后端 `GET /Auth/Challenge` 返回 `{ challengeId, publicKey }`，`publicKey` 为 PKCS#8 SPKI PEM；
 * 加密算法固定 **RSA-OAEP / SHA-256**，输出 Base64 密文。
 * 浏览器不支持 Web Crypto（非安全上下文 / 老内核）时返回 `null`，由调用方决定降级策略
 * （后端 `AllowPlainPassword=true` 时可直接提交明文，否则应提示用户升级浏览器）。
 */

/**
 * 用后端公钥加密密码，返回 Base64 密文；失败返回 null（调用方降级）。
 */
export async function encryptPassword(password: string, publicKeyPem: string): Promise<string | null> {
  try {
    if (!crypto?.subtle) return null;
    const pem = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/[\r\n\s]/g, '');
    const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(password));
    return btoa(String.fromCharCode(...new Uint8Array(cipher)));
  } catch {
    return null;
  }
}
