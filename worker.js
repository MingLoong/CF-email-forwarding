// ==========================================
// 0. 共享配置与工具
// ==========================================
const DURATION_OPTIONS = [
  { value: '1', label: '1 小时' },
  { value: '8', label: '8 小时' },
  { value: '24', label: '24 小时' },
  { value: '48', label: '48 小时' },
  { value: '72', label: '72 小时' },
  { value: '168', label: '168 小时' },
  { value: 'permanent', label: '永久' }
];

const DURATION_VALUES = new Set(DURATION_OPTIONS.map((i) => i.value));
const BOOLEAN_CONFIG_KEYS = new Set(['allow_registration', 'enable_invitation_code']);
const DURATION_CONFIG_KEYS = new Set(['max_destination_duration_hours', 'max_route_duration_hours']);
const MAX_ROUTE_REMARK_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITATION_USES = 100000;
const MAX_SEARCH_LENGTH = 64;
const MAX_INBOX_SEARCH_LENGTH = 96;
const BYTES_PER_MB = 1048576;
const DEFAULT_MAX_INBOUND_BODY_BYTES = 262144;
const DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES = 10485760;
const DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES = 26214400;
const DEFAULT_MAX_INBOUND_ATTACHMENTS = 20;
const DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES = 1073741824;
const MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY = 'max_inbound_total_attachment_bytes';
const MAX_INBOUND_ATTACHMENTS_CONFIG_KEY = 'max_inbound_attachments_per_email';
const MAX_INBOUND_R2_STORAGE_CONFIG_KEY = 'max_inbound_r2_storage_bytes';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const DELIVERY_MODES = new Set(['inbox_only', 'inbox_forward', 'forward_only']);
const AUTH_RATE_LIMITS = {
  admin_login: { max: 5, windowMinutes: 15 },
  user_login: { max: 5, windowMinutes: 15 },
  register: { max: 5, windowMinutes: 60 }
};
const INTEGER_CONFIG_LIMITS = {
  max_users: { min: 0, max: 100000 },
  max_routes_per_user: { min: 0, max: 1000 },
  max_total_destinations: { min: 0, max: 100000 },
  max_destinations_per_user: { min: 1, max: 1000 },
  max_regs_per_ip_24h: { min: 1, max: 1000 },
  unverified_user_expiry_hours: { min: 1, max: 8760 },
  pending_dest_expiry_hours: { min: 1, max: 8760 },
  inbound_mail_retention_days: { min: 1, max: 3650 },
  max_inbound_body_bytes: { min: 4096, max: 1048576 },
  max_inbound_attachment_bytes: { min: 1024, max: 104857600 },
  [MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY]: { min: 1024, max: 209715200 },
  [MAX_INBOUND_R2_STORAGE_CONFIG_KEY]: { min: 0, max: 1099511627776 },
  [MAX_INBOUND_ATTACHMENTS_CONFIG_KEY]: { min: 0, max: 200 }
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "frame-src https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

const DEFAULT_CONFIGS = [
  ['max_users', '1000'],
  ['max_routes_per_user', '10'],
  ['max_total_destinations', '180'],
  ['max_destinations_per_user', '3'],
  ['max_regs_per_ip_24h', '1'],
  ['unverified_user_expiry_hours', '24'],
  ['pending_dest_expiry_hours', '24'],
  ['allowed_countries', 'ALL'],
  ['allow_registration', 'true'],
  ['enable_invitation_code', 'false'],
  ['max_destination_duration_hours', '168'],
  ['max_route_duration_hours', '72'],
  ['inbound_mail_retention_days', '30'],
  ['max_inbound_body_bytes', String(DEFAULT_MAX_INBOUND_BODY_BYTES)],
  ['max_inbound_attachment_bytes', String(DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES)],
  [MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY, String(DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES)],
  [MAX_INBOUND_R2_STORAGE_CONFIG_KEY, String(DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES)],
  [MAX_INBOUND_ATTACHMENTS_CONFIG_KEY, String(DEFAULT_MAX_INBOUND_ATTACHMENTS)]
];

let schemaReady = false;

const durationRank = (value) => value === 'permanent' ? Number.POSITIVE_INFINITY : parseInt(value, 10);
const isValidDuration = (value) => DURATION_VALUES.has(String(value));
const isWithinMaxDuration = (value, maxValue) => durationRank(String(value)) <= durationRank(String(maxValue || 'permanent'));
const sqlDateFromMs = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const expiryFromDuration = (durationHours) => durationHours === 'permanent' ? null : sqlDateFromMs(Date.now() + parseInt(durationHours, 10) * 3600000);
const dbDateMs = (value) => {
  if (!value) return null;
  const raw = String(value);
  return Date.parse(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
};
const minExpiry = (a, b) => {
  if (!a) return b || null;
  if (!b) return a || null;
  return dbDateMs(a) <= dbDateMs(b) ? a : b;
};
const normalizeRouteRemark = (value) => String(value == null ? '' : value).trim();
const normalizeDeliveryMode = (value) => {
  const mode = String(value || '').trim();
  return DELIVERY_MODES.has(mode) ? mode : '';
};
const deliveryModeNeedsDestination = (mode) => mode === 'inbox_forward' || mode === 'forward_only';
const routeDeliveryMode = (route) => {
  if (isTruthyFlag(route?.inbox_enabled)) return route?.destination_id == null ? 'inbox_only' : 'inbox_forward';
  return 'forward_only';
};

const buildHeaders = (headers = {}) => {
  const out = new Headers(SECURITY_HEADERS);
  for (const [key, value] of Object.entries(headers || {})) {
    if (value != null) out.set(key, value);
  }
  return out;
};

const jsonResponse = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {status, headers: buildHeaders({'Content-Type':'application/json;charset=utf-8', ...headers})});

const htmlResponse = (html, headers = {}) =>
  new Response(html, {headers: buildHeaders({'Content-Type':'text/html;charset=utf-8', ...headers})});

const emptyResponse = (status = 204, headers = {}) =>
  new Response(null, {status, headers: buildHeaders(headers)});

const isTrustedOrigin = (req, url) => {
  if (!MUTATING_METHODS.has(req.method)) return true;
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch (_) {
    return false;
  }
};

const readJsonBody = async (req) => {
  try {
    const contentType = String(req.headers.get('Content-Type') || '').toLowerCase();
    if (!contentType.includes('application/json')) return {ok: true, data: {}};
    const data = await req.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {ok: false, error: 'JSON 请求体必须是对象'};
    return {ok: true, data};
  } catch (_) {
    return {ok: false, error: 'JSON 请求体格式不正确'};
  }
};

const getClientIp = (req) => req.headers.get('CF-Connecting-IP') || '0.0.0.0';
const normalizeUsername = (value) => String(value == null ? '' : value).trim();
const normalizeAuthIdentifier = (value) => String(value == null ? '' : value).trim().toLowerCase().slice(0, 128) || '-';
const normalizeEmail = (value) => String(value == null ? '' : value).trim();
const normalizeSearch = (value) => String(value == null ? '' : value).trim().slice(0, MAX_SEARCH_LENGTH);
const normalizeInboxSearch = (value) => String(value == null ? '' : value).trim().slice(0, MAX_INBOX_SEARCH_LENGTH);
const isTruthyFlag = (value) => String(value || '').toLowerCase() === 'true';
const boolText = (value) => value ? 'true' : 'false';
const normalizeMailAddress = (value) => {
  const raw = String(value == null ? '' : value).trim();
  const angle = raw.match(/<([^<>]+)>/);
  return String(angle ? angle[1] : raw).trim().toLowerCase();
};

const validateUsername = (value) => {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) return {ok: false, error: '用户名需为 3-32 位字母、数字、下划线或短横线'};
  return {ok: true, value: username};
};

const validatePassword = (value, label = '密码') => {
  const password = String(value == null ? '' : value);
  if (password.length < MIN_PASSWORD_LENGTH) return {ok: false, error: `${label}至少 ${MIN_PASSWORD_LENGTH} 位`};
  if (password.length > MAX_PASSWORD_LENGTH) return {ok: false, error: `${label}最多 ${MAX_PASSWORD_LENGTH} 位`};
  return {ok: true, value: password};
};

const validateEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return {ok: false, error: '请输入邮箱地址'};
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return {ok: false, error: '邮箱地址格式不正确'};
  return {ok: true, value: email};
};

const safeDecodeURIComponent = (value) => {
  try {
    return {ok: true, value: decodeURIComponent(value || '')};
  } catch (_) {
    return {ok: false, value: ''};
  }
};

const parsePositiveInteger = (value, fallback = 1, min = 1, max = 1000) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const validateConfigValue = (key, value) => {
  const raw = String(value == null ? '' : value).trim();
  if (raw.length > 512) return {ok: false, error: '配置值过长'};
  if (BOOLEAN_CONFIG_KEYS.has(key)) {
    if (!['true', 'false'].includes(raw)) return {ok: false, error: '该配置只能选择 true 或 false'};
    return {ok: true, value: raw};
  }
  if (DURATION_CONFIG_KEYS.has(key)) {
    if (!isValidDuration(raw)) return {ok: false, error: '有效期只能从预设选项中选择'};
    return {ok: true, value: raw};
  }
  if (INTEGER_CONFIG_LIMITS[key]) {
    const n = parseInt(raw, 10);
    const limit = INTEGER_CONFIG_LIMITS[key];
    if (!Number.isFinite(n) || String(n) !== raw || n < limit.min || n > limit.max) {
      return {ok: false, error: `该配置必须是 ${limit.min} 到 ${limit.max} 之间的整数`};
    }
    return {ok: true, value: String(n)};
  }
  if (key === 'allowed_countries') {
    const normalized = raw.toUpperCase().replace(/\s+/g, '');
    if (normalized !== 'ALL' && !/^[A-Z]{2}(,[A-Z]{2})*$/.test(normalized)) return {ok: false, error: '国家代码格式应为 ALL 或 US,JP,SG'};
    return {ok: true, value: normalized};
  }
  return {ok: true, value: raw};
};

const PASSWORD_SCHEME = 'pbkdf2_sha256';
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;
const passwordEncoder = new TextEncoder();

const bytesToBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64ToBytes = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bytesToUtf8 = (bytes) => new TextDecoder('utf-8', {fatal: false}).decode(bytes);

const decodeQuotedPrintable = (value) => {
  const compact = String(value || '').replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(compact.slice(i + 1, i + 3))) {
      bytes.push(parseInt(compact.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(compact.charCodeAt(i));
    }
  }
  return bytesToUtf8(new Uint8Array(bytes));
};

const decodeMimeEncodedWords = (value) => String(value || '').replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_, charset, encoding, text) => {
  try {
    const normalizedCharset = String(charset || '').toLowerCase();
    if (!/utf-?8|us-ascii/.test(normalizedCharset)) return text;
    if (String(encoding).toUpperCase() === 'B') return bytesToUtf8(base64ToBytes(text));
    return decodeQuotedPrintable(String(text).replace(/_/g, ' '));
  } catch (_) {
    return text;
  }
});

const parseMimeHeaders = (rawHeaders) => {
  const headers = {};
  const unfolded = String(rawHeaders || '').replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
};

const getMimeParam = (value, name) => {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, 'i');
  const m = String(value || '').match(re);
  return m ? (m[1] || m[2] || '') : '';
};

const stripContentId = (value) => String(value || '').trim().replace(/^<|>$/g, '').toLowerCase();

const normalizeAttachmentFilename = (value, fallback = 'attachment') => {
  const decoded = decodeMimeEncodedWords(String(value || '')).trim();
  const clean = decoded.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').slice(0, 160).trim();
  return clean || fallback;
};

const decodeQuotedPrintableBytes = (value) => {
  const compact = String(value || '').replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(compact.slice(i + 1, i + 3))) {
      bytes.push(parseInt(compact.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(compact.charCodeAt(i) & 255);
    }
  }
  return new Uint8Array(bytes);
};

const decodeMimePartBody = (body, encoding) => {
  const transferEncoding = String(encoding || '').toLowerCase();
  try {
    if (transferEncoding === 'base64') return bytesToUtf8(base64ToBytes(String(body || '').replace(/\s+/g, '')));
    if (transferEncoding === 'quoted-printable') return decodeQuotedPrintable(body);
  } catch (_) {}
  return String(body || '');
};

const decodeMimePartBytes = (body, encoding) => {
  const transferEncoding = String(encoding || '').toLowerCase();
  try {
    if (transferEncoding === 'base64') return base64ToBytes(String(body || '').replace(/\s+/g, ''));
    if (transferEncoding === 'quoted-printable') return decodeQuotedPrintableBytes(body);
  } catch (_) {}
  const raw = String(body || '');
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 255;
  return bytes;
};

const htmlToPlainText = (html) => String(html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;/gi, "'");

