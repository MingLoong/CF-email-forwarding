// ==========================================
// 0. 鍏变韩閰嶇疆涓庡伐鍏?
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

const validatePassword = (value, label = '\u5bc6\u7801') => {
  const password = String(value == null ? '' : value);
  if (password.length < MIN_PASSWORD_LENGTH) return {ok: false, error: `${label}\u81f3\u5c11 ${MIN_PASSWORD_LENGTH} \u4f4d`};
  if (password.length > MAX_PASSWORD_LENGTH) return {ok: false, error: `${label}\u6700\u591a ${MAX_PASSWORD_LENGTH} \u4f4d`};
  return {ok: true, value: password};
};

const validateEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return {ok: false, error: '\u8bf7\u8f93\u5165\u90ae\u7bb1\u5730\u5740'};
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return {ok: false, error: '\u90ae\u7bb1\u5730\u5740\u683c\u5f0f\u4e0d\u6b63\u786e'};
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
  if (raw.length > 512) return {ok: false, error: '\u914d\u7f6e\u503c\u8fc7\u957f'};
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
      return {ok: false, error: `\u8be5\u914d\u7f6e\u5fc5\u987b\u662f ${limit.min} \u5230 ${limit.max} \u4e4b\u95f4\u7684\u6574\u6570`};
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
    const workerName = String(env.EMAIL_WORKER_NAME || '').trim() || '\u672a\u914d\u7f6e';
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
  if (parts.includes('r2_missing')) labels.push('\u9644\u4ef6\u5b58\u50a8\u672a\u7ed1\u5b9a\uff0c\u9644\u4ef6\u672a\u4fdd\u5b58');
  if (parts.includes('count_limited')) labels.push('閮ㄥ垎闄勪欢鍥犳暟閲忚秴闄愭湭淇濆瓨');
  if (parts.includes('size_limited')) labels.push('閮ㄥ垎闄勪欢鍥犲ぇ灏忚秴闄愭湭淇濆瓨');
  if (parts.includes('storage_limited')) labels.push('\u90e8\u5206\u65e7\u9644\u4ef6\u56e0\u5b58\u50a8\u7a7a\u95f4\u9650\u5236\u5df2\u81ea\u52a8\u6e05\u7406');
  if (parts.includes('save_failed')) labels.push('閮ㄥ垎闄勪欢淇濆瓨澶辫触');
  return labels.join('\uff1b');
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
  if (!workerName) return {ok: false, error: '璇峰厛閰嶇疆 EMAIL_WORKER_NAME锛屾墠鑳藉紑鍚珯鍐呮敹浠剁鍚屾'};
  return {ok: true, value: workerName};
};