const sanitizeEmailHtml = (html) => {
  let out = String(html || '');
  out = out.replace(/<!doctype[\s\S]*?>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base|svg|math)[\s\S]*?<\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base|svg|math)[^>]*\/?\s*>/gi, '');
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/\s+(href|src|background)\s*=\s*(["']?)\s*javascript:[\s\S]*?\2/gi, '');
  out = out.replace(/\s+(href|src|background)\s*=\s*(["']?)\s*data:(?!image\/(?:png|gif|jpe?g|webp|bmp|svg\+xml);)[\s\S]*?\2/gi, '');
  out = out.replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return out.trim();
};

const splitMimeSections = (raw) => {
  const text = String(raw || '');
  const split = text.match(/\r?\n\r?\n/);
  if (!split) return {headerText: '', bodyText: text};
  return {
    headerText: text.slice(0, split.index),
    bodyText: text.slice(split.index + split[0].length)
  };
};

const splitMimeMultipartBody = (bodyText, boundary) => {
  if (!boundary) return [];
  const marker = `--${boundary}`;
  return String(bodyText || '').split(marker).slice(1).map((part) => {
    const endIdx = part.indexOf(`${marker}`);
    const raw = endIdx >= 0 ? part.slice(0, endIdx) : part;
    return raw.replace(/^\r?\n/, '').replace(/\r?\n--\s*$/, '').replace(/--\s*$/, '');
  }).filter((part) => part.trim());
};

const parseMimeEntity = (raw, inheritedHeaders = null) => {
  const sections = inheritedHeaders ? {headerText: '', bodyText: String(raw || '')} : splitMimeSections(raw);
  const headers = inheritedHeaders || parseMimeHeaders(sections.headerText);
  const contentType = headers['content-type'] || 'text/plain';
  const boundary = getMimeParam(contentType, 'boundary');
  const entity = {headers, body: sections.bodyText, children: []};
  if (boundary && /^multipart\//i.test(contentType)) {
    entity.children = splitMimeMultipartBody(sections.bodyText, boundary).map((part) => parseMimeEntity(part));
  }
  return entity;
};

const walkMimeEntities = (entity, out = []) => {
  if (!entity) return out;
  out.push(entity);
  for (const child of entity.children || []) walkMimeEntities(child, out);
  return out;
};

const cleanEmailBody = (value, maxBytes) => {
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_INBOUND_BODY_BYTES;
  const text = String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  return text.length > limit ? `${text.slice(0, limit)}\n\n[Message truncated]` : text;
};

const extractEmailContent = (rawText, maxBytes) => {
  const root = parseMimeEntity(rawText);
  const headers = root.headers || {};
  const contentType = headers['content-type'] || '';
  const subject = decodeMimeEncodedWords(headers.subject || '');
  const fromEmail = decodeMimeEncodedWords(headers.from || '');
  const messageId = String(headers['message-id'] || '').slice(0, 255);
  let plainBody = '';
  let htmlBody = '';
  const attachments = [];

  for (const entity of walkMimeEntities(root)) {
    if (entity.children?.length) continue;
    const partHeaders = entity.headers || {};
    const partType = String(partHeaders['content-type'] || contentType || 'text/plain').toLowerCase();
    const disposition = String(partHeaders['content-disposition'] || '').toLowerCase();
    const contentId = stripContentId(partHeaders['content-id'] || '');
    const isTextPart = partType.includes('text/plain') || partType.includes('text/html');
    const isAttachment = disposition.includes('attachment') ||
      !!getMimeParam(partHeaders['content-disposition'], 'filename') ||
      !!getMimeParam(partHeaders['content-type'], 'name');
    const isInlineAsset = !isTextPart && (!!contentId || disposition.includes('inline'));
    if (!isAttachment && !isInlineAsset && isTextPart) {
      const decoded = decodeMimePartBody(entity.body, partHeaders['content-transfer-encoding']);
      if (partType.includes('text/plain') && !plainBody) plainBody = decoded;
      if (partType.includes('text/html') && !htmlBody) htmlBody = decoded;
      continue;
    }
    if (isAttachment || isInlineAsset) {
      const filename = normalizeAttachmentFilename(
        getMimeParam(partHeaders['content-disposition'], 'filename') || getMimeParam(partHeaders['content-type'], 'name'),
        contentId ? `inline-${contentId}` : 'attachment'
      );
      const bytes = decodeMimePartBytes(entity.body, partHeaders['content-transfer-encoding']);
      attachments.push({
        filename,
        contentType: partType.split(';')[0].trim() || 'application/octet-stream',
        contentId,
        disposition: disposition.includes('inline') ? 'inline' : 'attachment',
        bytes
      });
    }
  }

  if (!plainBody && htmlBody) plainBody = htmlToPlainText(htmlBody);
  if (!plainBody && !htmlBody && !root.children?.length) {
    const decoded = decodeMimePartBody(root.body, headers['content-transfer-encoding']);
    if (String(contentType).toLowerCase().includes('text/html')) htmlBody = decoded;
    else plainBody = decoded;
  }

  return {
    subject: cleanEmailBody(subject, 512),
    fromEmail: cleanEmailBody(fromEmail, 512),
    messageId,
    bodyText: cleanEmailBody(plainBody, maxBytes),
    bodyHtml: sanitizeEmailHtml(cleanEmailBody(htmlBody, maxBytes)),
    attachments
  };
};

const readEmailRawText = async (message) => {
  if (!message?.raw) return '';
  const reader = message.raw.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytesToUtf8(bytes);
};

const timingSafeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};

const derivePasswordHash = async (plainPassword, saltBytes, iterations) => {
  const keyMaterial = await crypto.subtle.importKey('raw', passwordEncoder.encode(String(plainPassword || '')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    PASSWORD_KEY_BYTES * 8
  );
  return new Uint8Array(bits);
};

const isHashedPassword = (value) => {
  const parts = String(value || '').split('$');
  if (parts.length !== 4) return false;
  const [scheme, iterText, saltB64, hashB64] = parts;
  const iterations = parseInt(iterText, 10);
  if (scheme !== PASSWORD_SCHEME) return false;
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  if (!saltB64 || !hashB64) return false;
  try {
    return base64ToBytes(saltB64).length > 0 && base64ToBytes(hashB64).length > 0;
  } catch (_) {
    return false;
  }
};

const hashPassword = async (plainPassword) => {
  const saltBytes = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hashBytes = await derivePasswordHash(plainPassword, saltBytes, PASSWORD_ITERATIONS);
  return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${bytesToBase64(saltBytes)}$${bytesToBase64(hashBytes)}`;
};

const verifyPassword = async (plainPassword, storedPassword) => {
  const stored = String(storedPassword || '');
  if (!isHashedPassword(stored)) return false;
  const [scheme, iterText, saltB64, hashB64] = stored.split('$');
  if (scheme !== PASSWORD_SCHEME) return false;
  const iterations = parseInt(iterText, 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  try {
    const saltBytes = base64ToBytes(saltB64);
    const expectedHash = base64ToBytes(hashB64);
    const actualHash = await derivePasswordHash(plainPassword, saltBytes, iterations);
    return timingSafeEqual(actualHash, expectedHash);
  } catch (_) {
    return false;
  }
};

const buildCookie = (name, value, path, maxAge) =>
  `${name}=${value};HttpOnly;Secure;Path=${path};Max-Age=${maxAge};SameSite=Lax`;

const getMaxDestinationsPerUser = (cfg) => {
  const limit = parseInt(cfg.max_destinations_per_user || '3', 10);
  return Number.isFinite(limit) && limit > 0 ? limit : 3;
};

const ensureDestinationSchema = async (db) => {
  const tableMeta = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_destinations'").first();
  const tableSql = String(tableMeta?.sql || '');
  if (/user_id\s+INTEGER\s+UNIQUE/i.test(tableSql)) {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_destinations_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        cf_address_id TEXT,
        email TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        expires_at DATETIME,
        duration_hours TEXT,
        inbox_default TEXT DEFAULT 'true',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await db.prepare(`
      INSERT INTO user_destinations_v2(id,user_id,cf_address_id,email,status,expires_at,duration_hours,inbox_default,created_at)
      SELECT id,user_id,cf_address_id,email,status,expires_at,duration_hours,COALESCE(inbox_default,'true'),created_at
      FROM user_destinations
    `).run();
    await db.prepare("DROP TABLE user_destinations").run();
    await db.prepare("ALTER TABLE user_destinations_v2 RENAME TO user_destinations").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_user_destinations_user_status ON user_destinations(user_id,status)").run();
};

const ensureSystem = async (db) => {
  if (schemaReady) return;

  await db.prepare("CREATE TABLE IF NOT EXISTS invitation_codes (code TEXT PRIMARY KEY, max_uses INTEGER NOT NULL, used_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS auth_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, action TEXT NOT NULL, identifier TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();

  for (const [key, value] of DEFAULT_CONFIGS) {
    await db.prepare("INSERT OR IGNORE INTO sys_config (key, value) VALUES (?, ?)").bind(key, value).run();
  }
  await db.prepare("DELETE FROM sys_config WHERE key='expired_data_retention_days'").run();

  try { await db.prepare("ALTER TABLE user_destinations ADD COLUMN duration_hours TEXT").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE email_routes ADD COLUMN duration_hours TEXT").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE email_routes ADD COLUMN remark TEXT").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE email_routes ADD COLUMN destination_id INTEGER").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE email_routes ADD COLUMN inbox_enabled TEXT DEFAULT 'false'").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE user_destinations ADD COLUMN inbox_default TEXT DEFAULT 'true'").run(); } catch (_) {}

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS inbound_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      route_id INTEGER,
      route_address TEXT,
      from_email TEXT,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      raw_size INTEGER DEFAULT 0,
      message_id TEXT,
      forward_status TEXT,
      attachment_count INTEGER DEFAULT 0,
      attachment_status TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS inbound_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mail_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      filename TEXT,
      content_type TEXT,
      size_bytes INTEGER DEFAULT 0,
      content_id TEXT,
      disposition TEXT,
      r2_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  try { await db.prepare("ALTER TABLE inbound_emails ADD COLUMN body_html TEXT").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE inbound_emails ADD COLUMN attachment_count INTEGER DEFAULT 0").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE inbound_emails ADD COLUMN attachment_status TEXT").run(); } catch (_) {}

  await ensureDestinationSchema(db);

  await db.prepare(`
    UPDATE email_routes
    SET destination_id = (
      SELECT ud.id
      FROM user_destinations ud
      WHERE ud.user_id=email_routes.user_id AND ud.status!='expired'
      ORDER BY CASE WHEN ud.status='verified' THEN 0 ELSE 1 END, ud.id DESC
      LIMIT 1
    )
    WHERE destination_id IS NULL AND COALESCE(inbox_enabled,'false')!='true'
  `).run();

  await db.prepare("CREATE INDEX IF NOT EXISTS idx_email_routes_destination_id ON email_routes(destination_id)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_routes_active_domain_tag ON email_routes(domain_id,tag) WHERE status='active'").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_attempts_scope_created ON auth_attempts(ip,action,identifier,created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_inbound_emails_user_received ON inbound_emails(user_id,received_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_inbound_emails_route ON inbound_emails(route_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_inbound_attachments_mail_user ON inbound_attachments(mail_id,user_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_inbound_attachments_user ON inbound_attachments(user_id)").run();

  schemaReady = true;
};

const getConfigMap = async (db) => {
  const rows = (await db.prepare("SELECT key, value FROM sys_config").all()).results || [];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};

const isAuthRateLimited = async (db, action, ip, identifier) => {
  const limit = AUTH_RATE_LIMITS[action] || {max: 5, windowMinutes: 15};
  const normalized = normalizeAuthIdentifier(identifier);
  await db.prepare("DELETE FROM auth_attempts WHERE created_at<datetime('now','-1 day')").run();
  const row = await db.prepare(`
    SELECT COUNT(*) AS c
    FROM auth_attempts
    WHERE ip=? AND action=? AND identifier=?
      AND created_at>=datetime('now','-'||?||' minutes')
  `).bind(ip, action, normalized, limit.windowMinutes).first();
  return (row?.c || 0) >= limit.max;
};

const recordAuthFailure = async (db, action, ip, identifier) => {
  await db.prepare("INSERT INTO auth_attempts(ip,action,identifier) VALUES(?,?,?)")
    .bind(ip, action, normalizeAuthIdentifier(identifier)).run();
};

const clearAuthFailures = async (db, action, ip, identifier) => {
  await db.prepare("DELETE FROM auth_attempts WHERE ip=? AND action=? AND identifier=?")
    .bind(ip, action, normalizeAuthIdentifier(identifier)).run();
};

const getPendingExpiryHours = (cfg) => {
  const hours = parseInt(cfg.pending_dest_expiry_hours || '24', 10);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
};

const expireLocalForUser = async (db, env, userId, cfg) => {
  await db.prepare("DELETE FROM email_routes WHERE user_id=? AND status='expired'").bind(userId).run();
  await db.prepare("DELETE FROM user_destinations WHERE user_id=? AND status='expired'").bind(userId).run();

  const expiredRoutes = (await db.prepare("SELECT r.id,r.cf_rule_id,d.zone_id FROM email_routes r JOIN domains d ON r.domain_id=d.id WHERE r.user_id=? AND r.status='active' AND r.expires_at IS NOT NULL AND datetime(r.expires_at)<datetime('now')").bind(userId).all()).results || [];
  for (const route of expiredRoutes) {
    if(route.cf_rule_id) await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, 'expire_user_route');
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  }

  const expiredDestinations = (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND status!='expired' AND expires_at IS NOT NULL AND datetime(expires_at)<datetime('now')").bind(userId).all()).results || [];
  for (const dest of expiredDestinations) {
    await deleteDestinationById(db, env, userId, dest.id, {force: true});
  }

  const pendingHours = getPendingExpiryHours(cfg);
  const expiredPending = (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND status='pending' AND created_at<datetime('now','-'||?||' hours')").bind(userId, pendingHours).all()).results || [];
  for (const dest of expiredPending) {
    await deleteDestinationById(db, env, userId, dest.id, {force: true});
  }
};

const getPublicConfig = async (db, cfg) => {
  const codeCount = (await db.prepare("SELECT COUNT(*) AS c FROM invitation_codes").first())?.c || 0;
  return {
    allowRegistration: cfg.allow_registration === 'true',
    inviteRequired: cfg.allow_registration === 'true' && cfg.enable_invitation_code === 'true' && codeCount > 0,
    durationOptions: DURATION_OPTIONS
  };
};

const getUserState = async (db, env, userId, cfg) => {
  await expireLocalForUser(db, env, userId, cfg);

  const destinations = (await db.prepare("SELECT id,email,status,expires_at,created_at,duration_hours,COALESCE(inbox_default,'true') AS inbox_default FROM user_destinations WHERE user_id=? AND status!='expired' ORDER BY id DESC").bind(userId).all()).results || [];
  for (const destination of destinations) {
    if (destination?.status === 'pending') {
      const pendingExpiry = dbDateMs(destination.created_at) + getPendingExpiryHours(cfg) * 3600000;
      destination.pending_expires_at = sqlDateFromMs(pendingExpiry);
    }
  }

  const routes = (await db.prepare(`
    SELECT r.id, r.tag, r.expires_at, r.duration_hours, COALESCE(r.remark,'') AS remark, d.domain,
           r.destination_id, COALESCE(r.inbox_enabled,'false') AS inbox_enabled, ud.email AS destination_email
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    LEFT JOIN user_destinations ud ON ud.id=r.destination_id
    WHERE r.user_id=? AND r.status='active' AND (r.expires_at IS NULL OR datetime(r.expires_at)>datetime('now'))
    ORDER BY r.id DESC
  `).bind(userId).all()).results || [];
  for (const route of routes) {
    route.delivery_mode = routeDeliveryMode(route);
  }

  const domains = (await db.prepare("SELECT id,domain FROM domains ORDER BY domain ASC").all()).results || [];
  const maxRoutes = parseInt(cfg.max_routes_per_user || '10', 10);
  const maxDestinations = getMaxDestinationsPerUser(cfg);

  return {
    destinations,
    routes,
    domains,
    quota: {
      used: routes.length,
      max: Number.isFinite(maxRoutes) && maxRoutes >= 0 ? maxRoutes : 10,
      destinationUsed: destinations.length,
      destinationMax: maxDestinations
    },
    limits: {
      destinationMax: cfg.max_destination_duration_hours || '168',
      routeMax: cfg.max_route_duration_hours || '72'
    },
    durationOptions: DURATION_OPTIONS
  };
};

const normalizeDomain = (domain) => String(domain || '').trim().toLowerCase().replace(/\.$/, '');
const isValidDomainName = (domain) => /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
const domainBelongsToZone = (domain, zoneName) => domain === zoneName || domain.endsWith('.' + zoneName);

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const cfRequest = async (env, pathOrUrl, options = {}) => {
  const url = /^https?:\/\//i.test(String(pathOrUrl || '')) ? String(pathOrUrl) : `${CF_API_BASE}${pathOrUrl}`;
  const method = options.method || 'GET';
  const headers = {'Authorization':`Bearer ${env.CF_API_TOKEN}`, ...(options.headers || {})};
  const init = {method, headers};
  if (options.body != null) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({success: res.ok, errors: ['Cloudflare response parse failed']}));
    const ok = res.ok && data.success !== false;
    if (!ok && options.warn !== false) {
      console.warn('[cf_api_error]', JSON.stringify({
        label: options.label || '',
        method,
        status: res.status,
        url,
        errors: data.errors || data.messages || data
      }));
    }
    return {ok, status: res.status, data};
  } catch (e) {
    if (options.warn !== false) {
      console.warn('[cf_api_error]', JSON.stringify({
        label: options.label || '',
        method,
        url,
        error: e?.message || String(e)
      }));
    }
    return {ok: false, status: 0, data: {success: false, errors: [e?.message || String(e)]}};
  }
};

const cfDelete = async (pathOrUrl, env, label = 'delete') =>
  (await cfRequest(env, pathOrUrl, {method:'DELETE', label})).ok;

const cfDeleteRoute = async (env, zoneId, ruleId, label = 'delete_email_route') =>
  cfDelete(`/zones/${zoneId}/email/routing/rules/${ruleId}`, env, label);

const cfDeleteAddress = async (env, addressId, label = 'delete_email_address') =>
  cfDelete(`/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${addressId}`, env, label);

const isUniqueConstraintError = (error) => /unique|constraint/i.test(String(error?.message || error || ''));

const summarizeCfError = (data) => {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const parts = [...errors, ...messages].map((item) => {
    if (typeof item === 'string') return item;
    const code = item?.code ? `${item.code}: ` : '';
    return `${code}${item?.message || JSON.stringify(item)}`;
  }).filter(Boolean);
  if (parts.length) return parts.join('; ').slice(0, 500);
  return JSON.stringify(data || {}).slice(0, 500);
};

const summarizeEmailRouteRuleError = (data, env) => {
  const summary = summarizeCfError(data);
  if (/Workers Script Info not found/i.test(summary)) {
    const workerName = String(env.EMAIL_WORKER_NAME || '').trim() || '未配置';
    return `Cloudflare 找不到站内同步 Worker（EMAIL_WORKER_NAME 当前为 ${workerName}）。请把 EMAIL_WORKER_NAME 设置为 Workers & Pages 里的 Worker 服务名称，不要填域名、URL、路由名或变量名，并确认这个 Worker 已部署在同一个 Cloudflare 账号下。原始错误：${summary}`;
  }
  return summary;
};

const cfEnableEmailRoutingDomain = async (zoneId, domain, env) => {
  return await cfRequest(env, `/zones/${zoneId}/email/routing/dns`, {
    method: 'POST',
    body: {name: domain},
    label: 'enable_email_routing_dns'
  });
};

const getInboundRetentionDays = (cfg) => {
  const days = parseInt(cfg.inbound_mail_retention_days || '30', 10);
  return Number.isFinite(days) && days > 0 ? days : 30;
};

const getMaxInboundBodyBytes = (cfg) => {
  const bytes = parseInt(cfg.max_inbound_body_bytes || String(DEFAULT_MAX_INBOUND_BODY_BYTES), 10);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : DEFAULT_MAX_INBOUND_BODY_BYTES;
};

const getMaxInboundAttachmentBytes = (cfg) => {
  const bytes = parseInt(cfg.max_inbound_attachment_bytes || String(DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES), 10);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES;
};

const getMaxInboundTotalAttachmentBytes = (cfg) => {
  const bytes = parseInt(cfg[MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY] || String(DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES), 10);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES;
};

const getMaxInboundAttachments = (cfg) => {
  const count = parseInt(cfg[MAX_INBOUND_ATTACHMENTS_CONFIG_KEY] || String(DEFAULT_MAX_INBOUND_ATTACHMENTS), 10);
  return Number.isFinite(count) && count >= 0 ? count : DEFAULT_MAX_INBOUND_ATTACHMENTS;
};

const getMaxInboundR2StorageBytes = (cfg) => {
  const bytes = parseInt(cfg[MAX_INBOUND_R2_STORAGE_CONFIG_KEY] || String(DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES), 10);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES;
};

const getInboundAttachmentStorageUsage = async (db, env, cfg) => {
  const row = await db.prepare("SELECT COUNT(*) AS attachment_count, COALESCE(SUM(size_bytes),0) AS used_bytes FROM inbound_attachments").first();
  const usedBytes = parseInt(row?.used_bytes || '0', 10);
  const limitBytes = getMaxInboundR2StorageBytes(cfg);
  return {
    r2Bound: !!env.INBOUND_ATTACHMENTS,
    attachmentCount: parseInt(row?.attachment_count || '0', 10) || 0,
    usedBytes: Number.isFinite(usedBytes) ? usedBytes : 0,
    limitBytes,
    usagePercent: limitBytes > 0 ? Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100)) : (usedBytes > 0 ? 100 : 0)
  };
};

const buildAttachmentUrl = (mailId, attachmentId, inline = false) =>
  `/api/inbox/${mailId}/attachments/${attachmentId}${inline ? '?inline=1' : ''}`;

const rewriteCidUrls = (html, cidMap) => String(html || '').replace(/(["'(])cid:([^"')\s>]+)(["')])/gi, (match, left, cid, right) => {
  const key = stripContentId(cid);
  return cidMap[key] ? `${left}${cidMap[key]}${right}` : match;
});

const attachmentStatusText = (status) => {
  if (!status) return '';
  const parts = String(status).split(',').map((part) => part.trim()).filter((part) => part && part !== 'ok');
  if (!parts.length) return '';
  const labels = [];
  if (parts.includes('r2_missing')) labels.push('附件存储未绑定，附件未保存');
  if (parts.includes('count_limited')) labels.push('部分附件因数量超限未保存');
  if (parts.includes('size_limited')) labels.push('部分附件因大小超限未保存');
  if (parts.includes('storage_limited')) labels.push('部分旧附件因存储空间限制已自动清理');
  if (parts.includes('save_failed')) labels.push('部分附件保存失败');
  return labels.join('；');
};

const appendAttachmentStatus = (status, flag) => {
  const parts = new Set(String(status || '').split(',').map((part) => part.trim()).filter((part) => part && part !== 'ok'));
  if (flag) parts.add(flag);
  return parts.size ? Array.from(parts).join(',') : '';
};

const deleteR2Objects = async (env, keys) => {
  if (!env.INBOUND_ATTACHMENTS || !Array.isArray(keys) || !keys.length) return;
  for (const key of keys) {
    try {
      await env.INBOUND_ATTACHMENTS.delete(key);
    } catch (e) {
      console.warn('[r2_attachment_delete_error]', JSON.stringify({key, error: e?.message || String(e)}));
    }
  }
};

const deleteInboundMailById = async (db, env, userId, mailId) => {
  const mail = await db.prepare("SELECT id FROM inbound_emails WHERE id=? AND user_id=?").bind(mailId, userId).first();
  if (!mail) return false;
  const attachments = (await db.prepare("SELECT r2_key FROM inbound_attachments WHERE mail_id=? AND user_id=?").bind(mailId, userId).all()).results || [];
  await deleteR2Objects(env, attachments.map((item) => item.r2_key).filter(Boolean));
  await db.prepare("DELETE FROM inbound_attachments WHERE mail_id=? AND user_id=?").bind(mailId, userId).run();
  await db.prepare("DELETE FROM inbound_emails WHERE id=? AND user_id=?").bind(mailId, userId).run();
  return true;
};

const deleteInboundMailForUser = async (db, env, userId) => {
  const attachments = (await db.prepare("SELECT r2_key FROM inbound_attachments WHERE user_id=?").bind(userId).all()).results || [];
  await deleteR2Objects(env, attachments.map((item) => item.r2_key).filter(Boolean));
  await db.prepare("DELETE FROM inbound_attachments WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM inbound_emails WHERE user_id=?").bind(userId).run();
};

const cleanupExpiredInboundEmails = async (db, env, retentionDays) => {
  const rows = (await db.prepare("SELECT id,user_id FROM inbound_emails WHERE received_at<datetime('now','-'||?||' days')").bind(retentionDays).all()).results || [];
  for (const row of rows) {
    await deleteInboundMailById(db, env, row.user_id, row.id);
  }
};

const cleanupInboundAttachmentStorage = async (db, env, cfg) => {
  const usage = await getInboundAttachmentStorageUsage(db, env, cfg);
  if (usage.usedBytes <= usage.limitBytes) return {cleaned: 0, freedBytes: 0, ...usage};
  if (!env.INBOUND_ATTACHMENTS) return {cleaned: 0, freedBytes: 0, skipped: true, ...usage};

  const rows = (await db.prepare(`
    SELECT id,mail_id,user_id,size_bytes,r2_key
    FROM inbound_attachments
    ORDER BY datetime(created_at) ASC, id ASC
  `).all()).results || [];
  const touchedMails = new Map();
  let usedBytes = usage.usedBytes;
  let cleaned = 0;
  let freedBytes = 0;

  for (const row of rows) {
    if (usedBytes <= usage.limitBytes) break;
    const sizeBytes = parseInt(row.size_bytes || '0', 10) || 0;
    await deleteR2Objects(env, row.r2_key ? [row.r2_key] : []);
    await db.prepare("DELETE FROM inbound_attachments WHERE id=?").bind(row.id).run();
    usedBytes = Math.max(0, usedBytes - sizeBytes);
    freedBytes += sizeBytes;
    cleaned++;
    touchedMails.set(`${row.user_id}:${row.mail_id}`, {userId: row.user_id, mailId: row.mail_id});
  }

  for (const item of touchedMails.values()) {
    const row = await db.prepare("SELECT attachment_status FROM inbound_emails WHERE id=? AND user_id=?").bind(item.mailId, item.userId).first();
    if (!row) continue;
    const count = (await db.prepare("SELECT COUNT(*) AS c FROM inbound_attachments WHERE mail_id=? AND user_id=?").bind(item.mailId, item.userId).first())?.c || 0;
    await db.prepare("UPDATE inbound_emails SET attachment_count=?, attachment_status=? WHERE id=? AND user_id=?")
      .bind(count, appendAttachmentStatus(row.attachment_status, 'storage_limited'), item.mailId, item.userId).run();
  }

  return {cleaned, freedBytes, ...usage, usedBytes};
};

const saveInboundAttachments = async (db, env, cfg, mailId, userId, attachments) => {
  const items = Array.isArray(attachments) ? attachments : [];
  if (!items.length) return {count: 0, status: ''};
  if (!env.INBOUND_ATTACHMENTS) return {count: 0, status: 'r2_missing'};

  const maxCount = getMaxInboundAttachments(cfg);
  const maxItemBytes = getMaxInboundAttachmentBytes(cfg);
  const maxTotalBytes = getMaxInboundTotalAttachmentBytes(cfg);
  const status = new Set();
  const cidMap = {};
  let savedCount = 0;
  let totalBytes = 0;

  for (const item of items) {
    if (savedCount >= maxCount) {
      status.add('count_limited');
      continue;
    }
    const bytes = item.bytes instanceof Uint8Array ? item.bytes : new Uint8Array();
    if (bytes.length > maxItemBytes || totalBytes + bytes.length > maxTotalBytes) {
      status.add('size_limited');
      continue;
    }

    const filename = normalizeAttachmentFilename(item.filename, 'attachment');
    const r2Key = `${userId}/${mailId}/${crypto.randomUUID()}-${filename}`;
    try {
      await env.INBOUND_ATTACHMENTS.put(r2Key, bytes, {
        httpMetadata: {contentType: item.contentType || 'application/octet-stream'}
      });
      const inserted = await db.prepare(`
        INSERT INTO inbound_attachments(mail_id,user_id,filename,content_type,size_bytes,content_id,disposition,r2_key,created_at)
        VALUES(?,?,?,?,?,?,?,?,datetime('now'))
      `).bind(
        mailId,
        userId,
        filename,
        item.contentType || 'application/octet-stream',
        bytes.length,
        item.contentId || '',
        item.disposition || 'attachment',
        r2Key
      ).run();
      const attachmentId = inserted?.meta?.last_row_id || null;
      if (item.contentId && attachmentId) {
        cidMap[stripContentId(item.contentId)] = buildAttachmentUrl(mailId, attachmentId, true);
      }
      savedCount++;
      totalBytes += bytes.length;
    } catch (e) {
      status.add('save_failed');
      console.error('[inbound_attachment_save_error]', JSON.stringify({mailId, filename, error: e?.message || String(e)}));
      await deleteR2Objects(env, [r2Key]);
    }
  }

  return {
    count: savedCount,
    status: status.size ? Array.from(status).join(',') : (savedCount ? 'ok' : ''),
    cidMap
  };
};

const requireEmailWorkerName = (env) => {
  const raw = String(env.EMAIL_WORKER_NAME || '').trim();
  let workerName = raw;
  try {
    if (/^https?:\/\//i.test(workerName)) workerName = new URL(workerName).hostname;
  } catch (_) {}
  if (/\.workers\.dev$/i.test(workerName)) workerName = workerName.split('.')[0] || workerName;
  if (!workerName) return {ok: false, error: '请先配置 EMAIL_WORKER_NAME，才能开启站内收件箱同步'};
  return {ok: true, value: workerName};
};

const buildEmailRouteRule = (env, routeAddress, targetEmail, userId, tag, inboxEnabled) => {
  const enabled = isTruthyFlag(inboxEnabled);
  const workerName = enabled ? requireEmailWorkerName(env) : {ok: true, value: ''};
  if (!workerName.ok) return workerName;
  if (!enabled && !targetEmail) return {ok: false, error: '请选择转发目标邮箱'};
  return {
    ok: true,
    value: {
      actions: enabled
        ? [{type: 'worker', value: [workerName.value]}]
        : [{type: 'forward', value: [targetEmail]}],
      matchers: [{type: 'literal', field: 'to', value: routeAddress}],
      enabled: true,
      name: `U-${userId}-${tag}`
    }
  };
};

const cfRuleNotFound = (cf) => cf?.status === 404 || /not found|does not exist|could not find/i.test(summarizeCfError(cf?.data));

const cfRouteRuleMatchesAddress = (rule, routeAddress) => {
  const wanted = String(routeAddress || '').toLowerCase();
  return (rule?.matchers || []).some((matcher) =>
    String(matcher?.type || '').toLowerCase() === 'literal' &&
    String(matcher?.field || '').toLowerCase() === 'to' &&
    String(matcher?.value || '').toLowerCase() === wanted
  );
};

const cfFindRouteRuleIdByAddress = async (env, zoneId, routeAddress) => {
  for (let page = 1; page <= 10; page++) {
    const cf = await cfRequest(env, `/zones/${zoneId}/email/routing/rules?page=${page}&per_page=100`, {
      label: 'find_email_route_rule',
      warn: false
    });
    if (!cf.ok) return null;
    const found = (cf.data?.result || []).find((rule) => cfRouteRuleMatchesAddress(rule, routeAddress));
    if (found?.id) return found.id;
    const totalPages = parseInt(cf.data?.result_info?.total_pages || '1', 10);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
  }
  return null;
};

const cfCreateRouteRule = async (env, zoneId, rulePayload, label = 'create_email_route_rule') =>
  cfRequest(env, `/zones/${zoneId}/email/routing/rules`, {
    method: 'POST',
    body: rulePayload,
    label
  });

const cfSyncRouteRule = async (env, route, routeAddress, rulePayload, label = 'sync_email_route_rule') => {
  const zoneId = route.zone_id;
  if (route.cf_rule_id && route.status === 'active') {
    const updated = await cfRequest(env, `/zones/${zoneId}/email/routing/rules/${route.cf_rule_id}`, {
      method: 'PUT',
      body: rulePayload,
      label
    });
    if (updated.ok) return {ok: true, ruleId: route.cf_rule_id, data: updated.data};
    if (!cfRuleNotFound(updated)) return updated;
  }

  const existingRuleId = await cfFindRouteRuleIdByAddress(env, zoneId, routeAddress);
  if (existingRuleId) {
    const updated = await cfRequest(env, `/zones/${zoneId}/email/routing/rules/${existingRuleId}`, {
      method: 'PUT',
      body: rulePayload,
      label: `${label}_found_existing`
    });
    if (updated.ok) return {ok: true, ruleId: existingRuleId, data: updated.data};
    if (!cfRuleNotFound(updated)) return updated;
  }

  const created = await cfCreateRouteRule(env, zoneId, rulePayload, `${label}_create_missing`);
  if (created.ok && created.data?.result?.id) return {ok: true, ruleId: created.data.result.id, data: created.data};
  return created;
};

const runTimedCleanup = async (db, env, cfg) => {
  const eR = await db.prepare("SELECT r.*,d.zone_id FROM email_routes r JOIN domains d ON r.domain_id=d.id WHERE r.expires_at IS NOT NULL AND datetime(r.expires_at)<datetime('now') AND r.status='active'").all();
  for (const r of eR.results || []) {
    if (r.cf_rule_id) await cfDeleteRoute(env, r.zone_id, r.cf_rule_id, 'scheduled_expire_route');
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(r.id).run();
  }

  const eD = await db.prepare("SELECT id,user_id FROM user_destinations WHERE expires_at IS NOT NULL AND datetime(expires_at)<datetime('now') AND status!='expired'").all();
  for(let d of eD.results){
    await deleteDestinationById(db, env, d.user_id, d.id, {force: true});
  }

  const pH = getPendingExpiryHours(cfg);
  const eP = await db.prepare("SELECT id,user_id FROM user_destinations WHERE status='pending' AND created_at<datetime('now','-'||?||' hours')").bind(pH).all();
  for(let d of eP.results){ await deleteDestinationById(db, env, d.user_id, d.id, {force: true}); }

  const zH = parseInt(cfg.unverified_user_expiry_hours || '24', 10);
  const zs = await db.prepare("SELECT id FROM users WHERE created_at<datetime('now','-'||?||' hours') AND id NOT IN (SELECT user_id FROM user_destinations WHERE status!='expired')").bind(zH).all();
  for(let z of zs.results){ await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(z.id).run(); await db.prepare("DELETE FROM users WHERE id=?").bind(z.id).run(); }

  await db.prepare("DELETE FROM email_routes WHERE status='expired'").run();
  await db.prepare("DELETE FROM user_destinations WHERE status='expired'").run();
  await db.prepare("DELETE FROM sessions WHERE expires_at<datetime('now')").run();
  await db.prepare("DELETE FROM sessions WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)").run();
  await db.prepare("DELETE FROM auth_attempts WHERE created_at<datetime('now','-1 day')").run();
  await cleanupExpiredInboundEmails(db, env, getInboundRetentionDays(cfg));
  await cleanupInboundAttachmentStorage(db, env, cfg);
};

const deleteRouteById = async (db, env, routeId, userId) => {
  const route = await db.prepare(`
    SELECT r.id,r.cf_rule_id,r.status,d.zone_id
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    WHERE r.id=? AND r.user_id=?
  `).bind(routeId, userId).first();
  if (!route) return false;
  if (route.cf_rule_id && route.status === 'active') {
    await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, 'delete_user_route');
  }
  await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  return true;
};

const deleteUserRoutes = async (db, env, userId) => {
  const routes = (await db.prepare(`
    SELECT r.id,r.cf_rule_id,d.zone_id
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    WHERE r.user_id=? AND r.status='active'
  `).bind(userId).all()).results || [];
  for (const route of routes) {
    if (route.cf_rule_id) await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, 'delete_user_account_route');
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  }
  return routes.length;
};

const deleteDestinationById = async (db, env, userId, destinationId, options = {}) => {
  const force = options.force === true;
  const dest = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, userId).first();
  if (!dest) return {ok: false, reason: 'not_found'};

  const activeRouteCount = (await db.prepare("SELECT COUNT(*) AS c FROM email_routes WHERE destination_id=? AND user_id=? AND status='active' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(destinationId, userId).first())?.c || 0;
  if (!force && activeRouteCount > 0) return {ok: false, reason: 'in_use', routeCount: activeRouteCount};

  const boundRoutes = (await db.prepare(`
    SELECT r.id,r.cf_rule_id,d.zone_id
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    WHERE r.user_id=? AND r.destination_id=?
  `).bind(userId, destinationId).all()).results || [];
  for (const route of boundRoutes) {
    if (route.cf_rule_id) await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, 'delete_destination_bound_route');
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  }

  if (dest.cf_address_id) {
    await cfDeleteAddress(env, dest.cf_address_id, 'delete_destination_address');
  }
  await db.prepare("DELETE FROM user_destinations WHERE id=?").bind(dest.id).run();
  await db.prepare("UPDATE email_routes SET destination_id=NULL WHERE destination_id=?").bind(destinationId).run();
  return {ok: true};
};

const deleteUserDestination = async (db, env, userId, destinationId) => {
  if (!Number.isFinite(parseInt(destinationId, 10))) return false;
  const result = await deleteDestinationById(db, env, userId, parseInt(destinationId, 10), {force: false});
  return result.ok ? true : result;
};

const deleteUserAccount = async (db, env, userId) => {
  const destinations = (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND status!='expired'").bind(userId).all()).results || [];
  for (const destination of destinations) {
    await deleteDestinationById(db, env, userId, destination.id, {force: true});
  }
  await deleteUserRoutes(db, env, userId);
  await deleteInboundMailForUser(db, env, userId);
  await db.prepare("DELETE FROM email_routes WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM user_destinations WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
};

const handleInboundEmail = async (message, env) => {
  if (!env.DB) {
    message.setReject('Database binding missing');
    return;
  }
  const db = env.DB;
  await ensureSystem(db);
  const cfg = await getConfigMap(db);
  const toAddress = normalizeMailAddress(message.to);
  const route = await db.prepare(`
    SELECT r.id AS route_id, r.user_id, r.tag, r.expires_at, COALESCE(r.inbox_enabled,'false') AS inbox_enabled,
           d.domain, ud.email AS destination_email, ud.status AS destination_status, ud.expires_at AS destination_expires_at
    FROM email_routes r
    JOIN domains d ON d.id=r.domain_id
    LEFT JOIN user_destinations ud ON ud.id=r.destination_id
    WHERE lower(r.tag || '@' || d.domain)=? AND r.status='active'
    LIMIT 1
  `).bind(toAddress).first();

  if (!route || !isTruthyFlag(route.inbox_enabled)) {
    message.setReject('Unknown recipient');
    return;
  }
  if (route.expires_at && dbDateMs(route.expires_at) <= Date.now()) {
    message.setReject('Route expired');
    return;
  }
  const shouldForward = !!route.destination_email;
  if (shouldForward && (route.destination_status !== 'verified' || (route.destination_expires_at && dbDateMs(route.destination_expires_at) <= Date.now()))) {
    message.setReject('Destination unavailable');
    return;
  }

  const routeAddress = `${route.tag}@${route.domain}`;
  let saved = false;
  let savedMailId = null;
  let saveError = '';
  try {
    const rawText = await readEmailRawText(message);
    const parsed = extractEmailContent(rawText, getMaxInboundBodyBytes(cfg));
    const savedResult = await db.prepare(`
      INSERT INTO inbound_emails(user_id,route_id,route_address,from_email,subject,body_text,body_html,raw_size,message_id,forward_status,attachment_count,attachment_status,received_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).bind(
      route.user_id,
      route.route_id,
      routeAddress,
      parsed.fromEmail || String(message.from || '').slice(0, 512),
      parsed.subject || '(无主题)',
      parsed.bodyText || '(无法提取正文)',
      parsed.bodyHtml || '',
      Number(message.rawSize || rawText.length || 0),
      parsed.messageId || '',
      shouldForward ? 'pending_forward' : 'stored',
      0,
      ''
    ).run();
    savedMailId = savedResult?.meta?.last_row_id || null;
    if (savedMailId) {
      const attachmentResult = await saveInboundAttachments(db, env, cfg, savedMailId, route.user_id, parsed.attachments);
      const bodyHtml = attachmentResult.cidMap ? rewriteCidUrls(parsed.bodyHtml || '', attachmentResult.cidMap) : (parsed.bodyHtml || '');
      await db.prepare("UPDATE inbound_emails SET body_html=?, attachment_count=?, attachment_status=? WHERE id=?")
        .bind(bodyHtml, attachmentResult.count || 0, attachmentResult.status || '', savedMailId).run();
    }
    saved = true;
  } catch (e) {
    saveError = e?.message || String(e);
    console.error('[inbound_email_save_error]', JSON.stringify({to: routeAddress, routeId: route.route_id, error: saveError}));
  }
  if (!saved) {
    message.setReject('Delivery failed');
    return;
  }
  if (!shouldForward) return;

  try {
    await message.forward(route.destination_email);
    if (savedMailId) {
      await db.prepare("UPDATE inbound_emails SET forward_status='forwarded' WHERE id=?").bind(savedMailId).run();
    } else {
      await db.prepare("UPDATE inbound_emails SET forward_status='forwarded' WHERE id=(SELECT id FROM inbound_emails WHERE user_id=? AND route_id=? ORDER BY id DESC LIMIT 1)")
        .bind(route.user_id, route.route_id).run();
    }
  } catch (e) {
    const forwardError = e?.message || String(e);
    console.error('[inbound_email_forward_error]', JSON.stringify({to: routeAddress, routeId: route.route_id, error: forwardError}));
    if (savedMailId) {
      await db.prepare("UPDATE inbound_emails SET forward_status=? WHERE id=?")
        .bind(`forward_failed: ${forwardError}`.slice(0, 255), savedMailId).run();
    } else {
      await db.prepare("UPDATE inbound_emails SET forward_status=? WHERE id=(SELECT id FROM inbound_emails WHERE user_id=? AND route_id=? ORDER BY id DESC LIMIT 1)")
        .bind(`forward_failed: ${forwardError}`.slice(0, 255), route.user_id, route.route_id).run();
    }
  }
};

// ==========================================
// 1. 普通用户网页 HTML
// ==========================================
const renderUserHTML = (sitekey, bypassTurnstile = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>云端邮件路由系统</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${bypassTurnstile ? '' : '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'}
    <script>(function(){var k='themePreference';var p='system';try{p=localStorage.getItem(k)||'system';}catch(_){}if(['system','light','dark'].indexOf(p)<0)p='system';var dark=p==='dark'||(p==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.themePreference=p;})();</script>
    <style>
html,body{height:100%}:root{color-scheme:dark;--app-bg:#030712;--panel-bg:#111827;--card-bg:rgba(17,24,39,.6);--field-bg:#030712;--border:#1f2937;--border-strong:#374151;--text:#e5e7eb;--text-strong:#f9fafb;--muted:#9ca3af;--muted-soft:#6b7280;--hover:#1f2937;--row:#03071299;--row-hover:#111827b3;--overlay:rgba(3,7,18,.8)}html[data-theme="light"]{color-scheme:light;--app-bg:#f8fafc;--panel-bg:#fff;--card-bg:#fff;--field-bg:#fff;--border:#e5e7eb;--border-strong:#d1d5db;--text:#111827;--text-strong:#030712;--muted:#4b5563;--muted-soft:#6b7280;--hover:#f3f4f6;--row:#fff;--row-hover:#f9fafb;--overlay:rgba(15,23,42,.42)}body{background:var(--app-bg)!important;color:var(--text)!important}.fade-in{animation:fadeIn .25s ease-out}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.theme-toggle{background:var(--field-bg);border-color:var(--border-strong);color:var(--muted)}.theme-toggle:hover{background:var(--hover);color:var(--text-strong)}.email-html{color:var(--text);line-height:1.6;font-size:14px}.email-html img{max-width:100%;height:auto}.email-html table{max-width:100%;overflow:auto}.email-html a{color:#059669;text-decoration:underline}.email-html blockquote{border-left:3px solid var(--border-strong);margin-left:0;padding-left:12px;color:var(--muted)}html[data-theme="light"] .bg-gray-950{background-color:var(--app-bg)!important}html[data-theme="light"] .bg-gray-900{background-color:var(--panel-bg)!important}html[data-theme="light"] .bg-gray-900\/60,html[data-theme="light"] .bg-gray-900\/40,html[data-theme="light"] .bg-gray-900\/80,html[data-theme="light"] .bg-gray-950\/60,html[data-theme="light"] .bg-gray-800{background-color:var(--card-bg)!important}html[data-theme="light"] .bg-gray-950\/80{background-color:var(--overlay)!important}html[data-theme="light"] .bg-gray-700{background-color:#f3f4f6!important}html[data-theme="light"] .bg-gray-600{background-color:#e5e7eb!important}html[data-theme="light"] .hover\:bg-gray-900\/70:hover,html[data-theme="light"] .hover\:bg-gray-800:hover,html[data-theme="light"] .hover\:bg-gray-700:hover,html[data-theme="light"] .hover\:bg-gray-600:hover{background-color:var(--hover)!important}html[data-theme="light"] .text-white,html[data-theme="light"] .text-gray-200,html[data-theme="light"] .text-gray-300{color:var(--text-strong)!important}html[data-theme="light"] .text-gray-400{color:var(--muted)!important}html[data-theme="light"] .text-gray-500,html[data-theme="light"] .text-gray-600{color:var(--muted-soft)!important}html[data-theme="light"] .hover\:text-white:hover{color:var(--text-strong)!important}html[data-theme="light"] .border-gray-800,html[data-theme="light"] .border-gray-700,html[data-theme="light"] .border-gray-600{border-color:var(--border)!important}html[data-theme="light"] .divide-gray-800>:not([hidden])~:not([hidden]),html[data-theme="light"] .divide-gray-700>:not([hidden])~:not([hidden]){border-color:var(--border)!important}html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{background-color:var(--field-bg)!important;color:var(--text-strong)!important;border-color:var(--border-strong)!important}html[data-theme="light"] input::placeholder{color:#9ca3af!important}html[data-theme="light"] .bg-emerald-600,html[data-theme="light"] .hover\:bg-emerald-500:hover{background-color:#6366f1!important}html[data-theme="light"] .bg-emerald-600.text-white,html[data-theme="light"] button.bg-emerald-600,html[data-theme="light"] .bg-blue-600.text-white,html[data-theme="light"] button.bg-blue-600{color:#fff!important}html[data-theme="light"] .text-emerald-400,html[data-theme="light"] .text-emerald-300,html[data-theme="light"] .text-emerald-200{color:#6366f1!important}html[data-theme="light"] .border-emerald-400,html[data-theme="light"] .border-emerald-500{border-color:#6366f1!important}html[data-theme="light"] .bg-emerald-900\/20,html[data-theme="light"] .bg-emerald-900\/30,html[data-theme="light"] .bg-emerald-950\/40{background-color:#eef2ff!important}html[data-theme="light"] .border-emerald-700\/50,html[data-theme="light"] .border-emerald-800{border-color:#c7d2fe!important}html[data-theme="light"] .bg-blue-900\/20,html[data-theme="light"] .bg-blue-600\/20{background-color:#eff6ff!important}html[data-theme="light"] .hover\:bg-blue-600\/40:hover{background-color:#dbeafe!important}html[data-theme="light"] .bg-rose-900\/50{background-color:#fff1f2!important}html[data-theme="light"] .hover\:bg-rose-900\/80:hover{background-color:#ffe4e6!important}html[data-theme="light"] .text-rose-300,html[data-theme="light"] .text-rose-200{color:#be123c!important}html[data-theme="light"] .border-rose-800,html[data-theme="light"] .border-rose-900\/70{border-color:#fecdd3!important}html[data-theme="light"] .bg-amber-900\/20,html[data-theme="light"] .bg-amber-900\/30,html[data-theme="light"] .bg-amber-900\/40{background-color:#fffbeb!important}html[data-theme="light"] .text-amber-300,html[data-theme="light"] .text-amber-200{color:#92400e!important}html[data-theme="light"] .border-amber-800,html[data-theme="light"] .border-amber-700,html[data-theme="light"] .border-amber-700\/50{border-color:#fde68a!important}
html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{color-scheme:light}
html[data-theme="light"]{--app-bg:#f0f2f5;--panel-bg:#fff;--card-bg:#fff;--field-bg:#fff;--border:#e5e7eb;--border-strong:#d1d5db;--text:#1f2937;--text-strong:#111827;--muted:#6b7280;--muted-soft:#9ca3af;--hover:#f3f4f6;--overlay:rgba(15,23,42,.42)}html[data-theme="light"] body{background:#f0f2f5!important;color:#1f2937!important}html[data-theme="light"] .bg-emerald-600,html[data-theme="light"] .hover\:bg-emerald-500:hover{background-color:#6366f1!important}html[data-theme="light"] .text-emerald-500,html[data-theme="light"] .text-emerald-400,html[data-theme="light"] .text-emerald-300,html[data-theme="light"] .text-emerald-200{color:#6366f1!important}html[data-theme="light"] .border-emerald-400,html[data-theme="light"] .border-emerald-500{border-color:#6366f1!important}html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{background-color:#fff!important;border-color:#d1d5db!important;color:#1f2937!important}html[data-theme="light"] input:focus,html[data-theme="light"] select:focus,html[data-theme="light"] textarea:focus{border-color:#6366f1!important;box-shadow:0 0 0 1px rgba(99,102,241,.2)!important}html[data-theme="light"] #auth-panel,html[data-theme="light"] #booting-panel{background:#fff!important;border-color:#e5e7eb!important;box-shadow:0 18px 45px rgba(0,0,0,.08)!important}html[data-theme="light"] .theme-toggle,html[data-theme="light"] button.bg-gray-800,html[data-theme="light"] button.bg-gray-700{background:#fff!important;color:#6b7280!important;border-color:#d1d5db!important}html[data-theme="light"] .theme-toggle:hover,html[data-theme="light"] button.hover\:bg-gray-700:hover,html[data-theme="light"] button.hover\:bg-gray-600:hover{background:#f3f4f6!important;color:#1f2937!important;border-color:#d1d5db!important}html[data-theme="light"] .dashboard-nav{background:transparent!important;border:0!important;border-bottom:2px solid transparent!important;color:#6b7280!important}html[data-theme="light"] .dashboard-nav:hover{background:transparent!important;color:#1f2937!important;border-bottom-color:#d1d5db!important}html[data-theme="light"] .dashboard-nav.bg-gray-800,html[data-theme="light"] .dashboard-nav.bg-gray-800:hover{background:transparent!important;color:#6366f1!important;border:0!important;border-bottom:2px solid #6366f1!important}html[data-theme="light"] .settings-nav.text-emerald-300{color:#6366f1!important}html[data-theme="light"] .settings-nav.border-emerald-400{border-color:#6366f1!important}html[data-theme="light"] .bg-rose-900\/50,html[data-theme="light"] .hover\:bg-rose-900\/80:hover{background-color:#fef2f2!important}html[data-theme="light"] .text-rose-300,html[data-theme="light"] .text-rose-200{color:#dc2626!important}html[data-theme="light"] .border-rose-800,html[data-theme="light"] .border-rose-900\/70{border-color:#fecaca!important}
html[data-theme="light"] aside.bg-gray-950{background:#fff!important;border-color:#e5e7eb!important;padding:18px 14px!important}html[data-theme="light"] aside .dashboard-nav{position:relative!important;width:100%!important;padding:10px 16px!important;border:0!important;border-bottom:0!important;background:transparent!important;color:#6b7280!important;font-weight:500!important}html[data-theme="light"] aside .dashboard-nav:hover{background:transparent!important;color:#1f2937!important;border:0!important;border-bottom:0!important}html[data-theme="light"] aside .dashboard-nav.bg-gray-800,html[data-theme="light"] aside .dashboard-nav.bg-gray-800:hover{background:transparent!important;color:#6366f1!important;border:0!important;border-bottom:0!important}html[data-theme="light"] aside .dashboard-nav.bg-gray-800::after{content:"";position:absolute;right:8px;top:50%;width:4px;height:4px;border-radius:999px;background:#6366f1;transform:translateY(-50%)}html[data-theme="light"] .md\:hidden .dashboard-nav.bg-gray-800{border-bottom:2px solid #6366f1!important}
html[data-theme="light"] main.bg-gray-950,html[data-theme="light"] #dashboard-section-security,html[data-theme="light"] #dashboard-section-routes,html[data-theme="light"] #dashboard-section-inbox,html[data-theme="light"] #dashboard-section-inbox>div{background:#f0f2f5!important}html[data-theme="light"] #dashboard-section-security .bg-gray-900\/60,html[data-theme="light"] #dashboard-section-security .bg-gray-950\/60,html[data-theme="light"] #dashboard-section-routes .bg-gray-900\/60,html[data-theme="light"] #dashboard-section-routes .bg-gray-950\/60,html[data-theme="light"] #destination-list>div,html[data-theme="light"] #route-list>div{background:#fff!important}html[data-theme="light"] #destination-list>div:hover,html[data-theme="light"] #route-list>div:hover{background:#f3f4f6!important}
    </style>
</head>
<body class="bg-gray-950 text-gray-200 font-sans min-h-screen overflow-hidden">
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2"></div>

    <div id="booting-panel" class="fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-gray-900 rounded-lg p-6 border border-gray-800 text-center text-gray-300 fade-in">
        正在检查登录状态...
    </div>

    <div id="auth-panel" class="hidden fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-gray-900 rounded-lg p-6 border border-gray-800 fade-in">
        <div class="flex border-b border-gray-800 mb-5">
            <button type="button" class="w-1/2 pb-3 font-bold text-center text-emerald-400 border-b-2 border-emerald-500 transition-all" id="tab-login" onclick="switchTab('login')">用户登录</button>
            <button type="button" class="w-1/2 pb-3 font-medium text-center text-gray-500 hover:text-gray-300 transition-all border-b border-transparent" id="tab-register" onclick="switchTab('register')">注册账号</button>
        </div>
        <form id="auth-form" onsubmit="handleAuth(event)" class="space-y-3">
            <input type="text" id="username" class="w-full px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="用户名" required>
            <input type="password" id="password" class="w-full px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="密码" required>
            <div id="invite-wrap" class="hidden">
                <input type="text" id="invite-code" class="w-full px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="邀请码">
            </div>
            ${bypassTurnstile
                ? '<div class="py-2 px-3 rounded-lg border border-amber-800 bg-amber-900/30 text-amber-300 text-xs">Turnstile is temporarily bypassed for troubleshooting. Disable TURNSTILE_BYPASS after recovery.</div>'
                : `<div class="cf-turnstile flex justify-center py-2" data-sitekey="${sitekey}"></div>`
            }
            <button type="submit" id="submit-btn" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-md transition-colors active:scale-[0.99]">登 录</button>
        </form>
    </div>

    <div id="dashboard-panel" class="hidden bg-gray-950 w-full h-screen overflow-hidden fade-in flex flex-col">
        <div class="bg-gray-950 px-3 md:px-4 py-2 border-b border-gray-800 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h2 class="text-sm font-semibold text-white flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>云端邮箱</h2>
                <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    <span id="dashboard-route-summary">专属邮箱 0 / 0</span>
                    <span id="dashboard-dest-summary">底层收件箱 0 / 0</span>
                </div>
            </div>
            <div class="self-start md:self-center flex items-center gap-2">
                <button type="button" id="theme-toggle" onclick="toggleThemePreference()" class="theme-toggle text-xs px-2.5 py-1.5 rounded-md border transition-colors">主题：跟随系统</button>
                <button onclick="logout()" class="text-gray-400 hover:text-white text-xs">退出</button>
            </div>
        </div>
        <div class="md:hidden border-b border-gray-800 bg-gray-950 overflow-x-auto">
            <div class="flex gap-1 px-2 py-2 min-w-max">
                <button type="button" data-dashboard-section="inbox" onclick="switchDashboardSection('inbox')" class="dashboard-nav px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors">站内收件箱</button>
                <button type="button" data-dashboard-section="routes" onclick="switchDashboardSection('routes')" class="dashboard-nav px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors">专属邮箱</button>
                <button type="button" data-dashboard-section="security" onclick="switchDashboardSection('security')" class="dashboard-nav px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors">设置</button>
            </div>
        </div>
        <div class="flex flex-1 min-h-0">
            <aside class="hidden md:flex w-44 shrink-0 border-r border-gray-800 bg-gray-950 p-2 flex-col gap-1">
                <button type="button" data-dashboard-section="inbox" onclick="switchDashboardSection('inbox')" class="dashboard-nav text-left px-3 py-2 rounded-md text-sm transition-colors">站内收件箱</button>
                <button type="button" data-dashboard-section="routes" onclick="switchDashboardSection('routes')" class="dashboard-nav text-left px-3 py-2 rounded-md text-sm transition-colors">专属邮箱</button>
                <button type="button" data-dashboard-section="security" onclick="switchDashboardSection('security')" class="dashboard-nav text-left px-3 py-2 rounded-md text-sm transition-colors">设置</button>
            </aside>
            <main class="flex-1 min-w-0 overflow-hidden bg-gray-950">
            <section id="dashboard-section-routes" class="dashboard-section hidden h-full overflow-y-auto">
            <div class="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 class="text-xl font-semibold text-white">专属邮箱</h3>
                        <div id="route-quota" class="mt-1 text-xs text-gray-400"></div>
                    </div>
                    <button type="button" id="route-create-open-btn" onclick="openRouteCreate()" class="self-start sm:self-center bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">创建专属邮箱</button>
                </div>
                <div class="bg-gray-900/60 rounded-md border border-gray-800">
                    <div class="p-3 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center gap-2">
                        <input type="text" id="route-search" class="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="搜索专属邮箱 / 备注 / 目标邮箱">
                        <button type="button" id="route-search-clear" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-md transition-colors whitespace-nowrap">清空</button>
                        <div id="route-search-count" class="text-xs text-gray-500 sm:text-right sm:min-w-[120px]">0 / 0</div>
                    </div>
                    <div id="route-list" class="divide-y divide-gray-800 text-sm"></div>
                </div>
            </div>
            <div id="route-create-modal" class="hidden fixed inset-0 z-40 bg-gray-950/80 p-4 md:p-6 overflow-y-auto">
                <div class="min-h-full flex items-center justify-center">
                    <div class="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-md shadow-2xl">
                        <div class="px-4 py-3 border-b border-gray-800 flex items-start justify-between gap-3">
                            <div>
                                <h4 class="text-white font-semibold">创建专属邮箱</h4>
                                <p class="text-xs text-gray-500 mt-1">选择域名、有效期和投递方式。</p>
                            </div>
                            <button type="button" onclick="closeRouteCreate()" class="text-gray-500 hover:text-white text-xl leading-none">×</button>
                        </div>
                        <form onsubmit="handleRoute(event)" class="p-4 space-y-3">
                            <div class="flex w-full min-w-0 shadow-sm rounded-md">
                                <input type="text" id="route-prefix" class="w-1/2 min-w-[120px] px-3 py-2 bg-gray-950 border border-r-0 border-gray-800 rounded-l-md text-white text-sm outline-none" placeholder="前缀，如 admin" required>
                                <span class="inline-flex items-center px-2 border-y border-gray-800 bg-gray-900 text-gray-500 text-sm">@</span>
                                <select id="route-domain" class="w-1/2 min-w-0 px-3 py-2 bg-gray-950 border border-l-0 border-gray-800 rounded-r-md text-white text-sm outline-none"></select>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <select id="route-duration" class="min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none"></select>
                                <select id="route-delivery-mode" class="min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none">
                                    <option value="inbox_only">仅站内收件箱</option>
                                    <option value="inbox_forward">站内收件箱 + 保底转发</option>
                                    <option value="forward_only">仅转发到邮箱</option>
                                </select>
                            </div>
                            <select id="route-destination" class="w-full min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none"></select>
                            <input type="text" id="route-remark" maxlength="100" class="w-full min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none" placeholder="用途备注（可选）">
                            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                                <button type="button" onclick="closeRouteCreate()" class="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-md text-sm transition-colors">取消</button>
                                <button type="submit" id="route-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">创建</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div id="route-edit-modal" class="hidden fixed inset-0 z-40 bg-gray-950/80 p-4 md:p-6 overflow-y-auto">
                <div class="min-h-full flex items-center justify-center">
                    <div class="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-md shadow-2xl">
                        <div class="px-4 py-3 border-b border-gray-800 flex items-start justify-between gap-3">
                            <div>
                                <h4 class="text-white font-semibold">编辑专属邮箱</h4>
                                <p id="edit-route-address" class="text-xs text-emerald-300 font-mono mt-1 break-all"></p>
                            </div>
                            <button type="button" onclick="closeRouteEdit()" class="text-gray-500 hover:text-white text-xl leading-none">×</button>
                        </div>
                        <form onsubmit="saveRouteEdit(event)" class="p-4 space-y-3">
                            <input type="hidden" id="edit-route-id">
                            <label class="block">
                                <span class="block text-xs text-gray-400 mb-1">投递方式</span>
                                <select id="edit-route-delivery-mode" onchange="toggleRouteEditTarget()" class="w-full min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none">
                                    <option value="inbox_only">仅站内收件箱</option>
                                    <option value="inbox_forward">站内收件箱 + 保底转发</option>
                                    <option value="forward_only">仅转发到邮箱</option>
                                </select>
                            </label>
                            <label id="edit-route-destination-wrap" class="block">
                                <span class="block text-xs text-gray-400 mb-1">目标邮箱</span>
                                <select id="edit-route-destination" class="w-full min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none"></select>
                                <span id="edit-route-destination-empty" class="hidden mt-1 text-xs text-rose-300">无可用目标邮箱，请先到设置里添加并验证底层收件箱。</span>
                            </label>
                            <label class="block">
                                <span class="block text-xs text-gray-400 mb-1">用途备注</span>
                                <input type="text" id="edit-route-remark" maxlength="100" class="w-full min-w-0 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none" placeholder="用途备注（可选）">
                            </label>
                            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                                <button type="button" onclick="closeRouteEdit()" class="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-md text-sm transition-colors">取消</button>
                                <button type="submit" id="edit-route-save-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            </section>
            <section id="dashboard-section-inbox" class="dashboard-section h-full">
            <div class="h-full flex flex-col bg-gray-950">
                <div class="px-3 py-2 border-b border-gray-800 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h3 class="text-emerald-400 font-bold mb-2">站内收件箱</h3>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <input type="text" id="inbox-search" class="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="搜索发件人 / 主题 / 正文">
                        <button type="button" onclick="loadInbox(1)" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap">搜索</button>
                        <button type="button" onclick="refreshInboxNow()" class="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap">刷新</button>
                    </div>
                </div>
                <div id="inbox-layout" class="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] gap-0 flex-1 min-h-0">
                    <div id="inbox-list-panel" class="bg-gray-950 border-r border-gray-800 overflow-hidden flex flex-col min-h-0 h-full">
                        <div class="px-3 py-2 border-b border-gray-800 flex items-center justify-between gap-2 text-xs text-gray-500">
                            <span id="inbox-page-info">第 1 页</span>
                            <span id="inbox-refresh-info">自动刷新中</span>
                        </div>
                        <div id="inbox-list" class="divide-y divide-gray-800 text-sm flex-1 min-h-0 overflow-y-auto"></div>
                        <div class="px-3 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
                            <button onclick="changeInboxPage(-1)" class="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors text-gray-200">上一页</button>
                            <button onclick="changeInboxPage(1)" class="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors text-gray-200">下一页</button>
                        </div>
                    </div>
                    <div id="inbox-detail" class="hidden lg:flex bg-gray-950 min-h-0 h-full p-4 items-center justify-center text-sm text-gray-500">选择一封邮件查看正文</div>
                </div>
            </div>
            </section>
            <section id="dashboard-section-security" class="dashboard-section hidden h-full overflow-y-auto">
            <div class="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
                <div>
                    <h3 class="text-xl font-semibold text-white">设置</h3>
                    <div class="mt-4 border-b border-gray-800 flex gap-4 overflow-x-auto">
                        <button type="button" data-settings-section="destinations" onclick="switchSettingsSection('destinations')" class="settings-nav shrink-0 px-1 pb-2 border-b-2 border-transparent text-sm transition-colors">底层收件箱</button>
                        <button type="button" data-settings-section="security" onclick="switchSettingsSection('security')" class="settings-nav shrink-0 px-1 pb-2 border-b-2 border-transparent text-sm transition-colors">账号安全</button>
                    </div>
                </div>
                <div id="settings-section-destinations" class="settings-section space-y-4">
                    <div class="bg-gray-900/60 rounded-md p-4 border border-gray-800">
                        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                            <div>
                                <h4 class="text-white font-semibold">绑定底层收件箱</h4>
                                <p class="text-xs text-gray-400 mt-1">可选绑定真实邮箱，用于保底转发或仅转发；仅站内收件箱无需绑定。</p>
                            </div>
                            <div id="dest-summary" class="text-xs text-gray-400 md:text-right"></div>
                        </div>
                        <form onsubmit="handleDest(event)" class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,1fr)_140px_120px] gap-3">
                            <input type="email" id="dest-email" class="px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="如: real-email@qq.com" required>
                            <select id="dest-duration" class="px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm outline-none"></select>
                            <button type="submit" id="dest-btn" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors md:col-span-2 lg:col-span-1">发送验证</button>
                        </form>
                    </div>
                    <div class="bg-gray-900/60 rounded-md border border-gray-800">
                        <div class="px-4 py-3 border-b border-gray-800">
                            <h4 class="text-white font-semibold">已绑定邮箱</h4>
                        </div>
                        <div id="destination-list" class="divide-y divide-gray-800 text-sm"></div>
                    </div>
                </div>
                <div id="settings-section-security" class="settings-section hidden space-y-4 max-w-3xl">
                    <div class="bg-gray-900/60 rounded-md p-4 border border-gray-800">
                        <h4 class="text-white font-semibold mb-3">修改密码</h4>
                        <form onsubmit="changePassword(event)" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="password" id="old-password" class="px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="当前密码" required>
                            <input type="password" id="new-password" class="px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="新密码" required>
                            <button type="submit" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors md:col-span-2">修改密码</button>
                        </form>
                    </div>
                    <div class="bg-gray-900/60 rounded-md p-4 border border-rose-900/70">
                        <h4 class="text-rose-200 font-semibold mb-3">注销账号</h4>
                        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-3">
                            <input type="password" id="delete-account-password" class="px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white text-sm focus:ring-1 focus:ring-rose-500 outline-none" placeholder="输入当前密码确认注销账号">
                            <button onclick="deleteAccount()" class="bg-rose-900/50 hover:bg-rose-900/80 text-rose-200 border border-rose-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">注销账号</button>
                        </div>
                    </div>
                </div>
            </div>
            </section>
            </main>
        </div>
    </div>

    <script>
        var mode = 'login';
        var TURNSTILE_BYPASS = ${bypassTurnstile ? 'true' : 'false'};
        var publicConfig = { allowRegistration: true, inviteRequired: false, durationOptions: [] };
        var dashboardState = null;
        var routeSearchKeyword = '';
        var editingRouteId = null;
        var inboxPage = 1;
        var inboxRouteId = '';
        var inboxSelectedMailId = null;
        var inboxMobileView = 'list';
        var inboxAutoRefreshTimer = null;
        var inboxLoading = false;
        var activeDashboardSection = 'inbox';
        var activeSettingsSection = 'destinations';
        var themeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

        function escapeHTML(s) {
            var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return map[ch]; });
        }
        function getStoredThemePreference() {
            try {
                var value = localStorage.getItem('themePreference') || 'system';
                return ['system','light','dark'].indexOf(value) >= 0 ? value : 'system';
            } catch (_) {
                return 'system';
            }
        }
        function resolveThemePreference(preference) {
            var value = ['system','light','dark'].indexOf(preference) >= 0 ? preference : 'system';
            if (value === 'light' || value === 'dark') return value;
            return themeMediaQuery && themeMediaQuery.matches ? 'dark' : 'light';
        }
        function applyThemePreference(preference) {
            var value = ['system','light','dark'].indexOf(preference) >= 0 ? preference : 'system';
            var resolved = resolveThemePreference(value);
            document.documentElement.dataset.theme = resolved;
            document.documentElement.dataset.themePreference = value;
            try { localStorage.setItem('themePreference', value); } catch (_) {}
            var btn = document.getElementById('theme-toggle');
            if (btn) btn.textContent = '主题：' + (value === 'light' ? '浅色' : (value === 'dark' ? '深色' : '跟随系统'));
        }
        function toggleThemePreference() {
            var order = ['system','light','dark'];
            var current = getStoredThemePreference();
            applyThemePreference(order[(order.indexOf(current) + 1) % order.length]);
        }
        function watchSystemThemeChange() {
            if (!themeMediaQuery) return;
            var sync = function(){ if (getStoredThemePreference() === 'system') applyThemePreference('system'); };
            if (themeMediaQuery.addEventListener) themeMediaQuery.addEventListener('change', sync);
            else if (themeMediaQuery.addListener) themeMediaQuery.addListener(sync);
        }
        function durationRank(v){ return v === 'permanent' ? Infinity : parseInt(v, 10); }
        function durationOptions(){ return publicConfig.durationOptions && publicConfig.durationOptions.length ? publicConfig.durationOptions : [{value:'1',label:'1 小时'},{value:'8',label:'8 小时'},{value:'24',label:'24 小时'},{value:'48',label:'48 小时'},{value:'72',label:'72 小时'},{value:'168',label:'168 小时'},{value:'permanent',label:'永久'}]; }
        function durationLabel(v){ var hit = durationOptions().find(function(o){ return o.value === String(v); }); return hit ? hit.label : String(v); }
        function parseDbDate(v){ if(!v) return null; v = String(v); return new Date(v.indexOf('T') >= 0 ? v : v.replace(' ', 'T') + 'Z'); }
        function formatDate(v){ if(!v) return '永久'; var d = parseDbDate(v); return isNaN(d.getTime()) ? v : d.toLocaleString(); }
        function formatFileSize(bytes){ bytes = Number(bytes) || 0; if(bytes < 1024) return bytes + ' B'; if(bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; }
        function remainingText(v){ if(!v) return '永久'; var diff = parseDbDate(v).getTime() - Date.now(); if(diff <= 0) return '已过期'; return '约 ' + Math.ceil(diff / 3600000) + ' 小时'; }
        function deliveryModeNeedsDestination(mode){ return mode === 'inbox_forward' || mode === 'forward_only'; }
        function routeDeliveryMode(route) {
            if (route && route.delivery_mode) return route.delivery_mode;
            if (String(route && route.inbox_enabled || 'false') === 'true') return route && route.destination_id == null ? 'inbox_only' : 'inbox_forward';
            return 'forward_only';
        }
        function deliveryModeLabel(mode) {
            if (mode === 'inbox_forward') return '站内同步 + 保底转发';
            if (mode === 'forward_only') return '仅转发到邮箱';
            return '仅站内收件箱';
        }
        function showToast(msg, isErr) {
            var c=document.getElementById('toast-container'), t=document.createElement('div');
            t.className='px-6 py-3 rounded-lg shadow-xl text-white font-medium text-sm transition-all duration-300 translate-x-full opacity-0 ' + (isErr?'bg-rose-600':'bg-emerald-600');
            t.innerText=msg; c.appendChild(t);
            setTimeout(function(){ t.classList.remove('translate-x-full','opacity-0'); },10);
            setTimeout(function(){ t.classList.add('translate-x-full','opacity-0'); setTimeout(function(){t.remove();},300); },3000);
        }
        function fillDurationSelect(id, maxValue, filterFn) {
            var s = document.getElementById(id);
            var opts = durationOptions().filter(function(o){
                return durationRank(o.value) <= durationRank(maxValue || 'permanent') && (!filterFn || filterFn(o.value));
            });
            s.innerHTML = opts.length ? opts.map(function(o){ return '<option value="' + escapeHTML(o.value) + '">' + escapeHTML(o.label) + '</option>'; }).join('') : '<option value="" disabled>暂无可用有效期</option>';
            return opts;
        }
        function fitSelectToLongestText(selectEl, minCh, maxCh) {
            if (!selectEl) return;
            var options = selectEl.options || [];
            var longest = Number(minCh) || 12;
            for (var i = 0; i < options.length; i++) {
                longest = Math.max(longest, String(options[i].text || '').length);
            }
            var widthCh = Math.min(Number(maxCh) || 52, longest + 2);
            selectEl.style.width = '100%';
            selectEl.style.minWidth = widthCh + 'ch';
            selectEl.style.maxWidth = '100%';
        }
        function normalizeSearchText(v) {
            return String(v == null ? '' : v).trim().toLowerCase();
        }
        function updateRouteSearchCount(matched, total) {
            var countEl = document.getElementById('route-search-count');
            if (countEl) countEl.textContent = String(matched) + ' / ' + String(total);
        }
        function updateDashboardNav() {
            var sections = ['routes','inbox','security'];
            sections.forEach(function(name){
                var panel = document.getElementById('dashboard-section-' + name);
                if (panel) panel.classList.toggle('hidden', activeDashboardSection !== name);
            });
            document.querySelectorAll('.dashboard-nav').forEach(function(btn){
                var isActive = btn.getAttribute('data-dashboard-section') === activeDashboardSection;
                btn.classList.toggle('bg-gray-800', isActive);
                btn.classList.toggle('text-emerald-300', isActive);
                btn.classList.toggle('text-gray-400', !isActive);
                btn.classList.toggle('hover:text-white', !isActive);
                btn.classList.toggle('hover:bg-gray-800', !isActive);
            });
            updateSettingsNav();
        }
        function updateSettingsNav() {
            var sections = ['destinations','security'];
            sections.forEach(function(name){
                var panel = document.getElementById('settings-section-' + name);
                if (panel) panel.classList.toggle('hidden', activeSettingsSection !== name);
            });
            document.querySelectorAll('.settings-nav').forEach(function(btn){
                var isActive = btn.getAttribute('data-settings-section') === activeSettingsSection;
                btn.classList.toggle('text-emerald-300', isActive);
                btn.classList.toggle('border-emerald-400', isActive);
                btn.classList.toggle('text-gray-400', !isActive);
                btn.classList.toggle('border-transparent', !isActive);
                btn.classList.toggle('hover:text-white', !isActive);
            });
        }
        function switchSettingsSection(section) {
            var allowed = ['destinations','security'];
            if (allowed.indexOf(section) < 0) section = 'destinations';
            activeSettingsSection = section;
            updateSettingsNav();
        }
        function updateInboxRefreshInfo(text) {
            var el = document.getElementById('inbox-refresh-info');
            if (el) el.textContent = text || '自动刷新中';
        }
        function inboxIsMobile() {
            return window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024;
        }
        function setInboxResponsiveView(view) {
            inboxMobileView = view === 'detail' ? 'detail' : 'list';
            var listPanel = document.getElementById('inbox-list-panel');
            var detail = document.getElementById('inbox-detail');
            var mobile = inboxIsMobile();
            if (listPanel) listPanel.classList.toggle('hidden', mobile && inboxMobileView === 'detail');
            if (detail) detail.classList.toggle('hidden', mobile && inboxMobileView !== 'detail');
        }
        function syncInboxResponsiveView() {
            setInboxResponsiveView(inboxMobileView);
        }
        function inboxDetailClassName(mode) {
            var base = 'bg-gray-950 min-h-0 h-full';
            if (mode === 'reader') return base + ' overflow-hidden flex flex-col';
            return base + ' p-4 flex items-center justify-center text-sm text-gray-500';
        }
        function startInboxAutoRefresh() {
            stopInboxAutoRefresh();
            updateInboxRefreshInfo('自动刷新中');
            inboxAutoRefreshTimer = setInterval(function(){
                if (activeDashboardSection === 'inbox') loadInbox(inboxPage, {silent:true, preserveSelection:true});
            }, 15000);
        }
        function stopInboxAutoRefresh() {
            if (inboxAutoRefreshTimer) clearInterval(inboxAutoRefreshTimer);
            inboxAutoRefreshTimer = null;
        }
        async function switchDashboardSection(section) {
            var allowed = ['routes','inbox','security'];
            if (allowed.indexOf(section) < 0) section = 'inbox';
            activeDashboardSection = section;
            updateDashboardNav();
            if (section === 'inbox') {
                startInboxAutoRefresh();
                await loadInbox(1);
            } else {
                stopInboxAutoRefresh();
            }
        }
        function getFilteredRoutes(routes, keyword) {
            var normalizedKeyword = normalizeSearchText(keyword);
            if (!normalizedKeyword) return routes;
            return routes.filter(function(r){
                var addressText = normalizeSearchText((r.tag || '') + '@' + (r.domain || ''));
                var remarkText = normalizeSearchText(r.remark || '');
                var destinationText = normalizeSearchText(r.destination_email || '');
                var deliveryText = normalizeSearchText(deliveryModeLabel(routeDeliveryMode(r)));
                return addressText.indexOf(normalizedKeyword) >= 0
                    || remarkText.indexOf(normalizedKeyword) >= 0
                    || destinationText.indexOf(normalizedKeyword) >= 0
                    || deliveryText.indexOf(normalizedKeyword) >= 0;
            });
        }
        function renderRouteList(routes, availableDestinations, routeDestWidthCh, totalRoutes) {
            var container = document.getElementById('route-list');
            var matchedCount = routes.length;
            var allCount = Number(totalRoutes) || 0;
            updateRouteSearchCount(matchedCount, allCount);
            if (!routes.length) {
                var searching = !!normalizeSearchText(routeSearchKeyword);
                var emptyTitle = searching ? '没有匹配的专属邮箱' : '还没有专属邮箱';
                var emptyAction = searching
                    ? '<button type="button" onclick="clearRouteSearch()" class="mt-3 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-md transition-colors">清空搜索</button>'
                    : '<button type="button" onclick="openRouteCreate()" class="mt-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md transition-colors">创建专属邮箱</button>';
                container.innerHTML = '<div class="min-h-[220px] flex flex-col items-center justify-center text-center px-4 py-10"><div class="text-white font-medium">' + emptyTitle + '</div><div class="mt-1 text-xs text-gray-500">' + (searching ? '换个关键词试试，或清空当前搜索。' : '创建后会显示邮箱地址、投递方式和有效期。') + '</div>' + emptyAction + '</div>';
                return;
            }
            container.innerHTML = routes.map(function(r){
                var routeDurationText = r.duration_hours ? durationLabel(r.duration_hours) : (r.expires_at ? '按过期时间' : '永久');
                var remark = r.remark || '';
                var address = (r.tag || '') + '@' + (r.domain || '');
                var expiryText = r.expires_at ? (routeDurationText + '，至 ' + formatDate(r.expires_at)) : routeDurationText;
                var deliveryMode = routeDeliveryMode(r);
                var badgeClass = deliveryMode === 'forward_only'
                    ? 'border-gray-700 bg-gray-900 text-gray-400'
                    : (deliveryMode === 'inbox_forward' ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300' : 'border-blue-700/50 bg-blue-900/20 text-blue-300');
                var deliveryBadge = '<span class="inline-flex text-[10px] px-1.5 py-0.5 rounded border ' + badgeClass + '">' + deliveryModeLabel(deliveryMode) + '</span>';
                var targetText = deliveryMode === 'inbox_only'
                    ? '不转发到真实邮箱'
                    : ('转发到：' + (r.destination_email || '未设置'));
                var remarkText = remark ? escapeHTML(remark) : '<span class="text-gray-600">无备注</span>';
                return '<div class="bg-gray-950/60 px-3 py-3 hover:bg-gray-900/70 transition-colors"><div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div class="min-w-0 flex-1"><div class="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0"><span class="font-mono text-emerald-300 break-all">' + escapeHTML(address) + '</span>' + deliveryBadge + '</div><div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-1.5 text-xs text-gray-500"><div class="break-words">' + escapeHTML(targetText) + '</div><div class="break-words">有效期：' + escapeHTML(expiryText) + '</div><div class="break-words">备注：' + remarkText + '</div></div></div><div class="flex gap-2 lg:shrink-0"><button type="button" onclick="openRouteEdit(' + r.id + ')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded transition-colors">编辑</button><button type="button" onclick="deleteRoute(' + r.id + ')" class="text-xs bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 border border-rose-800 px-3 py-1.5 rounded transition-colors">删除</button></div></div></div>';
            }).join('');
        }
        function clearRouteSearch() {
            routeSearchKeyword = '';
            var input = document.getElementById('route-search');
            if (input) input.value = '';
            if (dashboardState) applyDashboardState();
            if (input) input.focus();
        }
        function setupRouteSearch() {
            var input = document.getElementById('route-search');
            var clearBtn = document.getElementById('route-search-clear');
            if (!input || !clearBtn) return;
            input.value = routeSearchKeyword;
            input.oninput = function() {
                routeSearchKeyword = normalizeSearchText(input.value);
                if (dashboardState) applyDashboardState();
            };
            clearBtn.onclick = clearRouteSearch;
        }
        async function loadPublicConfig() {
            try {
                var res = await fetch('/api/public-config');
                if (res.ok) publicConfig = await res.json();
            } catch (_) {}
            updateInviteField();
        }
        function updateInviteField() {
            var show = mode === 'register' && publicConfig.inviteRequired;
            document.getElementById('invite-wrap').classList.toggle('hidden', !show);
            document.getElementById('invite-code').required = show;
        }
        applyThemePreference(getStoredThemePreference());
        watchSystemThemeChange();

        window.onload = async function() {
            setupRouteSearch();
            window.addEventListener('resize', syncInboxResponsiveView);
            await loadPublicConfig();
            var session = await fetch('/api/check-session');
            document.getElementById('booting-panel').classList.add('hidden');
            if (session.ok) {
                document.getElementById('auth-panel').classList.add('hidden');
                document.getElementById('dashboard-panel').classList.remove('hidden');
                await loadDashboard();
            } else {
                document.getElementById('auth-panel').classList.remove('hidden');
            }
        };
        function switchTab(m) {
            mode = m;
            document.getElementById('submit-btn').innerText = m==='login'?'登 录':'注 册';
            document.getElementById('tab-login').className = m==='login'?'w-1/2 pb-3 font-bold text-center text-emerald-400 border-b-2 border-emerald-500 transition-all':'w-1/2 pb-3 font-medium text-center text-gray-500 hover:text-gray-300 border-b border-transparent transition-all';
            document.getElementById('tab-register').className = m==='register'?'w-1/2 pb-3 font-bold text-center text-emerald-400 border-b-2 border-emerald-500 transition-all':'w-1/2 pb-3 font-medium text-center text-gray-500 hover:text-gray-300 border-b border-transparent transition-all';
            updateInviteField();
            if (!TURNSTILE_BYPASS && window.turnstile) window.turnstile.reset();
        }
        async function handleAuth(e) {
            e.preventDefault();
            var t = new FormData(e.target).get('cf-turnstile-response');
            if (TURNSTILE_BYPASS && !t) t = 'bypass';
            if(!t) return showToast('请完成人机验证', true);
            var payload = {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                turnstileToken: TURNSTILE_BYPASS ? '' : t
            };
            if (mode === 'register' && publicConfig.inviteRequired) payload.invitationCode = document.getElementById('invite-code').value.trim();
            var res = await fetch('/api/'+mode, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            if(res.ok){
                mode==='login' ? location.reload() : (showToast('注册成功，请登录'), switchTab('login'));
            } else {
                var d = await res.json();
                var errMsg = d.error || '请求失败';
                showToast(errMsg, true);
                if (window.turnstile && /验证|turnstile|captcha/i.test(String(errMsg))) window.turnstile.reset();
            }
        }
        async function loadDashboard() {
            var res = await fetch('/api/me');
            if(!res.ok) return location.reload();
            dashboardState = await res.json();
            publicConfig.durationOptions = dashboardState.durationOptions || publicConfig.durationOptions;
            applyDashboardState();
            updateDashboardNav();
            if (activeDashboardSection === 'inbox') {
                if (!inboxAutoRefreshTimer) startInboxAutoRefresh();
                await loadInbox(inboxPage, {preserveSelection:true});
            }
        }
        function destinationById(id) {
            var list = dashboardState && dashboardState.destinations ? dashboardState.destinations : [];
            return list.find(function(item){ return Number(item.id) === Number(id); }) || null;
        }
        function verifiedDestinations() {
            var list = dashboardState && dashboardState.destinations ? dashboardState.destinations : [];
            return list.filter(function(item){
                return item.status === 'verified' && (!item.expires_at || parseDbDate(item.expires_at).getTime() > Date.now());
            });
        }
        function routeById(id) {
            var list = dashboardState && dashboardState.routes ? dashboardState.routes : [];
            return list.find(function(item){ return Number(item.id) === Number(id); }) || null;
        }
        function openRouteCreate() {
            var btn = document.getElementById('route-create-open-btn');
            if (btn && btn.disabled) return showToast('当前无法创建专属邮箱，请检查配额、域名或目标邮箱状态', true);
            var modal = document.getElementById('route-create-modal');
            if (modal) modal.classList.remove('hidden');
            if (dashboardState) applyDashboardState();
            setTimeout(function(){
                var input = document.getElementById('route-prefix');
                if (input && !input.disabled) input.focus();
            }, 20);
        }
        function closeRouteCreate() {
            var modal = document.getElementById('route-create-modal');
            if (modal) modal.classList.add('hidden');
        }
        function fillEditRouteDestinationSelect(route) {
            var select = document.getElementById('edit-route-destination');
            if (!select) return;
            var available = verifiedDestinations();
            select.innerHTML = available.length
                ? available.map(function(item){ return '<option value="' + item.id + '">' + escapeHTML(item.email) + '</option>'; }).join('')
                : '<option value="" disabled>暂无可用已验证邮箱</option>';
            if (route && route.destination_id != null) select.value = String(route.destination_id);
            fitSelectToLongestText(select, 18, 56);
        }
        function toggleRouteEditTarget() {
            var modeEl = document.getElementById('edit-route-delivery-mode');
            var select = document.getElementById('edit-route-destination');
            var wrap = document.getElementById('edit-route-destination-wrap');
            var empty = document.getElementById('edit-route-destination-empty');
            var needsTarget = deliveryModeNeedsDestination(modeEl ? modeEl.value : 'inbox_only');
            var hasTarget = !!(select && select.options && select.options.length && select.value);
            if (wrap) wrap.classList.toggle('hidden', !needsTarget);
            if (select) select.disabled = needsTarget && !hasTarget;
            if (empty) empty.classList.toggle('hidden', !needsTarget || hasTarget);
        }
        function openRouteEdit(id) {
            var route = routeById(id);
            if (!route) return showToast('这个专属邮箱不存在或已刷新', true);
            editingRouteId = route.id;
            document.getElementById('edit-route-id').value = route.id;
            document.getElementById('edit-route-address').textContent = (route.tag || '') + '@' + (route.domain || '');
            document.getElementById('edit-route-remark').value = route.remark || '';
            document.getElementById('edit-route-delivery-mode').value = routeDeliveryMode(route);
            fillEditRouteDestinationSelect(route);
            toggleRouteEditTarget();
            var modal = document.getElementById('route-edit-modal');
            if (modal) modal.classList.remove('hidden');
        }
        function closeRouteEdit() {
            editingRouteId = null;
            var modal = document.getElementById('route-edit-modal');
            if (modal) modal.classList.add('hidden');
        }
        function renderDestinationList() {
            var list = dashboardState.destinations || [];
            var container = document.getElementById('destination-list');
            if (!list.length) {
                container.innerHTML = '<div class="min-h-[160px] flex items-center justify-center text-center px-4 py-8 text-sm text-gray-500">还没有绑定任何底层收件箱</div>';
                return;
            }
            container.innerHTML = list.map(function(item){
                var statusText = item.status === 'verified' ? '已验证' : '待验证';
                var statusClass = item.status === 'verified' ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300' : 'border-blue-700/50 bg-blue-900/20 text-blue-300';
                var durationText = item.duration_hours ? durationLabel(item.duration_hours) : (item.expires_at ? '按过期时间' : '永久');
                var expiryText = item.status === 'pending'
                    ? ('邮箱有效期：' + durationText + '，验证截止：' + formatDate(item.pending_expires_at))
                    : (item.expires_at ? ('邮箱有效期：' + durationText + '，到期时间：' + formatDate(item.expires_at) + '（' + remainingText(item.expires_at) + '）') : '邮箱有效期：永久');
                var refreshBtn = item.status === 'pending'
                    ? '<button onclick="refreshDestination(' + item.id + ')" class="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 px-3 py-1.5 rounded transition-colors">刷新验证</button>'
                    : '';
                return '<div class="px-3 py-3 bg-gray-950/60 hover:bg-gray-900/70 transition-colors"><div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div class="min-w-0"><div class="flex flex-col sm:flex-row sm:items-center gap-2"><span class="inline-flex self-start text-[10px] px-1.5 py-0.5 rounded border ' + statusClass + '">' + statusText + '</span><span class="text-emerald-200 font-mono text-sm break-all">' + escapeHTML(item.email) + '</span></div><div class="text-xs text-gray-500 mt-1 break-words">' + escapeHTML(expiryText) + '</div></div><div class="flex flex-wrap gap-2 sm:shrink-0">' + refreshBtn + '<button onclick="deleteDestination(' + item.id + ')" class="text-xs bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 border border-rose-800 px-3 py-1.5 rounded transition-colors">删除</button></div></div></div>';
            }).join('');
        }
        function applyDashboardState() {
            fillDurationSelect('dest-duration', dashboardState.limits.destinationMax);
            var quota = dashboardState.quota || {used:0,max:0,destinationUsed:0,destinationMax:0};
            document.getElementById('dest-summary').innerHTML = '已绑定 <span class="text-emerald-300 font-bold">' + quota.destinationUsed + '</span> / ' + quota.destinationMax + ' 个';
            document.getElementById('dashboard-dest-summary').innerText = '底层收件箱 ' + quota.destinationUsed + ' / ' + quota.destinationMax;
            renderDestinationList();

            document.getElementById('route-quota').innerHTML = '已创建 <span class="text-emerald-300 font-bold">' + quota.used + '</span> / ' + quota.max + ' 个';
            document.getElementById('dashboard-route-summary').innerText = '专属邮箱 ' + quota.used + ' / ' + quota.max;
            var domains = dashboardState.domains || [];
            var routeDomainSelect = document.getElementById('route-domain');
            routeDomainSelect.innerHTML = domains.length ? domains.map(function(x){ return '<option value="' + x.id + '">' + escapeHTML(x.domain) + '</option>'; }).join('') : '<option value="" disabled>管理员暂未开放可用域名</option>';
            fitSelectToLongestText(routeDomainSelect, 16, 42);

            var availableDestinations = verifiedDestinations();
            var routeDeliverySelect = document.getElementById('route-delivery-mode');
            var routeDeliveryMode = routeDeliverySelect ? routeDeliverySelect.value : 'inbox_only';
            var routeNeedsDestination = deliveryModeNeedsDestination(routeDeliveryMode);
            var routeDestinationSelect = document.getElementById('route-destination');
            var selectedRouteDestinationId = routeDestinationSelect.value;
            routeDestinationSelect.innerHTML = availableDestinations.length ? availableDestinations.map(function(x){ return '<option value="' + x.id + '">' + escapeHTML(x.email) + '</option>'; }).join('') : '<option value="" disabled>暂无可用已验证邮箱，请到 设置 > 底层收件箱 添加</option>';
            if (selectedRouteDestinationId) routeDestinationSelect.value = selectedRouteDestinationId;
            fitSelectToLongestText(routeDestinationSelect, 18, 52);
            var selectedDestination = destinationById(routeDestinationSelect.value) || availableDestinations[0] || null;
            var routeOptions = fillDurationSelect('route-duration', dashboardState.limits.routeMax, function(value){
                if(!routeNeedsDestination) return true;
                if(!selectedDestination) return false;
                if(selectedDestination.duration_hours && durationRank(value) > durationRank(selectedDestination.duration_hours)) return false;
                if(!selectedDestination.expires_at) return true;
                return value !== 'permanent';
            });
            var canCreate = domains.length > 0 && quota.used < quota.max && routeOptions.length > 0 && (!routeNeedsDestination || !!selectedDestination);
            ['route-prefix','route-domain','route-duration','route-remark','route-btn'].forEach(function(id){ document.getElementById(id).disabled = !canCreate; });
            routeDestinationSelect.disabled = !canCreate || !routeNeedsDestination;
            routeDestinationSelect.classList.toggle('hidden', !routeNeedsDestination);
            if (routeDeliverySelect) routeDeliverySelect.disabled = domains.length === 0 || quota.used >= quota.max;
            routeDestinationSelect.onchange = function(){ applyDashboardState(); };
            if (routeDeliverySelect) routeDeliverySelect.onchange = function(){ applyDashboardState(); };
            var routeCreateOpenBtn = document.getElementById('route-create-open-btn');
            if (routeCreateOpenBtn) {
                routeCreateOpenBtn.disabled = !canCreate;
                routeCreateOpenBtn.className = canCreate ? 'self-start sm:self-center bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap' : 'self-start sm:self-center bg-gray-800 text-gray-500 border border-gray-700 px-3 py-2 rounded-md text-sm font-medium cursor-not-allowed whitespace-nowrap';
            }
            document.getElementById('route-btn').className = canCreate ? 'bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap' : 'bg-gray-700 text-gray-400 px-3 py-2 rounded-md text-sm font-medium cursor-not-allowed whitespace-nowrap';

            var routes = dashboardState.routes || [];
            var longestDestLen = availableDestinations.reduce(function(maxLen, item){
                return Math.max(maxLen, String(item && item.email ? item.email : '').length);
            }, 18);
            var routeDestWidthCh = Math.min(72, longestDestLen + 10);
            var routeSearchInput = document.getElementById('route-search');
            if (routeSearchInput && routeSearchInput.value !== routeSearchKeyword) routeSearchInput.value = routeSearchKeyword;
            var filteredRoutes = getFilteredRoutes(routes, routeSearchKeyword);
            renderRouteList(filteredRoutes, availableDestinations, routeDestWidthCh, routes.length);
        }
        async function saveRouteRemark(id) {
            var remark = document.getElementById('route-remark-' + id).value;
            var res = await fetch('/api/routes/' + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({remark:remark})});
            var d = await res.json().catch(function(){ return {}; });
            showToast(res.ok ? '备注已保存' : (d.error || '备注保存失败'), !res.ok);
            if (res.ok) await loadDashboard();
        }
        function toggleRouteDeliveryTarget(id) {
            var modeEl = document.getElementById('route-mode-' + id);
            var destEl = document.getElementById('route-dest-' + id);
            var emptyEl = document.getElementById('route-dest-empty-' + id);
            var showTarget = deliveryModeNeedsDestination(modeEl ? modeEl.value : 'inbox_only');
            if (destEl) destEl.classList.toggle('hidden', !showTarget);
            if (emptyEl) emptyEl.classList.toggle('hidden', !showTarget);
        }
        async function saveRouteDelivery(id) {
            var mode = document.getElementById('route-mode-' + id).value;
            var destEl = document.getElementById('route-dest-' + id);
            var payload = {deliveryMode: mode, destinationId: deliveryModeNeedsDestination(mode) && destEl ? destEl.value : null};
            var res = await fetch('/api/routes/' + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            var d = await res.json().catch(function(){ return {}; });
            showToast(res.ok ? (d.message || '投递设置已更新') : (d.error || '更新失败'), !res.ok);
            if (res.ok) await loadDashboard();
        }
        async function saveRouteEdit(e) {
            e.preventDefault();
            var id = document.getElementById('edit-route-id').value || editingRouteId;
            var mode = document.getElementById('edit-route-delivery-mode').value;
            var destEl = document.getElementById('edit-route-destination');
            if (deliveryModeNeedsDestination(mode) && (!destEl || !destEl.value)) return showToast('请选择转发目标邮箱', true);
            var btn = document.getElementById('edit-route-save-btn');
            if (btn) btn.disabled = true;
            var payload = {
                remark: document.getElementById('edit-route-remark').value.trim(),
                deliveryMode: mode,
                destinationId: deliveryModeNeedsDestination(mode) ? destEl.value : null
            };
            try {
                var res = await fetch('/api/routes/' + encodeURIComponent(id), {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
                var d = await res.json().catch(function(){ return {}; });
                showToast(res.ok ? (d.message || '专属邮箱已更新') : (d.error || '更新失败'), !res.ok);
                if (res.ok) {
                    closeRouteEdit();
                    await loadDashboard();
                }
            } finally {
                if (btn) btn.disabled = false;
            }
        }
        async function handleDest(e) {
            e.preventDefault();
            var payload = {
                email:document.getElementById('dest-email').value.trim(),
                durationHours:document.getElementById('dest-duration').value
            };
            var res = await fetch('/api/destinations', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            var d = await res.json().catch(function(){ return {}; });
            showToast(d.message || d.error || '请求完成', !res.ok);
            if (res.ok) document.getElementById('dest-email').value = '';
            await loadDashboard();
        }
        async function refreshDestination(id) {
            var res = await fetch('/api/destinations/' + id + '/refresh', {method:'POST'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(d.message || d.error || '请求完成', !res.ok);
            await loadDashboard();
        }
        async function handleRoute(e) {
            e.preventDefault();
            var deliveryMode = document.getElementById('route-delivery-mode').value;
            var payload = {
                prefix:document.getElementById('route-prefix').value.trim(),
                domainId:document.getElementById('route-domain').value,
                durationHours:document.getElementById('route-duration').value,
                deliveryMode:deliveryMode,
                destinationId:deliveryModeNeedsDestination(deliveryMode) ? document.getElementById('route-destination').value : null,
                remark:document.getElementById('route-remark').value.trim()
            };
            var res = await fetch('/api/routes', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            var d = await res.json();
            showToast(d.success ? (d.message || '专属邮箱创建成功') : (d.error || '创建失败'), !d.success);
            if(d.success) {
                document.getElementById('route-prefix').value = '';
                document.getElementById('route-remark').value = '';
                closeRouteCreate();
                await loadDashboard();
            }
        }
        async function deleteRoute(id) {
            if(!confirm('确定删除这个专属域名邮箱吗？删除后 Cloudflare 路由也会一起移除。')) return;
            var res = await fetch('/api/routes/' + id, {method:'DELETE'});
            var d = await res.json();
            showToast(d.message || d.error || '请求完成', !res.ok);
            await loadDashboard();
        }
        async function deleteDestination(id) {
            if(!confirm('确定删除这个底层收件箱吗？若仍被路由使用将被阻止。')) return;
            var res = await fetch('/api/destinations/' + id, {method:'DELETE'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(d.message || d.error || '请求完成', !res.ok);
            await loadDashboard();
        }
        function renderInboxDetailPlaceholder(text) {
            var detail = document.getElementById('inbox-detail');
            if (!detail) return;
            detail.className = inboxDetailClassName('placeholder');
            detail.innerHTML = escapeHTML(text || '选择一封邮件查看正文');
            setInboxResponsiveView('list');
        }
        function closeInboxMail() {
            inboxSelectedMailId = null;
            renderInboxDetailPlaceholder();
            loadInbox(inboxPage, {silent:true, preserveSelection:true});
        }
        async function refreshInboxNow() {
            updateInboxRefreshInfo('正在刷新...');
            await loadInbox(inboxPage, {preserveSelection:true});
        }
        async function loadInbox(page, options) {
            options = options || {};
            if (inboxLoading) return;
            inboxLoading = true;
            inboxPage = page || 1;
            if (inboxPage < 1) inboxPage = 1;
            if (!options.preserveSelection) {
                inboxSelectedMailId = null;
                renderInboxDetailPlaceholder();
            }
            var input = document.getElementById('inbox-search');
            var q = input ? input.value.trim() : '';
            var url = '/api/inbox?page=' + inboxPage + '&search=' + encodeURIComponent(q);
            if (inboxRouteId) url += '&routeId=' + encodeURIComponent(inboxRouteId);
            try {
                var res = await fetch(url);
                if(!res.ok) {
                    if (!options.silent) showToast('收件箱刷新失败', true);
                    return;
                }
                var d = await res.json().catch(function(){ return {data:[]}; });
                renderInboxList(d.data || []);
                document.getElementById('inbox-page-info').innerText = '第 ' + inboxPage + ' 页';
                updateInboxRefreshInfo('已刷新 ' + new Date().toLocaleTimeString());
            } finally {
                inboxLoading = false;
            }
        }
        function renderInboxList(items) {
            var list = document.getElementById('inbox-list');
            if (!list) return;
            if (!items.length) {
                list.innerHTML = '<div class="p-4 text-gray-500">站内收件箱暂无邮件</div>';
                return;
            }
            list.innerHTML = items.map(function(m){
                var unread = !m.read_at;
                var selected = Number(m.id) === Number(inboxSelectedMailId);
                var subject = m.subject || '(无主题)';
                var preview = m.preview || '';
                var itemClass = selected ? 'bg-emerald-950/40 border-l-2 border-l-emerald-500' : (unread ? 'bg-gray-900 border-l-2 border-l-emerald-500' : 'bg-gray-950 hover:bg-gray-900/70');
                var titleClass = unread ? 'text-white font-bold' : 'text-gray-300 font-medium';
                var status = m.forward_status && m.forward_status !== 'forwarded' ? '<span class="text-[10px] px-1.5 py-0.5 rounded border border-amber-700/50 bg-amber-900/20 text-amber-200">' + escapeHTML(m.forward_status) + '</span>' : '';
                return '<div onclick="openInboxMail(' + m.id + ')" class="cursor-pointer px-3 py-2 transition-colors ' + itemClass + '"><div class="flex items-start justify-between gap-2"><div class="min-w-0 flex-1"><div class="' + titleClass + ' truncate">' + escapeHTML(subject) + '</div><div class="text-xs text-gray-500 mt-0.5 truncate">From: ' + escapeHTML(m.from_email || '') + '</div><div class="text-xs text-gray-500 mt-0.5 truncate">To: ' + escapeHTML(m.route_address || '') + ' · ' + escapeHTML(formatDate(m.received_at)) + '</div><div class="text-xs text-gray-400 mt-1 line-clamp-2">' + escapeHTML(preview) + '</div></div><div class="flex flex-col items-end gap-1.5 shrink-0">' + status + '<button onclick="deleteInboxMail(event,' + m.id + ')" class="text-xs bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 border border-rose-800 px-2 py-1 rounded transition-colors">删除</button></div></div></div>';
            }).join('');
        }
        function renderInboxAttachments(mailId, attachments, statusText) {
            var rows = Array.isArray(attachments) ? attachments : [];
            var notice = statusText ? '<div class="mb-2 text-xs text-amber-200 bg-amber-900/20 border border-amber-700/50 rounded px-3 py-2">' + escapeHTML(statusText) + '</div>' : '';
            if (!rows.length) return notice;
            return '<div class="border-t border-gray-800 bg-gray-950/80 p-3">' + notice + '<div class="text-xs font-bold text-gray-400 mb-2">附件</div><div class="space-y-2">' + rows.map(function(a){
                var url = '/api/inbox/' + encodeURIComponent(mailId) + '/attachments/' + encodeURIComponent(a.id);
                return '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded border border-gray-800 bg-gray-950 px-3 py-2"><div class="min-w-0"><div class="text-sm text-gray-200 truncate">' + escapeHTML(a.filename || 'attachment') + '</div><div class="text-xs text-gray-500">' + escapeHTML(a.content_type || 'application/octet-stream') + ' · ' + escapeHTML(formatFileSize(a.size_bytes)) + '</div></div><a href="' + url + '" target="_blank" rel="noopener" class="self-start sm:self-center text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 px-2 py-1 rounded transition-colors whitespace-nowrap">下载</a></div>';
            }).join('') + '</div></div>';
        }
        async function openInboxMail(id) {
            inboxSelectedMailId = id;
            var detail = document.getElementById('inbox-detail');
            if (detail) {
                detail.className = inboxDetailClassName('placeholder');
                detail.innerHTML = '正在读取邮件...';
                setInboxResponsiveView('detail');
                if (inboxIsMobile()) {
                    var section = document.getElementById('dashboard-section-inbox');
                    if (section && section.scrollIntoView) section.scrollIntoView({block:'start'});
                }
            }
            var res = await fetch('/api/inbox/' + id);
            var d = await res.json().catch(function(){ return {}; });
            if(!res.ok) {
                inboxSelectedMailId = null;
                renderInboxDetailPlaceholder();
                return showToast(d.error || '读取邮件失败', true);
            }
            var m = d.data || {};
            if (detail) {
                detail.className = inboxDetailClassName('reader');
                detail.innerHTML = '<div class="px-3 py-2 border-b border-gray-800 flex justify-between gap-2"><div class="min-w-0"><div class="font-bold text-white break-words">' + escapeHTML(m.subject || '(无主题)') + '</div><div class="text-xs text-gray-500 mt-1 break-words">From: ' + escapeHTML(m.from_email || '') + '</div><div class="text-xs text-gray-500 mt-1 break-words">To: ' + escapeHTML(m.route_address || '') + ' · ' + escapeHTML(formatDate(m.received_at)) + '</div></div><button onclick="closeInboxMail()" class="self-start text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded whitespace-nowrap">返回列表</button></div><div class="flex-1 overflow-auto bg-gray-950"><div id="inbox-body-container" class="email-html p-3 break-words"></div></div>' + renderInboxAttachments(m.id || id, m.attachments || [], m.attachment_status_text || '');
                var bodyContainer = document.getElementById('inbox-body-container');
                if (bodyContainer) {
                    if (m.body_html) bodyContainer.innerHTML = m.body_html;
                    else bodyContainer.innerHTML = '<pre class="whitespace-pre-wrap break-words text-sm text-gray-200">' + escapeHTML(m.body_text || '') + '</pre>';
                }
                setInboxResponsiveView('detail');
            }
            await loadInbox(inboxPage, {silent:true, preserveSelection:true});
        }
        async function deleteInboxMail(event, id) {
            if (event && event.stopPropagation) event.stopPropagation();
            if(!confirm('确定删除这封站内邮件吗？真实邮箱中的保底转发不受影响。')) return;
            var res = await fetch('/api/inbox/' + id, {method:'DELETE'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(res.ok ? (d.message || '邮件已删除') : (d.error || '删除失败'), !res.ok);
            if(res.ok) {
                if (Number(inboxSelectedMailId) === Number(id)) {
                    inboxSelectedMailId = null;
                    renderInboxDetailPlaceholder();
                }
                await loadInbox(inboxPage, {preserveSelection:true});
            }
        }
        function changeInboxPage(delta) {
            var next = inboxPage + delta;
            if(next < 1) next = 1;
            loadInbox(next);
        }
        async function changePassword(e) {
            e.preventDefault();
            var oldPassword = document.getElementById('old-password').value;
            var newPassword = document.getElementById('new-password').value;
            if(newPassword.length < 6) return showToast('新密码至少 6 位', true);
            var res = await fetch('/api/password', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({oldPassword:oldPassword,newPassword:newPassword})});
            var d = await res.json();
            showToast(d.message || d.error || '请求完成', !res.ok);
            if(res.ok){ document.getElementById('old-password').value=''; document.getElementById('new-password').value=''; }
        }
        async function deleteAccount() {
            var password = document.getElementById('delete-account-password').value;
            if(!password) return showToast('请输入当前密码确认注销', true);
            if(!confirm('确定永久删除自己的账号吗？账号、底层收件箱和所有专属域名邮箱都会被删除。')) return;
            var res = await fetch('/api/account', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:password})});
            var d = await res.json();
            showToast(d.message || d.error || '请求完成', !res.ok);
            if(res.ok) setTimeout(function(){ location.reload(); }, 600);
        }
        async function logout(){ await fetch('/api/logout',{method:'POST'}); location.reload();}
    </script>
</body>
</html>`;

// ==========================================
// 2. 现代化管理员网页 HTML
// ==========================================
const renderAdminHTML = (adminPath, sitekey, bypassTurnstile = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>系统管理中心</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${bypassTurnstile ? '' : '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'}
    <script>(function(){var k='themePreference';var p='system';try{p=localStorage.getItem(k)||'system';}catch(_){}if(['system','light','dark'].indexOf(p)<0)p='system';var dark=p==='dark'||(p==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.themePreference=p;})();</script>
    <style>
:root{color-scheme:dark;--app-bg:#030712;--panel-bg:#111827;--card-bg:rgba(17,24,39,.6);--field-bg:#111827;--border:#374151;--border-strong:#4b5563;--text:#e5e7eb;--text-strong:#f9fafb;--muted:#9ca3af;--muted-soft:#6b7280;--hover:#1f2937;--overlay:rgba(3,7,18,.8)}html[data-theme="light"]{color-scheme:light;--app-bg:#f8fafc;--panel-bg:#fff;--card-bg:#fff;--field-bg:#fff;--border:#e5e7eb;--border-strong:#d1d5db;--text:#111827;--text-strong:#030712;--muted:#4b5563;--muted-soft:#6b7280;--hover:#f3f4f6;--overlay:rgba(15,23,42,.42)}body{background:var(--app-bg)!important;color:var(--text)!important}.fade-in{animation:fadeIn 0.3s}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#9ca3af;border-radius:3px}.theme-toggle{background:var(--field-bg);border-color:var(--border-strong);color:var(--muted)}.theme-toggle:hover{background:var(--hover);color:var(--text-strong)}html[data-theme="light"] .bg-gray-900,html[data-theme="light"] .bg-gray-800{background-color:var(--panel-bg)!important}html[data-theme="light"] .bg-gray-900\/80,html[data-theme="light"] .bg-gray-900\/40{background-color:var(--card-bg)!important}html[data-theme="light"] .bg-gray-700{background-color:#f3f4f6!important}html[data-theme="light"] .bg-gray-600{background-color:#e5e7eb!important}html[data-theme="light"] .hover\:bg-gray-800:hover,html[data-theme="light"] .hover\:bg-gray-700:hover,html[data-theme="light"] .hover\:bg-gray-600:hover{background-color:var(--hover)!important}html[data-theme="light"] .text-white,html[data-theme="light"] .text-gray-200,html[data-theme="light"] .text-gray-300{color:var(--text-strong)!important}html[data-theme="light"] .text-gray-400{color:var(--muted)!important}html[data-theme="light"] .text-gray-500,html[data-theme="light"] .text-gray-600{color:var(--muted-soft)!important}html[data-theme="light"] .hover\:text-white:hover{color:var(--text-strong)!important}html[data-theme="light"] .border-gray-700,html[data-theme="light"] .border-gray-600{border-color:var(--border)!important}html[data-theme="light"] .divide-gray-700>:not([hidden])~:not([hidden]){border-color:var(--border)!important}html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{background-color:var(--field-bg)!important;color:var(--text-strong)!important;border-color:var(--border-strong)!important}html[data-theme="light"] input::placeholder{color:#9ca3af!important}html[data-theme="light"] .bg-emerald-600,html[data-theme="light"] .hover\:bg-emerald-500:hover{background-color:#6366f1!important}html[data-theme="light"] .bg-emerald-600.text-white,html[data-theme="light"] button.bg-emerald-600,html[data-theme="light"] .bg-blue-600.text-white,html[data-theme="light"] button.bg-blue-600{color:#fff!important}html[data-theme="light"] .text-emerald-500,html[data-theme="light"] .text-emerald-400,html[data-theme="light"] .text-emerald-300,html[data-theme="light"] .text-emerald-200{color:#6366f1!important}html[data-theme="light"] .border-emerald-400,html[data-theme="light"] .border-emerald-500{border-color:#6366f1!important}html[data-theme="light"] .bg-emerald-900\/20,html[data-theme="light"] .bg-emerald-900\/30{background-color:#eef2ff!important}html[data-theme="light"] .border-emerald-700\/50,html[data-theme="light"] .border-emerald-800{border-color:#c7d2fe!important}html[data-theme="light"] .bg-blue-900\/20{background-color:#eff6ff!important}html[data-theme="light"] .bg-rose-900\/30,html[data-theme="light"] .bg-rose-900\/50{background-color:#fff1f2!important}html[data-theme="light"] .hover\:bg-rose-900\/80:hover{background-color:#ffe4e6!important}html[data-theme="light"] .text-rose-400,html[data-theme="light"] .text-rose-300,html[data-theme="light"] .text-rose-200{color:#be123c!important}html[data-theme="light"] .border-rose-800{border-color:#fecdd3!important}html[data-theme="light"] .bg-amber-900\/30,html[data-theme="light"] .bg-amber-900\/40{background-color:#fffbeb!important}html[data-theme="light"] .text-amber-300,html[data-theme="light"] .text-amber-200{color:#92400e!important}html[data-theme="light"] .border-amber-800,html[data-theme="light"] .border-amber-700,html[data-theme="light"] .border-amber-700\/50{border-color:#fde68a!important}
html[data-theme="light"] .theme-toggle,html[data-theme="light"] button.bg-gray-800,html[data-theme="light"] button.bg-gray-700{background-color:#fff!important;color:#6b7280!important;border-color:#d1d5db!important}html[data-theme="light"] .theme-toggle:hover,html[data-theme="light"] button.hover\:bg-gray-700:hover,html[data-theme="light"] button.hover\:bg-gray-600:hover{background-color:#f3f4f6!important;color:#1f2937!important;border-color:#d1d5db!important}html[data-theme="light"] button.text-emerald-400.border-emerald-400{color:#6366f1!important;border-color:#6366f1!important}html[data-theme="light"] button.text-gray-400:hover{background-color:#f3f4f6!important;color:#1f2937!important}html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{color-scheme:light}
html[data-theme="light"]{--app-bg:#f0f2f5;--panel-bg:#fff;--card-bg:#fff;--field-bg:#fff;--border:#e5e7eb;--border-strong:#d1d5db;--text:#1f2937;--text-strong:#111827;--muted:#6b7280;--muted-soft:#9ca3af;--hover:#f3f4f6;--overlay:rgba(15,23,42,.42)}html[data-theme="light"] body{background:#f0f2f5!important;color:#1f2937!important}html[data-theme="light"] #login-panel,html[data-theme="light"] #booting-panel,html[data-theme="light"] #dashboard-panel{background:#fff!important;border-color:#e5e7eb!important;box-shadow:0 18px 45px rgba(0,0,0,.08)!important}html[data-theme="light"] .bg-emerald-600,html[data-theme="light"] .hover\:bg-emerald-500:hover{background-color:#6366f1!important}html[data-theme="light"] .text-emerald-500,html[data-theme="light"] .text-emerald-400,html[data-theme="light"] .text-emerald-300,html[data-theme="light"] .text-emerald-200{color:#6366f1!important}html[data-theme="light"] .border-emerald-400,html[data-theme="light"] .border-emerald-500{border-color:#6366f1!important}html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{background-color:#fff!important;border-color:#d1d5db!important;color:#1f2937!important}html[data-theme="light"] input:focus,html[data-theme="light"] select:focus,html[data-theme="light"] textarea:focus{border-color:#6366f1!important;box-shadow:0 0 0 1px rgba(99,102,241,.2)!important}html[data-theme="light"] .theme-toggle,html[data-theme="light"] button.bg-gray-800,html[data-theme="light"] button.bg-gray-700{background:#fff!important;color:#6b7280!important;border-color:#d1d5db!important}html[data-theme="light"] .theme-toggle:hover,html[data-theme="light"] button.hover\:bg-gray-700:hover,html[data-theme="light"] button.hover\:bg-gray-600:hover{background:#f3f4f6!important;color:#1f2937!important;border-color:#d1d5db!important}html[data-theme="light"] #nav-domains,html[data-theme="light"] #nav-invites,html[data-theme="light"] #nav-users{background:transparent!important}html[data-theme="light"] button.text-emerald-400.border-emerald-400{color:#6366f1!important;border-color:#6366f1!important}html[data-theme="light"] button.text-gray-400:hover{background:transparent!important;color:#1f2937!important}html[data-theme="light"] .bg-rose-900\/50,html[data-theme="light"] .hover\:bg-rose-900\/80:hover{background-color:#fef2f2!important}html[data-theme="light"] .text-rose-400,html[data-theme="light"] .text-rose-300,html[data-theme="light"] .text-rose-200{color:#dc2626!important}html[data-theme="light"] .border-rose-800{border-color:#fecaca!important}
    </style>
    <style>html[data-theme="light"] body.bg-gray-900{background-color:#f0f2f5!important}</style>
</head>
<body class="bg-gray-900 text-gray-200 font-sans min-h-screen p-4 flex justify-center items-center">
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2"></div>

    <div id="booting-panel" class="bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl p-8 border border-gray-700 text-center text-gray-300 fade-in">
        正在检查登录状态...
    </div>

    <div id="login-panel" class="hidden bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl p-8 border border-gray-700 fade-in">
        <h2 class="text-2xl font-bold text-center text-white mb-6">系统管理中心</h2>
        <form onsubmit="handleAdminLogin(event)" class="space-y-4">
            <input type="text" id="admin-user" class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-emerald-500" placeholder="Admin ID" required>
            <input type="password" id="admin-pass" class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-emerald-500" placeholder="Password" required>
            ${bypassTurnstile
                ? '<div class="py-2 px-3 rounded-lg border border-amber-800 bg-amber-900/30 text-amber-300 text-xs">Turnstile is temporarily bypassed for troubleshooting. Disable TURNSTILE_BYPASS after recovery.</div>'
                : `<div class="cf-turnstile flex justify-center py-2" data-sitekey="${sitekey}"></div>`
            }
            <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all">解 锁</button>
        </form>
    </div>

    <div id="dashboard-panel" class="hidden bg-gray-800 w-full max-w-6xl rounded-2xl shadow-2xl border border-gray-700 overflow-hidden fade-in flex flex-col h-[90vh]">
        <div class="bg-gray-900/80 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
            <div class="flex gap-4">
                <button onclick="nav('domains')" id="nav-domains" class="text-emerald-400 font-bold border-b-2 border-emerald-400 pb-1">域名与配置</button>
                <button onclick="nav('invites')" id="nav-invites" class="text-gray-400 hover:text-white font-bold pb-1 transition-colors">邀请码</button>
                <button onclick="nav('users')" id="nav-users" class="text-gray-400 hover:text-white font-bold pb-1 transition-colors">用户管理中心</button>
            </div>
            <div class="flex items-center gap-3">
                <button type="button" id="theme-toggle" onclick="toggleThemePreference()" class="theme-toggle text-xs px-2.5 py-1.5 rounded-lg border transition-colors">主题：跟随系统</button>
                <button onclick="logout()" class="text-rose-400 hover:text-rose-300 text-sm">锁定退出</button>
            </div>
        </div>
        ${bypassTurnstile ? '<div class="px-6 py-3 border-b border-amber-700 bg-amber-900/40 text-amber-200 text-sm">⚠ 当前 TURNSTILE_BYPASS=true：人机验证已绕过，仅限排障，请在恢复后立即关闭。</div>' : ''}

        <div class="p-6 overflow-y-auto flex-1">
            <div id="view-domains" class="space-y-6">
                <div class="bg-gray-900/40 p-5 rounded-xl border border-gray-700">
                    <div class="flex justify-between items-center mb-4"><h3 class="font-bold text-white">域名引擎拉取</h3><button onclick="syncDomains()" class="text-xs bg-blue-600 px-3 py-1.5 rounded text-white hover:bg-blue-500 transition-colors">重新拉取 CF 域名</button></div>
                    <div id="domain-list" class="space-y-2 text-sm"></div>
                    <div class="mt-5 pt-5 border-t border-gray-700">
                        <h4 class="font-bold text-white mb-3">开放子域名邮箱</h4>
                        <form onsubmit="addSubdomain(event)" class="grid grid-cols-1 md:grid-cols-[180px_1fr_120px] gap-3">
                            <select id="sub-zone" class="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none"></select>
                            <input type="text" id="sub-name" class="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500" placeholder="子域名前缀，如 mail 或 corp">
                            <button type="submit" class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-white text-sm transition-colors">添加子域名</button>
                        </form>
                        <div id="authorized-domain-list" class="mt-4 space-y-2 text-sm"></div>
                    </div>
                </div>
                <div class="bg-gray-900/40 p-5 rounded-xl border border-gray-700">
                    <div class="flex justify-between items-center mb-4"><h3 class="font-bold text-white">核心参数设定</h3><button onclick="runCleanup()" class="text-xs bg-gray-700 px-3 py-1.5 rounded text-white hover:bg-gray-600 transition-colors">手动清理过期数据</button></div>
                    <div id="r2-storage-status" class="mb-4"></div>
                    <div id="config-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                </div>
            </div>

            <div id="view-invites" class="hidden space-y-4">
                <div class="bg-gray-900/40 p-5 rounded-xl border border-gray-700">
                    <h3 class="font-bold text-white mb-4">邀请码管理</h3>
                    <form onsubmit="createInvite(event)" class="grid grid-cols-1 md:grid-cols-[1fr_160px_120px_120px] gap-3 mb-5">
                        <input type="text" id="new-invite-code" class="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500" placeholder="邀请码，如 ABCD-2026" required>
                        <input type="number" min="1" id="new-invite-max" class="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500" placeholder="可用次数" required>
                        <button type="button" onclick="randomInvite()" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white text-sm transition-colors">随机生成</button>
                        <button type="submit" class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-white text-sm transition-colors">新增</button>
                    </form>
                    <div class="overflow-x-auto border border-gray-700 rounded-xl">
                        <table class="w-full text-left text-sm text-gray-300">
                            <thead class="bg-gray-900 text-gray-400 border-b border-gray-700"><tr><th class="p-3">邀请码</th><th class="p-3">最大次数</th><th class="p-3">已使用</th><th class="p-3">剩余</th><th class="p-3">创建时间</th><th class="p-3">操作</th></tr></thead>
                            <tbody id="invite-table-body" class="divide-y divide-gray-700"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="view-users" class="hidden space-y-4">
                <div class="flex gap-2">
                    <input type="text" id="search-user" class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="搜索用户名...">
                    <button onclick="loadUsers(1)" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white text-sm transition-colors">精准搜索</button>
                </div>
                <div class="overflow-x-auto border border-gray-700 rounded-xl">
                    <table class="w-full text-left text-sm text-gray-300">
                        <thead class="bg-gray-900 text-gray-400 border-b border-gray-700"><tr><th class="p-3">ID</th><th class="p-3">用户名</th><th class="p-3">注册IP</th><th class="p-3">底层收件箱</th><th class="p-3">路由数</th><th class="p-3">注册时间</th><th class="p-3">操作</th></tr></thead>
                        <tbody id="user-table-body" class="divide-y divide-gray-700"></tbody>
                    </table>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span id="page-info" class="text-gray-500 font-medium"></span>
                    <div class="flex gap-2">
                        <button onclick="changePage(-1)" class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors">上一页</button>
                        <button onclick="changePage(1)" class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors">下一页</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const basePath = '${adminPath}';
        const TURNSTILE_BYPASS = ${bypassTurnstile ? 'true' : 'false'};
        const durationOptions = [{value:'1',label:'1 小时'},{value:'8',label:'8 小时'},{value:'24',label:'24 小时'},{value:'48',label:'48 小时'},{value:'72',label:'72 小时'},{value:'168',label:'168 小时'},{value:'permanent',label:'永久'}];
        const durationConfigKeys = ['max_destination_duration_hours','max_route_duration_hours'];
        const booleanConfigKeys = ['allow_registration','enable_invitation_code'];
        const bytesPerMB = 1048576;
        const sizeConfigKeys = ['max_inbound_body_bytes','max_inbound_attachment_bytes','max_inbound_total_attachment_bytes','max_inbound_r2_storage_bytes'];
        const cfgOrder = ['allow_registration','enable_invitation_code','max_users','max_routes_per_user','max_total_destinations','max_destinations_per_user','max_regs_per_ip_24h','max_destination_duration_hours','max_route_duration_hours','pending_dest_expiry_hours','unverified_user_expiry_hours','inbound_mail_retention_days','max_inbound_body_bytes','max_inbound_attachment_bytes','max_inbound_total_attachment_bytes','max_inbound_r2_storage_bytes','max_inbound_attachments_per_email','allowed_countries'];
        const cfgDict = {
            'max_users': '系统最大注册总人数',
            'max_routes_per_user': '单用户专属域名邮箱上限',
            'max_total_destinations': '全局目标邮箱总配额',
            'max_destinations_per_user': '单用户底层收件箱上限',
            'max_regs_per_ip_24h': '单IP每24小时注册上限',
            'unverified_user_expiry_hours': '无邮箱僵尸号清理时间(时)',
            'pending_dest_expiry_hours': '验证邮件未确认超时(时)',
            'allowed_countries': '允许注册的国家代码(ALL不限)',
            'allow_registration': '是否开放新注册',
            'enable_invitation_code': '是否启用邀请码',
            'max_destination_duration_hours': '绑定验证邮箱最大有效期',
            'max_route_duration_hours': '专属域名邮箱最大有效期',
            'inbound_mail_retention_days': '站内邮件保留天数',
            'max_inbound_body_bytes': '站内邮件正文最大大小(MB)',
            'max_inbound_attachment_bytes': '单附件最大大小(MB)',
            'max_inbound_total_attachment_bytes': '单封邮件附件总大小(MB)',
            'max_inbound_r2_storage_bytes': '站内附件 R2 存储上限(MB)',
            'max_inbound_attachments_per_email': '单封邮件附件数量上限'
        };
        let currPage = 1;
        let cfZones = [];
        let bypassWarned = false;
        let themeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

        function escapeHTML(s) {
            var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return map[ch]; });
        }
        function getStoredThemePreference() {
            try {
                var value = localStorage.getItem('themePreference') || 'system';
                return ['system','light','dark'].indexOf(value) >= 0 ? value : 'system';
            } catch (_) {
                return 'system';
            }
        }
        function resolveThemePreference(preference) {
            var value = ['system','light','dark'].indexOf(preference) >= 0 ? preference : 'system';
            if (value === 'light' || value === 'dark') return value;
            return themeMediaQuery && themeMediaQuery.matches ? 'dark' : 'light';
        }
        function applyThemePreference(preference) {
            var value = ['system','light','dark'].indexOf(preference) >= 0 ? preference : 'system';
            var resolved = resolveThemePreference(value);
            document.documentElement.dataset.theme = resolved;
            document.documentElement.dataset.themePreference = value;
            try { localStorage.setItem('themePreference', value); } catch (_) {}
            var btn = document.getElementById('theme-toggle');
            if (btn) btn.textContent = '主题：' + (value === 'light' ? '浅色' : (value === 'dark' ? '深色' : '跟随系统'));
        }
        function toggleThemePreference() {
            var order = ['system','light','dark'];
            var current = getStoredThemePreference();
            applyThemePreference(order[(order.indexOf(current) + 1) % order.length]);
        }
        function watchSystemThemeChange() {
            if (!themeMediaQuery) return;
            var sync = function(){ if (getStoredThemePreference() === 'system') applyThemePreference('system'); };
            if (themeMediaQuery.addEventListener) themeMediaQuery.addEventListener('change', sync);
            else if (themeMediaQuery.addListener) themeMediaQuery.addListener(sync);
        }
        function showT(msg, e){ const c=document.getElementById('toast-container'),t=document.createElement('div');t.className='px-4 py-2 rounded shadow-lg text-white text-sm transition-all translate-x-full opacity-0 ' + (e?'bg-rose-600':'bg-emerald-600');t.innerText=msg;c.appendChild(t); setTimeout(function(){t.classList.remove('translate-x-full','opacity-0');},10); setTimeout(function(){t.classList.add('translate-x-full','opacity-0');setTimeout(function(){t.remove();},300);},3000); }
        function bytesToMbValue(value) {
            var bytes = Number(value || 0);
            if (!Number.isFinite(bytes) || bytes < 0) bytes = 0;
            var text = (bytes / bytesPerMB).toFixed(3);
            return text.replace(/\\.0+$/, '').replace(/(\\.\\d*?)0+$/, '$1');
        }
        function mbToBytesValue(value) {
            var mb = Number(String(value == null ? '' : value).trim());
            if (!Number.isFinite(mb) || mb < 0) return null;
            return String(Math.round(mb * bytesPerMB));
        }
        function formatStorageSize(bytes) {
            var n = Number(bytes || 0);
            if (!Number.isFinite(n) || n < 0) n = 0;
            if (n >= 1073741824) return (n / 1073741824).toFixed(2).replace(/\\.00$/, '') + ' GB';
            if (n >= 1048576) return (n / 1048576).toFixed(2).replace(/\\.00$/, '') + ' MB';
            if (n >= 1024) return (n / 1024).toFixed(1).replace(/\\.0$/, '') + ' KB';
            return n + ' B';
        }
        function renderStorageStatus(storage) {
            var box = document.getElementById('r2-storage-status');
            if (!box) return;
            storage = storage || {};
            var used = Number(storage.usedBytes || 0);
            var limit = Number(storage.limitBytes || 0);
            var percent = Number(storage.usagePercent || 0);
            if (!Number.isFinite(percent)) percent = 0;
            percent = Math.max(0, Math.min(100, percent));
            var boundLabel = storage.r2Bound ? 'R2 已绑定' : 'R2 未绑定';
            var boundClass = storage.r2Bound ? 'text-emerald-300 bg-emerald-900/30 border-emerald-700/50' : 'text-amber-200 bg-amber-900/30 border-amber-700/50';
            var limitText = limit > 0 ? formatStorageSize(limit) : '不保存附件';
            box.innerHTML = '<div class="bg-gray-800 border border-gray-700 rounded-xl p-4">' +
                '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">' +
                  '<div><div class="text-sm font-bold text-white">站内附件 R2 用量</div><div class="text-xs text-gray-400 mt-1">当前系统附件占用 ' + escapeHTML(formatStorageSize(used)) + ' / ' + escapeHTML(limitText) + '，共 ' + escapeHTML(storage.attachmentCount || 0) + ' 个附件</div></div>' +
                  '<span class="text-xs px-2.5 py-1 rounded-lg border ' + boundClass + '">' + boundLabel + '</span>' +
                '</div>' +
                '<div class="h-2 bg-gray-900 rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:' + percent.toFixed(1) + '%"></div></div>' +
                '<div class="mt-2 text-xs text-gray-500">占比 ' + percent.toFixed(1) + '%</div>' +
              '</div>';
        }
        function configControl(i) {
            if (durationConfigKeys.indexOf(i.key) >= 0) {
                return '<select id="cfg-' + escapeHTML(i.key) + '" class="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-emerald-500">' + durationOptions.map(function(o){ return '<option value="' + o.value + '"' + (String(i.value) === o.value ? ' selected' : '') + '>' + o.label + '</option>'; }).join('') + '</select>';
            }
            if (booleanConfigKeys.indexOf(i.key) >= 0) {
                return '<select id="cfg-' + escapeHTML(i.key) + '" class="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-emerald-500"><option value="true"' + (String(i.value) === 'true' ? ' selected' : '') + '>true</option><option value="false"' + (String(i.value) === 'false' ? ' selected' : '') + '>false</option></select>';
            }
            if (sizeConfigKeys.indexOf(i.key) >= 0) {
                return '<input type="number" step="0.001" min="0" id="cfg-' + escapeHTML(i.key) + '" value="' + escapeHTML(bytesToMbValue(i.value)) + '" class="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-emerald-500">';
            }
            return '<input type="text" id="cfg-' + escapeHTML(i.key) + '" value="' + escapeHTML(i.value) + '" class="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-emerald-500">';
        }
        applyThemePreference(getStoredThemePreference());
        watchSystemThemeChange();

        window.onload = async function() {
            var booting = document.getElementById('booting-panel');
            var loginPanel = document.getElementById('login-panel');
            var dashboardPanel = document.getElementById('dashboard-panel');
            try {
                var session = await fetch(basePath+'/config');
                if (session.ok) {
                    loginPanel.classList.add('hidden');
                    dashboardPanel.classList.remove('hidden');
                    loadConfigs(); syncDomains(); loadUsers(1); loadInvites();
                } else {
                    loginPanel.classList.remove('hidden');
                }
            } catch (_) {
                loginPanel.classList.remove('hidden');
            } finally {
                booting.classList.add('hidden');
            }
        };
        function nav(tab){
            ['domains','invites','users'].forEach(function(name){
                document.getElementById('view-'+name).style.display = tab===name?'block':'none';
                document.getElementById('nav-'+name).className = tab===name?'text-emerald-400 font-bold border-b-2 border-emerald-400 pb-1':'text-gray-400 hover:text-white font-bold pb-1 transition-colors';
            });
            if(tab === 'invites') loadInvites();
        }
        async function handleAdminLogin(e){
            e.preventDefault();
            var t = new FormData(e.target).get('cf-turnstile-response');
            if (TURNSTILE_BYPASS && !t) t = 'bypass';
            if(!t) return showT('请完成人机验证', true);
            const res=await fetch(basePath+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('admin-user').value,password:document.getElementById('admin-pass').value,turnstileToken: TURNSTILE_BYPASS ? '' : t})});
            if(res.ok) location.reload();
            else {
                const d = await res.json().catch(function(){ return {}; });
                showT(d.error || '验证失败，请检查账号密码', true);
                if (!TURNSTILE_BYPASS && window.turnstile) window.turnstile.reset();
            }
        }
        async function loadConfigs(){
            const d = await (await fetch(basePath+'/config')).json();
            renderStorageStatus(d.storage || {});
            if (d.security && d.security.turnstileBypass && !bypassWarned) {
                bypassWarned = true;
                showT('安全告警：TURNSTILE_BYPASS=true，当前人机验证已绕过，仅限排障。', true);
            }
            const rows = (d.data || []).sort(function(a,b){
                var ai = cfgOrder.indexOf(a.key), bi = cfgOrder.indexOf(b.key);
                return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            });
            document.getElementById('config-list').innerHTML = rows.map(function(i){
                return '<div class="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-between"><span class="text-sm font-bold text-emerald-400 mb-2">' + escapeHTML(cfgDict[i.key]||i.key) + ' <span class="text-gray-500 font-normal text-xs">(' + escapeHTML(i.key) + ')</span></span><div class="flex gap-2">' + configControl(i) + '<button onclick="saveC(\\'' + escapeHTML(i.key) + '\\')" class="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/50 px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap">保存</button></div></div>';
            }).join('');
        }
        async function saveC(k){
            let v=document.getElementById('cfg-'+k).value;
            if (sizeConfigKeys.indexOf(k) >= 0) {
                v = mbToBytesValue(v);
                if (v == null) return showT('请输入有效的 MB 数值', true);
            }
            const r=await fetch(basePath+'/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?'参数已保存':(d.error || '保存失败'),!r.ok);
            if(r.ok) loadConfigs();
        }
        async function syncDomains(){
            document.getElementById('domain-list').innerHTML='<span class="text-emerald-500 animate-pulse">正在穿透 CF 接口拉取全量域名...</span>';
            try {
                const cfResRaw = await fetch(basePath+'/cf-zones');
                const cfRes = await cfResRaw.json();
                if (cfRes.error) {
                    return document.getElementById('domain-list').innerHTML='<div class="p-4 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300"><b>CF 接口拒绝访问：</b><br/>' + escapeHTML(JSON.stringify(cfRes.details)) + '<br/>请检查 API 令牌是否拥有 Zone:Read 权限，以及是否授权了 All Zones。</div>';
                }
                const dbR = await fetch(basePath+'/domains');
                const dbD = (await dbR.json()).data||[];
                cfZones = cfRes.data||[];
                if(!cfZones.length) return document.getElementById('domain-list').innerHTML='<span class="text-gray-400">拉取成功，但您的账号下未找到任何可用域名。</span>';
                document.getElementById('sub-zone').innerHTML = cfZones.map(function(z, idx){ return '<option value="' + idx + '">' + escapeHTML(z.name) + '</option>'; }).join('');
                document.getElementById('domain-list').innerHTML = cfZones.map(function(z, idx){
                    const on = dbD.find(function(d){ return d.zone_id===z.id && d.domain===z.name; });
                    return on ? '<div class="flex justify-between items-center p-3 bg-emerald-900/30 border border-emerald-800 rounded-lg mb-2"><span class="text-emerald-200">' + escapeHTML(z.name) + '</span><button onclick="tDom(\\'del\\',' + on.id + ')" class="text-xs bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 px-3 py-1.5 rounded transition-colors">取消授权并清空路由</button></div>'
                              : '<div class="flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-lg mb-2"><span class="text-gray-400">' + escapeHTML(z.name) + '</span><button onclick="tDom(\\'add\\',' + idx + ')" class="text-xs bg-gray-700 hover:bg-emerald-600 px-3 py-1.5 rounded transition-colors">授权开放</button></div>';
                }).join('');
                renderAuthorizedDomains(dbD);
            } catch (err) { document.getElementById('domain-list').innerHTML='<span class="text-rose-400">网络请求异常，请检查控制台。</span>'; }
        }
        function renderAuthorizedDomains(items){
            document.getElementById('authorized-domain-list').innerHTML = items.length ? items.map(function(d){
                const zone = cfZones.find(function(z){ return z.id === d.zone_id; });
                const isSub = zone && d.domain !== zone.name;
                return '<div class="flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-lg"><div><span class="text-emerald-200">' + escapeHTML(d.domain) + '</span><span class="ml-2 text-xs text-gray-500">' + (isSub ? '子域名' : '根域名') + '</span></div><button onclick="tDom(\\'del\\',' + d.id + ')" class="text-xs bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 px-3 py-1.5 rounded transition-colors">删除</button></div>';
            }).join('') : '<div class="text-gray-500">当前还没有开放邮箱域名</div>';
        }
        async function tDom(act, ref){
            if(act==='del' && !confirm('高危操作：此操作将强行删除 Cloudflare 上该域名所属的所有用户路由！确定吗？')) return;
            if (act === 'del') await fetch(basePath+'/domains/'+ref,{method:'DELETE'});
            else {
                const z = cfZones[ref];
                const r = await fetch(basePath+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:z.name,zone_id:z.id,zone_name:z.name})});
                const d = await r.json().catch(function(){ return {}; });
                if(!r.ok) showT(d.error || '域名开放失败', true);
            }
            syncDomains();
        }
        async function addSubdomain(e){
            e.preventDefault();
            const z = cfZones[document.getElementById('sub-zone').value];
            if(!z) return showT('请先选择根域名', true);
            let sub = document.getElementById('sub-name').value.trim().toLowerCase();
            if(!sub) return showT('请输入子域名前缀', true);
            sub = sub.replace(/^@\\./,'').replace(/\\.$/,'');
            if(sub === z.name) return showT('根域名请使用上方授权开放，不要作为子域名添加', true);
            if(sub.indexOf('.') >= 0 && !sub.endsWith('.' + z.name)) return showT('完整子域名必须属于所选根域名', true);
            const full = sub.endsWith('.' + z.name) ? sub : sub + '.' + z.name;
            const r = await fetch(basePath+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:full,zone_id:z.id,zone_name:z.name})});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?'子域名已开放，Cloudflare Email Routing DNS 已配置':(d.error || '子域名开放失败'),!r.ok);
            if(r.ok){ document.getElementById('sub-name').value=''; syncDomains(); }
        }
        async function runCleanup(){
            const r = await fetch(basePath + '/cleanup', {method:'POST'});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?(d.message || '清理完成'):(d.error || '清理失败'), !r.ok);
            if (r.ok) loadConfigs();
        }
        function randomInvite(){
            const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const bytes = new Uint8Array(12);
            if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
            else for (let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random() * 256);
            let code = '';
            for (let i=0;i<bytes.length;i++) code += alphabet[bytes[i] % alphabet.length];
            document.getElementById('new-invite-code').value = code.slice(0,4) + '-' + code.slice(4,8) + '-' + code.slice(8,12);
            if(!document.getElementById('new-invite-max').value) document.getElementById('new-invite-max').value = '1';
        }
        async function loadInvites(){
            const res = await fetch(basePath + '/invitations');
            if(!res.ok) return;
            const d = await res.json();
            document.getElementById('invite-table-body').innerHTML = (d.data || []).map(function(i){
                var code = escapeHTML(i.code), left = Math.max(0, Number(i.max_uses) - Number(i.used_count || 0));
                return '<tr class="hover:bg-gray-800 transition-colors"><td class="p-3 font-mono text-emerald-300">' + code + '</td><td class="p-3"><input id="inv-max-' + code + '" type="number" min="1" value="' + i.max_uses + '" class="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white"></td><td class="p-3"><input id="inv-used-' + code + '" type="number" min="0" value="' + (i.used_count || 0) + '" class="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white"></td><td class="p-3 text-gray-400">' + left + '</td><td class="p-3 text-xs text-gray-500">' + escapeHTML(new Date(i.created_at).toLocaleString()) + '</td><td class="p-3 whitespace-nowrap"><button onclick="saveInvite(\\'' + code + '\\')" class="text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded mr-2">保存</button><button onclick="deleteInvite(\\'' + code + '\\')" class="text-xs bg-rose-900/50 text-rose-300 px-3 py-1.5 rounded">删除</button></td></tr>';
            }).join('') || '<tr><td colspan="6" class="text-center p-8 text-gray-500">还没有配置邀请码</td></tr>';
        }
        async function createInvite(e){
            e.preventDefault();
            const code = document.getElementById('new-invite-code').value.trim();
            const max = document.getElementById('new-invite-max').value;
            const r = await fetch(basePath + '/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code,max_uses:max})});
            const d = await r.json();
            showT(r.ok?'邀请码已新增':(d.error || '新增失败'),!r.ok);
            if(r.ok){ document.getElementById('new-invite-code').value=''; document.getElementById('new-invite-max').value=''; loadInvites(); }
        }
        async function saveInvite(code){
            const max = document.getElementById('inv-max-'+code).value;
            const used = document.getElementById('inv-used-'+code).value;
            const r = await fetch(basePath + '/invitations/' + encodeURIComponent(code),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({max_uses:max,used_count:used})});
            const d = await r.json();
            showT(r.ok?'邀请码已保存':(d.error || '保存失败'),!r.ok);
            if(r.ok) loadInvites();
        }
        async function deleteInvite(code){
            if(!confirm('确定删除这个邀请码吗？')) return;
            const r = await fetch(basePath + '/invitations/' + encodeURIComponent(code),{method:'DELETE'});
            showT(r.ok?'邀请码已删除':'删除失败',!r.ok);
            if(r.ok) loadInvites();
        }
        async function loadUsers(page){
            currPage = page; const s = document.getElementById('search-user').value;
            const res = await fetch(basePath+'/users?page='+page+'&search='+encodeURIComponent(s));
            const d = await res.json();
            document.getElementById('user-table-body').innerHTML = (d.data || []).map(function(u){
                var destinations = Array.isArray(u.destinations) ? u.destinations : [];
                var destinationHTML = destinations.length
                    ? destinations.map(function(dest){
                        var verified = dest.status === 'verified';
                        var statusText = verified ? '已验证' : '待验证';
                        var statusClass = verified
                            ? 'text-emerald-300 border-emerald-700/50 bg-emerald-900/20'
                            : 'text-blue-300 border-blue-700/50 bg-blue-900/20';
                        return '<div class="flex items-center gap-2"><span class="font-mono text-gray-200">' + escapeHTML(dest.email || '') + '</span><span class="text-[10px] px-1.5 py-0.5 rounded border ' + statusClass + '">' + statusText + '</span></div>';
                    }).join('')
                    : '<span class="text-gray-600 italic">未绑定</span>';
                return '<tr class="hover:bg-gray-800 transition-colors"><td class="p-3 text-gray-400">' + u.id + '</td><td class="p-3 font-bold text-emerald-400">' + escapeHTML(u.username) + '</td><td class="p-3 text-xs font-mono text-gray-500">' + escapeHTML(u.reg_ip) + '</td><td class="p-3"><div class="space-y-1">' + destinationHTML + '</div></td><td class="p-3"><span class="bg-gray-700 px-2 py-1 rounded text-xs">' + u.route_count + ' 条</span></td><td class="p-3 text-xs text-gray-500">' + new Date(u.created_at).toLocaleString() + '</td><td class="p-3"><button onclick="deleteUser(' + u.id + ')" class="text-xs bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 px-3 py-1.5 rounded transition-colors">清除</button></td></tr>';
            }).join('') || '<tr><td colspan="7" class="text-center p-8 text-gray-500">此页暂无数据记录</td></tr>';
            document.getElementById('page-info').innerText = '第 ' + page + ' 页';
        }
        async function deleteUser(id){
            if(!confirm('确定清除这个用户吗？该用户的底层收件箱、专属域名邮箱和会话都会被删除。')) return;
            const r = await fetch(basePath + '/users/' + id, {method:'DELETE'});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?(d.message || '用户已清除'):(d.error || '清除失败'), !r.ok);
            if(r.ok) loadUsers(currPage);
        }
        function changePage(d){ if(currPage+d>0) loadUsers(currPage+d); }
        async function logout(){ await fetch(basePath+'/logout',{method:'POST'}); location.reload(); }
    </script>
</body>
</html>`;

// ==========================================
// 3. 后端 API 逻辑
// ==========================================
export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, method = req.method;
    const jsonRes = jsonResponse;
    const readBody = async () => {
      const parsed = await readJsonBody(req);
      if (!parsed.ok) return {ok: false, response: jsonRes({error: parsed.error}, 400)};
      return {ok: true, data: parsed.data};
    };

    if (!isTrustedOrigin(req, url)) return jsonRes({error:"跨站请求已被拒绝"}, 403);
    if (!env.DB) return jsonRes({error:"请在Settings->Bindings里绑定大写 DB 数据库"}, 500);
    const db = env.DB, adminPath = env.ADMIN_PATH || '/admin';
    const genT = () => crypto.randomUUID(), getC = (n) => req.headers.get('Cookie')?.match(new RegExp('(^| )'+n+'=([^;]+)'))?.[2];

    try {
      await ensureSystem(db);
      const cfg = await getConfigMap(db);
      const turnstileBypass = String(env.TURNSTILE_BYPASS || '').toLowerCase() === 'true';
      if (turnstileBypass) console.warn('[security_mode=turnstile_bypass]', JSON.stringify({ path, method }));

      if (path === '/favicon.ico') return emptyResponse(204);
      if (path === '/') return htmlResponse(renderUserHTML(env.TURNSTILE_SITEKEY, turnstileBypass));
      if (path === adminPath) return htmlResponse(renderAdminHTML(adminPath, env.TURNSTILE_SITEKEY, turnstileBypass));
      if (path === '/api/public-config' && method === 'GET') return jsonRes(await getPublicConfig(db, cfg));

      const verifyTurnstile = async(t, ip) => {
        if(turnstileBypass) return {ok:true};
        if(!env.TURNSTILE_SECRET) return {ok:false, error:"Turnstile Secret 未配置"};
        if(!t) return {ok:false, error:"请完成人机验证"};
        const body = new URLSearchParams();
        body.set('secret', env.TURNSTILE_SECRET);
        body.set('response', t);
        if(ip && ip !== '0' && ip !== '0.0.0.0') body.set('remoteip', ip);
        try {
          const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method:'POST', body});
          const data = await res.json();
          if(data.success) return {ok:true};
          const codes = data['error-codes'] || [];
          if(codes.includes('timeout-or-duplicate')) return {ok:false, error:"人机验证已过期或已被使用，请重新勾选验证"};
          if(codes.includes('invalid-input-secret')) return {ok:false, error:"Turnstile Secret 配置错误"};
          if(codes.includes('invalid-input-response') || codes.includes('missing-input-response')) return {ok:false, error:"人机验证无效，请刷新页面后重试"};
          return {ok:false, error:"人机验证失败，请重试"};
        } catch (_) {
          return {ok:false, error:"人机验证服务暂时不可用，请稍后重试"};
        }
      };

      // --- Admin Auth ---
      if (path.startsWith(adminPath)) {
        const act = path.replace(adminPath, '');
        if (act === '/login' && method === 'POST') {
          const body = await readBody(); if (!body.ok) return body.response;
          const {username, password, turnstileToken} = body.data;
          const ip = getClientIp(req);
          const adminName = normalizeUsername(username);
          if (await isAuthRateLimited(db, 'admin_login', ip, adminName)) return jsonRes({error:"请求过于频繁，请稍后再试"},429);
          const turnstile = await verifyTurnstile(turnstileToken, ip);
          if (!turnstile.ok) {
            await recordAuthFailure(db, 'admin_login', ip, adminName);
            return jsonRes({error:turnstile.error},400);
          }
          if (adminName===String(env.ADMIN_USERNAME || '') && String(password || '')===String(env.ADMIN_PASSWORD || '')) {
            await clearAuthFailures(db, 'admin_login', ip, adminName);
            const t = genT(); await db.prepare("INSERT INTO sessions(token,role,expires_at) VALUES(?,'admin',datetime('now','+1 day'))").bind(t).run();
            return jsonRes({success:true}, 200, {'Set-Cookie':buildCookie('admin_token', t, adminPath, 86400)});
          }
          await recordAuthFailure(db, 'admin_login', ip, adminName);
          return jsonRes({error:"账号或密码不正确"}, 401);
        }
        if (act === '/logout' && method === 'POST') return jsonRes({success:true}, 200, {'Set-Cookie':buildCookie('admin_token', '', adminPath, 0)});

        const aT = getC('admin_token'); if(!aT) return jsonRes({error:"无权访问"}, 403);
        if(!(await db.prepare("SELECT 1 FROM sessions WHERE token=? AND role='admin' AND expires_at>datetime('now')").bind(aT).first())) return jsonRes({error:"登录状态失效"}, 403);

        if (act === '/config' && method === 'GET') {
          return jsonRes({
            data:(await db.prepare("SELECT key, value FROM sys_config").all()).results,
            storage: await getInboundAttachmentStorageUsage(db, env, cfg),
            security:{
              turnstileBypass,
              securityMode: turnstileBypass ? 'turnstile_bypass' : 'normal'
            }
          });
        }
        if (act === '/config' && method === 'POST') {
          const body = await readBody(); if (!body.ok) return body.response;
          const {key, value} = body.data;
          const cleanKey = String(key || '');
          if (!DEFAULT_CONFIGS.some(([k]) => k === cleanKey)) return jsonRes({error:"未知配置项"}, 400);
          const nextValue = validateConfigValue(cleanKey, value);
          if (!nextValue.ok) return jsonRes({error:nextValue.error}, 400);

          const nextCfg = {...cfg, [cleanKey]: nextValue.value};
          if (durationRank(nextCfg.max_route_duration_hours) > durationRank(nextCfg.max_destination_duration_hours)) {
            return jsonRes({error:"专属域名邮箱最大有效期不能超过绑定验证邮箱最大有效期"}, 400);
          }

          await db.prepare("INSERT INTO sys_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(cleanKey, nextValue.value).run();
          return jsonRes({success:true});
        }

        if (act === '/cleanup' && method === 'POST') {
          await runTimedCleanup(db, env, cfg);
          return jsonRes({success:true, message:"过期数据已清理"});
        }

        // --- 拉取所有域名 ---
        if (act === '/cf-zones' && method === 'GET') {
          const cf = await cfRequest(env, '/zones', {label: 'list_zones'});
          if(!cf.ok) return jsonRes({error:true, details: cf.data.errors || cf.data}, 400);
          return jsonRes({data: cf.data.result || []});
        }

        if (act === '/domains' && method === 'GET') return jsonRes({data:(await db.prepare("SELECT id,domain,zone_id FROM domains ORDER BY domain ASC").all()).results});
        if (act === '/domains' && method === 'POST') {
          const body = await readBody(); if (!body.ok) return body.response;
          const {domain, zone_id, zone_name} = body.data;
          const cleanDomain = normalizeDomain(domain);
          const cleanZoneName = normalizeDomain(zone_name || domain);
          const cleanZoneId = String(zone_id || '').trim();
          if(!cleanZoneId || cleanZoneId.length > 128) return jsonRes({error:"缺少 Zone ID"},400);
          if(!isValidDomainName(cleanDomain)) return jsonRes({error:"域名格式不正确"},400);
          if(!isValidDomainName(cleanZoneName) || !domainBelongsToZone(cleanDomain, cleanZoneName)) return jsonRes({error:"子域名必须属于所选根域名"},400);
          if(await db.prepare("SELECT id FROM domains WHERE domain=?").bind(cleanDomain).first()) return jsonRes({error:"这个邮箱域名已经开放"},400);

          if(cleanDomain !== cleanZoneName) {
            const cf = await cfEnableEmailRoutingDomain(cleanZoneId, cleanDomain, env);
            const details = JSON.stringify(cf.data?.errors || cf.data?.messages || cf.data || {});
            if(!cf.ok && !/already|exist|enabled|configured/i.test(details)) {
              return jsonRes({error:"Cloudflare 未能启用该子域名的 Email Routing DNS，请确认 API Token 有 Zone Settings Write 权限", details: cf.data?.errors || cf.data},500);
            }
          }

          await db.prepare("INSERT INTO domains(domain,zone_id) VALUES(?,?)").bind(cleanDomain, cleanZoneId).run();
          return jsonRes({success:true});
        }
        if (act.startsWith('/domains/') && method === 'DELETE') {
          const id = parseInt(act.split('/')[2], 10);
          if(!Number.isFinite(id) || id < 1) return jsonRes({error:"域名 ID 不正确"},400);
          const dData = await db.prepare("SELECT zone_id FROM domains WHERE id=?").bind(id).first();
          if (dData) {
            const rts = await db.prepare("SELECT cf_rule_id FROM email_routes WHERE domain_id=?").bind(id).all();
            for (const r of rts.results || []) {
              if (r.cf_rule_id) await cfDeleteRoute(env, dData.zone_id, r.cf_rule_id, 'delete_domain_route');
            }
            await db.prepare("DELETE FROM email_routes WHERE domain_id=?").bind(id).run();
            await db.prepare("DELETE FROM domains WHERE id=?").bind(id).run();
          }
          return jsonRes({success:true});
        }

        if (act === '/invitations' && method === 'GET') {
          return jsonRes({data:(await db.prepare("SELECT code,max_uses,used_count,created_at FROM invitation_codes ORDER BY created_at DESC").all()).results});
        }
        if (act === '/invitations' && method === 'POST') {
          const body = await readBody(); if (!body.ok) return body.response;
          const {code, max_uses} = body.data;
          const cleanCode = String(code || '').trim();
          const maxUses = parseInt(max_uses, 10);
          if(!/^[A-Za-z0-9_-]{3,64}$/.test(cleanCode)) return jsonRes({error:"邀请码只能使用 3-64 位字母、数字、下划线或短横线"}, 400);
          if(!Number.isFinite(maxUses) || maxUses < 1 || maxUses > MAX_INVITATION_USES) return jsonRes({error:`最大使用次数必须在 1 到 ${MAX_INVITATION_USES} 之间`}, 400);
          try {
            await db.prepare("INSERT INTO invitation_codes(code,max_uses,used_count) VALUES(?,?,0)").bind(cleanCode, maxUses).run();
            return jsonRes({success:true});
          } catch (_) {
            return jsonRes({error:"这个邀请码已经存在"}, 400);
          }
        }
        if (act.startsWith('/invitations/') && method === 'PUT') {
          const decoded = safeDecodeURIComponent(act.split('/')[2] || '');
          if(!decoded.ok || !/^[A-Za-z0-9_-]{3,64}$/.test(decoded.value)) return jsonRes({error:"邀请码不正确"},400);
          const code = decoded.value;
          const body = await readBody(); if (!body.ok) return body.response;
          const {max_uses, used_count} = body.data;
          const maxUses = parseInt(max_uses, 10);
          const usedCount = parseInt(used_count, 10);
          if(!Number.isFinite(maxUses) || maxUses < 1 || maxUses > MAX_INVITATION_USES) return jsonRes({error:`最大使用次数必须在 1 到 ${MAX_INVITATION_USES} 之间`}, 400);
          if(!Number.isFinite(usedCount) || usedCount < 0 || usedCount > maxUses) return jsonRes({error:"已使用次数必须在 0 到最大次数之间"}, 400);
          await db.prepare("UPDATE invitation_codes SET max_uses=?, used_count=? WHERE code=?").bind(maxUses, usedCount, code).run();
          return jsonRes({success:true});
        }
        if (act.startsWith('/invitations/') && method === 'DELETE') {
          const decoded = safeDecodeURIComponent(act.split('/')[2] || '');
          if(!decoded.ok || !/^[A-Za-z0-9_-]{3,64}$/.test(decoded.value)) return jsonRes({error:"邀请码不正确"},400);
          const code = decoded.value;
          await db.prepare("DELETE FROM invitation_codes WHERE code=?").bind(code).run();
          return jsonRes({success:true});
        }

        if (act.startsWith('/users/') && method === 'DELETE') {
          const userId = parseInt(act.split('/')[2], 10);
          if(!Number.isFinite(userId)) return jsonRes({error:"用户 ID 不正确"},400);
          const user = await db.prepare("SELECT id FROM users WHERE id=?").bind(userId).first();
          if(!user) return jsonRes({error:"用户不存在"},404);
          await deleteUserAccount(db, env, userId);
          return jsonRes({success:true, message:"用户已清除"});
        }

        if (act.startsWith('/users') && method === 'GET') {
          const page = parsePositiveInteger(url.searchParams.get('page') || '1', 1, 1, 100000), search = normalizeSearch(url.searchParams.get('search') || '');
          const offset = (page - 1) * 20;
          const q = `SELECT u.id, u.username, u.reg_ip, u.created_at, (SELECT d.email FROM user_destinations d WHERE d.user_id=u.id AND d.status='verified' AND (d.expires_at IS NULL OR datetime(d.expires_at)>datetime('now')) ORDER BY d.id DESC LIMIT 1) AS dest_email, (SELECT COUNT(*) FROM email_routes r WHERE r.user_id=u.id AND r.status='active' AND (r.expires_at IS NULL OR datetime(r.expires_at)>datetime('now'))) AS route_count FROM users u WHERE u.username LIKE ? ORDER BY u.id DESC LIMIT 20 OFFSET ?`;
          const users = (await db.prepare(q).bind('%'+search+'%', offset).all()).results || [];
          if (!users.length) return jsonRes({data: []});

          const pendingHours = getPendingExpiryHours(cfg);
          const userIds = users.map((u) => parseInt(u.id, 10)).filter((id) => Number.isFinite(id));
          let destinations = [];
          if (userIds.length) {
            const placeholders = userIds.map(() => '?').join(',');
            destinations = (await db.prepare(`
              SELECT id,user_id,email,status,expires_at,created_at
              FROM user_destinations
              WHERE user_id IN (${placeholders})
                AND status!='expired'
                AND (
                  (status='verified' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now')))
                  OR
                  (status='pending' AND created_at>=datetime('now','-'||?||' hours'))
                )
              ORDER BY user_id ASC, CASE WHEN status='verified' THEN 0 ELSE 1 END, id DESC
            `).bind(...userIds, pendingHours).all()).results || [];
          }

          const byUser = {};
          for (const item of destinations) {
            const uid = parseInt(item.user_id, 10);
            if (!Number.isFinite(uid)) continue;
            if (!byUser[uid]) byUser[uid] = [];
            byUser[uid].push({
              email: item.email,
              status: item.status,
              expires_at: item.expires_at,
              created_at: item.created_at
            });
          }

          for (const user of users) {
            const uid = parseInt(user.id, 10);
            user.destinations = Number.isFinite(uid) ? (byUser[uid] || []) : [];
            if (user.destinations.length > 0) user.dest_email = user.destinations[0].email;
          }

          return jsonRes({data: users});
        }
        return jsonRes({error:"请求不存在"}, 404);
      }

      // --- 用户公共 API ---
      if (path === '/api/register' && method === 'POST') {
        const body = await readBody(); if (!body.ok) return body.response;
        const {username, password, turnstileToken, invitationCode} = body.data, ip = getClientIp(req);
        const usernameCheck = validateUsername(username);
        const registerIdentifier = usernameCheck.ok ? usernameCheck.value : normalizeUsername(username);
        if (await isAuthRateLimited(db, 'register', ip, registerIdentifier)) return jsonRes({error:"请求过于频繁，请稍后再试"},429);
        const rejectRegister = async (payload, status = 400) => {
          await recordAuthFailure(db, 'register', ip, registerIdentifier);
          return jsonRes(payload, status);
        };
        if (!usernameCheck.ok) return await rejectRegister({error:usernameCheck.error},400);
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.ok) return await rejectRegister({error:passwordCheck.error},400);
        const turnstile = await verifyTurnstile(turnstileToken, ip);
        if (!turnstile.ok) return await rejectRegister({error:turnstile.error},400);

        if (cfg.allow_registration !== 'true') return await rejectRegister({error:"抱歉，系统当前已关闭新用户注册"},403);
        const allowedCountryConfig = String(cfg.allowed_countries || 'ALL').trim().toUpperCase();
        const allowedCountries = allowedCountryConfig.split(',').map((i) => i.trim());
        if (allowedCountryConfig!=='ALL' && !allowedCountries.includes(req.cf?.country||'XX')) return await rejectRegister({error:"地区拦截：您所在的地区暂时不允许注册"},403);
        let maxUsers = parseInt(cfg.max_users || '1000', 10);
        if(!Number.isFinite(maxUsers) || maxUsers < 0) maxUsers = 1000;
        if ((await db.prepare("SELECT COUNT(*) as c FROM users").first()).c >= maxUsers) return await rejectRegister({error:"系统名额已被注册完毕"},403);

        const inviteCount = (await db.prepare("SELECT COUNT(*) AS c FROM invitation_codes").first())?.c || 0;
        const inviteRequired = cfg.enable_invitation_code === 'true' && inviteCount > 0;
        let invite = null;
        if (inviteRequired) {
          const code = String(invitationCode || '').trim();
          if (!code) return await rejectRegister({error:"请输入邀请码"}, 400);
          invite = await db.prepare("SELECT code,max_uses,used_count FROM invitation_codes WHERE code=?").bind(code).first();
          if (!invite || invite.used_count >= invite.max_uses) return await rejectRegister({error:"邀请码不存在或已被用完"}, 400);
        }

        let ipLim = parseInt(cfg.max_regs_per_ip_24h || '1', 10);
        if(!Number.isFinite(ipLim) || ipLim < 1) ipLim = 1;
        if ((await db.prepare("SELECT COUNT(*) as c FROM users WHERE reg_ip=? AND created_at>datetime('now','-1 day')").bind(ip).first()).c >= ipLim) {
          return await rejectRegister({error:`风控拦截：每个 IP 每 24 小时仅允许注册 ${ipLim} 个账号`},429);
        }

        try {
          const hashedPassword = await hashPassword(passwordCheck.value);
          await db.prepare("INSERT INTO users(username,password,reg_ip) VALUES(?,?,?)").bind(usernameCheck.value,hashedPassword,ip).run();
          if (invite) await db.prepare("UPDATE invitation_codes SET used_count=used_count+1 WHERE code=?").bind(invite.code).run();
          await clearAuthFailures(db, 'register', ip, registerIdentifier);
          return jsonRes({success:true});
        } catch (_) {
          return await rejectRegister({error:"用户名已被占用，换一个吧"},400);
        }
      }

      if (path === '/api/login' && method === 'POST') {
        const body = await readBody(); if (!body.ok) return body.response;
        const {username, password, turnstileToken} = body.data;
        const ip = getClientIp(req);
        const loginName = normalizeUsername(username);
        if (await isAuthRateLimited(db, 'user_login', ip, loginName)) return jsonRes({error:"请求过于频繁，请稍后再试"},429);
        const rejectLogin = async (status = 401, payload = {error:"账号或密码输入不正确"}) => {
          await recordAuthFailure(db, 'user_login', ip, loginName);
          return jsonRes(payload, status);
        };
        const turnstile = await verifyTurnstile(turnstileToken,ip);
        if (!turnstile.ok) return await rejectLogin(400, {error:turnstile.error});
        if (!loginName || String(password == null ? '' : password).length > MAX_PASSWORD_LENGTH) return await rejectLogin();
        const u = await db.prepare("SELECT id,password FROM users WHERE username=?").bind(loginName).first();
        if(!u || !(await verifyPassword(password, u.password))) return await rejectLogin();
        await clearAuthFailures(db, 'user_login', ip, loginName);
        const t = genT(); await db.prepare("INSERT INTO sessions(token,user_id,role,expires_at) VALUES(?,?,'user',datetime('now','+7 days'))").bind(t,u.id).run();
        return jsonRes({success:true},200,{'Set-Cookie':buildCookie('session_token', t, '/', 604800)});
      }

      if (path === '/api/logout' && method === 'POST') return jsonRes({success:true},200,{'Set-Cookie':buildCookie('session_token', '', '/', 0)});

      const uT = getC('session_token'); if(!uT) return jsonRes({error:"请先登录"},401);
      const uS = await db.prepare("SELECT user_id FROM sessions WHERE token=? AND role='user' AND expires_at>datetime('now')").bind(uT).first(); if(!uS) return jsonRes({error:"会话已过期，请重新登录"},401);

      if (path === '/api/check-session') return jsonRes({success:true});
      if (path === '/api/me') return jsonRes(await getUserState(db, env, uS.user_id, cfg));
      if (path === '/api/domains') return jsonRes((await db.prepare("SELECT id,domain FROM domains ORDER BY domain ASC").all()).results);

      if (path === '/api/password' && method === 'POST') {
        const body = await readBody(); if (!body.ok) return body.response;
        const {oldPassword, newPassword} = body.data;
        const nextPassword = validatePassword(newPassword, '新密码');
        if (!nextPassword.ok) return jsonRes({error:nextPassword.error},400);
        if (String(oldPassword == null ? '' : oldPassword).length > MAX_PASSWORD_LENGTH) return jsonRes({error:"当前密码不正确"},403);
        const user = await db.prepare("SELECT password FROM users WHERE id=?").bind(uS.user_id).first();
        if(!user || !(await verifyPassword(oldPassword, user.password))) return jsonRes({error:"当前密码不正确"},403);
        const hashedPassword = await hashPassword(nextPassword.value);
        await db.prepare("UPDATE users SET password=? WHERE id=?").bind(hashedPassword, uS.user_id).run();
        await db.prepare("DELETE FROM sessions WHERE user_id=? AND token!=?").bind(uS.user_id, uT).run();
        return jsonRes({message:"密码已修改"});
      }

      if (path === '/api/account' && method === 'DELETE') {
        const body = await readBody(); if (!body.ok) return body.response;
        const {password} = body.data;
        if (String(password == null ? '' : password).length > MAX_PASSWORD_LENGTH) return jsonRes({error:"当前密码不正确"},403);
        const user = await db.prepare("SELECT password FROM users WHERE id=?").bind(uS.user_id).first();
        if(!user || !(await verifyPassword(password, user.password))) return jsonRes({error:"当前密码不正确"},403);
        await deleteUserAccount(db, env, uS.user_id);
        return jsonRes({message:"账号已注销"},200,{'Set-Cookie':buildCookie('session_token', '', '/', 0)});
      }

      if (path === '/api/inbox' && method === 'GET') {
        const page = parsePositiveInteger(url.searchParams.get('page') || '1', 1, 1, 100000);
        const routeId = parseInt(url.searchParams.get('routeId') || '', 10);
        const search = normalizeInboxSearch(url.searchParams.get('search') || '');
        const where = ["user_id=?"];
        const binds = [uS.user_id];
        if (Number.isFinite(routeId) && routeId > 0) {
          where.push("route_id=?");
          binds.push(routeId);
        }
        if (search) {
          where.push("(route_address LIKE ? OR from_email LIKE ? OR subject LIKE ? OR body_text LIKE ?)");
          binds.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const offset = (page - 1) * 20;
        const rows = (await db.prepare(`
          SELECT id,route_id,route_address,from_email,subject,raw_size,message_id,forward_status,received_at,read_at,
                 substr(COALESCE(body_text,''),1,240) AS preview
          FROM inbound_emails
          WHERE ${where.join(' AND ')}
          ORDER BY id DESC
          LIMIT 20 OFFSET ?
        `).bind(...binds, offset).all()).results || [];
        return jsonRes({data: rows, page});
      }

      if (path.includes('/attachments/') && path.startsWith('/api/inbox/') && method === 'GET') {
        const parts = path.split('/');
        const mailId = parseInt(parts[3], 10);
        const attachmentId = parseInt(parts[5], 10);
        if(!Number.isFinite(mailId) || mailId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) return jsonRes({error:"附件 ID 不正确"},400);
        const attachment = await db.prepare(`
          SELECT a.id,a.filename,a.content_type,a.size_bytes,a.r2_key
          FROM inbound_attachments a
          JOIN inbound_emails m ON m.id=a.mail_id AND m.user_id=a.user_id
          WHERE a.id=? AND a.mail_id=? AND a.user_id=?
        `).bind(attachmentId, mailId, uS.user_id).first();
        if(!attachment) return jsonRes({error:"附件不存在或不属于您"},404);
        if(!env.INBOUND_ATTACHMENTS) return jsonRes({error:"附件存储未绑定"},404);
        const object = await env.INBOUND_ATTACHMENTS.get(attachment.r2_key);
        if(!object) return jsonRes({error:"附件文件不存在"},404);
        const filename = normalizeAttachmentFilename(attachment.filename, 'attachment');
        const inline = url.searchParams.get('inline') === '1';
        const disposition = inline ? 'inline' : 'attachment';
        return new Response(object.body, {
          headers: buildHeaders({
            'Content-Type': attachment.content_type || 'application/octet-stream',
            'Content-Length': String(attachment.size_bytes || object.size || 0),
            'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Cache-Control': 'private, max-age=3600'
          })
        });
      }

      if (path.startsWith('/api/inbox/') && method === 'GET') {
        const mailId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(mailId) || mailId < 1) return jsonRes({error:"邮件 ID 不正确"},400);
        const mail = await db.prepare(`
          SELECT id,route_id,route_address,from_email,subject,body_text,body_html,raw_size,message_id,forward_status,attachment_count,attachment_status,received_at,read_at
          FROM inbound_emails
          WHERE id=? AND user_id=?
        `).bind(mailId, uS.user_id).first();
        if(!mail) return jsonRes({error:"邮件不存在或不属于您"},404);
        if(!mail.read_at) await db.prepare("UPDATE inbound_emails SET read_at=datetime('now') WHERE id=? AND user_id=?").bind(mailId, uS.user_id).run();
        mail.read_at = mail.read_at || sqlDateFromMs(Date.now());
        mail.attachment_status_text = attachmentStatusText(mail.attachment_status);
        mail.attachments = (await db.prepare(`
          SELECT id,filename,content_type,size_bytes,content_id,disposition
          FROM inbound_attachments
          WHERE mail_id=? AND user_id=?
          ORDER BY id ASC
        `).bind(mailId, uS.user_id).all()).results || [];
        return jsonRes({data: mail});
      }

      if (path.startsWith('/api/inbox/') && path.endsWith('/read') && method === 'POST') {
        const mailId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(mailId) || mailId < 1) return jsonRes({error:"邮件 ID 不正确"},400);
        await db.prepare("UPDATE inbound_emails SET read_at=datetime('now') WHERE id=? AND user_id=?").bind(mailId, uS.user_id).run();
        return jsonRes({success:true});
      }

      if (path.startsWith('/api/inbox/') && method === 'DELETE') {
        const mailId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(mailId) || mailId < 1) return jsonRes({error:"邮件 ID 不正确"},400);
        await deleteInboundMailById(db, env, uS.user_id, mailId);
        return jsonRes({success:true, message:"邮件已删除"});
      }

      const createDestination = async (payload) => {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const {email, durationHours, inboxDefault} = payload || {};
        const chosenDuration = String(durationHours || '');
        const defaultInbox = inboxDefault === false ? 'false' : 'true';
        const emailCheck = validateEmail(email);
        if(!emailCheck.ok) return jsonRes({error:emailCheck.error},400);
        const cleanEmail = emailCheck.value;
        if(!isValidDuration(chosenDuration)) return jsonRes({error:"请选择有效的邮箱有效期"},400);
        if(!isWithinMaxDuration(chosenDuration, cfg.max_destination_duration_hours || '168')) return jsonRes({error:"超过管理员允许的绑定邮箱最大有效期"},403);

        const userDestinationLimit = getMaxDestinationsPerUser(cfg);
        const userDestCount = (await db.prepare("SELECT COUNT(*) AS c FROM user_destinations WHERE user_id=? AND status!='expired'").bind(uS.user_id).first())?.c || 0;
        if(userDestCount >= userDestinationLimit) return jsonRes({error:`您的底层收件箱配额已达上限（最多 ${userDestinationLimit} 个）`},403);
        if(await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND email=? AND status!='expired'").bind(uS.user_id, cleanEmail).first()) return jsonRes({error:"该邮箱已经绑定，请勿重复添加"},400);

        let cfgMaxD = parseInt(cfg.max_total_destinations || '180', 10);
        if(!Number.isFinite(cfgMaxD) || cfgMaxD < 0) cfgMaxD = 180;
        if((await db.prepare("SELECT COUNT(*) as c FROM user_destinations WHERE status!='expired'").first()).c >= cfgMaxD) return jsonRes({error:"系统全局目标邮箱配额已满"},403);

        const cf = await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`, {
          method: 'POST',
          body: {email: cleanEmail},
          label: 'create_email_address'
        });
        const d = cf.data;
        if(!cf.ok || !d.result?.id) return jsonRes({error:"Cloudflare 限制或邮箱格式有误", details:d.errors || d},500);

        await db.prepare("INSERT INTO user_destinations(user_id,cf_address_id,email,status,expires_at,duration_hours,inbox_default,created_at) VALUES(?,?,?,'pending',NULL,?,?,datetime('now'))")
          .bind(uS.user_id,d.result.id,cleanEmail,chosenDuration,defaultInbox).run();
        return jsonRes({message:"验证邮件已发送，请前往底层收件箱确认。"});
      };

      if (path === '/api/destination' && method === 'POST') {
        const body = await readBody(); if (!body.ok) return body.response;
        return await createDestination(body.data);
      }
      if (path === '/api/destinations' && method === 'POST') {
        const body = await readBody(); if (!body.ok) return body.response;
        return await createDestination(body.data);
      }

      if (path === '/api/destination/refresh' && method === 'POST') {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const latestPending = await db.prepare("SELECT * FROM user_destinations WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 1").bind(uS.user_id).first();
        if(!latestPending) return jsonRes({error:"当前没有等待验证的邮箱，请重新发送验证邮件"},400);
        const cfAddress = (await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${latestPending.cf_address_id}`, {label: 'refresh_latest_email_address'})).data;
        if(!cfAddress.result?.verified) return jsonRes({error:"还没有检测到验证完成，请确认邮箱里的验证链接已经点击"},400);
        const chosenDuration = isValidDuration(latestPending.duration_hours) ? latestPending.duration_hours : (cfg.max_destination_duration_hours || '168');
        const expiresAt = expiryFromDuration(chosenDuration);
        await db.prepare("UPDATE user_destinations SET status='verified', expires_at=? WHERE id=?").bind(expiresAt, latestPending.id).run();
        return jsonRes({message:"邮箱验证已刷新成功，现在可以创建专属域名邮箱。"});
      }

      if (path.startsWith('/api/destinations/') && path.endsWith('/refresh') && method === 'POST') {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const destinationId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({error:"邮箱 ID 不正确"},400);
        const dest = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, uS.user_id).first();
        if(!dest) return jsonRes({error:"目标邮箱不存在或已过期"},404);
        if(dest.status === 'verified') return jsonRes({message:"邮箱已经完成验证"});
        if(dest.status !== 'pending') return jsonRes({error:"当前邮箱状态无法刷新验证"},400);

        const cfAddress = (await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${dest.cf_address_id}`, {label: 'refresh_email_address'})).data;
        if(!cfAddress.result?.verified) return jsonRes({error:"还没有检测到验证完成，请确认邮箱里的验证链接已经点击"},400);

        const chosenDuration = isValidDuration(dest.duration_hours) ? dest.duration_hours : (cfg.max_destination_duration_hours || '168');
        const expiresAt = expiryFromDuration(chosenDuration);
        await db.prepare("UPDATE user_destinations SET status='verified', expires_at=? WHERE id=?").bind(expiresAt, dest.id).run();
        return jsonRes({message:"邮箱验证已刷新成功，现在可以创建专属域名邮箱。"});
      }

      if (path.startsWith('/api/destinations/') && path.endsWith('/inbox-default') && method === 'PUT') {
        const destinationId = parseInt(path.split('/')[3], 10);
        const body = await readBody(); if (!body.ok) return body.response;
        if(!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({error:"邮箱 ID 不正确"},400);
        const enabled = body.data.enabled !== false;
        const dest = await db.prepare("SELECT id FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, uS.user_id).first();
        if(!dest) return jsonRes({error:"目标邮箱不存在或已过期"},404);
        await db.prepare("UPDATE user_destinations SET inbox_default=? WHERE id=?").bind(boolText(enabled), destinationId).run();
        return jsonRes({success:true, message: enabled ? "默认站内同步已开启" : "默认站内同步已关闭"});
      }

      if (path === '/api/destination' && method === 'DELETE') return jsonRes({error:"请使用 /api/destinations/:id 删除指定底层收件箱"},400);
      if (path.startsWith('/api/destinations/') && method === 'DELETE') {
        const destinationId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({error:"邮箱 ID 不正确"},400);
        const removed = await deleteUserDestination(db, env, uS.user_id, destinationId);
        if (removed === true) return jsonRes({message:"底层收件箱已删除"});
        if (!removed || removed.reason === 'not_found') return jsonRes({error:"目标邮箱不存在或已过期"},404);
        if (removed.reason === 'in_use') return jsonRes({error:`该邮箱仍被 ${removed.routeCount || 0} 条专属路由使用，请先迁移路由目标后再删除`},400);
        return jsonRes({error:"删除失败"},400);
      }

      if (path.startsWith('/api/routes/') && method === 'DELETE') {
        const routeId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(routeId) || routeId < 1) return jsonRes({error:"路由 ID 不正确"},400);
        const removed = await deleteRouteById(db, env, routeId, uS.user_id);
        if(!removed) return jsonRes({error:"这个专属域名邮箱不存在或不属于您"},404);
        return jsonRes({message:"专属域名邮箱已删除"});
      }

      if (path.startsWith('/api/routes/') && path.endsWith('/inbox') && method === 'PUT') {
        const routeId = parseInt(path.split('/')[3], 10);
        const body = await readBody(); if (!body.ok) return body.response;
        if(!Number.isFinite(routeId) || routeId < 1) return jsonRes({error:"路由 ID 不正确"},400);
        const enabled = body.data.enabled === true;
        const route = await db.prepare(`
          SELECT r.id,r.tag,r.cf_rule_id,r.status,d.zone_id,d.domain,
                 ud.email AS destination_email, ud.status AS destination_status, ud.expires_at AS destination_expires_at
          FROM email_routes r
          JOIN domains d ON d.id=r.domain_id
          LEFT JOIN user_destinations ud ON ud.id=r.destination_id
          WHERE r.id=? AND r.user_id=?
        `).bind(routeId, uS.user_id).first();
        if(!route) return jsonRes({error:"这个专属域名邮箱不存在或不属于您"},404);
        if(!route.destination_email) return jsonRes({error:"请先设置可用的转发目标邮箱"},400);
        if(route.destination_status !== 'verified' || (route.destination_expires_at && dbDateMs(route.destination_expires_at) <= Date.now())) return jsonRes({error:"转发目标邮箱未验证或已过期"},400);
        const routeAddress = `${route.tag}@${route.domain}`;
        const rule = buildEmailRouteRule(env, routeAddress, route.destination_email, uS.user_id, route.tag, boolText(enabled));
        if(!rule.ok) return jsonRes({error:rule.error},400);
        const cf = await cfSyncRouteRule(env, route, routeAddress, rule.value, 'toggle_route_inbox');
        if(!cf.ok) return jsonRes({error:`Cloudflare 路由更新失败：${summarizeEmailRouteRuleError(cf.data, env)}`, details: cf.data.errors || cf.data},500);
        await db.prepare("UPDATE email_routes SET inbox_enabled=?, cf_rule_id=COALESCE(?, cf_rule_id) WHERE id=?").bind(boolText(enabled), cf.ruleId || null, routeId).run();
        return jsonRes({success:true, message: enabled ? "站内收件箱同步已开启" : "站内收件箱同步已关闭"});
      }

      if (path.startsWith('/api/routes/') && method === 'PUT') {
        const routeId = parseInt(path.split('/')[3], 10);
        const body = await readBody(); if (!body.ok) return body.response;
        const {remark, destinationId, deliveryMode} = body.data;
        const cleanRemark = normalizeRouteRemark(remark);
        const hasDestinationField = Object.prototype.hasOwnProperty.call(body.data, 'destinationId');
        const hasDeliveryModeField = Object.prototype.hasOwnProperty.call(body.data, 'deliveryMode');
        const requestedDeliveryMode = normalizeDeliveryMode(deliveryMode);
        if(!Number.isFinite(routeId) || routeId < 1) return jsonRes({error:"路由 ID 不正确"},400);
        if(remark != null && cleanRemark.length > MAX_ROUTE_REMARK_LENGTH) return jsonRes({error:`备注最多 ${MAX_ROUTE_REMARK_LENGTH} 个字符`},400);
        if(hasDeliveryModeField && !requestedDeliveryMode) return jsonRes({error:"投递方式不正确"},400);
        const route = await db.prepare(`
          SELECT r.id,r.tag,r.domain_id,r.duration_hours,r.expires_at,r.destination_id,r.cf_rule_id,r.status,r.remark,COALESCE(r.inbox_enabled,'false') AS inbox_enabled,d.zone_id,d.domain
          FROM email_routes r
          JOIN domains d ON d.id=r.domain_id
          WHERE r.id=? AND r.user_id=?
        `).bind(routeId, uS.user_id).first();
        if(!route) return jsonRes({error:"这个专属域名邮箱不存在或不属于您"},404);
        let targetDestinationId = route.destination_id == null ? null : parseInt(route.destination_id, 10);
        let nextDeliveryMode = hasDeliveryModeField ? requestedDeliveryMode : routeDeliveryMode(route);
        if (hasDestinationField) {
          if (destinationId == null || String(destinationId).trim() === '') {
            targetDestinationId = null;
            if (!hasDeliveryModeField) nextDeliveryMode = 'inbox_only';
          } else {
            const parsedDestinationId = parseInt(destinationId, 10);
            if(!Number.isFinite(parsedDestinationId) || parsedDestinationId < 1) return jsonRes({error:"目标邮箱 ID 不正确"},400);
            targetDestinationId = parsedDestinationId;
          }
        }
        if (nextDeliveryMode === 'inbox_only') targetDestinationId = null;
        if(deliveryModeNeedsDestination(nextDeliveryMode) && (!Number.isFinite(targetDestinationId) || targetDestinationId < 1)) return jsonRes({error:"请选择转发目标邮箱"},400);

        let targetDestination = null;
        let nextDurationHours = isValidDuration(route.duration_hours) ? String(route.duration_hours) : (cfg.max_route_duration_hours || '72');
        let nextExpiresAt = route.expires_at;
        if (deliveryModeNeedsDestination(nextDeliveryMode)) {
          targetDestination = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status='verified'").bind(targetDestinationId, uS.user_id).first();
          if(!targetDestination) return jsonRes({error:"目标邮箱不存在、未验证或已失效"},400);
          if(targetDestination.expires_at && dbDateMs(targetDestination.expires_at) <= Date.now()) return jsonRes({error:"目标邮箱已过期"},400);
          const targetDuration = isValidDuration(targetDestination.duration_hours) ? String(targetDestination.duration_hours) : null;
          if(targetDuration && durationRank(nextDurationHours) > durationRank(targetDuration)) nextDurationHours = targetDuration;
          const routeRawExpiry = expiryFromDuration(nextDurationHours);
          nextExpiresAt = minExpiry(routeRawExpiry, targetDestination.expires_at);
        } else if (hasDeliveryModeField || hasDestinationField) {
          nextExpiresAt = expiryFromDuration(nextDurationHours);
        }

        const nextInboxEnabled = nextDeliveryMode !== 'forward_only';
        const shouldSyncRule = hasDeliveryModeField || hasDestinationField;
        if (shouldSyncRule) {
          const routeAddress = `${route.tag}@${route.domain}`;
          const rule = buildEmailRouteRule(env, routeAddress, targetDestination?.email || '', uS.user_id, route.tag, boolText(nextInboxEnabled));
          if(!rule.ok) return jsonRes({error:rule.error},400);
          const cf = await cfSyncRouteRule(env, route, routeAddress, rule.value, 'update_email_route');
          if(!cf.ok) return jsonRes({error:`Cloudflare 路由更新失败：${summarizeEmailRouteRuleError(cf.data, env)}`, details: cf.data.errors || cf.data},500);
          route.cf_rule_id = cf.ruleId || route.cf_rule_id;
        }
        const nextRemark = remark == null ? route.remark : cleanRemark;
        await db.prepare("UPDATE email_routes SET remark=?, destination_id=?, duration_hours=?, expires_at=?, inbox_enabled=?, cf_rule_id=COALESCE(?, cf_rule_id) WHERE id=?")
          .bind(nextRemark, targetDestinationId, nextDurationHours, nextExpiresAt, boolText(nextInboxEnabled), route.cf_rule_id || null, routeId).run();
        return jsonRes({success:true, message: shouldSyncRule ? "投递设置已更新，Cloudflare 路由已同步" : "备注已保存"});
      }

      if (path === '/api/routes' && method === 'POST') {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const body = await readBody(); if (!body.ok) return body.response;
        const {prefix, domainId, durationHours, remark, destinationId, deliveryMode} = body.data;
        const cleanPrefix = String(prefix || '').trim().toLowerCase();
        const chosenDuration = String(durationHours || '');
        const cleanRemark = normalizeRouteRemark(remark);
        const requestedDeliveryMode = normalizeDeliveryMode(deliveryMode);
        const pickedDestinationId = parseInt(destinationId, 10);
        const pickedDomainId = parseInt(domainId, 10);
        if(!/^[a-z0-9._+-]{1,64}$/.test(cleanPrefix)) return jsonRes({error:"邮箱前缀只能使用字母、数字、点、下划线、加号或短横线"},400);
        if(!isValidDuration(chosenDuration)) return jsonRes({error:"请选择专属域名邮箱有效期"},400);
        if(!isWithinMaxDuration(chosenDuration, cfg.max_route_duration_hours || '72')) return jsonRes({error:"超过管理员允许的专属域名邮箱最大有效期"},403);
        if(cleanRemark.length > MAX_ROUTE_REMARK_LENGTH) return jsonRes({error:`备注最多 ${MAX_ROUTE_REMARK_LENGTH} 个字符`},400);
        if(deliveryMode != null && !requestedDeliveryMode) return jsonRes({error:"投递方式不正确"},400);
        const selectedDeliveryMode = requestedDeliveryMode || (Number.isFinite(pickedDestinationId) && pickedDestinationId > 0 ? 'inbox_forward' : 'inbox_only');
        if(deliveryModeNeedsDestination(selectedDeliveryMode) && (!Number.isFinite(pickedDestinationId) || pickedDestinationId < 1)) return jsonRes({error:"请选择转发目标邮箱"},400);
        if(!Number.isFinite(pickedDomainId) || pickedDomainId < 1) return jsonRes({error:"请选择有效域名"},400);

        let d = null;
        let targetDestinationId = null;
        let routeExpiry = expiryFromDuration(chosenDuration);
        if (deliveryModeNeedsDestination(selectedDeliveryMode)) {
          d = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(pickedDestinationId, uS.user_id).first();
          if(!d) return jsonRes({error:"请先绑定并验证您的真实收件箱"},400);
          if(d.status === 'pending') return jsonRes({error:"请先点击“刷新验证”，确认底层收件箱已经完成验证"},400);
          if(d.status !== 'verified') return jsonRes({error:"真实收件箱状态不可用，请重新绑定"},400);
          if(d.expires_at && dbDateMs(d.expires_at) <= Date.now()) return jsonRes({error:"目标邮箱已过期，请重新绑定"},400);
          if(d.duration_hours && durationRank(chosenDuration) > durationRank(d.duration_hours)) return jsonRes({error:"专属域名邮箱有效期不能超过绑定邮箱有效期"},400);
          if(chosenDuration === 'permanent' && d.expires_at) return jsonRes({error:"绑定邮箱不是永久有效，专属域名邮箱不能选择永久"},400);
          routeExpiry = minExpiry(routeExpiry, d.expires_at);
          targetDestinationId = pickedDestinationId;
        }

        let cfgMaxR = parseInt(cfg.max_routes_per_user || '10', 10);
        if(!Number.isFinite(cfgMaxR) || cfgMaxR < 0) cfgMaxR = 10;
        if((await db.prepare("SELECT COUNT(*) as c FROM email_routes WHERE user_id=? AND status='active' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(uS.user_id).first()).c >= cfgMaxR) return jsonRes({error:"您的专属域名邮箱配额已耗尽"},403);

        const dom = await db.prepare("SELECT * FROM domains WHERE id=?").bind(pickedDomainId).first(); if(!dom) return jsonRes({error:"您选择的域名不存在或已被下架"},400);
        if(await db.prepare("SELECT id FROM email_routes WHERE domain_id=? AND tag=? AND status='active'").bind(dom.id, cleanPrefix).first()) return jsonRes({error:"该前缀已被占用，请换一个重试"},400);

        let inboxEnabled = selectedDeliveryMode !== 'forward_only';
        const routeAddress = `${cleanPrefix}@${dom.domain}`;
        const rule = buildEmailRouteRule(env, routeAddress, d?.email || '', uS.user_id, cleanPrefix, boolText(inboxEnabled));
        if(!rule.ok) return jsonRes({error:rule.error},400);

        let cf = await cfRequest(env, `/zones/${dom.zone_id}/email/routing/rules`, {
          method:'POST',
          body: rule.value,
          label: 'create_email_route'
        });
        const cfD = cf.data;
        if(!cf.ok || !cfD.result?.id) return jsonRes({error:`Cloudflare 路由创建失败：${summarizeEmailRouteRuleError(cfD, env)}`, details:cfD.errors || cfD},500);

        try {
          await db.prepare("INSERT INTO email_routes(user_id,cf_rule_id,tag,domain_id,expires_at,duration_hours,remark,destination_id,inbox_enabled,status) VALUES(?,?,?,?,?,?,?,?,?, 'active')")
            .bind(uS.user_id,cfD.result.id,cleanPrefix,pickedDomainId,routeExpiry,chosenDuration,cleanRemark,targetDestinationId,boolText(inboxEnabled)).run();
        } catch (e) {
          await cfDeleteRoute(env, dom.zone_id, cfD.result.id, 'rollback_created_route_after_d1_error');
          if (isUniqueConstraintError(e)) return jsonRes({error:"该前缀已被占用，请换一个重试"},400);
          console.error('[route_create_d1_error]', e?.stack || e?.message || e);
          return jsonRes({error:"专属域名邮箱创建失败，请稍后重试"},500);
        }
        return jsonRes({success:true, message:"专属邮箱创建成功"});
      }
      return jsonRes({error:"404 Not Found"},404);
    } catch (e) {
      console.error('[server_error]', e?.stack || e?.message || e);
      return jsonRes({error:"Server Error"},500);
    }
  },

  async email(message, env, ctx) {
    await handleInboundEmail(message, env);
  },

  async scheduled(evt, env) {
    if(!env.DB) return; const db = env.DB;
    await ensureSystem(db);
    const cfg = await getConfigMap(db);
    await runTimedCleanup(db, env, cfg);
  }
};