const buildEmailRouteRule = (env, routeAddress, targetEmail, userId, tag, inboxEnabled) => {
  const enabled = isTruthyFlag(inboxEnabled);
  const workerName = enabled ? requireEmailWorkerName(env) : {ok: true, value: ''};
  if (!workerName.ok) return workerName;
  if (!enabled && !targetEmail) return {ok: false, error: '璇烽€夋嫨杞彂鐩爣閭'};
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
// 1. 鏅€氱敤鎴风綉椤?HTML
// ==========================================
const renderThemeBootstrapScript = () => `<script>(function(){document.documentElement.dataset.theme='light';document.documentElement.dataset.themePreference='light';try{localStorage.setItem('themePreference','light');}catch(_){};})();</script>`;

const renderSharedThemeStyle = () => `<style>
:root{
  color-scheme:light;
  --bg-page:#f6f8fc;
  --bg-surface:#ffffff;
  --bg-muted:#f1f3f4;
  --bg-subtle:#f8fafc;
  --bg-overlay:rgba(32,33,36,.1);
  --border-subtle:#e6e9ee;
  --border-strong:#dadce0;
  --text-strong:#202124;
  --text-muted:#5f6368;
  --text-soft:#70757a;
  --accent-primary:#1a73e8;
  --accent-primary-hover:#185abc;
  --accent-link:#1a73e8;
  --accent-link-hover:#185abc;
  --accent-soft:#e8f0fe;
  --accent-soft-border:#d2e3fc;
  --accent-compose:#c2e7ff;
  --accent-compose-hover:#b4defd;
  --danger:#c2410c;
  --danger-hover:#9a3412;
  --danger-surface:#fef1ed;
  --danger-border:#f6c2b4;
  --warning:#b45309;
  --warning-surface:#fff8eb;
  --warning-border:#f6d19a;
  --success:#0f766e;
  --success-surface:#ecfeff;
  --success-border:#99f6e4;
  --info:#1f6feb;
  --info-surface:#edf4ff;
  --info-border:#bfdbfe;
  --shadow-panel:0 1px 2px rgba(60,64,67,.02),0 2px 6px rgba(60,64,67,.025);
  --shadow-soft:0 1px 2px rgba(60,64,67,.015),0 3px 8px rgba(60,64,67,.024);
  --radius-shell:.44rem;
  --radius-panel:.4rem;
  --radius-card:.24rem;
  --radius-control:.9rem;
  --radius-pill:999px;
}
html,body{height:100%}
body{margin:0;background:var(--bg-page);color:var(--text-strong);font-family:"Google Sans","Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;transition:background-color .2s ease,color .2s ease}
*{box-sizing:border-box}
.fade-in{animation:fadeIn .25s ease-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:999px}
.app-shell{background:var(--bg-page);color:var(--text-strong)}
.topbar{background:transparent;backdrop-filter:none;border-bottom:0}
.sidebar{background:transparent;border-right:0;box-shadow:none}
.content-area{background:transparent}
.surface-card,.surface-panel{background:rgba(255,255,255,.998);border:1px solid rgba(230,233,238,.98);box-shadow:0 1px 2px rgba(60,64,67,.014),0 2px 6px rgba(60,64,67,.02);border-radius:var(--radius-panel)}
.surface-muted{background:var(--bg-muted);border:1px solid var(--border-subtle)}
.surface-table{background:var(--bg-surface);border:1px solid var(--border-subtle);box-shadow:var(--shadow-panel);border-radius:var(--radius-panel)}
.surface-inset{background:var(--bg-subtle);border:1px solid var(--border-subtle)}
.surface-page{background:var(--bg-page)}
.overlay-backdrop{background:rgba(32,33,36,.12);backdrop-filter:blur(4px)}
.modal-card{background:rgba(255,255,255,.998);border:1px solid rgba(227,231,238,.98);box-shadow:0 8px 20px rgba(60,64,67,.08);border-radius:.75rem}
.app-title{color:var(--text-strong)}
.text-strong{color:var(--text-strong)}
.text-muted{color:var(--text-muted)}
.text-soft{color:var(--text-soft)}
.text-link{color:var(--accent-link)}
.text-primary{color:var(--accent-primary)}
.text-danger{color:var(--danger)}
.text-success{color:var(--success)}
.status-dot{background:var(--accent-primary)}
.mono-accent{color:var(--accent-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.field,.select,.textarea{width:100%;background:var(--bg-surface);color:var(--text-strong);border:1px solid #d7dde5;border-radius:var(--radius-control);padding:.8rem 1rem;font-size:.875rem;outline:none;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease,color .18s ease}
.field::placeholder,.textarea::placeholder{color:var(--text-soft)}
.field:focus,.select:focus,.textarea:focus{border-color:var(--accent-link);box-shadow:0 0 0 3px rgba(11,87,208,.12)}
.split-field{display:flex;width:100%;min-width:0;border-radius:var(--radius-control);overflow:hidden;border:1px solid var(--border-strong);background:var(--bg-surface)}
.split-field .field,.split-field .select{border:0;border-radius:0;background:transparent;box-shadow:none}
.split-addon{display:inline-flex;align-items:center;padding:0 .75rem;background:var(--bg-muted);color:var(--text-soft);border-inline:1px solid var(--border-subtle)}
.btn-primary,.btn-secondary,.btn-danger,.btn-linkish,.theme-toggle{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:.42rem;padding:.56rem .88rem;font-size:.82rem;font-weight:600;border:1px solid transparent;transition:background-color .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease,opacity .18s ease;white-space:nowrap}
.btn-primary{background:#e8f0fe;border-color:#d2e3fc;color:#1967d2;box-shadow:none}
.btn-primary:hover{background:#dde9fd;border-color:#c9dcfc;color:#185abc;box-shadow:none}
.btn-secondary,.theme-toggle{background:rgba(255,255,255,.98);border-color:#e5e7eb;color:#5f6368;box-shadow:none}
.btn-secondary:hover,.theme-toggle:hover{background:#f6f8fb;color:var(--text-strong);border-color:#dde1e6}
.btn-danger{background:#fff7f3;border-color:#f1d8cf;color:#a1420b;box-shadow:none}
.btn-danger:hover{background:#fef1ed;border-color:#e7cabf;color:#8b3a0a}
.btn-linkish{background:transparent;border-color:transparent;color:var(--accent-link);padding:.25rem .1rem}
.btn-linkish:hover{background:#edf2fa;color:var(--accent-link-hover)}
.btn-disabled,.btn-primary:disabled,.btn-secondary:disabled,.btn-danger:disabled,.theme-toggle:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.theme-toggle{display:none!important}
.auth-tab,.dashboard-nav,.settings-nav,.admin-nav{transition:background-color .18s ease,border-color .18s ease,color .18s ease}
.auth-tab{color:var(--text-soft);border-bottom:2px solid transparent;padding-bottom:.75rem;font-weight:500}
.auth-tab:hover{color:var(--text-strong)}
.auth-tab-active{color:var(--accent-primary);border-bottom-color:var(--accent-primary);font-weight:700}
.auth-shell-head{display:flex;flex-direction:column;gap:.62rem;margin-bottom:1rem;max-width:23rem}
.auth-shell-badge{display:inline-flex;align-items:center;gap:.4rem;padding:.32rem .66rem;border-radius:999px;background:#f1f3f4;color:#5f6368;font-size:.72rem;font-weight:700;width:max-content}
.auth-shell-badge::before{content:"";width:.46rem;height:.46rem;border-radius:999px;background:currentColor;opacity:.82}
.auth-shell-copy{font-size:.82rem;line-height:1.7;color:var(--text-muted)}
.auth-shell-tabs{display:flex;gap:0;border-bottom:1px solid var(--border-subtle);margin-bottom:1rem;padding-bottom:.15rem}
.nav-link,.admin-nav{display:flex;align-items:center;gap:.5rem;padding:.68rem .88rem;border-radius:.58rem;border:1px solid transparent;color:var(--text-muted);background:transparent;font-weight:500}
.nav-link:hover,.admin-nav:hover{background:#eef2f6;border-color:transparent;color:var(--text-strong)}
.nav-link-active,.admin-nav-active{background:#e8f0fe;border-color:transparent;color:var(--accent-primary);font-weight:700}
.gmail-nav-pill{display:inline-flex;align-items:center;gap:.54rem;min-height:2.8rem;padding:.72rem .96rem;border-radius:.92rem;background:transparent;color:var(--text-muted);font-size:.82rem;font-weight:500;border:1px solid transparent;box-shadow:none;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.gmail-nav-pill:hover{background:#f1f3f4;color:var(--text-strong)}
.gmail-nav-pill-active{background:#e8f0fe;color:#174ea6;font-weight:700}
.gmail-nav-dot{width:.42rem;height:.42rem;border-radius:999px;background:currentColor;opacity:.3;flex:none;transition:opacity .16s ease}
.gmail-nav-pill-active .gmail-nav-dot{opacity:.92}
.gmail-mobile-nav{display:inline-flex;align-items:center;gap:.26rem;padding:.22rem;background:#f1f3f4;border:1px solid #e7ebef;border-radius:.78rem;width:max-content;max-width:100%}
.gmail-mobile-nav .gmail-nav-pill{min-height:2.1rem;padding:.5rem .78rem;border-radius:.72rem;font-size:.72rem}
.gmail-mobile-nav .gmail-nav-dot{display:none}
.tab-link{display:inline-flex;align-items:center;justify-content:center;padding:.56rem .9rem;border:1px solid transparent;border-radius:var(--radius-pill);color:var(--text-muted);font-weight:600;background:transparent}
.tab-link:hover{color:var(--text-strong);background:#eef2f6;border-color:transparent}
.tab-link-active{background:#e8f0fe;border-color:transparent;color:var(--accent-primary);font-weight:700}
.panel-header{border-bottom:1px solid var(--border-subtle)}
.stack-divider>:not([hidden])~:not([hidden]){border-top:1px solid var(--border-subtle)}
.soft-divider{border-color:var(--border-subtle)!important}
.list-row{background:transparent;border-left:0;transition:background-color .18s ease,border-color .18s ease}
.list-row:hover{background:var(--bg-muted)}
.list-row-selected{background:#e8f0fe}
.list-row-unread{background:#fff}
.list-row-read{background:transparent}
.detail-panel{background:var(--bg-surface);border-left:1px solid var(--border-subtle)}
.list-detail-shell{background:var(--bg-surface);border:1px solid var(--border-subtle);box-shadow:var(--shadow-panel)}
.topbar-meta{color:var(--text-soft)}
.section-shell{background:transparent}
.overlay-close{color:var(--text-soft)}
.overlay-close:hover{color:var(--text-strong)}
.badge-status{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid transparent;padding:.18rem .55rem;font-size:.675rem;font-weight:700;line-height:1.1}
.badge-primary{background:#eaf1fb;color:var(--accent-primary)}
.badge-success{background:var(--success-surface);border-color:var(--success-border);color:var(--success)}
.badge-info{background:#eef3fd;color:var(--accent-link)}
.badge-warning{background:var(--warning-surface);border-color:var(--warning-border);color:var(--warning)}
.badge-danger{background:var(--danger-surface);border-color:var(--danger-border);color:var(--danger)}
.pill-muted{display:inline-flex;align-items:center;border-radius:var(--radius-pill);background:var(--bg-muted);border:1px solid var(--border-subtle);color:var(--text-muted);padding:.24rem .6rem;font-size:.75rem;font-weight:600}
.empty-state{min-height:184px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem 1.1rem;color:var(--text-muted);background:transparent}
.empty-state-title{color:var(--text-strong);font-weight:700;font-size:.95rem;line-height:1.4}
.empty-state-copy{max-width:27rem;font-size:.8rem;line-height:1.7;color:var(--text-soft)}
.notice-warning{background:var(--warning-surface);border:1px solid var(--warning-border);color:var(--warning)}
.notice-danger{background:var(--danger-surface);border:1px solid var(--danger-border);color:var(--danger)}
.notice-info{background:var(--info-surface);border:1px solid var(--info-border);color:var(--info)}
.table-shell{overflow-x:auto;border:1px solid var(--border-subtle);border-radius:var(--radius-panel);background:var(--bg-surface);box-shadow:var(--shadow-panel)}
.table-head{background:var(--bg-muted);color:var(--text-muted)}
.table-body tr{transition:background-color .18s ease}
.table-body tr+tr td{border-top:1px solid var(--border-subtle)}
.table-row:hover{background:var(--bg-muted)}
.section-title{color:var(--text-strong);font-size:1.08rem;font-weight:700}
.section-subtitle{color:var(--text-muted);font-size:.76rem;line-height:1.58}
.workspace-section-head{display:flex;flex-direction:column;gap:.22rem}
.workspace-section-kicker{font-size:.64rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#80868b}
.workspace-section-copy{font-size:.77rem;color:var(--text-muted);line-height:1.64;max-width:35rem}
.danger-card{background:#fef7f4;border:1px solid #f1d2c7;box-shadow:none;border-radius:.56rem}
.mail-body-shell{background:#f8fafd}
.email-html{color:var(--text-strong);line-height:1.65;font-size:14px}
.email-html p{margin:.2rem 0 .9rem}
.email-html h1,.email-html h2,.email-html h3{color:var(--text-strong);line-height:1.35;margin:1.05rem 0 .65rem}
.email-html ul,.email-html ol{margin:.25rem 0 .9rem;padding-left:1.25rem}
.email-html li{margin:.18rem 0}
.email-html img{max-width:100%;height:auto}
.email-html table{max-width:100%;overflow:auto}
.email-html a{color:var(--accent-link);text-decoration:underline}
.email-html blockquote{border-left:3px solid var(--border-strong);margin-left:0;padding-left:12px;color:var(--text-muted)}
.email-html pre{color:var(--text-strong);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.gmail-app-chrome{padding:14px 16px 18px}
.gmail-section-shell{padding:14px 16px 18px}
.gmail-search-shell{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
.gmail-searchbar{display:flex;align-items:center;gap:.72rem;min-height:50px;flex:1 1 320px;border-radius:1rem;border:1px solid #e3e7eb;background:#f1f3f4;padding:0 .92rem;box-shadow:none}
.gmail-searchbar .field{border:0!important;background:transparent!important;box-shadow:none!important;padding:.65rem 0!important}
.gmail-search-icon{width:1rem;height:1rem;color:#5f6368;flex:none}
.gmail-toolbar-actions{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.gmail-content-card{background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:.44rem;box-shadow:none;overflow:hidden}
.gmail-content-body{padding:.95rem 1rem}
.gmail-inbox-shell{background:#fff;border:1px solid rgba(230,233,238,.98);border-radius:.44rem;box-shadow:none;overflow:hidden}
.gmail-panel-header{background:#f8fafd;border-bottom:1px solid var(--border-subtle)}
.gmail-list-shell{background:#fff}
.gmail-card-row{padding:.86rem .98rem;border-bottom:1px solid #edf0f3;transition:background-color .16s ease,box-shadow .16s ease}
.gmail-card-row:last-child{border-bottom:0}
.gmail-card-row:hover{background:#f3f6fb}
.gmail-card-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,.9fr) auto;gap:.8rem;align-items:start}
.gmail-card-main{min-width:0;display:flex;flex-direction:column;gap:.45rem}
.gmail-card-title{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .65rem}
.gmail-card-address{font-size:.93rem;font-weight:600;color:var(--text-strong);line-height:1.35;word-break:break-word}
.gmail-card-secondary{font-size:.77rem;color:var(--text-muted);line-height:1.55;word-break:break-word}
.gmail-card-meta{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}
.gmail-card-stack{display:flex;flex-direction:column;gap:.45rem;min-width:0}
.gmail-card-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.25rem;align-items:center}
.gmail-mini-label{font-size:.68rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--text-soft)}
.gmail-status-dot{display:inline-flex;align-items:center;gap:.4rem}
.gmail-status-dot::before{content:"";width:.5rem;height:.5rem;border-radius:999px;background:currentColor;opacity:.85}
.gmail-chip-row{display:flex;flex-wrap:wrap;gap:.35rem}
.gmail-card-summary{display:flex;flex-wrap:wrap;gap:.5rem .9rem;font-size:.75rem;color:var(--text-muted);line-height:1.55}
.gmail-card-summary strong{color:var(--text-strong);font-weight:600}
.gmail-list-meta{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.66rem .9rem;font-size:.73rem;color:var(--text-soft);background:#f8fafd}
.gmail-route-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.8rem;align-items:center;padding:.74rem 1rem;border-bottom:1px solid #edf1f4;background:#fff;transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease}
.gmail-route-row:last-child{border-bottom:0}
.gmail-route-row:hover{background:#f6f9fc}
.gmail-route-main{min-width:0;display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:.4rem .95rem;align-items:center}
.gmail-route-identity{display:flex;align-items:center;gap:.62rem;min-width:0}
.gmail-route-avatar{width:1.78rem;height:1.78rem;border-radius:999px;background:#edf2fa;color:#476a9b;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex:none;box-shadow:none}
.gmail-route-content{display:flex;flex-direction:column;gap:.18rem;min-width:0}
.gmail-route-address{font-size:.84rem;font-weight:600;color:var(--text-strong);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gmail-route-summary{font-size:.74rem;color:#70757a;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gmail-route-detail{display:flex;flex-direction:column;gap:.28rem;min-width:0}
.gmail-route-line{display:flex;align-items:center;gap:.42rem;min-width:0;flex-wrap:wrap}
.gmail-route-detail-text{font-size:.76rem;color:#3c4043;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gmail-route-meta{display:flex;flex-wrap:wrap;gap:.42rem .8rem;font-size:.7rem;color:#80868b;line-height:1.5}
.gmail-route-meta strong{color:var(--text-strong);font-weight:600}
.gmail-route-side{display:flex;align-items:center;justify-content:flex-end;gap:.28rem;flex-wrap:wrap;min-width:0}
.gmail-route-actions{display:flex;align-items:center;justify-content:flex-end;gap:.1rem;flex-wrap:wrap;opacity:0;transition:opacity .16s ease}
.gmail-route-row:hover .gmail-route-actions{opacity:1}
.gmail-route-actions .btn-secondary{font-size:.7rem;font-weight:600}
.gmail-route-target{display:inline-flex;align-items:center;max-width:100%;padding:.12rem .38rem;border-radius:.34rem;background:#f1f3f4;color:#5f6368;font-size:.66rem;font-weight:600}
.gmail-route-row:hover .gmail-route-target{background:#edf2f7}
.gmail-mail-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.55rem;align-items:center;padding:.66rem 1rem;cursor:pointer;border-bottom:1px solid #edf0f3;transition:background-color .16s ease,box-shadow .16s ease,border-color .16s ease}
.gmail-mail-row:last-child{border-bottom:0}
.gmail-mail-row:hover{background:#f6f9fc}
.gmail-mail-row.list-row-selected{background:#e8f0fe;box-shadow:inset 3px 0 0 var(--accent-primary)}
.gmail-mail-row.list-row-unread{background:#fff}
.gmail-mail-row.list-row-read{background:#fafbfc}
.gmail-mail-main{min-width:0;display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr);gap:.28rem .82rem;align-items:center}
.gmail-mail-from{display:flex;align-items:center;gap:.52rem;font-size:.77rem;color:#3c4043;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.gmail-mail-avatar{width:1.78rem;height:1.78rem;border-radius:999px;background:#edf2fa;color:#476a9b;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex:none}
.gmail-mail-content{min-width:0;display:flex;flex-direction:column;gap:.26rem}
.gmail-mail-line{display:flex;align-items:center;gap:.36rem;min-width:0}
.gmail-mail-subject{font-size:.8rem;color:var(--text-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.34;flex:none;max-width:40%}
.gmail-mail-preview{font-size:.76rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.34;min-width:0;flex:1}
.gmail-mail-snippet{display:flex;align-items:center;gap:.35rem;min-width:0}
.gmail-mail-snippet-divider{color:#c7cdd6;flex:none}
.gmail-mail-meta{display:flex;align-items:center;gap:.42rem;min-width:0;font-size:.66rem;color:#80868b;line-height:1.35;flex-wrap:wrap}
.gmail-mail-meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gmail-mail-meta .badge-status{padding:.14rem .46rem;font-size:.62rem}
.gmail-mail-route{display:inline-flex;align-items:center;max-width:100%;padding:.14rem .44rem;border-radius:.45rem;background:#f1f3f4;color:#5f6368;font-weight:600}
.gmail-mail-side{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:.2rem;padding-left:.35rem;min-width:82px;position:relative}
.gmail-mail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;padding:.54rem .94rem;border-bottom:1px solid var(--border-subtle);background:#fff}
.gmail-mail-toolbar-title{font-size:.75rem;font-weight:600;color:var(--text-muted)}
.gmail-mail-toolbar-actions{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.gmail-mail-time{font-size:.68rem;color:#6b7280;white-space:nowrap;transition:opacity .14s ease,visibility .14s ease}
.gmail-mail-flag{width:.5rem;height:.5rem;border-radius:999px;background:var(--accent-primary);display:inline-block;flex:none}
.gmail-row-action{position:absolute;top:50%;right:0;transform:translateY(-50%);opacity:0;visibility:hidden;border:0;background:transparent;color:var(--text-soft);padding:.28rem .5rem;border-radius:.68rem;font-size:.71rem;font-weight:600;transition:opacity .16s ease,background-color .16s ease,color .16s ease,visibility .16s ease}
.gmail-row-action:hover{background:#eef2f6;color:var(--text-strong)}
.gmail-mail-row:hover .gmail-row-action,.gmail-mail-row.list-row-selected .gmail-row-action{opacity:1;visibility:visible}
.gmail-mail-row:hover .gmail-mail-time,.gmail-mail-row.list-row-selected .gmail-mail-time{opacity:0;visibility:hidden}
.gmail-mail-row.list-row-unread .gmail-mail-from,.gmail-mail-row.list-row-unread .gmail-mail-subject{font-weight:700;color:#202124}
.gmail-mail-row.list-row-read .gmail-mail-from{font-weight:500;color:#3c4043}
.gmail-mail-row.list-row-read .gmail-mail-subject{font-weight:500}
.gmail-mail-row.list-row-read .gmail-mail-preview{color:#70757a}
.gmail-detail-shell{display:flex;flex-direction:column;min-height:0;height:100%;background:linear-gradient(180deg,#ffffff 0%,#f7f9fc 100%)}
.gmail-detail-head{padding:.92rem .96rem .84rem;border-bottom:1px solid #edf1f4;background:#fff}
.gmail-detail-kicker{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-soft)}
.gmail-detail-title{font-size:1.14rem;font-weight:700;color:var(--text-strong);line-height:1.42}
.gmail-detail-meta{display:flex;flex-wrap:wrap;gap:.38rem .96rem;margin-top:.5rem;font-size:.73rem;color:var(--text-muted)}
.gmail-detail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.68rem;padding:.54rem .68rem;border:1px solid #edf1f4;border-radius:.44rem;background:#f8fafd}
.gmail-detail-body{flex:1;overflow:auto;background:#f8fafd;padding:.92rem .96rem 1.04rem}
.gmail-detail-card{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0}
.gmail-detail-avatar{width:2.5rem;height:2.5rem;border-radius:999px;background:#e8f0fe;color:#1a73e8;display:flex;align-items:center;justify-content:center;font-size:.92rem;font-weight:700;flex:none}
.gmail-detail-sender{display:flex;align-items:flex-start;gap:.78rem}
.gmail-detail-sender-meta{display:flex;flex-direction:column;gap:.2rem;min-width:0}
.gmail-detail-sender-name{font-size:.83rem;font-weight:600;color:var(--text-strong);line-height:1.35}
.gmail-detail-sender-sub{font-size:.72rem;color:var(--text-soft);line-height:1.48}
.gmail-detail-body-surface{background:#fff;border:1px solid #edf1f4;border-radius:.52rem;padding:.94rem .96rem 1rem;box-shadow:none}
.gmail-detail-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.68rem;text-align:center;max-width:24rem;margin:0 auto}
.gmail-detail-placeholder-mark{width:2.85rem;height:2.85rem;border-radius:.56rem;background:#e8edf6;color:var(--accent-primary);display:flex;align-items:center;justify-content:center;font-size:1.16rem;font-weight:700}
.gmail-dialog-card{background:#fff;border:1px solid #e9edf2;border-radius:.72rem;box-shadow:0 10px 24px rgba(60,64,67,.1);overflow:hidden}
.gmail-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.9rem;padding:.96rem 1rem;border-bottom:1px solid #edf0f3;background:#fff}
.gmail-dialog-title{font-size:1rem;font-weight:700;color:var(--text-strong)}
.gmail-dialog-copy{font-size:.77rem;color:var(--text-soft);line-height:1.62}
.gmail-dialog-body{padding:1.06rem 1.08rem 1.12rem;display:flex;flex-direction:column;gap:.9rem;background:#fff}
.gmail-dialog-field{display:flex;flex-direction:column;gap:.38rem}
.gmail-dialog-field-label{font-size:.72rem;font-weight:700;color:#70757a;letter-spacing:.02em}
.gmail-dialog-actions{display:flex;flex-direction:column-reverse;gap:.56rem;padding-top:.24rem}
.gmail-dialog-actions .btn-primary,.gmail-dialog-actions .btn-secondary{min-width:5rem}
.gmail-dialog-address{font-size:.75rem;color:var(--accent-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;line-height:1.5;word-break:break-all}
.gmail-stat-inline{display:inline-flex;align-items:baseline;gap:.35rem;font-size:.78rem;color:var(--text-soft)}
.gmail-stat-inline strong{color:var(--accent-primary);font-size:.9rem;font-weight:700}
.gmail-attach-shell{border-top:1px solid var(--border-subtle);background:#f8fafd;padding:.92rem .96rem 1rem}
.gmail-attach-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.8rem}
.gmail-attach-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem}
.gmail-attach-card{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border:1px solid #e8edf3;border-radius:.42rem;background:#fff;padding:.72rem .78rem;box-shadow:none}
.gmail-admin-topbar{display:flex;flex-direction:column;gap:.55rem;max-width:74rem;margin:0 auto;width:100%}
.gmail-admin-brand{display:flex;flex-direction:column;gap:.18rem;max-width:38rem}
.gmail-admin-kicker{font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#80868b}
.gmail-admin-copy{font-size:.75rem;color:var(--text-muted);line-height:1.56;max-width:34rem}
.gmail-admin-tab-group{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap}
.gmail-admin-tabs{display:flex;align-items:center;gap:.1rem;flex-wrap:wrap;padding:0;background:transparent;border:0;border-radius:0;box-shadow:none}
.gmail-admin-grid{display:grid;gap:.82rem}
.gmail-admin-grid-wide{display:grid;gap:.82rem}
.gmail-admin-domain-stack{gap:0;background:#fff;border:1px solid var(--border-subtle);border-radius:.44rem;overflow:hidden}
.gmail-admin-domain-stack>.gmail-content-card{border:0!important;border-radius:0!important;box-shadow:none!important}
.gmail-admin-domain-stack>.gmail-content-card+.gmail-content-card{border-top:1px solid var(--border-subtle)!important}
.gmail-admin-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem .98rem;border:0;border-bottom:1px solid var(--border-subtle);border-radius:0;background:#fff;transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease}
.gmail-admin-row:last-child{border-bottom:0}
.gmail-admin-row:hover{background:#f6f9fc;border-color:var(--border-subtle)}
.gmail-admin-row-active{background:#eaf1fb;border-color:var(--border-subtle)}
.gmail-admin-row-main{min-width:0;display:flex;flex-direction:column;gap:.22rem}
.gmail-admin-row-title{font-size:.92rem;font-weight:600;color:var(--text-strong);word-break:break-word}
.gmail-admin-row-note{font-size:.76rem;color:var(--text-soft);word-break:break-word}
.gmail-admin-section-title{font-size:.98rem;font-weight:700;color:var(--text-strong)}
.gmail-admin-section-copy{font-size:.78rem;color:var(--text-muted);line-height:1.66}
.gmail-admin-list{display:grid;gap:0;border:1px solid var(--border-subtle);border-radius:.44rem;background:#fff;overflow:hidden}
.gmail-admin-card{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.78fr) auto;gap:.8rem;align-items:center;padding:.82rem 1rem;border:0;border-bottom:1px solid var(--border-subtle);border-radius:0;background:#fff;box-shadow:none;transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease}
.gmail-admin-card:last-child{border-bottom:0}
.gmail-admin-card:hover{background:#f6f9fc;border-color:var(--border-subtle);box-shadow:none}
.gmail-admin-card-compact{grid-template-columns:minmax(0,1.4fr) minmax(0,.95fr) auto;padding:.92rem 1rem}
.gmail-admin-card-main{display:flex;flex-direction:column;gap:.4rem;min-width:0}
.gmail-admin-card-side{display:flex;flex-direction:column;gap:.34rem;min-width:0;padding:0;border:0;border-radius:0;background:transparent}
.gmail-admin-card-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.45rem;align-items:center;padding-left:.2rem}
.gmail-admin-card-actions .btn-secondary,.gmail-route-actions .btn-secondary{background:transparent;border-color:transparent;color:var(--text-soft);padding:.34rem .42rem;box-shadow:none}
.gmail-admin-card-actions .btn-secondary:hover,.gmail-route-actions .btn-secondary:hover{background:#eef2f6;border-color:transparent;color:var(--text-strong)}
.gmail-admin-card-actions .text-danger,.gmail-route-actions .text-danger{color:#9a3412!important}
.gmail-admin-card-actions .text-danger:hover,.gmail-route-actions .text-danger:hover{color:#7c2d12!important}
.gmail-admin-card-split{grid-template-columns:minmax(0,1fr) auto;gap:1rem}
.gmail-admin-card-split .gmail-admin-card-side{gap:.38rem}
.gmail-admin-card-split .gmail-admin-card-actions{align-items:flex-start}
.gmail-admin-metrics{display:flex;flex-wrap:wrap;gap:.45rem}
.gmail-admin-meta-line{font-size:.76rem;color:var(--text-soft);line-height:1.55;word-break:break-word}
.gmail-admin-metric{display:inline-flex;align-items:center;gap:.35rem;padding:0;border:0;border-radius:0;background:transparent;font-size:.7rem;color:var(--text-soft);font-weight:600}
.gmail-config-grid{display:grid;gap:0;border-top:1px solid var(--border-subtle)}
.gmail-config-card{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);gap:1rem;align-items:center;background:#fff;border-bottom:1px solid var(--border-subtle);padding:.88rem 0;box-shadow:none}
.gmail-config-card-head{display:flex;flex-direction:column;gap:.12rem;padding-right:.4rem}
.gmail-config-card-title{font-size:.88rem;font-weight:600;color:var(--text-strong)}
.gmail-config-card-key{font-size:.73rem;color:var(--text-soft);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.gmail-config-card-copy{font-size:.74rem;color:var(--text-muted);line-height:1.58}
.gmail-config-card-control{display:flex;gap:.65rem;align-items:center;justify-content:flex-end;min-width:0}
.gmail-config-card-control .field,.gmail-config-card-control .select{min-width:0;max-width:17rem}
.gmail-config-card-control .btn-primary{flex:none;min-width:4.4rem}
.gmail-settings-stack{display:grid;gap:0;border:1px solid var(--border-subtle);border-radius:.44rem;background:#fff;overflow:hidden}
.gmail-settings-stack>.gmail-section-frame,.gmail-settings-stack>.gmail-content-card{border:0;border-top:1px solid var(--border-subtle);border-radius:0;box-shadow:none}
.gmail-settings-stack>:first-child{border-top:0}
.gmail-settings-stack>.gmail-settings-block .gmail-content-body{padding:1rem}
.gmail-settings-stack>.gmail-settings-block .gmail-panel-header{padding:1rem 1rem .85rem;border-bottom:1px solid var(--border-subtle);background:#fff}
.gmail-section-frame-danger{background:#fff8f6;border-top:0!important}
.gmail-form-stack{display:flex;flex-direction:column;gap:.3rem}
.gmail-form-title{font-size:.96rem;font-weight:700;color:var(--text-strong)}
.gmail-form-copy{font-size:.77rem;color:var(--text-soft);line-height:1.62;max-width:34rem}
.gmail-danger-copy{color:#8a5a4a}
.gmail-user-topbar{display:grid;gap:.48rem;align-items:start}
.gmail-user-topbar-compact{gap:.42rem}
.gmail-user-brand{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.72rem 1rem;padding:.04rem 0 0}
.gmail-user-brand-main{display:flex;flex-direction:column;gap:.18rem;max-width:31rem}
.gmail-user-title{display:flex;align-items:center;gap:.48rem;font-size:.98rem;font-weight:700;color:var(--text-strong)}
.gmail-user-copy{font-size:.76rem;color:var(--text-muted);line-height:1.58;max-width:32rem}
.gmail-user-stats{display:flex;flex-wrap:wrap;gap:.34rem;justify-content:flex-end}
.gmail-user-stat{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .5rem;border-radius:.36rem;border:1px solid #e8ebf0;background:#fff;font-size:.67rem;color:var(--text-muted);box-shadow:none}
.gmail-user-stat strong{color:var(--text-strong);font-size:.78rem}
.gmail-user-brand .btn-secondary{min-height:2.3rem;padding:.5rem .85rem;font-size:.76rem}
.gmail-user-nav{display:flex;align-items:center;gap:.28rem;flex-wrap:wrap;padding:0;border:0;background:transparent;border-radius:var(--radius-pill);box-shadow:none;width:max-content;max-width:100%}
.gmail-user-surface{background:transparent;border:0;border-radius:0;box-shadow:none}
.gmail-sidebar-shell{background:transparent;border:0;border-radius:0;box-shadow:none;padding:.14rem 0 0}
.gmail-sidebar-section-label{padding:.18rem 1rem .4rem;font-size:.64rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#80868b}
.gmail-sidebar-cta{display:flex;align-items:center;justify-content:flex-start;gap:.68rem;min-height:50px;padding:.76rem .94rem;border-radius:.72rem;background:var(--accent-compose);color:#0b57d0;font-size:.82rem;font-weight:700;border:0;box-shadow:none}
.gmail-sidebar-cta:hover{background:var(--accent-compose-hover);border-color:transparent}
.gmail-sidebar-cta-mark{width:1.18rem;height:1.18rem;border-radius:999px;background:#e8f0fe;color:#0b57d0;display:inline-flex;align-items:center;justify-content:center;font-size:.94rem;line-height:1}
.gmail-sidebar-nav{display:flex;flex-direction:column;gap:.08rem;padding-top:.42rem}
.gmail-sidebar-nav .dashboard-nav{font-size:.79rem;font-weight:600;min-height:2.75rem}
.gmail-workspace-shell{display:flex;flex-direction:column;gap:0;border:1px solid #e5e9ef;border-radius:.44rem;background:#fff;overflow:hidden;box-shadow:none}
.gmail-workspace-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.72rem;flex-wrap:wrap;background:#fff;padding-bottom:.36rem}
.gmail-toolbar-card{background:#fff;border:0;border-bottom:1px solid var(--border-subtle);border-radius:0;box-shadow:none;padding:.62rem .94rem}
.gmail-toolbar-card-quiet{padding:.58rem .94rem;background:#fff}
.gmail-list-stage{background:#fff;border:0;border-radius:0;box-shadow:none}
.gmail-list-stage-flat{background:#fff}
.gmail-list-stage-flat .gmail-list-shell{background:#fff}
.gmail-list-stage-flat .gmail-route-row,.gmail-list-stage-flat .gmail-mail-row{padding-left:1.05rem;padding-right:1.05rem}
.gmail-section-frame{background:#fff;border:0;border-top:1px solid rgba(227,231,235,.9);border-radius:0;padding:.9rem .94rem;box-shadow:none}
.gmail-mobile-nav-shell{display:flex;align-items:center;justify-content:flex-start;padding:0 .15rem}
.gmail-section-hero{display:flex;flex-direction:column;gap:.22rem}
.gmail-section-meta{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.gmail-admin-stack{display:grid;gap:0;border:1px solid var(--border-subtle);border-radius:.44rem;background:#fff;overflow:hidden}
.gmail-admin-stack .gmail-content-card{border:0;border-bottom:1px solid var(--border-subtle);border-radius:0}
.gmail-admin-stack .gmail-content-card:last-child{border-bottom:0}
.gmail-admin-canvas{max-width:72rem;margin:0 auto;width:100%}
@media (min-width:1024px){
  .gmail-admin-grid-wide{grid-template-columns:minmax(0,1.12fr) minmax(320px,.88fr)}
  .gmail-admin-topbar{flex-direction:row;align-items:flex-start;justify-content:space-between}
  .gmail-user-topbar{grid-template-columns:minmax(0,1fr) auto}
}
@media (max-width:1023px){
  .gmail-card-grid{grid-template-columns:minmax(0,1fr)}
  .gmail-card-actions{justify-content:flex-start}
  .gmail-route-main{grid-template-columns:minmax(0,1fr)}
  .gmail-route-side,.gmail-route-actions{justify-content:flex-start}
  .gmail-admin-card{grid-template-columns:minmax(0,1fr)}
  .gmail-admin-card-actions{justify-content:flex-start}
  .gmail-config-card{grid-template-columns:minmax(0,1fr)}
  .gmail-config-card-control{justify-content:stretch;flex-direction:column;align-items:stretch}
  .gmail-user-brand{grid-template-columns:minmax(0,1fr)}
  .gmail-user-stats{justify-content:flex-start}
}
.bg-gray-950{background:var(--bg-page)!important}
.bg-gray-950\/80{background:var(--bg-overlay)!important}
.bg-gray-950\/60,.bg-gray-900,.bg-gray-900\/60,.bg-gray-900\/40,.bg-gray-900\/80,.bg-gray-800{background:var(--bg-surface)!important}
.bg-gray-700{background:var(--bg-muted)!important}
.bg-gray-600{background:#dde3ea!important}
.hover\:bg-gray-900\/70:hover,.hover\:bg-gray-800:hover,.hover\:bg-gray-700:hover,.hover\:bg-gray-600:hover{background:var(--bg-muted)!important}
.text-white,.text-gray-200,.text-gray-300{color:var(--text-strong)!important}
.text-gray-400{color:var(--text-muted)!important}
.text-gray-500,.text-gray-600{color:var(--text-soft)!important}
.hover\:text-white:hover,.hover\:text-gray-300:hover{color:var(--text-strong)!important}
.border-gray-900,.border-gray-800,.border-gray-700,.border-gray-600{border-color:var(--border-subtle)!important}
.divide-gray-800>:not([hidden])~:not([hidden]),.divide-gray-700>:not([hidden])~:not([hidden]){border-color:var(--border-subtle)!important}
.bg-emerald-600,.bg-emerald-500{background:var(--accent-primary)!important}
.bg-emerald-950\/40,.bg-emerald-600\/20,.bg-emerald-900\/20,.bg-emerald-900\/30{background:var(--accent-soft)!important}
.border-l-emerald-500{border-left-color:var(--accent-primary)!important}
.hover\:bg-emerald-600:hover,.hover\:bg-emerald-500:hover{background:var(--accent-primary-hover)!important}
.hover\:bg-emerald-600\/40:hover{background:rgba(11,87,208,.18)!important}
.text-emerald-500,.text-emerald-400,.text-emerald-300,.text-emerald-200{color:var(--accent-primary)!important}
.border-emerald-400,.border-emerald-500,.border-emerald-500\/40,.border-emerald-500\/50,.border-emerald-700\/50,.border-emerald-800{border-color:var(--accent-soft-border)!important}
.focus\:border-emerald-500:focus{border-color:var(--accent-primary)!important}
.focus\:ring-emerald-500:focus{box-shadow:0 0 0 3px rgba(11,87,208,.12)!important}
.bg-blue-600{background:var(--accent-link)!important}
.bg-blue-600\/20,.bg-blue-900\/20{background:var(--info-surface)!important}
.hover\:bg-blue-600\/40:hover,.hover\:bg-blue-500:hover{background:rgba(11,87,208,.18)!important}
.text-blue-300{color:var(--accent-link)!important}
.border-blue-500\/40,.border-blue-700\/50{border-color:var(--info-border)!important}
.bg-rose-900\/50,.bg-rose-900\/30{background:var(--danger-surface)!important}
.hover\:bg-rose-900\/80:hover{background:color-mix(in srgb,var(--danger-surface) 60%,var(--danger) 40%)!important}
.bg-rose-600{background:var(--danger)!important}
.text-rose-400,.text-rose-300,.text-rose-200{color:var(--danger)!important}
.hover\:text-rose-300:hover{color:var(--danger-hover)!important}
.border-rose-800,.border-rose-900\/70{border-color:var(--danger-border)!important}
.focus\:ring-rose-500:focus{box-shadow:0 0 0 3px rgba(194,65,12,.12)!important}
.bg-amber-900\/20,.bg-amber-900\/30,.bg-amber-900\/40{background:var(--warning-surface)!important}
.text-amber-300,.text-amber-200{color:var(--warning)!important}
.border-amber-800,.border-amber-700,.border-amber-700\/50{border-color:var(--warning-border)!important}
input,select,textarea{background:var(--bg-surface)!important;color:var(--text-strong)!important;border-color:var(--border-strong)!important}
input:focus,select:focus,textarea:focus{border-color:var(--accent-link)!important;box-shadow:0 0 0 3px rgba(11,87,208,.12)!important}
input::placeholder,textarea::placeholder{color:var(--text-soft)!important}
button.bg-gray-800,button.bg-gray-700,.theme-toggle{background:var(--bg-surface)!important;color:var(--text-muted)!important;border-color:var(--border-strong)!important}
button.hover\:bg-gray-700:hover,button.hover\:bg-gray-600:hover,.theme-toggle:hover{background:var(--bg-muted)!important;color:var(--text-strong)!important;border-color:var(--border-strong)!important}
button.text-gray-400:hover{background:transparent!important;color:var(--text-strong)!important}
@media (max-width:1023px){
  .detail-panel{border-left:0;border-top:1px solid var(--border-subtle)}
  .gmail-app-chrome{padding:12px 12px 16px}
  .gmail-section-shell{padding:12px 12px 16px}
  .gmail-mail-main{grid-template-columns:minmax(0,1fr)}
  .gmail-mail-side{flex-direction:row;align-items:center;justify-content:space-between;min-width:0;padding-left:0}
}
</style>`;

const renderSharedThemeRuntimeScript = () => `<script>
function themePreferenceValue(){
    return 'light';
}
function getStoredThemePreference(){
    return 'light';
}
function updateThemeToggleLabel(){
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '\u4e3b\u9898\uff1a\u6d45\u8272';
}
function applyThemePreference(){
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.themePreference = 'light';
    try { localStorage.setItem('themePreference', 'light'); } catch (_) {}
    updateThemeToggleLabel();
}
function toggleThemePreference(){
    applyThemePreference();
}
function watchSystemThemeChange(){}
</script>`;

const renderPostThemeOverrides = () => `<style>
.app-shell,.surface-page,body.bg-gray-950,body.bg-gray-900{background:var(--bg-page)!important;color:var(--text-strong)!important}
#booting-panel,#auth-panel,#login-panel,#dashboard-panel{background:var(--bg-surface)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-panel)!important}
#dashboard-panel{border-radius:var(--radius-shell)!important;box-shadow:none!important}
#dashboard-panel>.bg-gray-900\/80,#dashboard-panel>.bg-gray-950,#dashboard-panel>.bg-gray-900{background:rgba(255,255,255,.92)!important;border-color:var(--border-subtle)!important;backdrop-filter:blur(10px)}
.dashboard-nav,.settings-nav,#nav-domains,#nav-invites,#nav-users{background:transparent!important;color:var(--text-muted)!important;border-color:transparent!important}
.dashboard-nav:hover,.settings-nav:hover,#nav-domains:hover,#nav-invites:hover,#nav-users:hover{color:var(--text-strong)!important;background:#edf1f4!important;border-color:transparent!important}
.dashboard-nav.bg-gray-800,.settings-nav.text-emerald-300,#nav-domains.text-emerald-400,#nav-invites.text-emerald-400,#nav-users.text-emerald-400{color:var(--accent-primary)!important}
.dashboard-nav.bg-gray-800,.dashboard-nav.nav-link-active,.settings-nav.border-emerald-400,.settings-nav.tab-link-active,#nav-domains.text-emerald-400,#nav-invites.text-emerald-400,#nav-users.text-emerald-400{background:#e8f0fe!important;border-color:transparent!important}
.admin-nav{display:inline-flex;align-items:center;justify-content:center;padding:.72rem 1rem;border:1px solid transparent;border-radius:.78rem;color:var(--text-muted)!important;background:transparent!important;font-weight:600;min-height:2.65rem}
.admin-nav:hover{background:#edf1f4!important;color:var(--text-strong)!important;border-color:transparent!important}
.admin-nav-active{background:#e8f0fe!important;border-color:transparent!important;color:var(--accent-primary)!important;box-shadow:none!important}
#route-create-modal,#route-edit-modal{background:var(--bg-overlay)!important}
#route-create-modal>div>div,#route-edit-modal>div>div{background:var(--bg-surface)!important;border-color:var(--border-subtle)!important;border-radius:.72rem!important;box-shadow:0 14px 28px rgba(60,64,67,.12)!important}
#inbox-layout,#inbox-list-panel,#inbox-detail{background:transparent!important}
#inbox-list-panel{background:var(--bg-surface)!important;border-right:1px solid var(--border-subtle)!important;box-shadow:none!important}
#inbox-detail{background:var(--bg-surface)!important;color:var(--text-muted)!important;border-left:1px solid var(--border-subtle)!important;box-shadow:none!important}
#inbox-detail .bg-gray-950,#inbox-detail .bg-gray-950\/80{background:var(--bg-muted)!important}
#inbox-list,#destination-list,#route-list{background:var(--bg-surface)!important}
#route-list>div,#destination-list>div{background:transparent!important}
#route-list>div:hover,#destination-list>div:hover{background:var(--bg-muted)!important}
#route-list.divide-y>div,#destination-list.divide-y>div,#inbox-list.divide-y>div,.divide-gray-800>div,.divide-gray-700>div{border-color:var(--border-subtle)!important}
#dashboard-section-routes .bg-gray-900\/60,#dashboard-section-security .bg-gray-900\/60,#dashboard-section-security .bg-gray-950\/60,#dashboard-section-routes .bg-gray-950\/60,.bg-gray-900\/40{background:var(--bg-surface)!important;border-color:var(--border-subtle)!important;box-shadow:none!important}
#dashboard-section-routes,#dashboard-section-inbox,#dashboard-section-security,#dashboard-section-inbox>div,main.bg-gray-950{background:transparent!important}
#dashboard-section-security .border-b,#dashboard-section-routes .border-b,#dashboard-section-inbox .border-b,#dashboard-section-inbox .border-t,.border-gray-800,.border-gray-700,.border-gray-600{border-color:var(--border-subtle)!important}
#dashboard-section-security .text-white,#dashboard-section-routes .text-white,#dashboard-section-inbox .text-white,.text-white{color:var(--text-strong)!important}
#dashboard-section-security .text-gray-400,#dashboard-section-routes .text-gray-400,#dashboard-section-inbox .text-gray-400,.text-gray-400{color:var(--text-muted)!important}
#dashboard-section-security .text-gray-500,#dashboard-section-routes .text-gray-500,#dashboard-section-inbox .text-gray-500,.text-gray-500,.text-gray-600{color:var(--text-soft)!important}
#dashboard-section-security .bg-rose-900\/50,#dashboard-section-routes .bg-rose-900\/50,#dashboard-section-inbox .bg-rose-900\/50{background:var(--danger-surface)!important;border-color:var(--danger-border)!important;color:var(--danger)!important}
#dashboard-section-security .bg-blue-600\/20,#dashboard-section-routes .bg-blue-600\/20,#dashboard-section-inbox .bg-blue-600\/20{background:var(--info-surface)!important;border-color:var(--info-border)!important;color:var(--info)!important}
#dashboard-section-security .bg-emerald-600\/20,#dashboard-section-routes .bg-emerald-600\/20,#dashboard-section-inbox .bg-emerald-600\/20{background:var(--accent-soft)!important;border-color:var(--accent-soft-border)!important;color:var(--accent-primary)!important}
.table-shell,.overflow-x-auto.border.border-gray-700.rounded-xl{border-color:var(--border-subtle)!important;background:var(--bg-surface)!important;box-shadow:none!important;border-radius:.64rem!important}
thead.bg-gray-900,thead.bg-gray-900\/80{background:var(--bg-muted)!important;color:var(--text-muted)!important;border-color:var(--border-subtle)!important}
tbody.divide-y.divide-gray-700>tr,tbody.divide-y.divide-gray-800>tr{border-color:var(--border-subtle)!important}
.hover\:bg-gray-800:hover{background:var(--bg-muted)!important}
</style>`;

const renderUserHTML = (sitekey, bypassTurnstile = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>云端邮件路由系统</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${bypassTurnstile ? '' : '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'}
    ${renderThemeBootstrapScript()}
    ${renderSharedThemeStyle()}
    ${renderPostThemeOverrides()}
    ${renderSharedThemeRuntimeScript()}
    <style>
html,body{height:100%}
.sidebar{padding:6px 0 0}
/* Gmail-style topbar with white background */
.topbar{background:#fff!important;border-bottom:1px solid var(--border-subtle)!important;padding-top:.5rem!important;padding-bottom:.5rem!important;backdrop-filter:none!important}
/* Sidebar label styling */
.gmail-sidebar-section-label{font-size:.68rem!important;font-weight:600!important;color:#5f6368!important;letter-spacing:.03em!important;text-transform:uppercase!important;padding:12px 16px 4px!important}
aside .dashboard-nav{position:relative!important;width:100%!important;padding:11px 16px!important;border:0!important;background:transparent!important;color:var(--text-muted)!important;font-weight:500!important;justify-content:flex-start!important}
aside .dashboard-nav:hover{background:#f1f3f4!important;color:var(--text-strong)!important}
aside .dashboard-nav.bg-gray-800,aside .dashboard-nav.bg-gray-800:hover{background:#e8f0fe!important;color:#174ea6!important;box-shadow:none!important}
aside .dashboard-nav.bg-gray-800::after{display:none!important}
.md\:hidden .dashboard-nav.bg-gray-800{border-bottom:0!important}
.dashboard-nav{background:transparent!important;border:1px solid transparent!important;color:var(--text-muted)!important;border-radius:var(--radius-pill)!important;box-shadow:none!important}
.dashboard-nav:hover{background:#f1f3f4!important;color:var(--text-strong)!important;border-color:transparent!important}
.dashboard-nav.bg-gray-800,.dashboard-nav.nav-link-active,.dashboard-nav.bg-gray-800:hover{background:#e8f0fe!important;color:#174ea6!important;border:1px solid transparent!important}
.settings-nav.text-emerald-300{color:var(--accent-primary)!important}
.settings-nav.border-emerald-400{border-color:transparent!important}
button.text-emerald-400.border-emerald-400{color:var(--accent-primary)!important;border-color:var(--accent-primary)!important}
main.bg-gray-950,#dashboard-section-security,#dashboard-section-routes,#dashboard-section-inbox,#dashboard-section-inbox>div{background:transparent!important}
#inbox-detail .bg-gray-950\/80{background:#f8fafd!important}
.gmail-user-nav.flex-col{gap:.18rem!important;padding:.08rem 0!important}
.gmail-user-nav.flex-col .dashboard-nav{border-radius:0 999px 999px 0!important}
.md\:hidden .gmail-user-nav{display:inline-flex!important;gap:.26rem!important;padding:.22rem!important;background:#f1f3f4!important;border-radius:.78rem!important;border:1px solid #e7ebef!important}
.md\:hidden .gmail-user-nav .dashboard-nav{min-height:2.14rem!important;padding:.5rem .78rem!important;font-size:.73rem!important;border-radius:.7rem!important}
.md\:hidden .gmail-user-nav .dashboard-nav.bg-gray-800{box-shadow:none!important}
.gmail-toolbar-card .gmail-searchbar{background:#f1f3f4!important;border-color:#e3e8ef!important;border-radius:1.08rem!important;min-height:52px!important;box-shadow:none!important}
.gmail-toolbar-card .gmail-searchbar:hover{background:#eef2f5!important;border-color:#dde4ee!important}
.gmail-toolbar-card .gmail-searchbar:focus-within{background:#fff!important;border-color:#d2d9e4!important;box-shadow:0 1px 2px rgba(60,64,67,.035),0 3px 8px rgba(60,64,67,.045)!important}
.gmail-list-stage .gmail-list-shell{background:transparent!important}
.gmail-toolbar-card{padding:.76rem 1rem!important}
.gmail-panel-header{padding-left:1.05rem!important;padding-right:1.05rem!important}
.gmail-section-frame .panel-header{background:transparent!important;border-bottom:0!important;padding:0!important}
.gmail-sidebar-shell .gmail-user-nav{padding:.08rem 0!important;gap:.12rem!important}
.gmail-sidebar-shell .dashboard-nav{min-height:2.9rem!important;padding:.78rem 1rem!important;font-size:.82rem!important;border-radius:0 999px 999px 0!important}
.gmail-mail-row,.gmail-card-row,.gmail-admin-card{border-radius:0!important}
.gmail-attach-shell{background:#f8fafd!important;padding:.76rem .88rem!important}
.gmail-list-meta,.gmail-panel-header,.gmail-detail-head{background:#fff!important}
.gmail-detail-placeholder-mark{border-radius:.56rem!important;background:#e8edf6!important}
.gmail-user-surface{padding-top:0!important;padding-bottom:0!important}
.gmail-user-stats{gap:.42rem!important}
.gmail-user-stat{background:#fff!important;border-color:#e8ebf0!important;padding:.36rem .58rem!important}

.gmail-section-shell,.gmail-app-chrome{gap:1.05rem!important}
.content-area{display:flex!important;flex-direction:column!important}
.sidebar{padding-top:.25rem!important}
.gmail-sidebar-cta{min-height:52px!important;border-radius:.82rem!important;padding:.78rem .94rem!important;box-shadow:0 1px 2px rgba(60,64,67,.12),0 2px 6px rgba(60,64,67,.06)!important}
.gmail-sidebar-shell{padding:.08rem 0 0!important}
.gmail-workspace-shell,.gmail-inbox-shell,.gmail-admin-stack,.gmail-admin-list{border-radius:.66rem!important}
.gmail-workspace-head{padding-top:.9rem!important;padding-bottom:.64rem!important}
.gmail-searchbar{min-height:52px!important;border-radius:1.08rem!important}
.gmail-mail-row{padding-top:.66rem!important;padding-bottom:.66rem!important}
.gmail-route-row{padding-top:.82rem!important;padding-bottom:.82rem!important}
.gmail-mail-avatar{box-shadow:none!important}
.gmail-mail-subject{max-width:40%!important}
.gmail-detail-title{font-size:1.04rem!important}
.gmail-detail-toolbar{margin-top:.58rem!important;padding-top:.58rem!important}
.gmail-detail-body{padding:.96rem 1rem 1.08rem!important}
.gmail-detail-body-surface{background:#fff!important;border-color:#edf1f4!important;border-radius:.52rem!important;padding:.92rem .96rem .98rem!important}
.gmail-attach-card{border-radius:.42rem!important}
.sidebar .dashboard-nav{margin-right:0!important}
.rounded-2xl{border-radius:.68rem!important}
.rounded-xl{border-radius:.56rem!important}
.gmail-user-title{font-size:1rem!important}
.gmail-user-copy{font-size:.77rem!important;max-width:35rem!important}
.gmail-user-stat{padding:.32rem .54rem!important;font-size:.68rem!important}
.workspace-section-copy{font-size:.76rem!important;max-width:34rem!important}
.rounded-lg{border-radius:.58rem!important}
.rounded-\[1rem\]{border-radius:.62rem!important}
.shadow-2xl,.shadow-lg{box-shadow:0 6px 16px rgba(60,64,67,.07)!important}
.text-emerald-300.font-mono{color:var(--accent-primary)!important}
.text-rose-300{color:var(--danger)!important}
.min-h-\[160px\]{border-radius:.56rem;background:#f8fafd}
    </style>

</head>
<body class="app-shell font-sans min-h-screen overflow-hidden">
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2"></div>

    <div id="booting-panel" class="surface-card fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 text-center text-muted fade-in">
        <div class="auth-shell-head items-center text-center mb-0">
            <span class="auth-shell-badge">Cloud Mail</span>
            <div class="text-strong text-lg font-semibold">正在检查登录状态</div>
            <div class="auth-shell-copy">正在恢复你的收件箱、邮箱别名和账户设置。</div>
        </div>
    </div>

    <div id="auth-panel" class="surface-card hidden fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 p-6 fade-in">
        <div class="auth-shell-head mx-auto">
            <span class="auth-shell-badge">Cloud Mail</span>
            <div class="text-strong text-xl font-semibold">欢迎回来</div>
            <div class="auth-shell-copy">用更接近邮箱客户端的方式管理站内收件箱、邮箱别名和账户安全设置。</div>
        </div>
        <div class="auth-shell-tabs">
            <button type="button" class="auth-tab auth-tab-active w-1/2 text-center" id="tab-login" onclick="switchTab('login')">用户登录</button>
            <button type="button" class="auth-tab w-1/2 text-center" id="tab-register" onclick="switchTab('register')">注册账户</button>
        </div>
        <form id="auth-form" onsubmit="handleAuth(event)" class="space-y-3">
            <input type="text" id="username" class="field" placeholder="\u7528\u6237\u540d" required>
            <input type="password" id="password" class="field" placeholder="密码" required>
            <div id="invite-wrap" class="hidden">
                <input type="text" id="invite-code" class="field" placeholder="邀请码">
            </div>
            ${bypassTurnstile
                ? '<div class="py-2 px-3 rounded-lg border border-amber-800 bg-amber-900/30 text-amber-300 text-xs">Turnstile 已临时绕过，仅用于排障；恢复后请立即关闭 TURNSTILE_BYPASS。</div>'
                : `<div class="cf-turnstile flex justify-center py-2" data-sitekey="${sitekey}"></div>`
            }
            <button type="submit" id="submit-btn" class="btn-primary w-full justify-center font-medium active:scale-[0.99]">登录</button>
        </form>
    </div>

    <div id="dashboard-panel" class="hidden app-shell w-full h-screen overflow-hidden fade-in flex flex-col">
      <div class="topbar px-3 md:px-5 pt-3 md:pt-4">
           <div class="flex flex-col md:flex-row justify-between gap-2 md:ml-0 px-1 md:px-0">
                <div>
                    <h2 class="gmail-user-title"><span class="w-2.5 h-2.5 rounded-full status-dot"></span>云端收件箱</h2>
                </div>
            </div>
      </div>
        <div class="md:hidden overflow-x-auto px-3 md:px-5 pt-3">
            <div class="gmail-mobile-nav-shell">
            <div class="gmail-user-nav gmail-mobile-nav min-w-max mx-auto md:mx-0">
                <button type="button" data-dashboard-section="inbox" onclick="switchDashboardSection('inbox')" class="dashboard-nav gmail-nav-pill nav-link px-3 py-1.5 text-xs whitespace-nowrap"><span class="gmail-nav-dot"></span><span>站内收件箱</span></button>
                <button type="button" data-dashboard-section="routes" onclick="switchDashboardSection('routes')" class="dashboard-nav gmail-nav-pill nav-link px-3 py-1.5 text-xs whitespace-nowrap"><span class="gmail-nav-dot"></span><span>邮箱别名</span></button>
                <button type="button" data-dashboard-section="security" onclick="switchDashboardSection('security')" class="dashboard-nav gmail-nav-pill nav-link px-3 py-1.5 text-xs whitespace-nowrap"><span class="gmail-nav-dot"></span><span>设置</span></button>
            </div>
            </div>
        </div>
        <div class="flex flex-1 min-h-0 gap-0 px-3 md:px-5 pb-4 md:pb-5 pt-2 md:pt-3">
           <aside class="sidebar hidden md:flex w-60 shrink-0 flex-col gap-3">
                <button type="button" onclick="switchDashboardSection('routes'); openRouteCreate();" class="gmail-sidebar-cta">
                    <span class="gmail-sidebar-cta-mark">+</span>
                    <span>新建别名</span>
                </button>
                <div class="gmail-sidebar-shell flex flex-col gap-1">
                <div class="gmail-sidebar-section-label">工作区</div>
                <div class="gmail-user-nav gmail-sidebar-nav flex-col items-stretch bg-transparent border-0 shadow-none w-full max-w-none">
                    <button type="button" data-dashboard-section="inbox" onclick="switchDashboardSection('inbox')" class="dashboard-nav gmail-nav-pill nav-link text-left px-3 py-2 text-sm"><span class="gmail-nav-dot"></span><span>站内收件箱</span></button>
                    <button type="button" data-dashboard-section="routes" onclick="switchDashboardSection('routes')" class="dashboard-nav gmail-nav-pill nav-link text-left px-3 py-2 text-sm"><span class="gmail-nav-dot"></span><span>邮箱别名</span></button>
                    <button type="button" data-dashboard-section="security" onclick="switchDashboardSection('security')" class="dashboard-nav gmail-nav-pill nav-link text-left px-3 py-2 text-sm"><span class="gmail-nav-dot"></span><span>设置</span></button>
               </div>
               </div>
                <div class="sidebar-footer mt-auto flex flex-col gap-2 px-2 pb-2">
                    <div class="gmail-user-stats flex gap-1">
                        <span id="dashboard-route-summary" class="gmail-user-stat flex-1 flex flex-col items-center"><strong style="font-size:.66rem;color:var(--text-muted)">邮箱别名</strong><span>0 / 0</span></span>
                        <span id="dashboard-dest-summary" class="gmail-user-stat flex-1 flex flex-col items-center"><strong style="font-size:.66rem;color:var(--text-muted)">转发邮箱</strong><span>0 / 0</span></span>
                    </div>
                    <button onclick="logout()" class="btn-secondary text-xs w-full justify-center">退出登录</button>
                </div>
           </aside>
            <main class="content-area flex-1 min-w-0 overflow-hidden surface-card" style="border-radius:0">
            <section id="dashboard-section-routes" class="dashboard-section hidden h-full overflow-y-auto">
            <div class="gmail-section-shell">
                <div class="gmail-workspace-shell">
                <div class="gmail-workspace-head px-4 md:px-5 pt-4 md:pt-5 pb-3 bg-white">
                    <div class="workspace-section-head">
                        <div class="workspace-section-kicker">Workspace</div>
                        <h3 class="section-title">邮箱别名</h3>
                        <div class="workspace-section-copy">像整理 Gmail 标签一样，查看哪些地址还在生效、会投递到哪里，以及什么时候到期。</div>
                        <div id="route-quota" class="section-subtitle"></div>
                    </div>
                        <button type="button" id="route-create-open-btn" onclick="openRouteCreate()" class="btn-primary self-start sm:self-center text-sm whitespace-nowrap">新建别名</button>
                </div>
                <div class="gmail-toolbar-card gmail-toolbar-card-quiet">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div class="gmail-searchbar sm:flex-1">
                            <svg class="gmail-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <path d="M8.75 3.5a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 0 0 0-10.5Zm0 0l6.75 6.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="route-search" class="field w-full min-w-0" placeholder="搜索别名 / 备注 / 转发邮箱">
                        </div>
                        <button type="button" id="route-search-clear" class="btn-secondary text-xs whitespace-nowrap">清空</button>
                        <div id="route-search-count" class="text-xs text-soft sm:text-right sm:min-w-[120px]">0 / 0 条结果</div>
                    </div>
                </div>
                <div class="gmail-list-stage gmail-list-stage-flat overflow-hidden">
                    <div id="route-list" class="gmail-list-shell text-sm"></div>
                </div>
                </div>
            </div>
            <div id="route-create-modal" class="overlay-backdrop hidden fixed inset-0 z-40 p-4 md:p-6 overflow-y-auto">
                <div class="min-h-full flex items-center justify-center">
                    <div class="modal-card gmail-dialog-card w-full max-w-xl">
                        <div class="gmail-dialog-head">
                            <div>
                                <h4 class="gmail-dialog-title">创建邮箱别名</h4>
                                <p class="gmail-dialog-copy mt-1">选择域名、有效期和投递方式。</p>
                            </div>
                            <button type="button" onclick="closeRouteCreate()" class="overlay-close text-xl leading-none">×</button>
                        </div>
                        <form onsubmit="handleRoute(event)" class="gmail-dialog-body">
                            <div class="split-field shadow-sm">
                                <input type="text" id="route-prefix" class="field w-1/2 min-w-[120px]" placeholder="前缀，如 admin" required>
                                <span class="split-addon text-sm">@</span>
                                <select id="route-domain" class="select w-1/2 min-w-0"></select>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <select id="route-duration" class="select min-w-0"></select>
                                <select id="route-delivery-mode" class="select min-w-0">
                                    <option value="inbox_only">仅站内收件箱</option>
                                    <option value="inbox_forward">站内收件箱 + 保底转发</option>
                                    <option value="forward_only">仅转发到邮箱</option>
                                </select>
                            </div>
                            <select id="route-destination" class="select w-full min-w-0"></select>
                            <input type="text" id="route-remark" maxlength="100" class="field w-full min-w-0" placeholder="用途备注（可选）">
                            <div class="gmail-dialog-actions sm:flex-row sm:justify-end sm:items-center">
                                <button type="button" onclick="closeRouteCreate()" class="btn-secondary text-sm">取消</button>
                                <button type="submit" id="route-btn" class="btn-primary text-sm whitespace-nowrap">创建</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div id="route-edit-modal" class="overlay-backdrop hidden fixed inset-0 z-40 p-4 md:p-6 overflow-y-auto">
                <div class="min-h-full flex items-center justify-center">
                    <div class="modal-card gmail-dialog-card w-full max-w-xl">
                        <div class="gmail-dialog-head">
                            <div>
                                <h4 class="gmail-dialog-title">编辑邮箱别名</h4>
                                <p id="edit-route-address" class="gmail-dialog-address mt-1"></p>
                            </div>
                            <button type="button" onclick="closeRouteEdit()" class="overlay-close text-xl leading-none">×</button>
                        </div>
                        <form onsubmit="saveRouteEdit(event)" class="gmail-dialog-body">
                            <input type="hidden" id="edit-route-id">
                            <label class="gmail-dialog-field">
                                <span class="gmail-dialog-field-label">投递方式</span>
                                <select id="edit-route-delivery-mode" onchange="toggleRouteEditTarget()" class="select w-full min-w-0">
                                    <option value="inbox_only">仅站内收件箱</option>
                                    <option value="inbox_forward">站内收件箱 + 保底转发</option>
                                    <option value="forward_only">仅转发到邮箱</option>
                                </select>
                            </label>
                            <label id="edit-route-destination-wrap" class="gmail-dialog-field">
                                <span class="gmail-dialog-field-label">目标邮箱</span>
                                <select id="edit-route-destination" class="select w-full min-w-0"></select>
                                <span id="edit-route-destination-empty" class="hidden mt-1 text-xs text-rose-300">没有可用转发邮箱，请先到设置里添加并验证邮箱。</span>
                            </label>
                            <label class="gmail-dialog-field">
                                <span class="gmail-dialog-field-label">用途备注</span>
                                <input type="text" id="edit-route-remark" maxlength="100" class="field w-full min-w-0" placeholder="用途备注（可选）">
                            </label>
                            <div class="gmail-dialog-actions sm:flex-row sm:justify-end sm:items-center">
                                <button type="button" onclick="closeRouteEdit()" class="btn-secondary text-sm">取消</button>
                                <button type="submit" id="edit-route-save-btn" class="btn-primary text-sm whitespace-nowrap">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            </section>
<section id="dashboard-section-inbox" class="dashboard-section h-full overflow-y-auto">
            <div class="gmail-app-chrome h-full flex flex-col gap-3">
                <div class="gmail-inbox-shell flex-1 min-h-0 flex flex-col">
                    <div class="gmail-workspace-head px-4 md:px-5 pt-4 md:pt-5 pb-2 bg-white">
                        <div class="workspace-section-head">
                            <div class="workspace-section-kicker">Inbox</div>
                            <h3 class="section-title">站内收件箱</h3>
                            <div class="workspace-section-copy">把通过邮箱别名收到的邮件集中放进一个更安静、更连续的阅读工作区里，发件人、正文和附件都会更清楚。</div>
                        </div>
                    </div>
                    <div class="gmail-toolbar-card gmail-toolbar-card-quiet">
                        <div class="flex flex-col lg:flex-row lg:items-center gap-3">
                            <div class="gmail-searchbar flex-1">
                                <svg class="gmail-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                    <path d="M8.75 3.5a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 0 0 0-10.5Zm0 0l6.75 6.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <input type="text" id="inbox-search" class="field" placeholder="搜索发件人 / 主题 / 正文">
                            </div>
                            <div class="gmail-toolbar-actions">
                                <button type="button" onclick="loadInbox(1)" class="btn-secondary text-xs whitespace-nowrap">搜索</button>
                                <button type="button" onclick="refreshInboxNow()" class="btn-primary text-xs whitespace-nowrap">刷新</button>
                            </div>
                        </div>
                    </div>
                    <div class="gmail-list-meta">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="text-strong font-semibold">邮件列表</span>
                            <span id="inbox-page-info" class="pill-muted">第 1 页</span>
                        </div>
                        <span id="inbox-refresh-info">自动刷新已开启</span>
                    </div>
                    <div id="inbox-layout" class="grid grid-cols-1 lg:grid-cols-[minmax(360px,1fr)_minmax(0,1fr)] gap-0 flex-1 min-h-0">
                        <div id="inbox-list-panel" class="flex flex-col min-h-0 h-full overflow-hidden">
                            <div class="gmail-mail-toolbar">
                                <span class="gmail-mail-toolbar-title">最新会话</span>
                                <div class="gmail-mail-toolbar-actions">
                                    <button onclick="changeInboxPage(-1)" class="btn-secondary text-xs px-3 py-1.5">上一页</button>
                                    <button onclick="changeInboxPage(1)" class="btn-secondary text-xs px-3 py-1.5">下一页</button>
                                </div>
                            </div>
                            <div class="gmail-panel-header px-4 py-3 flex items-center justify-between gap-2 text-xs text-soft">
                                <span class="text-muted">会话列表</span>
                                <span class="text-soft">按时间倒序</span>
                            </div>
                            <div id="inbox-list" class="text-sm flex-1 min-h-0 overflow-y-auto bg-white"></div>
                        </div>
                        <div id="inbox-detail" class="hidden lg:flex detail-panel min-h-0 h-full items-center justify-center text-sm text-muted">选择一封邮件查看正文</div>
                    </div>
                </div>
            </div>
            </section>
            <section id="dashboard-section-security" class="dashboard-section hidden h-full overflow-y-auto">
            <div class="gmail-section-shell space-y-4">
                <div class="gmail-workspace-shell">
                    <div class="gmail-workspace-head px-4 md:px-5 pt-4 md:pt-5 pb-2 bg-white">
                        <div class="workspace-section-head">
                            <div class="workspace-section-kicker">Settings</div>
                            <h3 class="section-title">设置</h3>
                            <div class="workspace-section-copy">管理转发邮箱、投递目标和账户安全，让邮箱别名的投递逻辑保持简单、明确、可追踪。</div>
                        </div>
                    </div>
                    <div class="gmail-toolbar-card gmail-toolbar-card-quiet">
                        <div class="panel-header flex gap-2 overflow-x-auto pb-1">
                            <button type="button" data-settings-section="destinations" onclick="switchSettingsSection('destinations')" class="settings-nav tab-link shrink-0 text-sm">转发邮箱</button>
                            <button type="button" data-settings-section="security" onclick="switchSettingsSection('security')" class="settings-nav tab-link shrink-0 text-sm">账户安全</button>
                        </div>
                    </div>
                </div>
                <div id="settings-section-destinations" class="settings-section gmail-settings-stack max-w-5xl">
                    <div class="gmail-content-card gmail-settings-block">
                        <div class="gmail-content-body">
                        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                            <div>
                                <h4 class="text-strong font-semibold">添加转发邮箱</h4>
                                <p class="text-xs text-soft mt-1">可选绑定真实邮箱，用于保底转发或仅转发；仅站内收件箱模式无需添加。</p>
                            </div>
                            <div id="dest-summary" class="text-xs text-soft md:text-right leading-6"></div>
                        </div>
                        <form onsubmit="handleDest(event)" class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,1fr)_140px_120px] gap-3 mt-4">
                            <input type="email" id="dest-email" class="field" placeholder="如 real-email@qq.com" required>
                            <select id="dest-duration" class="select"></select>
                            <button type="submit" id="dest-btn" class="btn-primary text-sm md:col-span-2 lg:col-span-1">发送验证</button>
                        </form>
                        </div>
                    </div>
                    <div class="gmail-content-card gmail-settings-block">
                        <div class="gmail-panel-header px-4 py-3">
                            <h4 class="text-strong font-semibold">已绑定邮箱</h4>
                            <p class="text-xs text-soft mt-1">已验证邮箱可作为别名的转发目标，待验证邮箱可在完成收信确认后启用。</p>
                        </div>
                        <div id="destination-list" class="gmail-list-shell text-sm"></div>
                    </div>
                </div>
                <div id="settings-section-security" class="settings-section hidden gmail-settings-stack max-w-4xl">
                    <div class="gmail-content-card gmail-settings-block">
                        <div class="gmail-content-body">
                        <h4 class="text-strong font-semibold mb-1">修改密码</h4>
                        <p class="text-xs text-soft mb-4">建议定期更新密码，避免与其他站点使用相同密码。</p>
                        <form onsubmit="changePassword(event)" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            <input type="password" id="old-password" class="field" placeholder="当前密码" required>
                            <input type="password" id="new-password" class="field" placeholder="\u65b0\u5bc6\u7801" required>
                            <button type="submit" class="btn-secondary text-sm md:col-span-2">修改密码</button>
                        </form>
                        </div>
                    </div>
                    <div class="gmail-section-frame gmail-section-frame-danger p-4">
                        <h4 class="text-danger font-semibold mb-1">注销账户</h4>
                        <p class="text-xs text-soft mb-4">此操作会删除账户、站内收件箱和已创建的邮箱别名，且无法恢复。</p>
                        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-3 mt-4">
                            <input type="password" id="delete-account-password" class="field" placeholder="输入当前密码确认注销账户">
                            <button onclick="deleteAccount()" class="btn-danger text-sm">注销账户</button>
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

        function escapeHTML(s) {
            var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return map[ch]; });
        }
        function durationRank(v){ return v === 'permanent' ? Infinity : parseInt(v, 10); }
        function durationOptions(){ return publicConfig.durationOptions && publicConfig.durationOptions.length ? publicConfig.durationOptions : [{value:'1',label:'1 小时'},{value:'8',label:'8 小时'},{value:'24',label:'24 小时'},{value:'48',label:'48 小时'},{value:'72',label:'72 小时'},{value:'168',label:'168 小时'},{value:'permanent',label:'永久'}]; }
        function durationLabel(v){ var hit = durationOptions().find(function(o){ return o.value === String(v); }); return hit ? hit.label : String(v); }
        function parseDbDate(v){ if(!v) return null; v = String(v); return new Date(v.indexOf('T') >= 0 ? v : v.replace(' ', 'T') + 'Z'); }
        function formatDate(v){ if(!v) return '永久'; var d = parseDbDate(v); return isNaN(d.getTime()) ? v : d.toLocaleString(); }
        function formatFileSize(bytes){ bytes = Number(bytes) || 0; if(bytes < 1024) return bytes + ' B'; if(bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; }
        function remainingText(v){ if(!v) return '\u6c38\u4e45'; var diff = parseDbDate(v).getTime() - Date.now(); if(diff <= 0) return '\u5df2\u8fc7\u671f'; return '\u7ea6 ' + Math.ceil(diff / 3600000) + ' \u5c0f\u65f6'; }
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
            t.className='px-5 py-3 rounded-[1rem] shadow-lg text-white font-medium text-sm transition-all duration-300 translate-x-full opacity-0 ' + (isErr?'bg-rose-600':'bg-emerald-600');
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
                btn.classList.toggle('nav-link-active', isActive);
                btn.classList.toggle('gmail-nav-pill-active', isActive);
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
                btn.classList.toggle('tab-link-active', isActive);
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
            var base = 'detail-panel min-h-0 h-full gmail-detail-shell';
            if (mode === 'reader') return base + ' overflow-hidden flex flex-col';
            return base + ' p-8 flex items-center justify-center text-sm text-muted';
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
                var emptyTitle = searching ? '没有匹配的邮箱别名' : '还没有邮箱别名';
                var emptyAction = searching
                    ? '<button type="button" onclick="clearRouteSearch()" class="mt-3 btn-secondary text-xs">清空搜索</button>'
                    : '<button type="button" onclick="openRouteCreate()" class="mt-3 btn-primary text-xs">新建邮箱别名</button>';
                container.innerHTML = '<div class="empty-state"><div class="empty-state-title">' + emptyTitle + '</div><div class="empty-state-copy mt-1">' + (searching ? '换个关键词试试，或者清空当前搜索，列表会自动恢复全部可用别名。' : '创建后会在这里显示别名地址、投递方式、转发目标和有效期。') + '</div>' + emptyAction + '</div>';
                return;
            }
            container.innerHTML = routes.map(function(r){
                var routeDurationText = r.duration_hours ? durationLabel(r.duration_hours) : (r.expires_at ? '\u6309\u8fc7\u671f\u65f6\u95f4' : '\u6c38\u4e45');
                var remark = r.remark || '';
                var address = (r.tag || '') + '@' + (r.domain || '');
                var avatarText = ((r.tag || r.domain || '?').charAt(0) || '?').toUpperCase();
                var expiryText = r.expires_at ? (routeDurationText + '，到 ' + formatDate(r.expires_at)) : routeDurationText;
                var deliveryMode = routeDeliveryMode(r);
                var badgeClass = deliveryMode === 'forward_only'
                    ? 'badge-status pill-muted'
                    : (deliveryMode === 'inbox_forward' ? 'badge-status badge-primary' : 'badge-status badge-info');
                var deliveryBadge = '<span class="' + badgeClass + '">' + deliveryModeLabel(deliveryMode) + '</span>';
                var targetText = deliveryMode === 'inbox_only'
                    ? '\u4ec5\u6536\u8fdb\u7ad9\u5185\u6536\u4ef6\u7bb1'
                    : (r.destination_email || '\u6682\u672a\u9009\u62e9\u8f6c\u53d1\u90ae\u7bb1');
                var remarkText = remark ? escapeHTML(remark) : '\u8fd9\u4e2a\u522b\u540d\u8fd8\u6ca1\u6709\u5907\u6ce8';
                var secondaryLine = deliveryMode === 'inbox_only'
                    ? '<span class="gmail-route-target">站内收件箱</span>'
                    : '<span class="gmail-route-target">' + escapeHTML(targetText) + '</span>';
                var deliveryLineText = deliveryMode === 'inbox_only'
                    ? '\u53ea\u4fdd\u7559\u5728\u7ad9\u5185\u6536\u4ef6\u7bb1'
                    : ('\u540c\u65f6\u6295\u9012\u5230 ' + targetText);
                return '<div class="gmail-route-row">' +
                    '<div class="gmail-route-main">' +
                        '<div class="gmail-route-identity">' +
                            '<span class="gmail-route-avatar">' + escapeHTML(avatarText) + '</span>' +
                            '<div class="gmail-route-content">' +
                                '<div class="gmail-route-address mono-accent">' + escapeHTML(address) + '</div>' +
                                '<div class="gmail-route-summary">' + remarkText + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="gmail-route-detail">' +
                            '<div class="gmail-route-line">' + deliveryBadge + secondaryLine + '</div>' +
                            '<div class="gmail-route-meta"><span><strong>投递去向</strong> ' + escapeHTML(deliveryLineText) + '</span><span><strong>有效期</strong> ' + escapeHTML(expiryText) + '</span></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gmail-route-side">' +
                        '<div class="gmail-route-actions">' +
                            '<button type="button" onclick="openRouteEdit(' + r.id + ')" class="btn-secondary text-xs">编辑</button>' +
                            '<button type="button" onclick="deleteRoute(' + r.id + ')" class="btn-secondary text-xs text-danger">删除</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
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
            document.getElementById('submit-btn').innerText = m==='login'?'登录':'注册';
            document.getElementById('tab-login').className = m==='login'?'auth-tab auth-tab-active w-1/2 text-center':'auth-tab w-1/2 text-center';
            document.getElementById('tab-register').className = m==='register'?'auth-tab auth-tab-active w-1/2 text-center':'auth-tab w-1/2 text-center';
            updateInviteField();
            if (!TURNSTILE_BYPASS && window.turnstile) window.turnstile.reset();
        }
        async function handleAuth(e) {
            e.preventDefault();
            var t = new FormData(e.target).get('cf-turnstile-response');
            if (TURNSTILE_BYPASS && !t) t = 'bypass';
            if(!t) return showToast('\u8bf7\u5b8c\u6210\u4eba\u673a\u9a8c\u8bc1', true);
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
                if (window.turnstile && /楠岃瘉|turnstile|captcha/i.test(String(errMsg))) window.turnstile.reset();
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
            if (btn && btn.disabled) return showToast('\u5f53\u524d\u8fd8\u4e0d\u80fd\u65b0\u5efa\u90ae\u7bb1\u522b\u540d\uff0c\u8bf7\u5148\u68c0\u67e5\u914d\u989d\u3001\u57df\u540d\u6216\u8f6c\u53d1\u90ae\u7bb1\u72b6\u6001', true);
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
            if (!route) return showToast('\u8fd9\u4e2a\u90ae\u7bb1\u522b\u540d\u5df2\u7ecf\u4e0d\u5b58\u5728\uff0c\u6216\u5217\u8868\u521a\u521a\u5237\u65b0\u8fc7', true);
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
            container.innerHTML = '<div class="empty-state"><div class="empty-state-title">还没有添加任何转发邮箱</div><div class="empty-state-copy mt-1">添加并验证邮箱后，这里会显示可用状态、默认行为和有效期。</div></div>';
                return;
            }
            container.innerHTML = list.map(function(item){
                var statusText = item.status === 'verified' ? '\u5df2\u9a8c\u8bc1' : '\u5f85\u9a8c\u8bc1';
                var statusClass = item.status === 'verified' ? 'badge-status badge-success' : 'badge-status badge-info';
                var durationText = item.duration_hours ? durationLabel(item.duration_hours) : (item.expires_at ? '\u6309\u8fc7\u671f\u65f6\u95f4' : '\u6c38\u4e45');
                var avatarText = ((item.email || '?').charAt(0) || '?').toUpperCase();
                var expiryText = item.status === 'pending'
                    ? ('邮箱有效期：' + durationText + '，验证截止：' + formatDate(item.pending_expires_at))
                    : (item.expires_at ? ('\u90ae\u7bb1\u6709\u6548\u671f\uff1a' + durationText + '\uff0c\u5230\u671f\u65f6\u95f4\uff1a' + formatDate(item.expires_at) + '\uff08' + remainingText(item.expires_at) + '\uff09') : '\u90ae\u7bb1\u6709\u6548\u671f\uff1a\u6c38\u4e45');
                var refreshBtn = item.status === 'pending'
                    ? '<button onclick="refreshDestination(' + item.id + ')" class="btn-linkish text-xs">刷新验证</button>'
                    : '';
                var inboxDefaultText = String(item.inbox_default || 'true') === 'true' ? '\u65b0\u5efa\u522b\u540d\u65f6\u4f1a\u9ed8\u8ba4\u9009\u4e2d\u5b83' : '\u53ea\u5728\u4f60\u624b\u52a8\u6307\u5b9a\u65f6\u624d\u4f1a\u4f7f\u7528';
                var inboxDefaultBadge = String(item.inbox_default || 'true') === 'true'
                    ? '<span class="gmail-route-target">默认目标</span>'
                    : '<span class="gmail-route-target">手动选择</span>';
                var statusDetail = item.status === 'pending'
                    ? '\u7b49\u5f85\u4f60\u5728\u90ae\u7bb1\u91cc\u5b8c\u6210\u9a8c\u8bc1'
                    : '\u53ef\u4ee5\u7acb\u5373\u4f5c\u4e3a\u8f6c\u53d1\u76ee\u6807';
                return '<div class="gmail-route-row">' +
                    '<div class="gmail-route-main">' +
                        '<div class="gmail-route-identity">' +
                            '<span class="gmail-route-avatar">' + escapeHTML(avatarText) + '</span>' +
                            '<div class="gmail-route-content">' +
                                '<div class="gmail-route-address mono-accent">' + escapeHTML(item.email) + '</div>' +
                                '<div class="gmail-route-summary">' + escapeHTML(inboxDefaultText) + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="gmail-route-detail">' +
                            '<div class="gmail-route-line"><span class="' + statusClass + '">' + statusText + '</span>' + inboxDefaultBadge + '</div>' +
                            '<div class="gmail-route-meta"><span><strong>当前状态</strong> ' + escapeHTML(statusDetail) + '</span><span><strong>有效期</strong> ' + escapeHTML(durationText) + '</span><span><strong>提醒</strong> ' + escapeHTML(expiryText) + '</span></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gmail-route-side">' +
                        '<div class="gmail-route-actions">' + refreshBtn + '<button onclick="deleteDestination(' + item.id + ')" class="btn-secondary text-xs text-danger">删除</button></div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        function applyDashboardState() {
            fillDurationSelect('dest-duration', dashboardState.limits.destinationMax);
            var quota = dashboardState.quota || {used:0,max:0,destinationUsed:0,destinationMax:0};
            document.getElementById('dest-summary').innerHTML = '<span class="gmail-stat-inline"><strong>' + quota.destinationUsed + '</strong><span>/ ' + quota.destinationMax + ' 个转发邮箱</span></span>';
            document.getElementById('dashboard-dest-summary').innerHTML = '<strong>转发邮箱</strong><span>' + quota.destinationUsed + ' / ' + quota.destinationMax + '</span>';
            renderDestinationList();

            document.getElementById('route-quota').innerHTML = '<span class="gmail-stat-inline"><strong>' + quota.used + '</strong><span>/ ' + quota.max + ' 个邮箱别名</span></span>';
            document.getElementById('dashboard-route-summary').innerHTML = '<strong>邮箱别名</strong><span>' + quota.used + ' / ' + quota.max + '</span>';
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
            routeDestinationSelect.innerHTML = availableDestinations.length ? availableDestinations.map(function(x){ return '<option value="' + x.id + '">' + escapeHTML(x.email) + '</option>'; }).join('') : '<option value="" disabled>暂无可用已验证邮箱，请到 设置 > 转发邮箱 添加</option>';
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
                routeCreateOpenBtn.className = canCreate ? 'btn-primary self-start sm:self-center text-sm whitespace-nowrap' : 'btn-secondary btn-disabled self-start sm:self-center text-sm whitespace-nowrap';
            }
            document.getElementById('route-btn').className = canCreate ? 'btn-primary text-sm whitespace-nowrap' : 'btn-secondary btn-disabled text-sm whitespace-nowrap';

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
            showToast(res.ok ? '\u5907\u6ce8\u5df2\u4fdd\u5b58' : (d.error || '\u5907\u6ce8\u4fdd\u5b58\u5931\u8d25'), !res.ok);
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
                showToast(res.ok ? (d.message || '\u4e13\u5c5e\u90ae\u7bb1\u5df2\u66f4\u65b0') : (d.error || '\u66f4\u65b0\u5931\u8d25'), !res.ok);
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
            showToast(d.success ? (d.message || '邮箱别名创建成功') : (d.error || '创建失败'), !d.success);
            if(d.success) {
                document.getElementById('route-prefix').value = '';
                document.getElementById('route-remark').value = '';
                closeRouteCreate();
                await loadDashboard();
            }
        }
        async function deleteRoute(id) {
            if(!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u5417\uff1f\u5220\u9664\u540e Cloudflare \u8def\u7531\u4e5f\u4f1a\u4e00\u8d77\u79fb\u9664\u3002')) return;
            var res = await fetch('/api/routes/' + id, {method:'DELETE'});
            var d = await res.json();
            showToast(d.message || d.error || '请求完成', !res.ok);
            await loadDashboard();
        }
        async function deleteDestination(id) {
            if(!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u5e95\u5c42\u6536\u4ef6\u7bb1\u5417\uff1f\u82e5\u4ecd\u88ab\u8def\u7531\u4f7f\u7528\u5c06\u88ab\u963b\u6b62\u3002')) return;
            var res = await fetch('/api/destinations/' + id, {method:'DELETE'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(d.message || d.error || '请求完成', !res.ok);
            await loadDashboard();
        }
function renderInboxDetailPlaceholder(text) {
            var detail = document.getElementById('inbox-detail');
            if (!detail) return;
            detail.className = inboxDetailClassName('placeholder');
            detail.innerHTML = '<div class="gmail-detail-placeholder"><div class="gmail-detail-placeholder-mark">@</div><div class="empty-state-title">\u7ad9\u5185\u6536\u4ef6\u7bb1</div><div class="empty-state-copy">' + escapeHTML(text || '\u4ece\u5de6\u4fa7\u9009\u62e9\u4e00\u5c01\u90ae\u4ef6\uff0c\u5373\u53ef\u5728\u8fd9\u91cc\u67e5\u770b\u6b63\u6587\u3001\u6295\u9012\u4fe1\u606f\u548c\u9644\u4ef6\u3002') + '</div></div>';
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
                    if (!options.silent) showToast('\u6536\u4ef6\u7bb1\u5237\u65b0\u5931\u8d25', true);
                    return;
                }
                var d = await res.json().catch(function(){ return {data:[]}; });
                renderInboxList(d.data || []);
                document.getElementById('inbox-page-info').innerText = '\u7b2c ' + inboxPage + ' \u9875';
                updateInboxRefreshInfo('已刷新 ' + new Date().toLocaleTimeString());
            } finally {
                inboxLoading = false;
            }
        }
function renderInboxList(items) {
            var list = document.getElementById('inbox-list');
            if (!list) return;
            if (!items.length) {
                list.innerHTML = '<div class="empty-state"><div class="empty-state-title mb-2">收件箱还是空的</div><div class="empty-state-copy">新收到的邮件会整齐地出现在这里，你也可以通过上方搜索框快速筛选发件人、主题或正文内容。</div></div>';
                return;
            }
            list.innerHTML = items.map(function(m){
                var unread = !m.read_at;
                var selected = Number(m.id) === Number(inboxSelectedMailId);
                var subject = m.subject || '(无主题)';
                var preview = m.preview || '';
                var senderText = String(m.from_email || '未知发件人').trim();
                var senderLetter = senderText ? senderText.charAt(0).toUpperCase() : '@';
                var itemClass = selected ? 'list-row list-row-selected gmail-mail-row' : ((unread ? 'list-row list-row-unread ' : 'list-row list-row-read ') + 'gmail-mail-row');
                var status = m.forward_status && m.forward_status !== 'forwarded' ? '<span class="badge-status badge-warning">' + escapeHTML(m.forward_status) + '</span>' : '';
                var unreadDot = unread ? '<span class="gmail-mail-flag" aria-hidden="true"></span>' : '';
                var attachmentHint = Number(m.attachment_count || 0) > 0 ? '<span>' + escapeHTML(String(m.attachment_count)) + ' 个附件</span>' : '<span>无附件</span>';
                return '<div onclick="openInboxMail(' + m.id + ')" class="' + itemClass + '">' +
                    '<div class="gmail-mail-main">' +
                        '<div class="gmail-mail-from">' + unreadDot + '<span class="gmail-mail-avatar">' + escapeHTML(senderLetter) + '</span><span class="truncate">' + escapeHTML(senderText || '\u672a\u77e5\u53d1\u4ef6\u4eba') + '</span></div>' +
                        '<div class="gmail-mail-content">' +
                            '<div class="gmail-mail-line">' +
                                '<div class="gmail-mail-subject">' + escapeHTML(subject) + '</div>' +
                                '<span class="gmail-mail-snippet-divider">-</span>' +
                                '<div class="gmail-mail-preview">' + escapeHTML(preview || '\u65e0\u6b63\u6587\u9884\u89c8') + '</div>' +
                            '</div>' +
                            '<div class="gmail-mail-meta">' +
                                '<span class="gmail-mail-route">' + escapeHTML(m.route_address || '') + '</span>' +
                                attachmentHint +
                                status +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gmail-mail-side">' +
                        '<span class="gmail-mail-time">' + escapeHTML(formatDate(m.received_at)) + '</span>' +
                        '<button onclick="deleteInboxMail(event,' + m.id + ')" class="gmail-row-action" aria-label="删除邮件">删除</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        function renderInboxAttachments(mailId, attachments, statusText) {
            var rows = Array.isArray(attachments) ? attachments : [];
            var notice = statusText ? '<div class="mb-2 notice-warning text-xs rounded px-3 py-2">' + escapeHTML(statusText) + '</div>' : '';
            if (!rows.length) return notice;
            return '<div class="gmail-attach-shell">' + notice + '<div class="gmail-attach-head"><div class="text-xs font-bold text-muted">附件</div><div class="text-xs text-soft">共 ' + escapeHTML(String(rows.length)) + ' 个文件</div></div><div class="gmail-attach-grid">' + rows.map(function(a){
                var url = '/api/inbox/' + encodeURIComponent(mailId) + '/attachments/' + encodeURIComponent(a.id);
                return '<div class="gmail-attach-card"><div class="min-w-0"><div class="text-sm text-strong truncate">' + escapeHTML(a.filename || 'attachment') + '</div><div class="text-xs text-soft">' + escapeHTML(a.content_type || 'application/octet-stream') + ' · ' + escapeHTML(formatFileSize(a.size_bytes)) + '</div></div><a href="' + url + '" target="_blank" rel="noopener" class="btn-linkish text-xs whitespace-nowrap">下载</a></div>';
            }).join('') + '</div></div>';
        }
        async function openInboxMail(id) {
            inboxSelectedMailId = id;
            var detail = document.getElementById('inbox-detail');
            if (detail) {
                detail.className = inboxDetailClassName('placeholder');
                detail.innerHTML = '<div class="gmail-detail-placeholder"><div class="gmail-detail-placeholder-mark">@</div><div class="empty-state-title">正在读取邮件</div><div class="empty-state-copy">正在加载正文、投递地址和附件信息。</div></div>';
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
                var senderText = String(m.from_email || '').trim();
                var senderLetter = senderText ? senderText.charAt(0).toUpperCase() : '@';
                detail.className = inboxDetailClassName('reader');
                detail.innerHTML = '<div class="gmail-detail-head">' +
                    '<div class="flex justify-between gap-3 items-start">' +
                        '<div class="min-w-0 flex-1">' +
                            '<div class="gmail-detail-kicker">Inbox</div>' +
                            '<div class="gmail-detail-title break-words mt-1.5">' + escapeHTML(m.subject || '(\u65e0\u4e3b\u9898)') + '</div>' +
                            '<div class="gmail-detail-sender mt-4">' +
                                '<div class="gmail-detail-avatar">' + escapeHTML(senderLetter) + '</div>' +
                                '<div class="gmail-detail-sender-meta">' +
                                    '<div class="gmail-detail-sender-name">' + escapeHTML(m.from_email || '\u672a\u77e5\u53d1\u4ef6\u4eba') + '</div>' +
                                    '<div class="gmail-detail-sender-sub">发送到 ' + escapeHTML(m.route_address || '') + '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="gmail-detail-toolbar">' +
                                '<div class="gmail-stat-inline"><strong>' + escapeHTML((Array.isArray(m.attachments) ? m.attachments.length : 0)) + '</strong><span> 个附件</span></div>' +
                                '<div class="gmail-detail-meta"><span>' + escapeHTML(formatDate(m.received_at)) + '</span><span>投递到：' + escapeHTML(m.route_address || '') + '</span></div>' +
                            '</div>' +
                        '</div>' +
                        '<button onclick="closeInboxMail()" class="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">返回列表</button>' +
                    '</div>' +
                '</div><div class="gmail-detail-body"><div class="gmail-detail-card"><div class="gmail-detail-body-surface"><div id="inbox-body-container" class="email-html break-words"></div></div></div></div>' + renderInboxAttachments(m.id || id, m.attachments || [], m.attachment_status_text || '');
                var bodyContainer = document.getElementById('inbox-body-container');
                if (bodyContainer) {
                    if (m.body_html) bodyContainer.innerHTML = m.body_html;
                    else bodyContainer.innerHTML = '<pre class="whitespace-pre-wrap break-words text-sm text-strong m-0">' + escapeHTML(m.body_text || '') + '</pre>';
                }
                setInboxResponsiveView('detail');
            }
            await loadInbox(inboxPage, {silent:true, preserveSelection:true});
        }
        async function deleteInboxMail(event, id) {
            if (event && event.stopPropagation) event.stopPropagation();
            if(!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u5c01\u7ad9\u5185\u90ae\u4ef6\u5417\uff1f\u771f\u5b9e\u90ae\u7bb1\u4e2d\u7684\u4fdd\u5e95\u8f6c\u53d1\u4e0d\u53d7\u5f71\u54cd\u3002')) return;
            var res = await fetch('/api/inbox/' + id, {method:'DELETE'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(res.ok ? (d.message || '\u90ae\u4ef6\u5df2\u5220\u9664') : (d.error || '\u5220\u9664\u5931\u8d25'), !res.ok);
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
            if(newPassword.length < 6) return showToast('\u65b0\u5bc6\u7801\u81f3\u5c11 6 \u4f4d', true);
            var res = await fetch('/api/password', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({oldPassword:oldPassword,newPassword:newPassword})});
            var d = await res.json();
            showToast(d.message || d.error || '请求完成', !res.ok);
            if(res.ok){ document.getElementById('old-password').value=''; document.getElementById('new-password').value=''; }
        }
        async function deleteAccount() {
            var password = document.getElementById('delete-account-password').value;
            if(!password) return showToast('请输入当前密码确认注销', true);
            if(!confirm('\u786e\u5b9a\u6c38\u4e45\u5220\u9664\u81ea\u5df1\u7684\u8d26\u53f7\u5417\uff1f\u8d26\u53f7\u3001\u5e95\u5c42\u6536\u4ef6\u7bb1\u548c\u6240\u6709\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u90fd\u4f1a\u88ab\u5220\u9664\u3002')) return;
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
// 2. 鐜颁唬鍖栫鐞嗗憳缃戦〉 HTML
// ==========================================
const renderAdminHTML = (adminPath, sitekey, bypassTurnstile = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>邮件工作区设置</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${bypassTurnstile ? '' : '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'}
    ${renderThemeBootstrapScript()}
    ${renderSharedThemeStyle()}
    ${renderPostThemeOverrides()}
    ${renderSharedThemeRuntimeScript()}
    <style>
body{background:var(--bg-page)!important;color:var(--text-strong)!important}
#dashboard-panel{background:var(--bg-page)!important;border-radius:var(--radius-shell)!important;overflow:hidden}
.surface-card{border-radius:var(--radius-panel)!important}
.topbar{background:rgba(255,255,255,.96)!important}
.gmail-admin-canvas{max-width:76rem!important}
.gmail-admin-copy{max-width:44rem!important}
#view-domains .gmail-admin-grid-wide{grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr)!important}
#view-domains .gmail-admin-grid-wide>.gmail-content-card{border-radius:0!important}
#view-domains .gmail-admin-grid-wide>.gmail-content-card:first-child{border-bottom:1px solid var(--border-subtle)!important}
#view-domains .gmail-admin-grid-wide>.gmail-content-card:last-child{border-top:0!important}
.gmail-admin-domain-stack .gmail-content-body{padding-bottom:.92rem!important}
.gmail-admin-domain-stack .gmail-admin-row{background:#f8fafd!important}
.gmail-admin-domain-stack .gmail-admin-row:hover{background:#f3f6fb!important}
.gmail-panel-header{padding-top:.88rem!important;padding-bottom:.82rem!important}
.gmail-content-body{padding:.88rem .96rem!important}
.gmail-admin-card-main{gap:.24rem!important}
.gmail-admin-meta-line{line-height:1.48!important}
.gmail-user-copy,.gmail-admin-copy,.gmail-admin-section-copy,.workspace-section-copy{color:#5f6368!important}
    </style>

</head>
<body class="app-shell font-sans min-h-screen p-4 flex justify-center items-center">
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2"></div>

    <div id="booting-panel" class="surface-card w-full max-w-[26rem] p-8 text-center text-muted fade-in">
        <div class="auth-shell-head items-center text-center mb-0 mx-auto">
            <span class="auth-shell-badge">管理工作区</span>
            <div class="text-strong text-lg font-semibold">正在检查登录状态</div>
            <div class="auth-shell-copy">正在恢复域名、邀请码和用户管理状态。</div>
        </div>
    </div>

    <div id="login-panel" class="surface-card hidden w-full max-w-[26rem] p-8 fade-in">
        <div class="auth-shell-head items-center text-center mx-auto">
            <span class="auth-shell-badge">管理工作区</span>
            <div class="text-strong text-2xl font-bold">邮件工作区设置</div>
            <div class="auth-shell-copy">集中管理域名开放、容量限制、邀请码与用户状态。</div>
        </div>
        <form onsubmit="handleAdminLogin(event)" class="space-y-4">
            <input type="text" id="admin-user" class="field" placeholder="管理员账号" required>
            <input type="password" id="admin-pass" class="field" placeholder="登录密码" required>
            ${bypassTurnstile
                ? '<div class="py-2 px-3 rounded-lg border border-amber-800 bg-amber-900/30 text-amber-300 text-xs">Turnstile 已临时绕过，仅用于排障；恢复后请立即关闭 TURNSTILE_BYPASS。</div>'
                : `<div class="cf-turnstile flex justify-center py-2" data-sitekey="${sitekey}"></div>`
            }
            <button type="submit" class="btn-primary w-full justify-center font-bold py-3 transition-all">解锁</button>
        </form>
    </div>

    <div id="dashboard-panel" class="hidden app-shell w-full h-screen overflow-hidden fade-in flex flex-col">
        <div class="topbar px-4 md:px-6 py-3 md:py-4">
            <div class="gmail-admin-topbar gmail-admin-canvas">
                <div class="gmail-admin-brand">
                    <div class="gmail-admin-kicker">Workspace</div>
                    <div class="text-lg font-semibold text-strong">邮件工作区设置</div>
                    <div class="gmail-admin-copy">把域名开放、容量限制、邀请码和用户状态收进同一个更轻的设置工作区里，尽量接近 Gmail 的设置阅读感。</div>
                </div>
                <div class="gmail-admin-tab-group">
                    <div class="gmail-admin-tabs">
                        <button onclick="nav('domains')" id="nav-domains" class="admin-nav admin-nav-active">域名与容量</button>
                        <button onclick="nav('invites')" id="nav-invites" class="admin-nav">邀请码</button>
                        <button onclick="nav('users')" id="nav-users" class="admin-nav">用户</button>
                    </div>
                    <button onclick="logout()" class="btn-secondary text-sm whitespace-nowrap">锁定退出</button>
                </div>
            </div>
        </div>
        ${bypassTurnstile ? '<div class="px-6 py-3 border-b border-amber-700 bg-amber-900/40 text-amber-200 text-sm">当前 TURNSTILE_BYPASS=true：人机验证已绕过，仅限排障，请在恢复后立即关闭。</div>' : ''}

        <div class="px-4 md:px-6 py-4 overflow-y-auto flex-1 surface-page">
            <div id="view-domains" class="gmail-admin-grid gmail-admin-canvas">
                <div class="gmail-admin-grid-wide gmail-admin-stack gmail-admin-domain-stack">
                    <div class="gmail-content-card">
                        <div class="gmail-panel-header px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 class="gmail-admin-section-title">可用域名</h3>
                                <p class="gmail-admin-section-copy mt-1">先同步 Cloudflare 域名，再决定哪些地址空间对用户开放，用来创建邮箱别名。</p>
                            </div>
                            <button onclick="syncDomains()" class="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">同步 Cloudflare</button>
                        </div>
                        <div class="gmail-content-body">
                            <div id="domain-list" class="space-y-3 text-sm"></div>
                        </div>
                    </div>
                    <div class="gmail-content-card">
                        <div class="gmail-panel-header px-5 py-4">
                            <h4 class="gmail-admin-section-title">开放范围</h4>
                            <p class="gmail-admin-section-copy mt-1">追加子域，或者回看当前已开放的根域与子域，统一在这里维护。</p>
                        </div>
                        <div class="gmail-content-body space-y-4">
                            <form onsubmit="addSubdomain(event)" class="grid grid-cols-1 md:grid-cols-[180px_1fr_120px] gap-3">
                                <select id="sub-zone" class="select"></select>
                                <input type="text" id="sub-name" class="field" placeholder="子域名前缀，如 mail 或 corp">
                                <button type="submit" class="btn-primary text-sm">新增子域</button>
                            </form>
                            <div id="authorized-domain-list" class="space-y-3 text-sm"></div>
                        </div>
                    </div>
                </div>
                <div class="gmail-content-card">
                    <div class="gmail-panel-header px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 class="gmail-admin-section-title">容量与规则</h3>
                            <p class="gmail-admin-section-copy mt-1">统一控制注册、容量、有效期和附件限制，让整个邮件工作区在高峰时也更稳。</p>
                        </div>
                        <button onclick="runCleanup()" class="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">立即清理过期数据</button>
                    </div>
                    <div class="gmail-content-body space-y-4">
                        <div id="r2-storage-status"></div>
                        <div id="config-list" class="gmail-config-grid"></div>
                    </div>
                </div>
            </div>

            <div id="view-invites" class="hidden gmail-admin-grid gmail-admin-canvas">
                <div class="gmail-content-card">
                    <div class="gmail-panel-header px-5 py-4">
                        <h3 class="gmail-admin-section-title">邀请码</h3>
                        <p class="gmail-admin-section-copy mt-1">生成、调整和回收邀请码，用更直接的方式控制谁可以进入注册流程。</p>
                    </div>
                    <div class="gmail-content-body space-y-5">
                        <form onsubmit="createInvite(event)" class="grid grid-cols-1 md:grid-cols-[1fr_160px_120px_120px] gap-3">
                            <input type="text" id="new-invite-code" class="field" placeholder="邀请码，如 ABCD-2026" required>
                            <input type="number" min="1" id="new-invite-max" class="field" placeholder="可用次数" required>
                            <button type="button" onclick="randomInvite()" class="btn-secondary text-sm">随机生成</button>
                            <button type="submit" class="btn-primary text-sm">新增</button>
                        </form>
                        <div id="invite-table-body" class="gmail-admin-list"></div>
                    </div>
                </div>
            </div>

            <div id="view-users" class="hidden gmail-admin-grid gmail-admin-canvas">
                <div class="gmail-content-card">
                    <div class="gmail-panel-header px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <h3 class="gmail-admin-section-title">用户</h3>
                            <p class="gmail-admin-section-copy mt-1">搜索用户、查看邮箱绑定状态，并在必要时清理账户数据。</p>
                        </div>
                        <div class="flex gap-2 w-full lg:w-auto">
                            <input type="text" id="search-user" class="field flex-1 lg:w-[280px]" placeholder="搜索用户名...">
                            <button onclick="loadUsers(1)" class="btn-secondary text-sm whitespace-nowrap">精准搜索</button>
                        </div>
                    </div>
                    <div class="gmail-content-body space-y-4">
                        <div id="user-table-body" class="gmail-admin-list"></div>
                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-sm">
                            <span id="page-info" class="text-soft font-medium"></span>
                            <div class="flex gap-2">
                                <button onclick="changePage(-1)" class="btn-secondary text-sm px-3 py-1.5">上一页</button>
                                <button onclick="changePage(1)" class="btn-secondary text-sm px-3 py-1.5">下一页</button>
                            </div>
                        </div>
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
            'max_users': '\u7cfb\u7edf\u6700\u5927\u6ce8\u518c\u603b\u4eba\u6570',
            'max_routes_per_user': '\u5355\u7528\u6237\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u4e0a\u9650',
            'max_total_destinations': '\u5168\u5c40\u76ee\u6807\u90ae\u7bb1\u603b\u914d\u989d',
            'max_destinations_per_user': '\u5355\u7528\u6237\u5e95\u5c42\u6536\u4ef6\u7bb1\u4e0a\u9650',
            'max_regs_per_ip_24h': '\u5355 IP \u6bcf 24 \u5c0f\u65f6\u6ce8\u518c\u4e0a\u9650',
            'unverified_user_expiry_hours': '\u65e0\u90ae\u7bb1\u50f5\u5c38\u53f7\u6e05\u7406\u65f6\u95f4(\u65f6)',
            'pending_dest_expiry_hours': '\u9a8c\u8bc1\u90ae\u4ef6\u672a\u786e\u8ba4\u8d85\u65f6(\u65f6)',
            'allowed_countries': '\u5141\u8bb8\u6ce8\u518c\u7684\u56fd\u5bb6\u4ee3\u7801(ALL\u4e0d\u9650)',
            'allow_registration': '\u662f\u5426\u5f00\u653e\u65b0\u6ce8\u518c',
            'enable_invitation_code': '\u662f\u5426\u542f\u7528\u9080\u8bf7\u7801',
            'max_destination_duration_hours': '\u7ed1\u5b9a\u9a8c\u8bc1\u90ae\u7bb1\u6700\u5927\u6709\u6548\u671f',
            'max_route_duration_hours': '\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u6700\u5927\u6709\u6548\u671f',
            'inbound_mail_retention_days': '\u7ad9\u5185\u90ae\u4ef6\u4fdd\u7559\u5929\u6570',
            'max_inbound_body_bytes': '\u7ad9\u5185\u90ae\u4ef6\u6b63\u6587\u6700\u5927\u5927\u5c0f(MB)',
            'max_inbound_attachment_bytes': '\u5355\u9644\u4ef6\u6700\u5927\u5927\u5c0f(MB)',
            'max_inbound_total_attachment_bytes': '\u5355\u5c01\u90ae\u4ef6\u9644\u4ef6\u603b\u5927\u5c0f(MB)',
            'max_inbound_r2_storage_bytes': '\u7ad9\u5185\u9644\u4ef6 R2 \u5b58\u50a8\u4e0a\u9650(MB)',
            'max_inbound_attachments_per_email': '\u5355\u5c01\u90ae\u4ef6\u9644\u4ef6\u6570\u91cf\u4e0a\u9650'
        };
        let currPage = 1;
        let cfZones = [];
        let bypassWarned = false;

        function escapeHTML(s) {
            var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return map[ch]; });
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
            var boundLabel = storage.r2Bound ? 'R2 \u5df2\u7ed1\u5b9a' : 'R2 \u672a\u7ed1\u5b9a';
            var boundClass = storage.r2Bound ? 'badge-status badge-success' : 'badge-status badge-warning';
            var limitText = limit > 0 ? formatStorageSize(limit) : '\u4e0d\u4fdd\u5b58\u9644\u4ef6';
            box.innerHTML = '<div class="gmail-content-card"><div class="gmail-content-body py-4">' +
                '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">' +
                  '<div><div class="text-sm font-bold text-strong">站内附件 R2 用量</div><div class="text-xs text-soft mt-1">当前系统附件占用 ' + escapeHTML(formatStorageSize(used)) + ' / ' + escapeHTML(limitText) + '，共 ' + escapeHTML(storage.attachmentCount || 0) + ' 个附件</div></div>' +
                  '<span class="text-xs px-2.5 py-1 rounded-lg border ' + boundClass + '">' + boundLabel + '</span>' +
                '</div>' +
                '<div class="h-2 surface-inset rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:' + percent.toFixed(1) + '%"></div></div>' +
                '<div class="mt-2 text-xs text-soft">占比 ' + percent.toFixed(1) + '%</div>' +
              '</div></div>';
        }
        function configControl(i) {
            if (durationConfigKeys.indexOf(i.key) >= 0) {
                return '<select id="cfg-' + escapeHTML(i.key) + '" class="select">' + durationOptions.map(function(o){ return '<option value="' + o.value + '"' + (String(i.value) === o.value ? ' selected' : '') + '>' + o.label + '</option>'; }).join('') + '</select>';
            }
            if (booleanConfigKeys.indexOf(i.key) >= 0) {
                return '<select id="cfg-' + escapeHTML(i.key) + '" class="select"><option value="true"' + (String(i.value) === 'true' ? ' selected' : '') + '>true</option><option value="false"' + (String(i.value) === 'false' ? ' selected' : '') + '>false</option></select>';
            }
            if (sizeConfigKeys.indexOf(i.key) >= 0) {
                return '<input type="number" step="0.001" min="0" id="cfg-' + escapeHTML(i.key) + '" value="' + escapeHTML(bytesToMbValue(i.value)) + '" class="field">';
            }
            return '<input type="text" id="cfg-' + escapeHTML(i.key) + '" value="' + escapeHTML(i.value) + '" class="field">';
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
                document.getElementById('nav-'+name).className = tab===name?'admin-nav admin-nav-active':'admin-nav';
            });
            if(tab === 'invites') loadInvites();
        }
        async function handleAdminLogin(e){
            e.preventDefault();
            var t = new FormData(e.target).get('cf-turnstile-response');
            if (TURNSTILE_BYPASS && !t) t = 'bypass';
            if(!t) return showT('\u8bf7\u5b8c\u6210\u4eba\u673a\u9a8c\u8bc1', true);
            const res=await fetch(basePath+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('admin-user').value,password:document.getElementById('admin-pass').value,turnstileToken: TURNSTILE_BYPASS ? '' : t})});
            if(res.ok) location.reload();
            else {
                const d = await res.json().catch(function(){ return {}; });
                showT(d.error || '\u9a8c\u8bc1\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u8d26\u53f7\u5bc6\u7801', true);
                if (!TURNSTILE_BYPASS && window.turnstile) window.turnstile.reset();
            }
        }
        async function loadConfigs(){
            const d = await (await fetch(basePath+'/config')).json();
            renderStorageStatus(d.storage || {});
            if (d.security && d.security.turnstileBypass && !bypassWarned) {
                bypassWarned = true;
                showT('\u5b89\u5168\u544a\u8b66\uff1aTURNSTILE_BYPASS=true\uff0c\u5f53\u524d\u4eba\u673a\u9a8c\u8bc1\u5df2\u7ed5\u8fc7\uff0c\u4ec5\u9650\u6392\u969c\u3002', true);
            }
            const rows = (d.data || []).sort(function(a,b){
                var ai = cfgOrder.indexOf(a.key), bi = cfgOrder.indexOf(b.key);
                return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            });
            document.getElementById('config-list').innerHTML = rows.map(function(i){
                return '<div class="gmail-config-card">' +
                    '<div class="gmail-config-card-head">' +
                        '<span class="gmail-config-card-title">' + escapeHTML(cfgDict[i.key]||i.key) + '</span>' +
                        '<span class="gmail-config-card-key">' + escapeHTML(i.key) + '</span>' +
                        '<span class="gmail-config-card-copy">修改后会立即影响用户创建邮箱、站内收件限制或系统容量策略。</span>' +
                    '</div>' +
                    '<div class="gmail-config-card-control">' + configControl(i) + '<button onclick="saveC(\\'' + escapeHTML(i.key) + '\\')" class="btn-primary text-sm whitespace-nowrap">保存</button></div>' +
                '</div>';
            }).join('');
        }
        async function saveC(k){
            let v=document.getElementById('cfg-'+k).value;
            if (sizeConfigKeys.indexOf(k) >= 0) {
                v = mbToBytesValue(v);
                if (v == null) return showT('\u8bf7\u8f93\u5165\u6709\u6548\u7684 MB \u6570\u503c', true);
            }
            const r=await fetch(basePath+'/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?'\u53c2\u6570\u5df2\u4fdd\u5b58':(d.error || '\u4fdd\u5b58\u5931\u8d25'),!r.ok);
            if(r.ok) loadConfigs();
        }
        async function syncDomains(){
            document.getElementById('domain-list').innerHTML='<span class="text-emerald-500 animate-pulse">正在通过 Cloudflare 接口拉取全部域名...</span>';
            try {
                const cfResRaw = await fetch(basePath+'/cf-zones');
                const cfRes = await cfResRaw.json();
                if (cfRes.error) {
                    return document.getElementById('domain-list').innerHTML='<div class="p-4 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300"><b>Cloudflare 接口拒绝访问：</b><br/>' + escapeHTML(JSON.stringify(cfRes.details)) + '<br/>请检查 API Token 是否具备 Zone:Read 权限，并确认已经授权 All Zones。</div>';
                }
                const dbR = await fetch(basePath+'/domains');
                const dbD = (await dbR.json()).data||[];
                cfZones = cfRes.data||[];
                if(!cfZones.length) return document.getElementById('domain-list').innerHTML='<div class="empty-state"><div class="empty-state-title mb-2">当前账号下没有可用域名</div><div class="empty-state-copy">Cloudflare 返回成功，但账号里暂时没有可授权给邮箱系统的域名。</div></div>';
                document.getElementById('sub-zone').innerHTML = cfZones.map(function(z, idx){ return '<option value="' + idx + '">' + escapeHTML(z.name) + '</option>'; }).join('');
                document.getElementById('domain-list').innerHTML = cfZones.map(function(z, idx){
                    const on = dbD.find(function(d){ return d.zone_id===z.id && d.domain===z.name; });
                return on ? '<div class="gmail-admin-row gmail-admin-row-active"><div class="gmail-admin-row-main"><div class="gmail-admin-row-title mono-accent">' + escapeHTML(z.name) + '</div><div class="gmail-admin-row-note">当前已开放，用户现在就可以用它创建邮箱别名。</div></div><button onclick="tDom(\\'del\\',' + on.id + ')" class="btn-secondary text-xs px-3 py-1.5 text-danger">关闭并清空路由</button></div>'
                              : '<div class="gmail-admin-row"><div class="gmail-admin-row-main"><div class="gmail-admin-row-title">' + escapeHTML(z.name) + '</div><div class="gmail-admin-row-note">还没有对用户开放，授权后就会出现在创建别名时的可选域名里。</div></div><button onclick="tDom(\\'add\\',' + idx + ')" class="btn-secondary text-xs px-3 py-1.5">开放给用户</button></div>';
                }).join('');
                renderAuthorizedDomains(dbD);
            } catch (err) { document.getElementById('domain-list').innerHTML='<div class="empty-state"><div class="empty-state-title mb-2">域名加载失败</div><div class="empty-state-copy">网络请求出现异常，请稍后重试，或检查 Cloudflare API 配置。</div></div>'; }
        }
        function renderAuthorizedDomains(items){
            document.getElementById('authorized-domain-list').innerHTML = items.length ? items.map(function(d){
                const zone = cfZones.find(function(z){ return z.id === d.zone_id; });
                const isSub = zone && d.domain !== zone.name;
                return '<div class="gmail-admin-row"><div class="gmail-admin-row-main"><div class="gmail-admin-row-title mono-accent">' + escapeHTML(d.domain) + '</div><div class="gmail-admin-row-note">' + (isSub ? '子域名，适合按品牌或用途分流。' : '根域名，适合作为主入口开放。') + '</div></div><button onclick="tDom(\\'del\\',' + d.id + ')" class="btn-secondary text-xs px-3 py-1.5 text-danger">移除</button></div>';
            }).join('') : '<div class="empty-state"><div class="empty-state-title mb-2">还没有开放邮箱域名</div><div class="empty-state-copy">授权根域名或新增子域名后，它们会显示在这里，用户也就可以开始创建邮箱别名。</div></div>';
        }
        async function tDom(act, ref){
            if(act==='del' && !confirm('高危操作：此操作将强制删除 Cloudflare 上该域名所属的所有用户路由，确定继续吗？')) return;
            if (act === 'del') await fetch(basePath+'/domains/'+ref,{method:'DELETE'});
            else {
                const z = cfZones[ref];
                const r = await fetch(basePath+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:z.name,zone_id:z.id,zone_name:z.name})});
                const d = await r.json().catch(function(){ return {}; });
                if(!r.ok) showT(d.error || '\u57df\u540d\u5f00\u653e\u5931\u8d25', true);
            }
            syncDomains();
        }
        async function addSubdomain(e){
            e.preventDefault();
            const z = cfZones[document.getElementById('sub-zone').value];
            if(!z) return showT('\u8bf7\u5148\u9009\u62e9\u6839\u57df\u540d', true);
            let sub = document.getElementById('sub-name').value.trim().toLowerCase();
            if(!sub) return showT('请输入子域名前缀', true);
            sub = sub.replace(/^@\\./,'').replace(/\\.$/,'');
            if(sub === z.name) return showT('\u6839\u57df\u540d\u8bf7\u4f7f\u7528\u4e0a\u65b9\u6388\u6743\u5f00\u653e\uff0c\u4e0d\u8981\u4f5c\u4e3a\u5b50\u57df\u540d\u6dfb\u52a0', true);
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
                return '<div class="gmail-admin-card gmail-admin-card-compact gmail-admin-card-split">' +
                    '<div class="gmail-admin-card-main">' +
                        '<div class="gmail-admin-row-title mono-accent">' + code + '</div>' +
                        '<div class="gmail-admin-meta-line">创建时间：' + escapeHTML(new Date(i.created_at).toLocaleString()) + '</div>' +
                        '<div class="gmail-admin-meta-line">你可以直接调整总次数和已使用次数，保存后会马上影响注册放行规则。</div>' +
                    '</div>' +
                    '<div class="gmail-admin-card-side">' +
                        '<div class="gmail-admin-metrics"><span class="gmail-admin-metric">最大 ' + i.max_uses + '</span><span class="gmail-admin-metric">已用 ' + (i.used_count || 0) + '</span><span class="gmail-admin-metric">剩余 ' + left + '</span></div>' +
                        '<div class="grid grid-cols-2 gap-2"><input id="inv-max-' + code + '" type="number" min="1" value="' + i.max_uses + '" class="field px-2 py-1 text-sm" placeholder="最大次数"><input id="inv-used-' + code + '" type="number" min="0" value="' + (i.used_count || 0) + '" class="field px-2 py-1 text-sm" placeholder="已使用"></div>' +
                    '</div>' +
                    '<div class="gmail-admin-card-actions"><button onclick="saveInvite(\'' + code + '\')" class="btn-primary text-xs px-3 py-1.5">保存</button><button onclick="deleteInvite(\'' + code + '\')" class="btn-secondary text-xs px-3 py-1.5 text-danger">删除</button></div>' +
                '</div>';
            }).join('') || '<div class="gmail-admin-card gmail-admin-card-compact gmail-admin-card-split justify-center"><div class="empty-state w-full"><div class="empty-state-title mb-2">还没有邀请码</div><div class="empty-state-copy">生成邀请码后会显示在这里，你可以随时调整次数、回收或重新分配。</div></div></div>';
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
                        var statusText = verified ? '\u5df2\u9a8c\u8bc1' : '\u5f85\u9a8c\u8bc1';
                        var statusClass = verified
                            ? 'badge-status badge-success'
                            : 'badge-status badge-info';
                        return '<div class="flex items-center gap-2"><span class="mono-accent">' + escapeHTML(dest.email || '') + '</span><span class="' + statusClass + '">' + statusText + '</span></div>';
                    }).join('')
                    : '<span class="text-soft italic">\u6682\u65e0\u90ae\u7bb1</span>';
                return '<div class="gmail-admin-card gmail-admin-card-compact gmail-admin-card-split">' +
                    '<div class="gmail-admin-card-main">' +
                        '<div class="gmail-admin-row-title">' + escapeHTML(u.username) + ' <span class="text-soft font-normal">#' + u.id + '</span></div>' +
                        '<div class="gmail-admin-meta-line">注册时间：' + new Date(u.created_at).toLocaleString() + '</div>' +
                        '<div class="gmail-admin-meta-line">注册 IP：<span class="font-mono">' + escapeHTML(u.reg_ip) + '</span></div>' +
                        '<div class="gmail-admin-meta-line">这里会集中显示这个用户的收件目标、路由数量和当前账户状态。</div>' +
                    '</div>' +
                    '<div class="gmail-admin-card-side">' +
                        '<div class="gmail-admin-metrics"><span class="gmail-admin-metric">' + u.route_count + ' 条路由</span><span class="gmail-admin-metric">' + destinations.length + ' 个邮箱</span></div>' +
                        '<div><div class="gmail-mini-label">转发邮箱</div><div class="space-y-1 mt-2">' + destinationHTML + '</div></div>' +
                    '</div>' +
                    '<div class="gmail-admin-card-actions"><button onclick="deleteUser(' + u.id + ')" class="btn-secondary text-xs px-3 py-1.5 text-danger">删除</button></div>' +
                '</div>';
            }).join('') || '<div class="gmail-admin-card gmail-admin-card-compact gmail-admin-card-split justify-center"><div class="empty-state w-full"><div class="empty-state-title mb-2">没有找到用户</div><div class="empty-state-copy">换个关键词试试，或者清空搜索后重新查看全部用户列表。</div></div></div>';
            document.getElementById('page-info').innerText = '\u7b2c ' + page + ' \u9875';
        }
        async function deleteUser(id){
            if(!confirm('确定清除这个用户吗？该用户的转发邮箱、邮箱别名和会话都会被删除。')) return;
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
// 3. 鍚庣 API 閫昏緫
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

    if (!isTrustedOrigin(req, url)) return jsonRes({error:"\u8de8\u7ad9\u8bf7\u6c42\u5df2\u88ab\u62d2\u7edd"}, 403);
    if (!env.DB) return jsonRes({error:"\u8bf7\u5728 Settings -> Bindings \u4e2d\u7ed1\u5b9a DB \u6570\u636e\u5e93"}, 500);
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
        if(!env.TURNSTILE_SECRET) return {ok:false, error:"Turnstile Secret \u672a\u914d\u7f6e"};
        if(!t) return {ok:false, error:"\u8bf7\u5b8c\u6210\u4eba\u673a\u9a8c\u8bc1"};
        const body = new URLSearchParams();
        body.set('secret', env.TURNSTILE_SECRET);
        body.set('response', t);
        if(ip && ip !== '0' && ip !== '0.0.0.0') body.set('remoteip', ip);
        try {
          const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method:'POST', body});
          const data = await res.json();
          if(data.success) return {ok:true};
          const codes = data['error-codes'] || [];
          if(codes.includes('timeout-or-duplicate')) return {ok:false, error:"\u4eba\u673a\u9a8c\u8bc1\u5df2\u8fc7\u671f\u6216\u5df2\u88ab\u4f7f\u7528\uff0c\u8bf7\u91cd\u65b0\u52fe\u9009\u9a8c\u8bc1"};
          if(codes.includes('invalid-input-secret')) return {ok:false, error:"Turnstile Secret 配置错误"};
          if(codes.includes('invalid-input-response') || codes.includes('missing-input-response')) return {ok:false, error:"\u4eba\u673a\u9a8c\u8bc1\u65e0\u6548\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5"};
          return {ok:false, error:"人机验证失败，请重试"};
        } catch (_) {
          return {ok:false, error:"\u4eba\u673a\u9a8c\u8bc1\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"};
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
          const adminPassword = String(password || '');
          const adminMatched = adminName===String(env.ADMIN_USERNAME || '') && adminPassword===String(env.ADMIN_PASSWORD || '');
          if (!adminMatched && await isAuthRateLimited(db, 'admin_login', ip, adminName)) {
            return jsonRes({error:"请求过于频繁，请稍后再试"},429);
          }
          const turnstile = await verifyTurnstile(turnstileToken, ip);
          if (!turnstile.ok) {
            await recordAuthFailure(db, 'admin_login', ip, adminName);
            return jsonRes({error:turnstile.error},400);
          }
          if (adminMatched) {
            await clearAuthFailures(db, 'admin_login', ip, adminName);
            const t = genT(); await db.prepare("INSERT INTO sessions(token,role,expires_at) VALUES(?,'admin',datetime('now','+1 day'))").bind(t).run();
            return jsonRes({success:true}, 200, {'Set-Cookie':buildCookie('admin_token', t, adminPath, 86400)});
          }
          await recordAuthFailure(db, 'admin_login', ip, adminName);
          return jsonRes({error:"账号或密码不正确"}, 401);
        }
        if (act === '/logout' && method === 'POST') return jsonRes({success:true}, 200, {'Set-Cookie':buildCookie('admin_token', '', adminPath, 0)});

        const aT = getC('admin_token'); if(!aT) return jsonRes({error:"无权访问"}, 403);
        if(!(await db.prepare("SELECT 1 FROM sessions WHERE token=? AND role='admin' AND expires_at>datetime('now')").bind(aT).first())) return jsonRes({error:"\u767b\u5f55\u72b6\u6001\u5931\u6548"}, 403);

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
          if (!DEFAULT_CONFIGS.some(([k]) => k === cleanKey)) return jsonRes({error:"\u672a\u77e5\u914d\u7f6e\u9879"}, 400);
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
          return jsonRes({success:true, message:"\u8fc7\u671f\u6570\u636e\u5df2\u6e05\u7406"});
        }

        // --- 鎷夊彇鎵€鏈夊煙鍚?---
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
          if(!cleanZoneId || cleanZoneId.length > 128) return jsonRes({error:"缂哄皯 Zone ID"},400);
          if(!isValidDomainName(cleanDomain)) return jsonRes({error:"\u57df\u540d\u683c\u5f0f\u4e0d\u6b63\u786e"},400);
          if(!isValidDomainName(cleanZoneName) || !domainBelongsToZone(cleanDomain, cleanZoneName)) return jsonRes({error:"子域名必须属于所选根域名"},400);
          if(await db.prepare("SELECT id FROM domains WHERE domain=?").bind(cleanDomain).first()) return jsonRes({error:"\u8fd9\u4e2a\u90ae\u7bb1\u57df\u540d\u5df2\u7ecf\u5f00\u653e"},400);

          if(cleanDomain !== cleanZoneName) {
            const cf = await cfEnableEmailRoutingDomain(cleanZoneId, cleanDomain, env);
            const details = JSON.stringify(cf.data?.errors || cf.data?.messages || cf.data || {});
            if(!cf.ok && !/already|exist|enabled|configured/i.test(details)) {
              return jsonRes({error:"Cloudflare 未能启用该子域名的 Email Routing DNS，请确认 API Token 具备 Zone Settings Write 权限", details: cf.data?.errors || cf.data},500);
            }
          }

          await db.prepare("INSERT INTO domains(domain,zone_id) VALUES(?,?)").bind(cleanDomain, cleanZoneId).run();
          return jsonRes({success:true});
        }
        if (act.startsWith('/domains/') && method === 'DELETE') {
          const id = parseInt(act.split('/')[2], 10);
          if(!Number.isFinite(id) || id < 1) return jsonRes({error:"\u57df\u540d ID \u4e0d\u6b63\u786e"},400);
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
          if(!decoded.ok || !/^[A-Za-z0-9_-]{3,64}$/.test(decoded.value)) return jsonRes({error:"\u9080\u8bf7\u7801\u4e0d\u6b63\u786e"},400);
          const code = decoded.value;
          const body = await readBody(); if (!body.ok) return body.response;
          const {max_uses, used_count} = body.data;
          const maxUses = parseInt(max_uses, 10);
          const usedCount = parseInt(used_count, 10);
          if(!Number.isFinite(maxUses) || maxUses < 1 || maxUses > MAX_INVITATION_USES) return jsonRes({error:`最大使用次数必须在 1 到 ${MAX_INVITATION_USES} 之间`}, 400);
          if(!Number.isFinite(usedCount) || usedCount < 0 || usedCount > maxUses) return jsonRes({error:"\u5df2\u4f7f\u7528\u6b21\u6570\u5fc5\u987b\u5728 0 \u5230\u6700\u5927\u6b21\u6570\u4e4b\u95f4"}, 400);
          await db.prepare("UPDATE invitation_codes SET max_uses=?, used_count=? WHERE code=?").bind(maxUses, usedCount, code).run();
          return jsonRes({success:true});
        }
        if (act.startsWith('/invitations/') && method === 'DELETE') {
          const decoded = safeDecodeURIComponent(act.split('/')[2] || '');
          if(!decoded.ok || !/^[A-Za-z0-9_-]{3,64}$/.test(decoded.value)) return jsonRes({error:"\u9080\u8bf7\u7801\u4e0d\u6b63\u786e"},400);
          const code = decoded.value;
          await db.prepare("DELETE FROM invitation_codes WHERE code=?").bind(code).run();
          return jsonRes({success:true});
        }

        if (act.startsWith('/users/') && method === 'DELETE') {
          const userId = parseInt(act.split('/')[2], 10);
          if(!Number.isFinite(userId)) return jsonRes({error:"\u7528\u6237 ID \u4e0d\u6b63\u786e"},400);
          const user = await db.prepare("SELECT id FROM users WHERE id=?").bind(userId).first();
          if(!user) return jsonRes({error:"\u7528\u6237\u4e0d\u5b58\u5728"},404);
          await deleteUserAccount(db, env, userId);
          return jsonRes({success:true, message:"\u7528\u6237\u5df2\u6e05\u9664"});
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
        return jsonRes({error:"\u8bf7\u6c42\u4e0d\u5b58\u5728"}, 404);
      }

      // --- 鐢ㄦ埛鍏叡 API ---
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

        if (cfg.allow_registration !== 'true') return await rejectRegister({error:"\u62b1\u6b49\uff0c\u7cfb\u7edf\u5f53\u524d\u5df2\u5173\u95ed\u65b0\u7528\u6237\u6ce8\u518c"},403);
        const allowedCountryConfig = String(cfg.allowed_countries || 'ALL').trim().toUpperCase();
        const allowedCountries = allowedCountryConfig.split(',').map((i) => i.trim());
        if (allowedCountryConfig!=='ALL' && !allowedCountries.includes(req.cf?.country||'XX')) return await rejectRegister({error:"\u5730\u533a\u62e6\u622a\uff1a\u60a8\u6240\u5728\u7684\u5730\u533a\u6682\u65f6\u4e0d\u5141\u8bb8\u6ce8\u518c"},403);
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
          return await rejectRegister({error:`风控拦截：每个 IP 每 24 小时仅允许注册 ${ipLim} 个账户`},429);
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
      const uS = await db.prepare("SELECT user_id FROM sessions WHERE token=? AND role='user' AND expires_at>datetime('now')").bind(uT).first(); if(!uS) return jsonRes({error:"\u4f1a\u8bdd\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55"},401);

      if (path === '/api/check-session') return jsonRes({success:true});
      if (path === '/api/me') return jsonRes(await getUserState(db, env, uS.user_id, cfg));
      if (path === '/api/domains') return jsonRes((await db.prepare("SELECT id,domain FROM domains ORDER BY domain ASC").all()).results);

      if (path === '/api/password' && method === 'POST') {
        const body = await readBody(); if (!body.ok) return body.response;
        const {oldPassword, newPassword} = body.data;
        const nextPassword = validatePassword(newPassword, '\u65b0\u5bc6\u7801');
        if (!nextPassword.ok) return jsonRes({error:nextPassword.error},400);
        if (String(oldPassword == null ? '' : oldPassword).length > MAX_PASSWORD_LENGTH) return jsonRes({error:"\u5f53\u524d\u5bc6\u7801\u4e0d\u6b63\u786e"},403);
        const user = await db.prepare("SELECT password FROM users WHERE id=?").bind(uS.user_id).first();
        if(!user || !(await verifyPassword(oldPassword, user.password))) return jsonRes({error:"\u5f53\u524d\u5bc6\u7801\u4e0d\u6b63\u786e"},403);
        const hashedPassword = await hashPassword(nextPassword.value);
        await db.prepare("UPDATE users SET password=? WHERE id=?").bind(hashedPassword, uS.user_id).run();
        await db.prepare("DELETE FROM sessions WHERE user_id=? AND token!=?").bind(uS.user_id, uT).run();
        return jsonRes({message:"\u5bc6\u7801\u5df2\u4fee\u6539"});
      }

      if (path === '/api/account' && method === 'DELETE') {
        const body = await readBody(); if (!body.ok) return body.response;
        const {password} = body.data;
        if (String(password == null ? '' : password).length > MAX_PASSWORD_LENGTH) return jsonRes({error:"\u5f53\u524d\u5bc6\u7801\u4e0d\u6b63\u786e"},403);
        const user = await db.prepare("SELECT password FROM users WHERE id=?").bind(uS.user_id).first();
        if(!user || !(await verifyPassword(password, user.password))) return jsonRes({error:"\u5f53\u524d\u5bc6\u7801\u4e0d\u6b63\u786e"},403);
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
        if(!Number.isFinite(mailId) || mailId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) return jsonRes({error:"\u9644\u4ef6 ID \u4e0d\u6b63\u786e"},400);
        const attachment = await db.prepare(`
          SELECT a.id,a.filename,a.content_type,a.size_bytes,a.r2_key
          FROM inbound_attachments a
          JOIN inbound_emails m ON m.id=a.mail_id AND m.user_id=a.user_id
          WHERE a.id=? AND a.mail_id=? AND a.user_id=?
        `).bind(attachmentId, mailId, uS.user_id).first();
        if(!attachment) return jsonRes({error:"附件不存在或不属于您"},404);
        if(!env.INBOUND_ATTACHMENTS) return jsonRes({error:"\u9644\u4ef6\u5b58\u50a8\u672a\u7ed1\u5b9a"},404);
        const object = await env.INBOUND_ATTACHMENTS.get(attachment.r2_key);
        if(!object) return jsonRes({error:"\u9644\u4ef6\u6587\u4ef6\u4e0d\u5b58\u5728"},404);
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
        if(!Number.isFinite(mailId) || mailId < 1) return jsonRes({error:"\u90ae\u4ef6 ID \u4e0d\u6b63\u786e"},400);
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
        if(!Number.isFinite(mailId) || mailId < 1) return jsonRes({error:"\u90ae\u4ef6 ID \u4e0d\u6b63\u786e"},400);
        await db.prepare("UPDATE inbound_emails SET read_at=datetime('now') WHERE id=? AND user_id=?").bind(mailId, uS.user_id).run();
        return jsonRes({success:true});
      }

      if (path.startsWith('/api/inbox/') && method === 'DELETE') {
        const mailId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(mailId) || mailId < 1) return jsonRes({error:"\u90ae\u4ef6 ID \u4e0d\u6b63\u786e"},400);
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
        if(userDestCount >= userDestinationLimit) return jsonRes({error:`您的转发邮箱配额已达上限（最多 ${userDestinationLimit} 个）`},403);
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
        if(!cf.ok || !d.result?.id) return jsonRes({error:"Cloudflare 限制了当前请求，或邮箱地址格式不符合要求", details:d.errors || d},500);

        await db.prepare("INSERT INTO user_destinations(user_id,cf_address_id,email,status,expires_at,duration_hours,inbox_default,created_at) VALUES(?,?,?,'pending',NULL,?,?,datetime('now'))")
          .bind(uS.user_id,d.result.id,cleanEmail,chosenDuration,defaultInbox).run();
        return jsonRes({message:"验证邮件已发送，请前往转发邮箱确认。"});
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
        if(!latestPending) return jsonRes({error:"\u5f53\u524d\u6ca1\u6709\u7b49\u5f85\u9a8c\u8bc1\u7684\u90ae\u7bb1\uff0c\u8bf7\u91cd\u65b0\u53d1\u9001\u9a8c\u8bc1\u90ae\u4ef6"},400);
        const cfAddress = (await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${latestPending.cf_address_id}`, {label: 'refresh_latest_email_address'})).data;
        if(!cfAddress.result?.verified) return jsonRes({error:"还没有检测到验证完成，请确认邮箱里的验证链接已经点击"},400);
        const chosenDuration = isValidDuration(latestPending.duration_hours) ? latestPending.duration_hours : (cfg.max_destination_duration_hours || '168');
        const expiresAt = expiryFromDuration(chosenDuration);
        await db.prepare("UPDATE user_destinations SET status='verified', expires_at=? WHERE id=?").bind(expiresAt, latestPending.id).run();
        return jsonRes({message:"\u90ae\u7bb1\u9a8c\u8bc1\u5df2\u5237\u65b0\u6210\u529f\uff0c\u73b0\u5728\u53ef\u4ee5\u521b\u5efa\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u3002"});
      }

      if (path.startsWith('/api/destinations/') && path.endsWith('/refresh') && method === 'POST') {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const destinationId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({error:"\u90ae\u7bb1 ID \u4e0d\u6b63\u786e"},400);
        const dest = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, uS.user_id).first();
        if(!dest) return jsonRes({error:"\u76ee\u6807\u90ae\u7bb1\u4e0d\u5b58\u5728\u6216\u5df2\u8fc7\u671f"},404);
        if(dest.status === 'verified') return jsonRes({message:"邮箱已经完成验证"});
        if(dest.status !== 'pending') return jsonRes({error:"\u5f53\u524d\u90ae\u7bb1\u72b6\u6001\u65e0\u6cd5\u5237\u65b0\u9a8c\u8bc1"},400);

        const cfAddress = (await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${dest.cf_address_id}`, {label: 'refresh_email_address'})).data;
        if(!cfAddress.result?.verified) return jsonRes({error:"还没有检测到验证完成，请确认邮箱里的验证链接已经点击"},400);

        const chosenDuration = isValidDuration(dest.duration_hours) ? dest.duration_hours : (cfg.max_destination_duration_hours || '168');
        const expiresAt = expiryFromDuration(chosenDuration);
        await db.prepare("UPDATE user_destinations SET status='verified', expires_at=? WHERE id=?").bind(expiresAt, dest.id).run();
        return jsonRes({message:"\u90ae\u7bb1\u9a8c\u8bc1\u5df2\u5237\u65b0\u6210\u529f\uff0c\u73b0\u5728\u53ef\u4ee5\u521b\u5efa\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u3002"});
      }

      if (path.startsWith('/api/destinations/') && path.endsWith('/inbox-default') && method === 'PUT') {
        const destinationId = parseInt(path.split('/')[3], 10);
        const body = await readBody(); if (!body.ok) return body.response;
        if(!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({error:"\u90ae\u7bb1 ID \u4e0d\u6b63\u786e"},400);
        const enabled = body.data.enabled !== false;
        const dest = await db.prepare("SELECT id FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, uS.user_id).first();
        if(!dest) return jsonRes({error:"\u76ee\u6807\u90ae\u7bb1\u4e0d\u5b58\u5728\u6216\u5df2\u8fc7\u671f"},404);
        await db.prepare("UPDATE user_destinations SET inbox_default=? WHERE id=?").bind(boolText(enabled), destinationId).run();
        return jsonRes({success:true, message: enabled ? "默认站内同步已开启" : "默认站内同步已关闭"});
      }

      if (path === '/api/destination' && method === 'DELETE') return jsonRes({error:"\u8bf7\u4f7f\u7528 /api/destinations/:id \u5220\u9664\u6307\u5b9a\u5e95\u5c42\u6536\u4ef6\u7bb1"},400);
      if (path.startsWith('/api/destinations/') && method === 'DELETE') {
        const destinationId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({error:"\u90ae\u7bb1 ID \u4e0d\u6b63\u786e"},400);
        const removed = await deleteUserDestination(db, env, uS.user_id, destinationId);
        if (removed === true) return jsonRes({message:"转发邮箱已删除"});
        if (!removed || removed.reason === 'not_found') return jsonRes({error:"\u76ee\u6807\u90ae\u7bb1\u4e0d\u5b58\u5728\u6216\u5df2\u8fc7\u671f"},404);
        if (removed.reason === 'in_use') return jsonRes({error:`该邮箱仍被 ${removed.routeCount || 0} 条专属路由使用，请先迁移路由目标后再删除`},400);
        return jsonRes({error:"删除失败"},400);
      }

      if (path.startsWith('/api/routes/') && method === 'DELETE') {
        const routeId = parseInt(path.split('/')[3], 10);
        if(!Number.isFinite(routeId) || routeId < 1) return jsonRes({error:"\u8def\u7531 ID \u4e0d\u6b63\u786e"},400);
        const removed = await deleteRouteById(db, env, routeId, uS.user_id);
        if(!removed) return jsonRes({error:"这个专属域名邮箱不存在或不属于您"},404);
        return jsonRes({message:"\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u5df2\u5220\u9664"});
      }

      if (path.startsWith('/api/routes/') && path.endsWith('/inbox') && method === 'PUT') {
        const routeId = parseInt(path.split('/')[3], 10);
        const body = await readBody(); if (!body.ok) return body.response;
        if(!Number.isFinite(routeId) || routeId < 1) return jsonRes({error:"\u8def\u7531 ID \u4e0d\u6b63\u786e"},400);
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
        if(!route.destination_email) return jsonRes({error:"\u8bf7\u5148\u8bbe\u7f6e\u53ef\u7528\u7684\u8f6c\u53d1\u76ee\u6807\u90ae\u7bb1"},400);
        if(route.destination_status !== 'verified' || (route.destination_expires_at && dbDateMs(route.destination_expires_at) <= Date.now())) return jsonRes({error:"\u8f6c\u53d1\u76ee\u6807\u90ae\u7bb1\u672a\u9a8c\u8bc1\u6216\u5df2\u8fc7\u671f"},400);
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
        if(!Number.isFinite(routeId) || routeId < 1) return jsonRes({error:"\u8def\u7531 ID \u4e0d\u6b63\u786e"},400);
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
            if(!Number.isFinite(parsedDestinationId) || parsedDestinationId < 1) return jsonRes({error:"\u76ee\u6807\u90ae\u7bb1 ID \u4e0d\u6b63\u786e"},400);
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
          if(targetDestination.expires_at && dbDateMs(targetDestination.expires_at) <= Date.now()) return jsonRes({error:"\u76ee\u6807\u90ae\u7bb1\u5df2\u8fc7\u671f"},400);
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
        if(!/^[a-z0-9._+-]{1,64}$/.test(cleanPrefix)) return jsonRes({error:"\u90ae\u7bb1\u524d\u7f00\u53ea\u80fd\u4f7f\u7528\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u70b9\u3001\u4e0b\u5212\u7ebf\u3001\u52a0\u53f7\u6216\u77ed\u6a2a\u7ebf"},400);
        if(!isValidDuration(chosenDuration)) return jsonRes({error:"\u8bf7\u9009\u62e9\u4e13\u5c5e\u57df\u540d\u90ae\u7bb1\u6709\u6548\u671f"},400);
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
          if(d.status === 'pending') return jsonRes({error:"\u8bf7\u5148\u70b9\u51fb\u201c\u5237\u65b0\u9a8c\u8bc1\u201d\uff0c\u786e\u8ba4\u5e95\u5c42\u6536\u4ef6\u7bb1\u5df2\u7ecf\u5b8c\u6210\u9a8c\u8bc1"},400);
          if(d.status !== 'verified') return jsonRes({error:"真实收件箱状态不可用，请重新绑定"},400);
          if(d.expires_at && dbDateMs(d.expires_at) <= Date.now()) return jsonRes({error:"\u76ee\u6807\u90ae\u7bb1\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u7ed1\u5b9a"},400);
          if(d.duration_hours && durationRank(chosenDuration) > durationRank(d.duration_hours)) return jsonRes({error:"专属域名邮箱有效期不能超过绑定邮箱有效期"},400);
          if(chosenDuration === 'permanent' && d.expires_at) return jsonRes({error:"绑定邮箱不是永久有效，专属域名邮箱不能选择永久"},400);
          routeExpiry = minExpiry(routeExpiry, d.expires_at);
          targetDestinationId = pickedDestinationId;
        }

        let cfgMaxR = parseInt(cfg.max_routes_per_user || '10', 10);
        if(!Number.isFinite(cfgMaxR) || cfgMaxR < 0) cfgMaxR = 10;
        if((await db.prepare("SELECT COUNT(*) as c FROM email_routes WHERE user_id=? AND status='active' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(uS.user_id).first()).c >= cfgMaxR) return jsonRes({error:"您的专属域名邮箱配额已耗尽"},403);

        const dom = await db.prepare("SELECT * FROM domains WHERE id=?").bind(pickedDomainId).first(); if(!dom) return jsonRes({error:"\u60a8\u9009\u62e9\u7684\u57df\u540d\u4e0d\u5b58\u5728\u6216\u5df2\u88ab\u4e0b\u67b6"},400);
        if(await db.prepare("SELECT id FROM email_routes WHERE domain_id=? AND tag=? AND status='active'").bind(dom.id, cleanPrefix).first()) return jsonRes({error:"\u8be5\u524d\u7f00\u5df2\u88ab\u5360\u7528\uff0c\u8bf7\u6362\u4e00\u4e2a\u91cd\u8bd5"},400);

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
          if (isUniqueConstraintError(e)) return jsonRes({error:"\u8be5\u524d\u7f00\u5df2\u88ab\u5360\u7528\uff0c\u8bf7\u6362\u4e00\u4e2a\u91cd\u8bd5"},400);
          console.error('[route_create_d1_error]', e?.stack || e?.message || e);
          return jsonRes({error:"专属域名邮箱创建失败，请稍后重试"},500);
        }
        return jsonRes({success:true, message:"邮箱别名创建成功"});
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

