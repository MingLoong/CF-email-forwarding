var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var DURATION_OPTIONS = [
  { value: "1", label: "1 \u5C0F\u65F6" },
  { value: "8", label: "8 \u5C0F\u65F6" },
  { value: "24", label: "24 \u5C0F\u65F6" },
  { value: "48", label: "48 \u5C0F\u65F6" },
  { value: "72", label: "72 \u5C0F\u65F6" },
  { value: "168", label: "168 \u5C0F\u65F6" },
  { value: "permanent", label: "\u6C38\u4E45" }
];
var DURATION_VALUES = new Set(DURATION_OPTIONS.map((i) => i.value));
var BOOLEAN_CONFIG_KEYS = /* @__PURE__ */ new Set(["allow_registration", "enable_invitation_code"]);
var DURATION_CONFIG_KEYS = /* @__PURE__ */ new Set(["max_destination_duration_hours", "max_route_duration_hours"]);
var MAX_ROUTE_REMARK_LENGTH = 100;
var MIN_PASSWORD_LENGTH = 6;
var MAX_PASSWORD_LENGTH = 128;
var USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_INVITATION_USES = 1e5;
var MAX_SEARCH_LENGTH = 64;
var MAX_INBOX_SEARCH_LENGTH = 96;
var DEFAULT_MAX_INBOUND_BODY_BYTES = 262144;
var DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES = 10485760;
var DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES = 26214400;
var DEFAULT_MAX_INBOUND_ATTACHMENTS = 20;
var DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES = 1073741824;
var MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY = "max_inbound_total_attachment_bytes";
var MAX_INBOUND_ATTACHMENTS_CONFIG_KEY = "max_inbound_attachments_per_email";
var MAX_INBOUND_R2_STORAGE_CONFIG_KEY = "max_inbound_r2_storage_bytes";
var MUTATING_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "DELETE", "PATCH"]);
var DELIVERY_MODES = /* @__PURE__ */ new Set(["inbox_only", "inbox_forward", "forward_only"]);
var AUTH_RATE_LIMITS = {
  admin_login: { max: 5, windowMinutes: 15 },
  user_login: { max: 5, windowMinutes: 15 },
  register: { max: 5, windowMinutes: 60 }
};
var INTEGER_CONFIG_LIMITS = {
  max_users: { min: 0, max: 1e5 },
  max_routes_per_user: { min: 0, max: 1e3 },
  max_total_destinations: { min: 0, max: 1e5 },
  max_destinations_per_user: { min: 1, max: 1e3 },
  max_regs_per_ip_24h: { min: 1, max: 1e3 },
  unverified_user_expiry_hours: { min: 1, max: 8760 },
  pending_dest_expiry_hours: { min: 1, max: 8760 },
  inbound_mail_retention_days: { min: 1, max: 3650 },
  max_inbound_body_bytes: { min: 4096, max: 1048576 },
  max_inbound_attachment_bytes: { min: 1024, max: 104857600 },
  [MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY]: { min: 1024, max: 209715200 },
  [MAX_INBOUND_R2_STORAGE_CONFIG_KEY]: { min: 0, max: 1099511627776 },
  [MAX_INBOUND_ATTACHMENTS_CONFIG_KEY]: { min: 0, max: 200 }
};
var SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "frame-src https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ")
};
var DEFAULT_CONFIGS = [
  ["max_users", "1000"],
  ["max_routes_per_user", "10"],
  ["max_total_destinations", "180"],
  ["max_destinations_per_user", "3"],
  ["max_regs_per_ip_24h", "1"],
  ["unverified_user_expiry_hours", "24"],
  ["pending_dest_expiry_hours", "24"],
  ["allowed_countries", "ALL"],
  ["allow_registration", "true"],
  ["enable_invitation_code", "false"],
  ["max_destination_duration_hours", "168"],
  ["max_route_duration_hours", "72"],
  ["inbound_mail_retention_days", "30"],
  ["max_inbound_body_bytes", String(DEFAULT_MAX_INBOUND_BODY_BYTES)],
  ["max_inbound_attachment_bytes", String(DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES)],
  [MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY, String(DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES)],
  [MAX_INBOUND_R2_STORAGE_CONFIG_KEY, String(DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES)],
  [MAX_INBOUND_ATTACHMENTS_CONFIG_KEY, String(DEFAULT_MAX_INBOUND_ATTACHMENTS)]
];
var schemaReady = false;
var durationRank = /* @__PURE__ */ __name((value) => value === "permanent" ? Number.POSITIVE_INFINITY : parseInt(value, 10), "durationRank");
var isValidDuration = /* @__PURE__ */ __name((value) => DURATION_VALUES.has(String(value)), "isValidDuration");
var isWithinMaxDuration = /* @__PURE__ */ __name((value, maxValue) => durationRank(String(value)) <= durationRank(String(maxValue || "permanent")), "isWithinMaxDuration");
var sqlDateFromMs = /* @__PURE__ */ __name((ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " "), "sqlDateFromMs");
var expiryFromDuration = /* @__PURE__ */ __name((durationHours) => durationHours === "permanent" ? null : sqlDateFromMs(Date.now() + parseInt(durationHours, 10) * 36e5), "expiryFromDuration");
var dbDateMs = /* @__PURE__ */ __name((value) => {
  if (!value) return null;
  const raw = String(value);
  return Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
}, "dbDateMs");
var minExpiry = /* @__PURE__ */ __name((a, b) => {
  if (!a) return b || null;
  if (!b) return a || null;
  return dbDateMs(a) <= dbDateMs(b) ? a : b;
}, "minExpiry");
var normalizeRouteRemark = /* @__PURE__ */ __name((value) => String(value == null ? "" : value).trim(), "normalizeRouteRemark");
var normalizeDeliveryMode = /* @__PURE__ */ __name((value) => {
  const mode = String(value || "").trim();
  return DELIVERY_MODES.has(mode) ? mode : "";
}, "normalizeDeliveryMode");
var deliveryModeNeedsDestination = /* @__PURE__ */ __name((mode) => mode === "inbox_forward" || mode === "forward_only", "deliveryModeNeedsDestination");
var routeDeliveryMode = /* @__PURE__ */ __name((route) => {
  if (isTruthyFlag(route?.inbox_enabled)) return route?.destination_id == null ? "inbox_only" : "inbox_forward";
  return "forward_only";
}, "routeDeliveryMode");
var buildHeaders = /* @__PURE__ */ __name((headers = {}) => {
  const out = new Headers(SECURITY_HEADERS);
  for (const [key, value] of Object.entries(headers || {})) {
    if (value != null) out.set(key, value);
  }
  return out;
}, "buildHeaders");
var jsonResponse = /* @__PURE__ */ __name((data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: buildHeaders({ "Content-Type": "application/json;charset=utf-8", ...headers }) }), "jsonResponse");
var htmlResponse = /* @__PURE__ */ __name((html, headers = {}) => new Response(html, { headers: buildHeaders({ "Content-Type": "text/html;charset=utf-8", ...headers }) }), "htmlResponse");
var emptyResponse = /* @__PURE__ */ __name((status = 204, headers = {}) => new Response(null, { status, headers: buildHeaders(headers) }), "emptyResponse");
var isTrustedOrigin = /* @__PURE__ */ __name((req, url) => {
  if (!MUTATING_METHODS.has(req.method)) return true;
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch (_) {
    return false;
  }
}, "isTrustedOrigin");
var readJsonBody = /* @__PURE__ */ __name(async (req) => {
  try {
    const contentType = String(req.headers.get("Content-Type") || "").toLowerCase();
    if (!contentType.includes("application/json")) return { ok: true, data: {} };
    const data = await req.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "JSON \u8BF7\u6C42\u4F53\u5FC5\u987B\u662F\u5BF9\u8C61" };
    return { ok: true, data };
  } catch (_) {
    return { ok: false, error: "JSON \u8BF7\u6C42\u4F53\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
}, "readJsonBody");
var getClientIp = /* @__PURE__ */ __name((req) => req.headers.get("CF-Connecting-IP") || "0.0.0.0", "getClientIp");
var normalizeUsername = /* @__PURE__ */ __name((value) => String(value == null ? "" : value).trim(), "normalizeUsername");
var normalizeAuthIdentifier = /* @__PURE__ */ __name((value) => String(value == null ? "" : value).trim().toLowerCase().slice(0, 128) || "-", "normalizeAuthIdentifier");
var normalizeEmail = /* @__PURE__ */ __name((value) => String(value == null ? "" : value).trim(), "normalizeEmail");
var normalizeSearch = /* @__PURE__ */ __name((value) => String(value == null ? "" : value).trim().slice(0, MAX_SEARCH_LENGTH), "normalizeSearch");
var normalizeInboxSearch = /* @__PURE__ */ __name((value) => String(value == null ? "" : value).trim().slice(0, MAX_INBOX_SEARCH_LENGTH), "normalizeInboxSearch");
var isTruthyFlag = /* @__PURE__ */ __name((value) => String(value || "").toLowerCase() === "true", "isTruthyFlag");
var boolText = /* @__PURE__ */ __name((value) => value ? "true" : "false", "boolText");
var normalizeMailAddress = /* @__PURE__ */ __name((value) => {
  const raw = String(value == null ? "" : value).trim();
  const angle = raw.match(/<([^<>]+)>/);
  return String(angle ? angle[1] : raw).trim().toLowerCase();
}, "normalizeMailAddress");
var validateUsername = /* @__PURE__ */ __name((value) => {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) return { ok: false, error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF" };
  return { ok: true, value: username };
}, "validateUsername");
var validatePassword = /* @__PURE__ */ __name((value, label = "\u5BC6\u7801") => {
  const password = String(value == null ? "" : value);
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: `${label}\u81F3\u5C11 ${MIN_PASSWORD_LENGTH} \u4F4D` };
  if (password.length > MAX_PASSWORD_LENGTH) return { ok: false, error: `${label}\u6700\u591A ${MAX_PASSWORD_LENGTH} \u4F4D` };
  return { ok: true, value: password };
}, "validatePassword");
var validateEmail = /* @__PURE__ */ __name((value) => {
  const email = normalizeEmail(value);
  if (!email) return { ok: false, error: "\u8BF7\u8F93\u5165\u90AE\u7BB1\u5730\u5740" };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false, error: "\u90AE\u7BB1\u5730\u5740\u683C\u5F0F\u4E0D\u6B63\u786E" };
  return { ok: true, value: email };
}, "validateEmail");
var safeDecodeURIComponent = /* @__PURE__ */ __name((value) => {
  try {
    return { ok: true, value: decodeURIComponent(value || "") };
  } catch (_) {
    return { ok: false, value: "" };
  }
}, "safeDecodeURIComponent");
var parsePositiveInteger = /* @__PURE__ */ __name((value, fallback = 1, min = 1, max = 1e3) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}, "parsePositiveInteger");
var validateConfigValue = /* @__PURE__ */ __name((key, value) => {
  const raw = String(value == null ? "" : value).trim();
  if (raw.length > 512) return { ok: false, error: "\u914D\u7F6E\u503C\u8FC7\u957F" };
  if (BOOLEAN_CONFIG_KEYS.has(key)) {
    if (!["true", "false"].includes(raw)) return { ok: false, error: "\u8BE5\u914D\u7F6E\u53EA\u80FD\u9009\u62E9 true \u6216 false" };
    return { ok: true, value: raw };
  }
  if (DURATION_CONFIG_KEYS.has(key)) {
    if (!isValidDuration(raw)) return { ok: false, error: "\u6709\u6548\u671F\u53EA\u80FD\u4ECE\u9884\u8BBE\u9009\u9879\u4E2D\u9009\u62E9" };
    return { ok: true, value: raw };
  }
  if (INTEGER_CONFIG_LIMITS[key]) {
    const n = parseInt(raw, 10);
    const limit = INTEGER_CONFIG_LIMITS[key];
    if (!Number.isFinite(n) || String(n) !== raw || n < limit.min || n > limit.max) {
      return { ok: false, error: `\u8BE5\u914D\u7F6E\u5FC5\u987B\u662F ${limit.min} \u5230 ${limit.max} \u4E4B\u95F4\u7684\u6574\u6570` };
    }
    return { ok: true, value: String(n) };
  }
  if (key === "allowed_countries") {
    const normalized = raw.toUpperCase().replace(/\s+/g, "");
    if (normalized !== "ALL" && !/^[A-Z]{2}(,[A-Z]{2})*$/.test(normalized)) return { ok: false, error: "\u56FD\u5BB6\u4EE3\u7801\u683C\u5F0F\u5E94\u4E3A ALL \u6216 US,JP,SG" };
    return { ok: true, value: normalized };
  }
  return { ok: true, value: raw };
}, "validateConfigValue");
var PASSWORD_SCHEME = "pbkdf2_sha256";
var PASSWORD_ITERATIONS = 1e5;
var PASSWORD_SALT_BYTES = 16;
var PASSWORD_KEY_BYTES = 32;
var passwordEncoder = new TextEncoder();
var bytesToBase64 = /* @__PURE__ */ __name((bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}, "bytesToBase64");
var base64ToBytes = /* @__PURE__ */ __name((value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}, "base64ToBytes");
var bytesToUtf8 = /* @__PURE__ */ __name((bytes) => new TextDecoder("utf-8", { fatal: false }).decode(bytes), "bytesToUtf8");
var decodeQuotedPrintable = /* @__PURE__ */ __name((value) => {
  const compact = String(value || "").replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(compact.slice(i + 1, i + 3))) {
      bytes.push(parseInt(compact.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(compact.charCodeAt(i));
    }
  }
  return bytesToUtf8(new Uint8Array(bytes));
}, "decodeQuotedPrintable");
var decodeMimeEncodedWords = /* @__PURE__ */ __name((value) => String(value || "").replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_, charset, encoding, text) => {
  try {
    const normalizedCharset = String(charset || "").toLowerCase();
    if (!/utf-?8|us-ascii/.test(normalizedCharset)) return text;
    if (String(encoding).toUpperCase() === "B") return bytesToUtf8(base64ToBytes(text));
    return decodeQuotedPrintable(String(text).replace(/_/g, " "));
  } catch (_2) {
    return text;
  }
}), "decodeMimeEncodedWords");
var parseMimeHeaders = /* @__PURE__ */ __name((rawHeaders) => {
  const headers = {};
  const unfolded = String(rawHeaders || "").replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
}, "parseMimeHeaders");
var getMimeParam = /* @__PURE__ */ __name((value, name) => {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, "i");
  const m = String(value || "").match(re);
  return m ? m[1] || m[2] || "" : "";
}, "getMimeParam");
var stripContentId = /* @__PURE__ */ __name((value) => String(value || "").trim().replace(/^<|>$/g, "").toLowerCase(), "stripContentId");
var normalizeAttachmentFilename = /* @__PURE__ */ __name((value, fallback = "attachment") => {
  const decoded = decodeMimeEncodedWords(String(value || "")).trim();
  const clean = decoded.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").slice(0, 160).trim();
  return clean || fallback;
}, "normalizeAttachmentFilename");
var decodeQuotedPrintableBytes = /* @__PURE__ */ __name((value) => {
  const compact = String(value || "").replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(compact.slice(i + 1, i + 3))) {
      bytes.push(parseInt(compact.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(compact.charCodeAt(i) & 255);
    }
  }
  return new Uint8Array(bytes);
}, "decodeQuotedPrintableBytes");
var decodeMimePartBody = /* @__PURE__ */ __name((body, encoding) => {
  const transferEncoding = String(encoding || "").toLowerCase();
  try {
    if (transferEncoding === "base64") return bytesToUtf8(base64ToBytes(String(body || "").replace(/\s+/g, "")));
    if (transferEncoding === "quoted-printable") return decodeQuotedPrintable(body);
  } catch (_) {
  }
  return String(body || "");
}, "decodeMimePartBody");
var decodeMimePartBytes = /* @__PURE__ */ __name((body, encoding) => {
  const transferEncoding = String(encoding || "").toLowerCase();
  try {
    if (transferEncoding === "base64") return base64ToBytes(String(body || "").replace(/\s+/g, ""));
    if (transferEncoding === "quoted-printable") return decodeQuotedPrintableBytes(body);
  } catch (_) {
  }
  const raw = String(body || "");
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 255;
  return bytes;
}, "decodeMimePartBytes");
var htmlToPlainText = /* @__PURE__ */ __name((html) => String(html || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#039;/gi, "'"), "htmlToPlainText");
var sanitizeEmailHtml = /* @__PURE__ */ __name((html) => {
  let out = String(html || "");
  out = out.replace(/<!doctype[\s\S]*?>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base|svg|math)[\s\S]*?<\/\s*\1\s*>/gi, "");
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base|svg|math)[^>]*\/?\s*>/gi, "");
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\s+(href|src|background)\s*=\s*(["']?)\s*javascript:[\s\S]*?\2/gi, "");
  out = out.replace(/\s+(href|src|background)\s*=\s*(["']?)\s*data:(?!image\/(?:png|gif|jpe?g|webp|bmp|svg\+xml);)[\s\S]*?\2/gi, "");
  out = out.replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return out.trim();
}, "sanitizeEmailHtml");
var splitMimeSections = /* @__PURE__ */ __name((raw) => {
  const text = String(raw || "");
  const split = text.match(/\r?\n\r?\n/);
  if (!split) return { headerText: "", bodyText: text };
  return {
    headerText: text.slice(0, split.index),
    bodyText: text.slice(split.index + split[0].length)
  };
}, "splitMimeSections");
var splitMimeMultipartBody = /* @__PURE__ */ __name((bodyText, boundary) => {
  if (!boundary) return [];
  const marker = `--${boundary}`;
  return String(bodyText || "").split(marker).slice(1).map((part) => {
    const endIdx = part.indexOf(`${marker}`);
    const raw = endIdx >= 0 ? part.slice(0, endIdx) : part;
    return raw.replace(/^\r?\n/, "").replace(/\r?\n--\s*$/, "").replace(/--\s*$/, "");
  }).filter((part) => part.trim());
}, "splitMimeMultipartBody");
var parseMimeEntity = /* @__PURE__ */ __name((raw, inheritedHeaders = null) => {
  const sections = inheritedHeaders ? { headerText: "", bodyText: String(raw || "") } : splitMimeSections(raw);
  const headers = inheritedHeaders || parseMimeHeaders(sections.headerText);
  const contentType = headers["content-type"] || "text/plain";
  const boundary = getMimeParam(contentType, "boundary");
  const entity = { headers, body: sections.bodyText, children: [] };
  if (boundary && /^multipart\//i.test(contentType)) {
    entity.children = splitMimeMultipartBody(sections.bodyText, boundary).map((part) => parseMimeEntity(part));
  }
  return entity;
}, "parseMimeEntity");
var walkMimeEntities = /* @__PURE__ */ __name((entity, out = []) => {
  if (!entity) return out;
  out.push(entity);
  for (const child of entity.children || []) walkMimeEntities(child, out);
  return out;
}, "walkMimeEntities");
var cleanEmailBody = /* @__PURE__ */ __name((value, maxBytes) => {
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_INBOUND_BODY_BYTES;
  const text = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  return text.length > limit ? `${text.slice(0, limit)}

[Message truncated]` : text;
}, "cleanEmailBody");
var extractEmailContent = /* @__PURE__ */ __name((rawText, maxBytes) => {
  const root = parseMimeEntity(rawText);
  const headers = root.headers || {};
  const contentType = headers["content-type"] || "";
  const subject = decodeMimeEncodedWords(headers.subject || "");
  const fromEmail = decodeMimeEncodedWords(headers.from || "");
  const messageId = String(headers["message-id"] || "").slice(0, 255);
  let plainBody = "";
  let htmlBody = "";
  const attachments = [];
  for (const entity of walkMimeEntities(root)) {
    if (entity.children?.length) continue;
    const partHeaders = entity.headers || {};
    const partType = String(partHeaders["content-type"] || contentType || "text/plain").toLowerCase();
    const disposition = String(partHeaders["content-disposition"] || "").toLowerCase();
    const contentId = stripContentId(partHeaders["content-id"] || "");
    const isTextPart = partType.includes("text/plain") || partType.includes("text/html");
    const isAttachment = disposition.includes("attachment") || !!getMimeParam(partHeaders["content-disposition"], "filename") || !!getMimeParam(partHeaders["content-type"], "name");
    const isInlineAsset = !isTextPart && (!!contentId || disposition.includes("inline"));
    if (!isAttachment && !isInlineAsset && isTextPart) {
      const decoded = decodeMimePartBody(entity.body, partHeaders["content-transfer-encoding"]);
      if (partType.includes("text/plain") && !plainBody) plainBody = decoded;
      if (partType.includes("text/html") && !htmlBody) htmlBody = decoded;
      continue;
    }
    if (isAttachment || isInlineAsset) {
      const filename = normalizeAttachmentFilename(
        getMimeParam(partHeaders["content-disposition"], "filename") || getMimeParam(partHeaders["content-type"], "name"),
        contentId ? `inline-${contentId}` : "attachment"
      );
      const bytes = decodeMimePartBytes(entity.body, partHeaders["content-transfer-encoding"]);
      attachments.push({
        filename,
        contentType: partType.split(";")[0].trim() || "application/octet-stream",
        contentId,
        disposition: disposition.includes("inline") ? "inline" : "attachment",
        bytes
      });
    }
  }
  if (!plainBody && htmlBody) plainBody = htmlToPlainText(htmlBody);
  if (!plainBody && !htmlBody && !root.children?.length) {
    const decoded = decodeMimePartBody(root.body, headers["content-transfer-encoding"]);
    if (String(contentType).toLowerCase().includes("text/html")) htmlBody = decoded;
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
}, "extractEmailContent");
var readEmailRawText = /* @__PURE__ */ __name(async (message) => {
  if (!message?.raw) return "";
  const reader = message.raw.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
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
}, "readEmailRawText");
var timingSafeEqual = /* @__PURE__ */ __name((left, right) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}, "timingSafeEqual");
var derivePasswordHash = /* @__PURE__ */ __name(async (plainPassword, saltBytes, iterations) => {
  const keyMaterial = await crypto.subtle.importKey("raw", passwordEncoder.encode(String(plainPassword || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    keyMaterial,
    PASSWORD_KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}, "derivePasswordHash");
var isHashedPassword = /* @__PURE__ */ __name((value) => {
  const parts = String(value || "").split("$");
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
}, "isHashedPassword");
var hashPassword = /* @__PURE__ */ __name(async (plainPassword) => {
  const saltBytes = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hashBytes = await derivePasswordHash(plainPassword, saltBytes, PASSWORD_ITERATIONS);
  return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${bytesToBase64(saltBytes)}$${bytesToBase64(hashBytes)}`;
}, "hashPassword");
var verifyPassword = /* @__PURE__ */ __name(async (plainPassword, storedPassword) => {
  const stored = String(storedPassword || "");
  if (!isHashedPassword(stored)) return false;
  const [scheme, iterText, saltB64, hashB64] = stored.split("$");
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
}, "verifyPassword");
var buildCookie = /* @__PURE__ */ __name((name, value, path, maxAge) => `${name}=${value};HttpOnly;Secure;Path=${path};Max-Age=${maxAge};SameSite=Lax`, "buildCookie");
var getMaxDestinationsPerUser = /* @__PURE__ */ __name((cfg) => {
  const limit = parseInt(cfg.max_destinations_per_user || "3", 10);
  return Number.isFinite(limit) && limit > 0 ? limit : 3;
}, "getMaxDestinationsPerUser");
var ensureDestinationSchema = /* @__PURE__ */ __name(async (db) => {
  const tableMeta = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_destinations'").first();
  const tableSql = String(tableMeta?.sql || "");
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
}, "ensureDestinationSchema");
var ensureSystem = /* @__PURE__ */ __name(async (db) => {
  if (schemaReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS invitation_codes (code TEXT PRIMARY KEY, max_uses INTEGER NOT NULL, used_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS auth_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, action TEXT NOT NULL, identifier TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
  for (const [key, value] of DEFAULT_CONFIGS) {
    await db.prepare("INSERT OR IGNORE INTO sys_config (key, value) VALUES (?, ?)").bind(key, value).run();
  }
  await db.prepare("DELETE FROM sys_config WHERE key='expired_data_retention_days'").run();
  try {
    await db.prepare("ALTER TABLE user_destinations ADD COLUMN duration_hours TEXT").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE email_routes ADD COLUMN duration_hours TEXT").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE email_routes ADD COLUMN remark TEXT").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE email_routes ADD COLUMN destination_id INTEGER").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE email_routes ADD COLUMN inbox_enabled TEXT DEFAULT 'false'").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE user_destinations ADD COLUMN inbox_default TEXT DEFAULT 'true'").run();
  } catch (_) {
  }
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
  try {
    await db.prepare("ALTER TABLE inbound_emails ADD COLUMN body_html TEXT").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE inbound_emails ADD COLUMN attachment_count INTEGER DEFAULT 0").run();
  } catch (_) {
  }
  try {
    await db.prepare("ALTER TABLE inbound_emails ADD COLUMN attachment_status TEXT").run();
  } catch (_) {
  }
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
}, "ensureSystem");
var getConfigMap = /* @__PURE__ */ __name(async (db) => {
  const rows = (await db.prepare("SELECT key, value FROM sys_config").all()).results || [];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}, "getConfigMap");
var isAuthRateLimited = /* @__PURE__ */ __name(async (db, action, ip, identifier) => {
  const limit = AUTH_RATE_LIMITS[action] || { max: 5, windowMinutes: 15 };
  const normalized = normalizeAuthIdentifier(identifier);
  await db.prepare("DELETE FROM auth_attempts WHERE created_at<datetime('now','-1 day')").run();
  const row = await db.prepare(`
    SELECT COUNT(*) AS c
    FROM auth_attempts
    WHERE ip=? AND action=? AND identifier=?
      AND created_at>=datetime('now','-'||?||' minutes')
  `).bind(ip, action, normalized, limit.windowMinutes).first();
  return (row?.c || 0) >= limit.max;
}, "isAuthRateLimited");
var recordAuthFailure = /* @__PURE__ */ __name(async (db, action, ip, identifier) => {
  await db.prepare("INSERT INTO auth_attempts(ip,action,identifier) VALUES(?,?,?)").bind(ip, action, normalizeAuthIdentifier(identifier)).run();
}, "recordAuthFailure");
var clearAuthFailures = /* @__PURE__ */ __name(async (db, action, ip, identifier) => {
  await db.prepare("DELETE FROM auth_attempts WHERE ip=? AND action=? AND identifier=?").bind(ip, action, normalizeAuthIdentifier(identifier)).run();
}, "clearAuthFailures");
var getPendingExpiryHours = /* @__PURE__ */ __name((cfg) => {
  const hours = parseInt(cfg.pending_dest_expiry_hours || "24", 10);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}, "getPendingExpiryHours");
var expireLocalForUser = /* @__PURE__ */ __name(async (db, env, userId, cfg) => {
  await db.prepare("DELETE FROM email_routes WHERE user_id=? AND status='expired'").bind(userId).run();
  await db.prepare("DELETE FROM user_destinations WHERE user_id=? AND status='expired'").bind(userId).run();
  const expiredRoutes = (await db.prepare("SELECT r.id,r.cf_rule_id,d.zone_id FROM email_routes r JOIN domains d ON r.domain_id=d.id WHERE r.user_id=? AND r.status='active' AND r.expires_at IS NOT NULL AND datetime(r.expires_at)<datetime('now')").bind(userId).all()).results || [];
  for (const route of expiredRoutes) {
    if (route.cf_rule_id) await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, "expire_user_route");
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  }
  const expiredDestinations = (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND status!='expired' AND expires_at IS NOT NULL AND datetime(expires_at)<datetime('now')").bind(userId).all()).results || [];
  for (const dest of expiredDestinations) {
    await deleteDestinationById(db, env, userId, dest.id, { force: true });
  }
  const pendingHours = getPendingExpiryHours(cfg);
  const expiredPending = (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND status='pending' AND created_at<datetime('now','-'||?||' hours')").bind(userId, pendingHours).all()).results || [];
  for (const dest of expiredPending) {
    await deleteDestinationById(db, env, userId, dest.id, { force: true });
  }
}, "expireLocalForUser");
var getPublicConfig = /* @__PURE__ */ __name(async (db, cfg) => {
  const codeCount = (await db.prepare("SELECT COUNT(*) AS c FROM invitation_codes").first())?.c || 0;
  return {
    allowRegistration: cfg.allow_registration === "true",
    inviteRequired: cfg.allow_registration === "true" && cfg.enable_invitation_code === "true" && codeCount > 0,
    durationOptions: DURATION_OPTIONS
  };
}, "getPublicConfig");
var getUserState = /* @__PURE__ */ __name(async (db, env, userId, cfg) => {
  await expireLocalForUser(db, env, userId, cfg);
  const destinations = (await db.prepare("SELECT id,email,status,expires_at,created_at,duration_hours,COALESCE(inbox_default,'true') AS inbox_default FROM user_destinations WHERE user_id=? AND status!='expired' ORDER BY id DESC").bind(userId).all()).results || [];
  for (const destination of destinations) {
    if (destination?.status === "pending") {
      const pendingExpiry = dbDateMs(destination.created_at) + getPendingExpiryHours(cfg) * 36e5;
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
  const maxRoutes = parseInt(cfg.max_routes_per_user || "10", 10);
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
      destinationMax: cfg.max_destination_duration_hours || "168",
      routeMax: cfg.max_route_duration_hours || "72"
    },
    durationOptions: DURATION_OPTIONS
  };
}, "getUserState");
var normalizeDomain = /* @__PURE__ */ __name((domain) => String(domain || "").trim().toLowerCase().replace(/\.$/, ""), "normalizeDomain");
var isValidDomainName = /* @__PURE__ */ __name((domain) => /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain), "isValidDomainName");
var domainBelongsToZone = /* @__PURE__ */ __name((domain, zoneName) => domain === zoneName || domain.endsWith("." + zoneName), "domainBelongsToZone");
var CF_API_BASE = "https://api.cloudflare.com/client/v4";
var cfRequest = /* @__PURE__ */ __name(async (env, pathOrUrl, options = {}) => {
  const url = /^https?:\/\//i.test(String(pathOrUrl || "")) ? String(pathOrUrl) : `${CF_API_BASE}${pathOrUrl}`;
  const method = options.method || "GET";
  const headers = { "Authorization": `Bearer ${env.CF_API_TOKEN}`, ...options.headers || {} };
  const init = { method, headers };
  if (options.body != null) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({ success: res.ok, errors: ["Cloudflare response parse failed"] }));
    const ok = res.ok && data.success !== false;
    if (!ok && options.warn !== false) {
      console.warn("[cf_api_error]", JSON.stringify({
        label: options.label || "",
        method,
        status: res.status,
        url,
        errors: data.errors || data.messages || data
      }));
    }
    return { ok, status: res.status, data };
  } catch (e) {
    if (options.warn !== false) {
      console.warn("[cf_api_error]", JSON.stringify({
        label: options.label || "",
        method,
        url,
        error: e?.message || String(e)
      }));
    }
    return { ok: false, status: 0, data: { success: false, errors: [e?.message || String(e)] } };
  }
}, "cfRequest");
var cfDelete = /* @__PURE__ */ __name(async (pathOrUrl, env, label = "delete") => (await cfRequest(env, pathOrUrl, { method: "DELETE", label })).ok, "cfDelete");
var cfDeleteRoute = /* @__PURE__ */ __name(async (env, zoneId, ruleId, label = "delete_email_route") => cfDelete(`/zones/${zoneId}/email/routing/rules/${ruleId}`, env, label), "cfDeleteRoute");
var cfDeleteAddress = /* @__PURE__ */ __name(async (env, addressId, label = "delete_email_address") => cfDelete(`/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${addressId}`, env, label), "cfDeleteAddress");
var isUniqueConstraintError = /* @__PURE__ */ __name((error) => /unique|constraint/i.test(String(error?.message || error || "")), "isUniqueConstraintError");
var summarizeCfError = /* @__PURE__ */ __name((data) => {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const parts = [...errors, ...messages].map((item) => {
    if (typeof item === "string") return item;
    const code = item?.code ? `${item.code}: ` : "";
    return `${code}${item?.message || JSON.stringify(item)}`;
  }).filter(Boolean);
  if (parts.length) return parts.join("; ").slice(0, 500);
  return JSON.stringify(data || {}).slice(0, 500);
}, "summarizeCfError");
var summarizeEmailRouteRuleError = /* @__PURE__ */ __name((data, env) => {
  const summary = summarizeCfError(data);
  if (/Workers Script Info not found/i.test(summary)) {
    const workerName = String(env.EMAIL_WORKER_NAME || "").trim() || "\u672A\u914D\u7F6E";
    return `Cloudflare \u627E\u4E0D\u5230\u7AD9\u5185\u540C\u6B65 Worker\uFF08EMAIL_WORKER_NAME \u5F53\u524D\u4E3A ${workerName}\uFF09\u3002\u8BF7\u628A EMAIL_WORKER_NAME \u8BBE\u7F6E\u4E3A Workers & Pages \u91CC\u7684 Worker \u670D\u52A1\u540D\u79F0\uFF0C\u4E0D\u8981\u586B\u57DF\u540D\u3001URL\u3001\u8DEF\u7531\u540D\u6216\u53D8\u91CF\u540D\uFF0C\u5E76\u786E\u8BA4\u8FD9\u4E2A Worker \u5DF2\u90E8\u7F72\u5728\u540C\u4E00\u4E2A Cloudflare \u8D26\u53F7\u4E0B\u3002\u539F\u59CB\u9519\u8BEF\uFF1A${summary}`;
  }
  return summary;
}, "summarizeEmailRouteRuleError");
var cfEnableEmailRoutingDomain = /* @__PURE__ */ __name(async (zoneId, domain, env) => {
  return await cfRequest(env, `/zones/${zoneId}/email/routing/dns`, {
    method: "POST",
    body: { name: domain },
    label: "enable_email_routing_dns"
  });
}, "cfEnableEmailRoutingDomain");
var getInboundRetentionDays = /* @__PURE__ */ __name((cfg) => {
  const days = parseInt(cfg.inbound_mail_retention_days || "30", 10);
  return Number.isFinite(days) && days > 0 ? days : 30;
}, "getInboundRetentionDays");
var getMaxInboundBodyBytes = /* @__PURE__ */ __name((cfg) => {
  const bytes = parseInt(cfg.max_inbound_body_bytes || String(DEFAULT_MAX_INBOUND_BODY_BYTES), 10);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : DEFAULT_MAX_INBOUND_BODY_BYTES;
}, "getMaxInboundBodyBytes");
var getMaxInboundAttachmentBytes = /* @__PURE__ */ __name((cfg) => {
  const bytes = parseInt(cfg.max_inbound_attachment_bytes || String(DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES), 10);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES;
}, "getMaxInboundAttachmentBytes");
var getMaxInboundTotalAttachmentBytes = /* @__PURE__ */ __name((cfg) => {
  const bytes = parseInt(cfg[MAX_INBOUND_TOTAL_ATTACHMENT_CONFIG_KEY] || String(DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES), 10);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : DEFAULT_MAX_INBOUND_TOTAL_ATTACHMENT_BYTES;
}, "getMaxInboundTotalAttachmentBytes");
var getMaxInboundAttachments = /* @__PURE__ */ __name((cfg) => {
  const count = parseInt(cfg[MAX_INBOUND_ATTACHMENTS_CONFIG_KEY] || String(DEFAULT_MAX_INBOUND_ATTACHMENTS), 10);
  return Number.isFinite(count) && count >= 0 ? count : DEFAULT_MAX_INBOUND_ATTACHMENTS;
}, "getMaxInboundAttachments");
var getMaxInboundR2StorageBytes = /* @__PURE__ */ __name((cfg) => {
  const bytes = parseInt(cfg[MAX_INBOUND_R2_STORAGE_CONFIG_KEY] || String(DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES), 10);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : DEFAULT_MAX_INBOUND_R2_STORAGE_BYTES;
}, "getMaxInboundR2StorageBytes");
var getInboundAttachmentStorageUsage = /* @__PURE__ */ __name(async (db, env, cfg) => {
  const row = await db.prepare("SELECT COUNT(*) AS attachment_count, COALESCE(SUM(size_bytes),0) AS used_bytes FROM inbound_attachments").first();
  const usedBytes = parseInt(row?.used_bytes || "0", 10);
  const limitBytes = getMaxInboundR2StorageBytes(cfg);
  return {
    r2Bound: !!env.INBOUND_ATTACHMENTS,
    attachmentCount: parseInt(row?.attachment_count || "0", 10) || 0,
    usedBytes: Number.isFinite(usedBytes) ? usedBytes : 0,
    limitBytes,
    usagePercent: limitBytes > 0 ? Math.min(100, Math.max(0, usedBytes / limitBytes * 100)) : usedBytes > 0 ? 100 : 0
  };
}, "getInboundAttachmentStorageUsage");
var buildAttachmentUrl = /* @__PURE__ */ __name((mailId, attachmentId, inline = false) => `/api/inbox/${mailId}/attachments/${attachmentId}${inline ? "?inline=1" : ""}`, "buildAttachmentUrl");
var rewriteCidUrls = /* @__PURE__ */ __name((html, cidMap) => String(html || "").replace(/(["'(])cid:([^"')\s>]+)(["')])/gi, (match, left, cid, right) => {
  const key = stripContentId(cid);
  return cidMap[key] ? `${left}${cidMap[key]}${right}` : match;
}), "rewriteCidUrls");
var attachmentStatusText = /* @__PURE__ */ __name((status) => {
  if (!status) return "";
  const parts = String(status).split(",").map((part) => part.trim()).filter((part) => part && part !== "ok");
  if (!parts.length) return "";
  const labels = [];
  if (parts.includes("r2_missing")) labels.push("\u9644\u4EF6\u5B58\u50A8\u672A\u7ED1\u5B9A\uFF0C\u9644\u4EF6\u672A\u4FDD\u5B58");
  if (parts.includes("count_limited")) labels.push("\u90E8\u5206\u9644\u4EF6\u56E0\u6570\u91CF\u8D85\u9650\u672A\u4FDD\u5B58");
  if (parts.includes("size_limited")) labels.push("\u90E8\u5206\u9644\u4EF6\u56E0\u5927\u5C0F\u8D85\u9650\u672A\u4FDD\u5B58");
  if (parts.includes("storage_limited")) labels.push("\u90E8\u5206\u65E7\u9644\u4EF6\u56E0\u5B58\u50A8\u7A7A\u95F4\u9650\u5236\u5DF2\u81EA\u52A8\u6E05\u7406");
  if (parts.includes("save_failed")) labels.push("\u90E8\u5206\u9644\u4EF6\u4FDD\u5B58\u5931\u8D25");
  return labels.join("\uFF1B");
}, "attachmentStatusText");
var appendAttachmentStatus = /* @__PURE__ */ __name((status, flag) => {
  const parts = new Set(String(status || "").split(",").map((part) => part.trim()).filter((part) => part && part !== "ok"));
  if (flag) parts.add(flag);
  return parts.size ? Array.from(parts).join(",") : "";
}, "appendAttachmentStatus");
var deleteR2Objects = /* @__PURE__ */ __name(async (env, keys) => {
  if (!env.INBOUND_ATTACHMENTS || !Array.isArray(keys) || !keys.length) return;
  for (const key of keys) {
    try {
      await env.INBOUND_ATTACHMENTS.delete(key);
    } catch (e) {
      console.warn("[r2_attachment_delete_error]", JSON.stringify({ key, error: e?.message || String(e) }));
    }
  }
}, "deleteR2Objects");
var deleteInboundMailById = /* @__PURE__ */ __name(async (db, env, userId, mailId) => {
  const mail = await db.prepare("SELECT id FROM inbound_emails WHERE id=? AND user_id=?").bind(mailId, userId).first();
  if (!mail) return false;
  const attachments = (await db.prepare("SELECT r2_key FROM inbound_attachments WHERE mail_id=? AND user_id=?").bind(mailId, userId).all()).results || [];
  await deleteR2Objects(env, attachments.map((item) => item.r2_key).filter(Boolean));
  await db.prepare("DELETE FROM inbound_attachments WHERE mail_id=? AND user_id=?").bind(mailId, userId).run();
  await db.prepare("DELETE FROM inbound_emails WHERE id=? AND user_id=?").bind(mailId, userId).run();
  return true;
}, "deleteInboundMailById");
var deleteInboundMailForUser = /* @__PURE__ */ __name(async (db, env, userId) => {
  const attachments = (await db.prepare("SELECT r2_key FROM inbound_attachments WHERE user_id=?").bind(userId).all()).results || [];
  await deleteR2Objects(env, attachments.map((item) => item.r2_key).filter(Boolean));
  await db.prepare("DELETE FROM inbound_attachments WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM inbound_emails WHERE user_id=?").bind(userId).run();
}, "deleteInboundMailForUser");
var cleanupExpiredInboundEmails = /* @__PURE__ */ __name(async (db, env, retentionDays) => {
  const rows = (await db.prepare("SELECT id,user_id FROM inbound_emails WHERE received_at<datetime('now','-'||?||' days')").bind(retentionDays).all()).results || [];
  for (const row of rows) {
    await deleteInboundMailById(db, env, row.user_id, row.id);
  }
}, "cleanupExpiredInboundEmails");
var cleanupInboundAttachmentStorage = /* @__PURE__ */ __name(async (db, env, cfg) => {
  const usage = await getInboundAttachmentStorageUsage(db, env, cfg);
  if (usage.usedBytes <= usage.limitBytes) return { cleaned: 0, freedBytes: 0, ...usage };
  if (!env.INBOUND_ATTACHMENTS) return { cleaned: 0, freedBytes: 0, skipped: true, ...usage };
  const rows = (await db.prepare(`
    SELECT id,mail_id,user_id,size_bytes,r2_key
    FROM inbound_attachments
    ORDER BY datetime(created_at) ASC, id ASC
  `).all()).results || [];
  const touchedMails = /* @__PURE__ */ new Map();
  let usedBytes = usage.usedBytes;
  let cleaned = 0;
  let freedBytes = 0;
  for (const row of rows) {
    if (usedBytes <= usage.limitBytes) break;
    const sizeBytes = parseInt(row.size_bytes || "0", 10) || 0;
    await deleteR2Objects(env, row.r2_key ? [row.r2_key] : []);
    await db.prepare("DELETE FROM inbound_attachments WHERE id=?").bind(row.id).run();
    usedBytes = Math.max(0, usedBytes - sizeBytes);
    freedBytes += sizeBytes;
    cleaned++;
    touchedMails.set(`${row.user_id}:${row.mail_id}`, { userId: row.user_id, mailId: row.mail_id });
  }
  for (const item of touchedMails.values()) {
    const row = await db.prepare("SELECT attachment_status FROM inbound_emails WHERE id=? AND user_id=?").bind(item.mailId, item.userId).first();
    if (!row) continue;
    const count = (await db.prepare("SELECT COUNT(*) AS c FROM inbound_attachments WHERE mail_id=? AND user_id=?").bind(item.mailId, item.userId).first())?.c || 0;
    await db.prepare("UPDATE inbound_emails SET attachment_count=?, attachment_status=? WHERE id=? AND user_id=?").bind(count, appendAttachmentStatus(row.attachment_status, "storage_limited"), item.mailId, item.userId).run();
  }
  return { cleaned, freedBytes, ...usage, usedBytes };
}, "cleanupInboundAttachmentStorage");
var saveInboundAttachments = /* @__PURE__ */ __name(async (db, env, cfg, mailId, userId, attachments) => {
  const items = Array.isArray(attachments) ? attachments : [];
  if (!items.length) return { count: 0, status: "" };
  if (!env.INBOUND_ATTACHMENTS) return { count: 0, status: "r2_missing" };
  const maxCount = getMaxInboundAttachments(cfg);
  const maxItemBytes = getMaxInboundAttachmentBytes(cfg);
  const maxTotalBytes = getMaxInboundTotalAttachmentBytes(cfg);
  const status = /* @__PURE__ */ new Set();
  const cidMap = {};
  let savedCount = 0;
  let totalBytes = 0;
  for (const item of items) {
    if (savedCount >= maxCount) {
      status.add("count_limited");
      continue;
    }
    const bytes = item.bytes instanceof Uint8Array ? item.bytes : new Uint8Array();
    if (bytes.length > maxItemBytes || totalBytes + bytes.length > maxTotalBytes) {
      status.add("size_limited");
      continue;
    }
    const filename = normalizeAttachmentFilename(item.filename, "attachment");
    const r2Key = `${userId}/${mailId}/${crypto.randomUUID()}-${filename}`;
    try {
      await env.INBOUND_ATTACHMENTS.put(r2Key, bytes, {
        httpMetadata: { contentType: item.contentType || "application/octet-stream" }
      });
      const inserted = await db.prepare(`
        INSERT INTO inbound_attachments(mail_id,user_id,filename,content_type,size_bytes,content_id,disposition,r2_key,created_at)
        VALUES(?,?,?,?,?,?,?,?,datetime('now'))
      `).bind(
        mailId,
        userId,
        filename,
        item.contentType || "application/octet-stream",
        bytes.length,
        item.contentId || "",
        item.disposition || "attachment",
        r2Key
      ).run();
      const attachmentId = inserted?.meta?.last_row_id || null;
      if (item.contentId && attachmentId) {
        cidMap[stripContentId(item.contentId)] = buildAttachmentUrl(mailId, attachmentId, true);
      }
      savedCount++;
      totalBytes += bytes.length;
    } catch (e) {
      status.add("save_failed");
      console.error("[inbound_attachment_save_error]", JSON.stringify({ mailId, filename, error: e?.message || String(e) }));
      await deleteR2Objects(env, [r2Key]);
    }
  }
  return {
    count: savedCount,
    status: status.size ? Array.from(status).join(",") : savedCount ? "ok" : "",
    cidMap
  };
}, "saveInboundAttachments");
var requireEmailWorkerName = /* @__PURE__ */ __name((env) => {
  const raw = String(env.EMAIL_WORKER_NAME || "").trim();
  let workerName = raw;
  try {
    if (/^https?:\/\//i.test(workerName)) workerName = new URL(workerName).hostname;
  } catch (_) {
  }
  if (/\.workers\.dev$/i.test(workerName)) workerName = workerName.split(".")[0] || workerName;
  if (!workerName) return { ok: false, error: "\u8BF7\u5148\u914D\u7F6E EMAIL_WORKER_NAME\uFF0C\u624D\u80FD\u5F00\u542F\u7AD9\u5185\u6536\u4EF6\u7BB1\u540C\u6B65" };
  return { ok: true, value: workerName };
}, "requireEmailWorkerName");
var buildEmailRouteRule = /* @__PURE__ */ __name((env, routeAddress, targetEmail, userId, tag, inboxEnabled) => {
  const enabled = isTruthyFlag(inboxEnabled);
  const workerName = enabled ? requireEmailWorkerName(env) : { ok: true, value: "" };
  if (!workerName.ok) return workerName;
  if (!enabled && !targetEmail) return { ok: false, error: "\u8BF7\u9009\u62E9\u8F6C\u53D1\u76EE\u6807\u90AE\u7BB1" };
  return {
    ok: true,
    value: {
      actions: enabled ? [{ type: "worker", value: [workerName.value] }] : [{ type: "forward", value: [targetEmail] }],
      matchers: [{ type: "literal", field: "to", value: routeAddress }],
      enabled: true,
      name: `U-${userId}-${tag}`
    }
  };
}, "buildEmailRouteRule");
var cfRuleNotFound = /* @__PURE__ */ __name((cf) => cf?.status === 404 || /not found|does not exist|could not find/i.test(summarizeCfError(cf?.data)), "cfRuleNotFound");
var cfRouteRuleMatchesAddress = /* @__PURE__ */ __name((rule, routeAddress) => {
  const wanted = String(routeAddress || "").toLowerCase();
  return (rule?.matchers || []).some(
    (matcher) => String(matcher?.type || "").toLowerCase() === "literal" && String(matcher?.field || "").toLowerCase() === "to" && String(matcher?.value || "").toLowerCase() === wanted
  );
}, "cfRouteRuleMatchesAddress");
var cfFindRouteRuleIdByAddress = /* @__PURE__ */ __name(async (env, zoneId, routeAddress) => {
  for (let page = 1; page <= 10; page++) {
    const cf = await cfRequest(env, `/zones/${zoneId}/email/routing/rules?page=${page}&per_page=100`, {
      label: "find_email_route_rule",
      warn: false
    });
    if (!cf.ok) return null;
    const found = (cf.data?.result || []).find((rule) => cfRouteRuleMatchesAddress(rule, routeAddress));
    if (found?.id) return found.id;
    const totalPages = parseInt(cf.data?.result_info?.total_pages || "1", 10);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
  }
  return null;
}, "cfFindRouteRuleIdByAddress");
var cfCreateRouteRule = /* @__PURE__ */ __name(async (env, zoneId, rulePayload, label = "create_email_route_rule") => cfRequest(env, `/zones/${zoneId}/email/routing/rules`, {
  method: "POST",
  body: rulePayload,
  label
}), "cfCreateRouteRule");
var cfSyncRouteRule = /* @__PURE__ */ __name(async (env, route, routeAddress, rulePayload, label = "sync_email_route_rule") => {
  const zoneId = route.zone_id;
  if (route.cf_rule_id && route.status === "active") {
    const updated = await cfRequest(env, `/zones/${zoneId}/email/routing/rules/${route.cf_rule_id}`, {
      method: "PUT",
      body: rulePayload,
      label
    });
    if (updated.ok) return { ok: true, ruleId: route.cf_rule_id, data: updated.data };
    if (!cfRuleNotFound(updated)) return updated;
  }
  const existingRuleId = await cfFindRouteRuleIdByAddress(env, zoneId, routeAddress);
  if (existingRuleId) {
    const updated = await cfRequest(env, `/zones/${zoneId}/email/routing/rules/${existingRuleId}`, {
      method: "PUT",
      body: rulePayload,
      label: `${label}_found_existing`
    });
    if (updated.ok) return { ok: true, ruleId: existingRuleId, data: updated.data };
    if (!cfRuleNotFound(updated)) return updated;
  }
  const created = await cfCreateRouteRule(env, zoneId, rulePayload, `${label}_create_missing`);
  if (created.ok && created.data?.result?.id) return { ok: true, ruleId: created.data.result.id, data: created.data };
  return created;
}, "cfSyncRouteRule");
var runTimedCleanup = /* @__PURE__ */ __name(async (db, env, cfg) => {
  const eR = await db.prepare("SELECT r.*,d.zone_id FROM email_routes r JOIN domains d ON r.domain_id=d.id WHERE r.expires_at IS NOT NULL AND datetime(r.expires_at)<datetime('now') AND r.status='active'").all();
  for (const r of eR.results || []) {
    if (r.cf_rule_id) await cfDeleteRoute(env, r.zone_id, r.cf_rule_id, "scheduled_expire_route");
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(r.id).run();
  }
  const eD = await db.prepare("SELECT id,user_id FROM user_destinations WHERE expires_at IS NOT NULL AND datetime(expires_at)<datetime('now') AND status!='expired'").all();
  for (let d of eD.results) {
    await deleteDestinationById(db, env, d.user_id, d.id, { force: true });
  }
  const pH = getPendingExpiryHours(cfg);
  const eP = await db.prepare("SELECT id,user_id FROM user_destinations WHERE status='pending' AND created_at<datetime('now','-'||?||' hours')").bind(pH).all();
  for (let d of eP.results) {
    await deleteDestinationById(db, env, d.user_id, d.id, { force: true });
  }
  const zH = parseInt(cfg.unverified_user_expiry_hours || "24", 10);
  const zs = await db.prepare("SELECT id FROM users WHERE created_at<datetime('now','-'||?||' hours') AND id NOT IN (SELECT user_id FROM user_destinations WHERE status!='expired')").bind(zH).all();
  for (let z of zs.results) {
    await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(z.id).run();
    await db.prepare("DELETE FROM users WHERE id=?").bind(z.id).run();
  }
  await db.prepare("DELETE FROM email_routes WHERE status='expired'").run();
  await db.prepare("DELETE FROM user_destinations WHERE status='expired'").run();
  await db.prepare("DELETE FROM sessions WHERE expires_at<datetime('now')").run();
  await db.prepare("DELETE FROM sessions WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)").run();
  await db.prepare("DELETE FROM auth_attempts WHERE created_at<datetime('now','-1 day')").run();
  await cleanupExpiredInboundEmails(db, env, getInboundRetentionDays(cfg));
  await cleanupInboundAttachmentStorage(db, env, cfg);
}, "runTimedCleanup");
var deleteRouteById = /* @__PURE__ */ __name(async (db, env, routeId, userId) => {
  const route = await db.prepare(`
    SELECT r.id,r.cf_rule_id,r.status,d.zone_id
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    WHERE r.id=? AND r.user_id=?
  `).bind(routeId, userId).first();
  if (!route) return false;
  if (route.cf_rule_id && route.status === "active") {
    await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, "delete_user_route");
  }
  await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  return true;
}, "deleteRouteById");
var deleteUserRoutes = /* @__PURE__ */ __name(async (db, env, userId) => {
  const routes = (await db.prepare(`
    SELECT r.id,r.cf_rule_id,d.zone_id
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    WHERE r.user_id=? AND r.status='active'
  `).bind(userId).all()).results || [];
  for (const route of routes) {
    if (route.cf_rule_id) await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, "delete_user_account_route");
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  }
  return routes.length;
}, "deleteUserRoutes");
var deleteDestinationById = /* @__PURE__ */ __name(async (db, env, userId, destinationId, options = {}) => {
  const force = options.force === true;
  const dest = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, userId).first();
  if (!dest) return { ok: false, reason: "not_found" };
  const activeRouteCount = (await db.prepare("SELECT COUNT(*) AS c FROM email_routes WHERE destination_id=? AND user_id=? AND status='active' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(destinationId, userId).first())?.c || 0;
  if (!force && activeRouteCount > 0) return { ok: false, reason: "in_use", routeCount: activeRouteCount };
  const boundRoutes = (await db.prepare(`
    SELECT r.id,r.cf_rule_id,d.zone_id
    FROM email_routes r
    JOIN domains d ON r.domain_id=d.id
    WHERE r.user_id=? AND r.destination_id=?
  `).bind(userId, destinationId).all()).results || [];
  for (const route of boundRoutes) {
    if (route.cf_rule_id) await cfDeleteRoute(env, route.zone_id, route.cf_rule_id, "delete_destination_bound_route");
    await db.prepare("DELETE FROM email_routes WHERE id=?").bind(route.id).run();
  }
  if (dest.cf_address_id) {
    await cfDeleteAddress(env, dest.cf_address_id, "delete_destination_address");
  }
  await db.prepare("DELETE FROM user_destinations WHERE id=?").bind(dest.id).run();
  await db.prepare("UPDATE email_routes SET destination_id=NULL WHERE destination_id=?").bind(destinationId).run();
  return { ok: true };
}, "deleteDestinationById");
var deleteUserDestination = /* @__PURE__ */ __name(async (db, env, userId, destinationId) => {
  if (!Number.isFinite(parseInt(destinationId, 10))) return false;
  const result = await deleteDestinationById(db, env, userId, parseInt(destinationId, 10), { force: false });
  return result.ok ? true : result;
}, "deleteUserDestination");
var deleteUserAccount = /* @__PURE__ */ __name(async (db, env, userId) => {
  const destinations = (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND status!='expired'").bind(userId).all()).results || [];
  for (const destination of destinations) {
    await deleteDestinationById(db, env, userId, destination.id, { force: true });
  }
  await deleteUserRoutes(db, env, userId);
  await deleteInboundMailForUser(db, env, userId);
  await db.prepare("DELETE FROM email_routes WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM user_destinations WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId).run();
  await db.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
}, "deleteUserAccount");
var handleInboundEmail = /* @__PURE__ */ __name(async (message, env) => {
  if (!env.DB) {
    message.setReject("Database binding missing");
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
    message.setReject("Unknown recipient");
    return;
  }
  if (route.expires_at && dbDateMs(route.expires_at) <= Date.now()) {
    message.setReject("Route expired");
    return;
  }
  const shouldForward = !!route.destination_email;
  if (shouldForward && (route.destination_status !== "verified" || route.destination_expires_at && dbDateMs(route.destination_expires_at) <= Date.now())) {
    message.setReject("Destination unavailable");
    return;
  }
  const routeAddress = `${route.tag}@${route.domain}`;
  let saved = false;
  let savedMailId = null;
  let saveError = "";
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
      parsed.fromEmail || String(message.from || "").slice(0, 512),
      parsed.subject || "(\u65E0\u4E3B\u9898)",
      parsed.bodyText || "(\u65E0\u6CD5\u63D0\u53D6\u6B63\u6587)",
      parsed.bodyHtml || "",
      Number(message.rawSize || rawText.length || 0),
      parsed.messageId || "",
      shouldForward ? "pending_forward" : "stored",
      0,
      ""
    ).run();
    savedMailId = savedResult?.meta?.last_row_id || null;
    if (savedMailId) {
      const attachmentResult = await saveInboundAttachments(db, env, cfg, savedMailId, route.user_id, parsed.attachments);
      const bodyHtml = attachmentResult.cidMap ? rewriteCidUrls(parsed.bodyHtml || "", attachmentResult.cidMap) : parsed.bodyHtml || "";
      await db.prepare("UPDATE inbound_emails SET body_html=?, attachment_count=?, attachment_status=? WHERE id=?").bind(bodyHtml, attachmentResult.count || 0, attachmentResult.status || "", savedMailId).run();
    }
    saved = true;
  } catch (e) {
    saveError = e?.message || String(e);
    console.error("[inbound_email_save_error]", JSON.stringify({ to: routeAddress, routeId: route.route_id, error: saveError }));
  }
  if (!saved) {
    message.setReject("Delivery failed");
    return;
  }
  if (!shouldForward) return;
  try {
    await message.forward(route.destination_email);
    if (savedMailId) {
      await db.prepare("UPDATE inbound_emails SET forward_status='forwarded' WHERE id=?").bind(savedMailId).run();
    } else {
      await db.prepare("UPDATE inbound_emails SET forward_status='forwarded' WHERE id=(SELECT id FROM inbound_emails WHERE user_id=? AND route_id=? ORDER BY id DESC LIMIT 1)").bind(route.user_id, route.route_id).run();
    }
  } catch (e) {
    const forwardError = e?.message || String(e);
    console.error("[inbound_email_forward_error]", JSON.stringify({ to: routeAddress, routeId: route.route_id, error: forwardError }));
    if (savedMailId) {
      await db.prepare("UPDATE inbound_emails SET forward_status=? WHERE id=?").bind(`forward_failed: ${forwardError}`.slice(0, 255), savedMailId).run();
    } else {
      await db.prepare("UPDATE inbound_emails SET forward_status=? WHERE id=(SELECT id FROM inbound_emails WHERE user_id=? AND route_id=? ORDER BY id DESC LIMIT 1)").bind(`forward_failed: ${forwardError}`.slice(0, 255), route.user_id, route.route_id).run();
    }
  }
}, "handleInboundEmail");
var renderThemeBootstrapScript = /* @__PURE__ */ __name(() => `<script>(function(){document.documentElement.dataset.theme='light';document.documentElement.dataset.themePreference='light';try{localStorage.setItem('themePreference','light');}catch(_){};})();<\/script>`, "renderThemeBootstrapScript");
var renderSharedThemeStyle = /* @__PURE__ */ __name(() => `<style>
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
.field:focus,.select:focus,.textarea:focus{border-color:var(--accent-link);box-shadow:none}
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
.section-title{color:var(--text-strong);font-size:1.02rem;font-weight:600}
.section-subtitle{color:var(--text-muted);font-size:.76rem;line-height:1.58}
.workspace-section-head{display:flex;flex-direction:column;gap:.22rem}
.workspace-section-kicker{font-size:.64rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#80868b}
.workspace-section-copy{font-size:.77rem;color:var(--text-muted);line-height:1.64;max-width:35rem}
.danger-card{background:#fef7f4;border:1px solid #f1d2c7;box-shadow:none;border-radius:.56rem}
.mail-body-shell{background:#f8fafd}
.email-html{color:#27313d;line-height:1.72;font-size:14.5px}
.email-html p{margin:.2rem 0 .9rem}
.email-html h1,.email-html h2,.email-html h3{color:var(--text-strong);line-height:1.35;margin:1.05rem 0 .65rem}
.email-html ul,.email-html ol{margin:.25rem 0 .9rem;padding-left:1.25rem}
.email-html li{margin:.18rem 0}
.email-html img{max-width:100%;height:auto}
.email-html table{max-width:100%;overflow:auto}
.email-html a{color:var(--accent-link);text-decoration:underline}
.email-html blockquote{border-left:3px solid var(--border-strong);margin-left:0;padding-left:12px;color:var(--text-muted)}
.email-html pre{color:var(--text-strong);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.gmail-app-chrome{padding:10px 12px 14px}
.gmail-section-shell{padding:14px 16px 18px}
.gmail-search-shell{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
.gmail-searchbar{display:flex;align-items:center;gap:.54rem;min-height:38px;flex:1 1 320px;border-radius:.72rem;border:1px solid #e2e7ec;background:#f5f7f9;padding:0 .68rem;box-shadow:none}
.gmail-searchbar .field{border:0!important;background:transparent!important;box-shadow:none!important;padding:.3rem 0!important;font-size:.76rem!important}
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
.gmail-mail-main{min-width:0;display:grid;grid-template-columns:minmax(0,112px) minmax(0,1fr);gap:.26rem .72rem;align-items:center}
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
.gmail-admin-stack{display:grid;gap:.82rem}
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
.gmail-user-card{grid-template-columns:minmax(0,1fr)!important;gap:1rem!important;padding:1.08rem 1rem 1rem!important}
.gmail-user-card:hover{background:#fbfcfe!important}
.gmail-user-card-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:.85rem;min-width:0}
.gmail-user-card-identity{display:flex;flex-direction:column;gap:.3rem;min-width:0}
.gmail-user-card-title{font-size:.96rem;font-weight:600;color:var(--text-strong);line-height:1.35;word-break:break-word}
.gmail-user-card-id{font-size:.84rem;font-weight:500;color:var(--text-soft)}
.gmail-user-card-copy{font-size:.78rem;color:var(--text-muted);line-height:1.58;max-width:42rem}
.gmail-user-card-metrics{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.5rem}
.gmail-user-metric-chip{display:inline-flex;align-items:center;gap:.38rem;padding:.38rem .68rem;border:1px solid #d9e2ec;border-radius:999px;background:#f8fafc;font-size:.74rem;font-weight:700;color:#425466;white-space:nowrap}
.gmail-user-card-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:.8rem}
.gmail-user-card-panel{display:flex;flex-direction:column;gap:.5rem;padding:.82rem .92rem;border:1px solid #e6edf5;border-radius:.82rem;background:#fbfcfe;min-width:0}
.gmail-user-card-panel-danger{background:#fffaf7;border-color:#f3dfd2}
.gmail-user-card-panel-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
.gmail-user-card-panel-title{font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#6b7280}
.gmail-user-card-panel-copy{font-size:.76rem;color:var(--text-soft);line-height:1.55;word-break:break-word}
.gmail-user-card-list{display:flex;flex-direction:column;gap:.48rem;min-width:0}
.gmail-user-card-list-item{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem .55rem;min-width:0}
.gmail-user-card-list-item .mono-accent{word-break:break-all}
.gmail-user-card-actions{justify-content:flex-start!important;padding-left:0!important}
.gmail-user-search{display:flex;gap:.42rem;align-items:center;width:100%;max-width:18.75rem}
.gmail-user-search .field{min-height:2.1rem!important;font-size:.75rem!important;padding:.28rem .62rem!important}
.gmail-user-search .btn-secondary{min-height:2.1rem!important;padding:.28rem .62rem!important}
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
.gmail-user-title{display:flex;align-items:center;gap:.48rem;font-size:.94rem;font-weight:600;color:var(--text-strong)}
.gmail-user-copy{font-size:.76rem;color:var(--text-muted);line-height:1.58;max-width:32rem}
.gmail-user-stats{display:flex;flex-wrap:wrap;gap:.34rem;justify-content:flex-end}
.gmail-user-stat{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .5rem;border-radius:.36rem;border:1px solid #e8ebf0;background:#fff;font-size:.67rem;color:var(--text-muted);box-shadow:none}
.gmail-user-stat strong{color:var(--text-strong);font-size:.78rem}
.gmail-user-brand .btn-secondary{min-height:2.3rem;padding:.5rem .85rem;font-size:.76rem}
.gmail-user-nav{display:flex;align-items:center;gap:.28rem;flex-wrap:wrap;padding:0;border:0;background:transparent;border-radius:var(--radius-pill);box-shadow:none;width:max-content;max-width:100%}
.gmail-user-surface{background:transparent;border:0;border-radius:0;box-shadow:none}
.gmail-sidebar-shell{background:transparent;border:0;border-radius:0;box-shadow:none;padding:.14rem 0 0}
.gmail-sidebar-section-label{padding:.1rem .9rem .34rem;font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8791a0}
.gmail-sidebar-cta{display:flex;align-items:center;justify-content:flex-start;gap:.62rem;min-height:46px;padding:.66rem .86rem;border-radius:.6rem;background:linear-gradient(180deg,#3b8cff 0%,#2f7ef4 100%);color:#fff;font-size:.8rem;font-weight:700;border:0;box-shadow:0 1px 2px rgba(47,126,244,.22),0 4px 10px rgba(47,126,244,.18)}
.gmail-sidebar-cta:hover{background:var(--accent-compose-hover);border-color:transparent}
.gmail-sidebar-cta-mark{width:1.08rem;height:1.08rem;border-radius:999px;background:rgba(255,255,255,.22);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.9rem;line-height:1}
.gmail-sidebar-nav{display:flex;flex-direction:column;gap:.04rem;padding-top:.32rem}
.gmail-sidebar-nav .dashboard-nav{font-size:.78rem;font-weight:600;min-height:2.52rem}
.gmail-workspace-shell{display:flex;flex-direction:column;gap:0;border:1px solid #e5e9ef;border-radius:.38rem;background:#fff;overflow:hidden;box-shadow:none}
.gmail-workspace-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.72rem;flex-wrap:wrap;background:#fff;padding-bottom:.36rem}
.gmail-toolbar-card{background:#fff;border:0;border-bottom:1px solid var(--border-subtle);border-radius:0;box-shadow:none;padding:.52rem .82rem}
.gmail-toolbar-card-quiet{padding:.5rem .82rem;background:#fff}
.gmail-inbox-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1rem}
.gmail-inbox-head-main{display:flex;flex-direction:column;gap:.1rem;min-width:0}
.gmail-inbox-head-tools{display:flex;align-items:center;gap:.5rem;min-width:0;flex-wrap:wrap;justify-content:flex-end}
.gmail-inbox-search{display:flex;align-items:center;gap:.38rem;min-width:0;width:100%;max-width:18.5rem}
.gmail-inbox-search .gmail-searchbar{min-height:2.18rem!important;border-radius:.66rem!important;flex:1;padding-left:.72rem!important;padding-right:.72rem!important}
.gmail-inbox-search .field{min-height:2.18rem!important;padding-top:.26rem!important;padding-bottom:.26rem!important;font-size:.75rem!important}
.gmail-inbox-search .btn-secondary,.gmail-inbox-search .btn-primary{min-height:2.18rem!important;padding:.32rem .64rem!important}
.gmail-dest-form .field,.gmail-dest-form .select{min-height:2.08rem!important;padding:.28rem .66rem!important;font-size:.76rem!important}
.gmail-dest-form .btn-primary{min-height:2.08rem!important;padding:.3rem .68rem!important}
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
  .gmail-user-card-head{flex-direction:column;align-items:flex-start}
  .gmail-user-card-metrics{justify-content:flex-start}
  .gmail-user-card-grid{grid-template-columns:minmax(0,1fr)}
  .gmail-config-card{grid-template-columns:minmax(0,1fr)}
  .gmail-config-card-control{justify-content:stretch;flex-direction:column;align-items:stretch}
  .gmail-user-brand{grid-template-columns:minmax(0,1fr)}
  .gmail-user-stats{justify-content:flex-start}
}
.bg-gray-950{background:var(--bg-page)!important}
.bg-gray-950/80{background:var(--bg-overlay)!important}
.bg-gray-950/60,.bg-gray-900,.bg-gray-900/60,.bg-gray-900/40,.bg-gray-900/80,.bg-gray-800{background:var(--bg-surface)!important}
.bg-gray-700{background:var(--bg-muted)!important}
.bg-gray-600{background:#dde3ea!important}
.hover:bg-gray-900/70:hover,.hover:bg-gray-800:hover,.hover:bg-gray-700:hover,.hover:bg-gray-600:hover{background:var(--bg-muted)!important}
.text-white,.text-gray-200,.text-gray-300{color:var(--text-strong)!important}
.text-gray-400{color:var(--text-muted)!important}
.text-gray-500,.text-gray-600{color:var(--text-soft)!important}
.hover:text-white:hover,.hover:text-gray-300:hover{color:var(--text-strong)!important}
.border-gray-900,.border-gray-800,.border-gray-700,.border-gray-600{border-color:var(--border-subtle)!important}
.divide-gray-800>:not([hidden])~:not([hidden]),.divide-gray-700>:not([hidden])~:not([hidden]){border-color:var(--border-subtle)!important}
.bg-emerald-600,.bg-emerald-500{background:var(--accent-primary)!important}
.bg-emerald-950/40,.bg-emerald-600/20,.bg-emerald-900/20,.bg-emerald-900/30{background:var(--accent-soft)!important}
.border-l-emerald-500{border-left-color:var(--accent-primary)!important}
.hover:bg-emerald-600:hover,.hover:bg-emerald-500:hover{background:var(--accent-primary-hover)!important}
.hover:bg-emerald-600/40:hover{background:rgba(11,87,208,.18)!important}
.text-emerald-500,.text-emerald-400,.text-emerald-300,.text-emerald-200{color:var(--accent-primary)!important}
.border-emerald-400,.border-emerald-500,.border-emerald-500/40,.border-emerald-500/50,.border-emerald-700/50,.border-emerald-800{border-color:var(--accent-soft-border)!important}
.focus:border-emerald-500:focus{border-color:var(--accent-primary)!important}
.focus:ring-emerald-500:focus{box-shadow:0 0 0 3px rgba(11,87,208,.12)!important}
.bg-blue-600{background:var(--accent-link)!important}
.bg-blue-600/20,.bg-blue-900/20{background:var(--info-surface)!important}
.hover:bg-blue-600/40:hover,.hover:bg-blue-500:hover{background:rgba(11,87,208,.18)!important}
.text-blue-300{color:var(--accent-link)!important}
.border-blue-500/40,.border-blue-700/50{border-color:var(--info-border)!important}
.bg-rose-900/50,.bg-rose-900/30{background:var(--danger-surface)!important}
.hover:bg-rose-900/80:hover{background:color-mix(in srgb,var(--danger-surface) 60%,var(--danger) 40%)!important}
.bg-rose-600{background:var(--danger)!important}
.text-rose-400,.text-rose-300,.text-rose-200{color:var(--danger)!important}
.hover:text-rose-300:hover{color:var(--danger-hover)!important}
.border-rose-800,.border-rose-900/70{border-color:var(--danger-border)!important}
.focus:ring-rose-500:focus{box-shadow:0 0 0 3px rgba(194,65,12,.12)!important}
.bg-amber-900/20,.bg-amber-900/30,.bg-amber-900/40{background:var(--warning-surface)!important}
.text-amber-300,.text-amber-200{color:var(--warning)!important}
.border-amber-800,.border-amber-700,.border-amber-700/50{border-color:var(--warning-border)!important}
input,select,textarea{background:var(--bg-surface)!important;color:var(--text-strong)!important;border-color:var(--border-strong)!important}
input:focus,select:focus,textarea:focus{border-color:var(--accent-link)!important;box-shadow:0 0 0 3px rgba(11,87,208,.12)!important}
input::placeholder,textarea::placeholder{color:var(--text-soft)!important}
button.bg-gray-800,button.bg-gray-700,.theme-toggle{background:var(--bg-surface)!important;color:var(--text-muted)!important;border-color:var(--border-strong)!important}
button.hover:bg-gray-700:hover,button.hover:bg-gray-600:hover,.theme-toggle:hover{background:var(--bg-muted)!important;color:var(--text-strong)!important;border-color:var(--border-strong)!important}
button.text-gray-400:hover{background:transparent!important;color:var(--text-strong)!important}
@media (max-width:1023px){
  .detail-panel{border-left:0;border-top:1px solid var(--border-subtle)}
  .gmail-app-chrome{padding:12px 12px 16px}
  .gmail-section-shell{padding:12px 12px 16px}
  .gmail-mail-main{grid-template-columns:minmax(0,1fr)}
  .gmail-mail-side{flex-direction:row;align-items:center;justify-content:space-between;min-width:0;padding-left:0}
}
.gmail-inbox-head-line{display:flex;align-items:center;justify-content:flex-start;gap:.52rem .72rem;flex-wrap:wrap;min-width:0;width:100%}
.gmail-inbox-search{max-width:18.5rem;margin-left:0}
.qq-mail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.62rem;flex-wrap:wrap;padding:.34rem .62rem;border-bottom:1px solid #e6ebf1;background:#f8fafc}
.qq-mail-toolbar-main,.qq-mail-toolbar-side{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;min-width:0}
.qq-mail-toolbar-side{margin-left:auto}
.qq-mail-toolbar-count{font-size:.68rem;color:#687281}
.qq-mail-toolbar-count strong{color:var(--text-strong);font-weight:700}
.qq-mail-pager{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.42rem .75rem;border-top:1px solid #e8edf3;background:#fafbfd}
.qq-mail-page-indicator{font-size:.72rem;color:#5f6b7a;white-space:nowrap}
.qq-mail-check-wrap{display:inline-flex;align-items:center;gap:.36rem;font-size:.69rem;font-weight:600;color:#344054;white-space:nowrap}
.qq-mail-check-wrap input{width:.95rem;height:.95rem;accent-color:var(--accent-primary);cursor:pointer}
.qq-toolbar-btn[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none}
.inbox-reading #inbox-list-panel{display:none!important}
.inbox-reading #inbox-detail{display:flex!important;border-left:0!important}
.inbox-reading #inbox-layout{grid-template-columns:minmax(0,1fr)!important}
.qq-mail-table{display:flex;flex-direction:column;min-height:100%;background:#fff;border-top:1px solid #edf1f5}
.qq-mail-head,.qq-mail-row{display:grid;grid-template-columns:34px minmax(72px,.56fr) minmax(0,3.85fr) minmax(98px,1fr) auto;gap:.62rem;align-items:center;padding:0 .7rem}
.qq-mail-head{min-height:1.84rem;border-bottom:1px solid #eceff3;background:#f8f9fb;font-size:.65rem;font-weight:700;letter-spacing:.01em;color:#8a9097}
.qq-mail-row{min-height:2.62rem;border-bottom:1px solid #edf0f3;cursor:pointer;transition:background-color .16s ease,border-color .16s ease}
.qq-mail-row:last-child{border-bottom:0}
.qq-mail-row:hover{background:#f6f8fb}
.qq-mail-row.list-row-selected{background:#eef2f7;box-shadow:none}
.qq-mail-row.list-row-unread{background:#fff}
.qq-mail-row.list-row-read{background:#fff}
.qq-mail-checkbox{display:flex;align-items:center;justify-content:center}
.qq-mail-checkbox input{width:.95rem;height:.95rem;accent-color:var(--accent-primary);cursor:pointer}
.qq-mail-head .qq-mail-checkbox{justify-content:center}
.qq-mail-head-select{display:inline-flex;align-items:center;justify-content:flex-start}
.qq-mail-sort{display:inline-flex;align-items:center;gap:.2rem;border:0;background:transparent;padding:0;color:inherit;font:inherit;cursor:pointer}
.qq-mail-sort:hover{color:#556170}
.qq-mail-sort-active{color:#475569}
.qq-mail-sort-arrow{font-size:.62rem;line-height:1;opacity:.95}
.qq-mail-sender,.qq-mail-alias,.qq-mail-time{font-size:.72rem;color:#3c4043;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qq-mail-sender{font-weight:560;color:#2f3845}
.qq-mail-summary{min-width:0;display:flex;align-items:center;gap:.34rem}
.qq-mail-subject{font-size:.75rem;color:#27313d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.34;letter-spacing:.003em;flex:none;max-width:52%}
.qq-mail-preview{font-size:.71rem;color:#98a2af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.34;min-width:0;flex:1}
.qq-mail-divider{color:#d4d9e0;flex:none}
.qq-mail-alias{color:#7b8794;padding-left:.78rem}
.qq-col-alias{padding-left:.78rem}
.qq-col-time{display:flex;align-items:center;justify-content:flex-start;min-width:0}
.qq-mail-timebox{display:flex;align-items:center;justify-content:space-between;min-width:0;gap:.35rem}
.qq-col-time{display:flex;align-items:center;justify-content:flex-start;min-width:0;padding-right:3.2rem}
.qq-col-time button{text-align:left}

.qq-mail-time{transition:opacity .14s ease,visibility .14s ease;color:#566273;font-weight:600;text-align:left;padding-right:.15rem}
.qq-mail-delete{margin-left:auto;opacity:0;visibility:hidden;border:0;background:transparent;color:#7e8896;padding:.18rem .36rem;border-radius:.36rem;font-size:.66rem;font-weight:600;transition:opacity .16s ease,background-color .16s ease,color .16s ease,visibility .16s ease;white-space:nowrap}
.qq-mail-delete:hover{background:#edf1f5;color:#2f3845}
.qq-mail-row:hover .qq-mail-delete,.qq-mail-row.list-row-selected .qq-mail-delete{opacity:1;visibility:visible}

.qq-mail-row.list-row-unread .qq-mail-sender,.qq-mail-row.list-row-unread .qq-mail-subject{font-weight:620;color:#1f2937}
.qq-mail-row.list-row-read .qq-mail-sender{font-weight:500;color:#3c4043}
.qq-mail-row.list-row-read .qq-mail-subject{font-weight:520;color:#33404d}
.qq-mail-row.list-row-read .qq-mail-preview{color:#9aa3af}
.qq-mail-empty{padding:1.3rem 1rem}
.qq-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:.72rem .88rem;border-bottom:1px solid #e8edf3;background:#f8fafc}
.qq-detail-actions{display:flex;align-items:center;gap:.38rem;flex-wrap:wrap}
.qq-detail-main{min-width:0;display:flex;flex-direction:column;gap:.44rem;flex:1}
.qq-detail-topline{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap}
.qq-detail-back{min-height:2rem!important;padding:.34rem .64rem!important;font-size:.72rem!important}
.qq-detail-action-btn{min-height:2rem!important;padding:.32rem .58rem!important;font-size:.7rem!important}
.qq-detail-title{font-size:.95rem;font-weight:560;color:#1f2937;line-height:1.45;word-break:break-word}
.qq-detail-meta-row{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.qq-detail-sender{display:flex;align-items:center;gap:.62rem;min-width:0}
.qq-detail-avatar{width:2rem;height:2rem;border-radius:999px;background:#eef3fb;color:#365e91;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;flex:none}
.qq-detail-sender-name{font-size:.75rem;font-weight:560;color:#2f3845;line-height:1.32}
.qq-detail-sender-sub{font-size:.7rem;color:#8791a0;line-height:1.45}
.qq-detail-meta{display:flex;align-items:center;gap:.45rem 1rem;flex-wrap:wrap;justify-content:flex-end;font-size:.7rem;color:#6f7b8b}
.qq-detail-stat{display:inline-flex;align-items:center;gap:.28rem;padding:.16rem .46rem;border-radius:999px;background:#eef2f7;color:#445264;font-weight:600}
.qq-detail-body{flex:1;overflow:auto;background:#f6f8fb;padding:.82rem .88rem .96rem}
.qq-detail-body-surface{background:#fff;border:1px solid #e8edf3;border-radius:.44rem;padding:.88rem .92rem .94rem}
.qq-detail-attachments{border-top:1px solid #e8edf3;background:#f8fafc;padding:.78rem .88rem .92rem}
.qq-detail-attachments .gmail-attach-card{border-radius:.34rem;background:#fff;padding:.64rem .72rem}
@media (max-width:1023px){
  .gmail-inbox-head-line{align-items:stretch}
  .gmail-inbox-search{max-width:none}
  .qq-mail-head,.qq-mail-row{grid-template-columns:34px minmax(88px,.42fr) minmax(0,1fr) auto}
  .qq-mail-head .qq-col-alias,.qq-mail-row .qq-mail-alias{display:none}
  .qq-mail-summary .qq-mail-preview,.qq-mail-summary .qq-mail-divider{display:none}
  .qq-mail-summary .qq-mail-preview,.qq-mail-summary .qq-mail-divider{display:none}
  .qq-detail-head{padding:.64rem .72rem}
  .qq-detail-body{padding:.72rem}
  .qq-detail-attachments{padding:.7rem .72rem .84rem}
}
  .gmail-inbox-search{max-width:none}

  .qq-mail-head .qq-col-alias,.qq-mail-row .qq-mail-alias{display:none}
  .qq-detail-head{padding:.64rem .72rem}
  .qq-detail-body{padding:.72rem}
  .qq-detail-attachments{padding:.7rem .72rem .84rem}
}

    #booting-panel.hidden,#auth-panel.hidden,#login-panel.hidden,#dashboard-panel.hidden{display:none!important}</style>`, "renderSharedThemeStyle");
var renderSharedThemeRuntimeScript = /* @__PURE__ */ __name(() => `<script>
function themePreferenceValue(){
    return 'light';
}
function getStoredThemePreference(){
    return 'light';
}
function updateThemeToggleLabel(){
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '\u4E3B\u9898\uFF1A\u6D45\u8272';
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
<\/script>`, "renderSharedThemeRuntimeScript");
var renderPostThemeOverrides = /* @__PURE__ */ __name(() => `<style>
.app-shell,.surface-page,body.bg-gray-950,body.bg-gray-900{background:var(--bg-page)!important;color:var(--text-strong)!important}
#booting-panel,#auth-panel,#login-panel,#dashboard-panel{background:var(--bg-surface)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-panel)!important}
#dashboard-panel{border-radius:var(--radius-shell)!important;box-shadow:none!important}
#dashboard-panel>.bg-gray-900/80,#dashboard-panel>.bg-gray-950,#dashboard-panel>.bg-gray-900{background:rgba(255,255,255,.92)!important;border-color:var(--border-subtle)!important;backdrop-filter:blur(10px)}
.dashboard-nav,.settings-nav,#nav-domains,#nav-settings,#nav-invites,#nav-users{background:transparent!important;color:var(--text-muted)!important;border-color:transparent!important}
.dashboard-nav:hover,.settings-nav:hover,#nav-domains:hover,#nav-settings:hover,#nav-invites:hover,#nav-users:hover{color:var(--text-strong)!important;background:#edf1f4!important;border-color:transparent!important}
.dashboard-nav.bg-gray-800,.settings-nav.text-emerald-300,#nav-domains.text-emerald-400,#nav-invites.text-emerald-400,#nav-users.text-emerald-400{color:var(--accent-primary)!important}
.dashboard-nav.bg-gray-800,.dashboard-nav.nav-link-active,.settings-nav.border-emerald-400,.settings-nav.tab-link-active,#nav-domains.text-emerald-400,#nav-invites.text-emerald-400,#nav-users.text-emerald-400{background:#e8f0fe!important;border-color:transparent!important}
.admin-nav{display:inline-flex;align-items:center;justify-content:center;padding:.72rem 1rem;border:1px solid transparent;border-radius:.78rem;color:var(--text-muted)!important;background:transparent!important;font-weight:600;min-height:2.65rem}
.admin-nav:hover{background:#edf1f4!important;color:var(--text-strong)!important;border-color:transparent!important}
.admin-nav-active{background:#fff!important;border-color:#d7e3fc!important;color:var(--accent-primary)!important;box-shadow:0 1px 2px rgba(15,23,42,.06),0 6px 16px rgba(66,133,244,.16)!important}
#route-create-modal,#route-edit-modal{background:var(--bg-overlay)!important}
#route-create-modal>div>div,#route-edit-modal>div>div{background:var(--bg-surface)!important;border-color:var(--border-subtle)!important;border-radius:.72rem!important;box-shadow:0 14px 28px rgba(60,64,67,.12)!important}
#inbox-layout,#inbox-list-panel,#inbox-detail{background:transparent!important}
#inbox-list-panel{background:var(--bg-surface)!important;border-right:1px solid var(--border-subtle)!important;box-shadow:none!important}
#inbox-detail{background:var(--bg-surface)!important;color:var(--text-muted)!important;border-left:1px solid var(--border-subtle)!important;box-shadow:none!important}
#inbox-detail .bg-gray-950,#inbox-detail .bg-gray-950/80{background:var(--bg-muted)!important}
#inbox-list,#destination-list,#route-list{background:var(--bg-surface)!important}
#route-list>div,#destination-list>div{background:transparent!important}
#route-list>div:hover,#destination-list>div:hover{background:var(--bg-muted)!important}
#route-list.divide-y>div,#destination-list.divide-y>div,#inbox-list.divide-y>div,.divide-gray-800>div,.divide-gray-700>div{border-color:var(--border-subtle)!important}
#dashboard-section-routes .bg-gray-900/60,#dashboard-section-security .bg-gray-900/60,#dashboard-section-security .bg-gray-950/60,#dashboard-section-routes .bg-gray-950/60,.bg-gray-900/40{background:var(--bg-surface)!important;border-color:var(--border-subtle)!important;box-shadow:none!important}
#dashboard-section-routes,#dashboard-section-inbox,#dashboard-section-security,#dashboard-section-inbox>div,main.bg-gray-950{background:transparent!important}
#dashboard-section-security .border-b,#dashboard-section-routes .border-b,#dashboard-section-inbox .border-b,#dashboard-section-inbox .border-t,.border-gray-800,.border-gray-700,.border-gray-600{border-color:var(--border-subtle)!important}
#dashboard-section-security .text-white,#dashboard-section-routes .text-white,#dashboard-section-inbox .text-white,.text-white{color:var(--text-strong)!important}
#dashboard-section-security .text-gray-400,#dashboard-section-routes .text-gray-400,#dashboard-section-inbox .text-gray-400,.text-gray-400{color:var(--text-muted)!important}
#dashboard-section-security .text-gray-500,#dashboard-section-routes .text-gray-500,#dashboard-section-inbox .text-gray-500,.text-gray-500,.text-gray-600{color:var(--text-soft)!important}
#dashboard-section-security .bg-rose-900/50,#dashboard-section-routes .bg-rose-900/50,#dashboard-section-inbox .bg-rose-900/50{background:var(--danger-surface)!important;border-color:var(--danger-border)!important;color:var(--danger)!important}
#dashboard-section-security .bg-blue-600/20,#dashboard-section-routes .bg-blue-600/20,#dashboard-section-inbox .bg-blue-600/20{background:var(--info-surface)!important;border-color:var(--info-border)!important;color:var(--info)!important}
#dashboard-section-security .bg-emerald-600/20,#dashboard-section-routes .bg-emerald-600/20,#dashboard-section-inbox .bg-emerald-600/20{background:var(--accent-soft)!important;border-color:var(--accent-soft-border)!important;color:var(--accent-primary)!important}
.table-shell,.overflow-x-auto.border.border-gray-700.rounded-xl{border-color:var(--border-subtle)!important;background:var(--bg-surface)!important;box-shadow:none!important;border-radius:.64rem!important}
thead.bg-gray-900,thead.bg-gray-900/80{background:var(--bg-muted)!important;color:var(--text-muted)!important;border-color:var(--border-subtle)!important}
tbody.divide-y.divide-gray-700>tr,tbody.divide-y.divide-gray-800>tr{border-color:var(--border-subtle)!important}
.hover:bg-gray-800:hover{background:var(--bg-muted)!important}
</style>`, "renderPostThemeOverrides");
var renderUserHTML = /* @__PURE__ */ __name((sitekey, bypassTurnstile = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\u4E91\u7AEF\u90AE\u4EF6\u8DEF\u7531\u7CFB\u7EDF</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    ${bypassTurnstile ? "" : '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer><\/script>'}
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
.gmail-sidebar-section-label{font-size:.66rem!important;font-weight:700!important;color:#7b8796!important;letter-spacing:.05em!important;text-transform:uppercase!important;padding:10px 14px 4px!important}
aside .dashboard-nav{position:relative!important;width:100%!important;padding:10px 14px!important;border:0!important;background:transparent!important;color:#4f5b69!important;font-weight:600!important;justify-content:flex-start!important;border-radius:.58rem!important}
aside .dashboard-nav:hover{background:#f3f6fa!important;color:#253142!important}
aside .dashboard-nav.bg-gray-800,aside .dashboard-nav.bg-gray-800:hover{background:linear-gradient(180deg,#edf4ff 0%,#e4eefc 100%)!important;color:#1d5fbf!important;box-shadow:inset 0 0 0 1px #d7e6ff!important}
aside .dashboard-nav.bg-gray-800::after{display:none!important}
.md:hidden .dashboard-nav.bg-gray-800{border-bottom:0!important}
.dashboard-nav{background:transparent!important;border:1px solid transparent!important;color:var(--text-muted)!important;border-radius:var(--radius-pill)!important;box-shadow:none!important}
.dashboard-nav:hover{background:#f1f3f4!important;color:var(--text-strong)!important;border-color:transparent!important}
.dashboard-nav.bg-gray-800,.dashboard-nav.nav-link-active,.dashboard-nav.bg-gray-800:hover{background:#e8f0fe!important;color:#174ea6!important;border:1px solid transparent!important}
.settings-nav.text-emerald-300{color:var(--accent-primary)!important}
.settings-nav.border-emerald-400{border-color:transparent!important}
button.text-emerald-400.border-emerald-400{color:var(--accent-primary)!important;border-color:var(--accent-primary)!important}
main.bg-gray-950,#dashboard-section-security,#dashboard-section-routes,#dashboard-section-inbox,#dashboard-section-inbox>div{background:transparent!important}
#inbox-detail .bg-gray-950/80{background:#f8fafd!important}
.gmail-user-nav.flex-col{gap:.18rem!important;padding:.08rem 0!important}
.gmail-user-nav.flex-col .dashboard-nav{border-radius:0 999px 999px 0!important}
.md:hidden .gmail-user-nav{display:inline-flex!important;gap:.26rem!important;padding:.22rem!important;background:#f1f3f4!important;border-radius:.78rem!important;border:1px solid #e7ebef!important}
.md:hidden .gmail-user-nav .dashboard-nav{min-height:2.14rem!important;padding:.5rem .78rem!important;font-size:.73rem!important;border-radius:.7rem!important}
.md:hidden .gmail-user-nav .dashboard-nav.bg-gray-800{box-shadow:none!important}
.gmail-toolbar-card .gmail-searchbar{background:#f1f3f4!important;border-color:#e3e8ef!important;border-radius:.78rem!important;min-height:42px!important;box-shadow:none!important}
.gmail-toolbar-card .gmail-searchbar:hover{background:#eef2f5!important;border-color:#dde4ee!important}
.gmail-toolbar-card .gmail-searchbar:focus-within{background:#fff!important;border-color:#d2d9e4!important;box-shadow:0 1px 2px rgba(60,64,67,.035),0 3px 8px rgba(60,64,67,.045)!important}
.gmail-list-stage .gmail-list-shell{background:transparent!important}
.gmail-toolbar-card{padding:.62rem .88rem!important}
.gmail-panel-header{padding-left:1.05rem!important;padding-right:1.05rem!important}
.gmail-section-frame .panel-header{background:transparent!important;border-bottom:0!important;padding:0!important}
.gmail-sidebar-shell .gmail-user-nav{padding:.04rem 0!important;gap:.08rem!important}
.gmail-sidebar-shell .dashboard-nav{min-height:2.62rem!important;padding:.64rem .86rem!important;font-size:.8rem!important;border-radius:.58rem!important}
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
.gmail-sidebar-cta{min-height:48px!important;border-radius:.64rem!important;padding:.72rem .88rem!important;box-shadow:0 1px 2px rgba(47,126,244,.18),0 4px 10px rgba(47,126,244,.16)!important}
.gmail-sidebar-shell{padding:.04rem 0 0!important}
.gmail-workspace-shell,.gmail-inbox-shell,.gmail-admin-stack,.gmail-admin-list{border-radius:.66rem!important}
.gmail-workspace-head{padding-top:.9rem!important;padding-bottom:.64rem!important}
.gmail-searchbar{min-height:42px!important;border-radius:.78rem!important}
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
.rounded-[1rem]{border-radius:.62rem!important}
.shadow-2xl,.shadow-lg{box-shadow:0 6px 16px rgba(60,64,67,.07)!important}
.text-emerald-300.font-mono{color:var(--accent-primary)!important}
.text-rose-300{color:var(--danger)!important}
.min-h-[160px]{border-radius:.56rem;background:#f8fafd}
    
    #booting-panel.hidden,#auth-panel.hidden,#login-panel.hidden,#dashboard-panel.hidden{display:none!important}</style>

</head>
<body class="app-shell font-sans min-h-screen overflow-hidden">
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2"></div>

    <div id="booting-panel" class="hidden surface-card fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 text-center text-muted fade-in">
        <div class="auth-shell-head items-center text-center mb-0">
            <span class="auth-shell-badge">Cloud Mail</span>
            <div class="text-strong text-lg font-semibold">\u6B63\u5728\u68C0\u67E5\u767B\u5F55\u72B6\u6001</div>
            <div class="auth-shell-copy">\u6B63\u5728\u6062\u590D\u4F60\u7684\u6536\u4EF6\u7BB1\u3001\u90AE\u7BB1\u522B\u540D\u548C\u8D26\u6237\u8BBE\u7F6E\u3002</div>
        </div>
    </div>

    <div id="auth-panel" class="surface-card hidden fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 p-6 fade-in">
        <div class="auth-shell-head mx-auto">
            <span class="auth-shell-badge">Cloud Mail</span>
            <div class="text-strong text-xl font-semibold">\u6B22\u8FCE\u56DE\u6765</div>
            <div class="auth-shell-copy">\u7528\u66F4\u63A5\u8FD1\u90AE\u7BB1\u5BA2\u6237\u7AEF\u7684\u65B9\u5F0F\u7BA1\u7406\u7AD9\u5185\u6536\u4EF6\u7BB1\u3001\u90AE\u7BB1\u522B\u540D\u548C\u8D26\u6237\u5B89\u5168\u8BBE\u7F6E\u3002</div>
        </div>
        <div class="auth-shell-tabs">
            <button type="button" class="auth-tab auth-tab-active w-1/2 text-center" id="tab-login" onclick="switchTab('login')">\u7528\u6237\u767B\u5F55</button>
            <button type="button" class="auth-tab w-1/2 text-center" id="tab-register" onclick="switchTab('register')">\u6CE8\u518C\u8D26\u6237</button>
        </div>
        <form id="auth-form" onsubmit="handleAuth(event)" class="space-y-3">
            <input type="text" id="username" class="field" placeholder="\u7528\u6237\u540D" required>
            <input type="password" id="password" class="field" placeholder="\u5BC6\u7801" required>
            <div id="invite-wrap" class="hidden">
                <input type="text" id="invite-code" class="field" placeholder="\u9080\u8BF7\u7801">
            </div>
            '<div class="cf-turnstile flex justify-center py-2" data-sitekey="' + sitekey + '"></div>'
            <button type="submit" id="submit-btn" class="btn-primary w-full justify-center font-medium active:scale-[0.99]">\u767B\u5F55</button>
        </form>
    </div>

    <div id="dashboard-panel" class="hidden app-shell w-full h-screen overflow-hidden fade-in flex flex-col">
      <div class="topbar px-3 md:px-5 pt-3 md:pt-4">
           <div class="flex flex-col md:flex-row justify-between gap-2 md:ml-0 px-1 md:px-0">
                <div>
                    <h2 class="gmail-user-title"><span class="w-2.5 h-2.5 rounded-full status-dot"></span>\u4E91\u7AEF\u6536\u4EF6\u7BB1</h2>
                </div>
            </div>
      </div>
        <div class="md:hidden overflow-x-auto px-3 md:px-5 pt-3">
            <div class="gmail-mobile-nav-shell">
            <div class="gmail-user-nav gmail-mobile-nav min-w-max mx-auto md:mx-0">
                <button type="button" data-dashboard-section="inbox" onclick="switchDashboardSection('inbox')" class="dashboard-nav gmail-nav-pill nav-link px-3 py-1.5 text-xs whitespace-nowrap"><span class="gmail-nav-dot"></span><span>\u7AD9\u5185\u6536\u4EF6\u7BB1</span></button>
                <button type="button" data-dashboard-section="routes" onclick="switchDashboardSection('routes')" class="dashboard-nav gmail-nav-pill nav-link px-3 py-1.5 text-xs whitespace-nowrap"><span class="gmail-nav-dot"></span><span>\u90AE\u7BB1\u522B\u540D</span></button>
                <button type="button" data-dashboard-section="security" onclick="switchDashboardSection('security')" class="dashboard-nav gmail-nav-pill nav-link px-3 py-1.5 text-xs whitespace-nowrap"><span class="gmail-nav-dot"></span><span>\u8BBE\u7F6E</span></button>
            </div>
            </div>
        </div>
        <div class="flex flex-1 min-h-0 gap-0 px-3 md:px-5 pb-4 md:pb-5 pt-2 md:pt-3">
           <aside class="sidebar hidden md:flex w-60 shrink-0 flex-col gap-3">
                <button type="button" onclick="switchDashboardSection('routes'); openRouteCreate();" class="gmail-sidebar-cta">
                    <span class="gmail-sidebar-cta-mark">+</span>
                    <span>\u65B0\u5EFA\u522B\u540D</span>
                </button>
                <div class="gmail-sidebar-shell flex flex-col gap-1">
                <div class="gmail-sidebar-section-label">\u5DE5\u4F5C\u533A</div>
                <div class="gmail-user-nav gmail-sidebar-nav flex-col items-stretch bg-transparent border-0 shadow-none w-full max-w-none">
                    <button type="button" data-dashboard-section="inbox" onclick="switchDashboardSection('inbox')" class="dashboard-nav gmail-nav-pill nav-link text-left px-3 py-2 text-sm"><span class="gmail-nav-dot"></span><span>\u7AD9\u5185\u6536\u4EF6\u7BB1</span></button>
                    <button type="button" data-dashboard-section="routes" onclick="switchDashboardSection('routes')" class="dashboard-nav gmail-nav-pill nav-link text-left px-3 py-2 text-sm"><span class="gmail-nav-dot"></span><span>\u90AE\u7BB1\u522B\u540D</span></button>
                    <button type="button" data-dashboard-section="security" onclick="switchDashboardSection('security')" class="dashboard-nav gmail-nav-pill nav-link text-left px-3 py-2 text-sm"><span class="gmail-nav-dot"></span><span>\u8BBE\u7F6E</span></button>
               </div>
               </div>
                <div class="sidebar-footer mt-auto flex flex-col gap-2 px-2 pb-2">
                    <div class="gmail-user-stats flex gap-1">
                        <span id="dashboard-route-summary" class="gmail-user-stat flex-1 flex flex-col items-center"><strong style="font-size:.66rem;color:var(--text-muted)">\u90AE\u7BB1\u522B\u540D</strong><span>0 / 0</span></span>
                        <span id="dashboard-dest-summary" class="gmail-user-stat flex-1 flex flex-col items-center"><strong style="font-size:.66rem;color:var(--text-muted)">\u8F6C\u53D1\u90AE\u7BB1</strong><span>0 / 0</span></span>
                    </div>
                    <button onclick="logout()" class="btn-secondary text-xs w-full justify-center">\u9000\u51FA\u767B\u5F55</button>
                </div>
           </aside>
            <main class="content-area flex-1 min-w-0 overflow-hidden surface-card" style="border-radius:0">
            <section id="dashboard-section-routes" class="dashboard-section hidden h-full overflow-y-auto">
            <div class="gmail-section-shell">
                <div class="gmail-workspace-shell">
                <div class="gmail-workspace-head px-4 md:px-5 pt-4 md:pt-5 pb-3 bg-white">
                    <div id="route-quota" class="section-subtitle"></div>
                        <button type="button" id="route-create-open-btn" onclick="openRouteCreate()" class="btn-primary self-start sm:self-center text-sm whitespace-nowrap">\u65B0\u5EFA\u522B\u540D</button>
                </div>
                <div class="gmail-toolbar-card gmail-toolbar-card-quiet">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div class="gmail-searchbar sm:flex-1">
                            <svg class="gmail-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <path d="M8.75 3.5a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 0 0 0-10.5Zm0 0l6.75 6.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="route-search" class="field w-full min-w-0" placeholder="\u641C\u7D22\u522B\u540D / \u5907\u6CE8 / \u8F6C\u53D1\u90AE\u7BB1">
                        </div>
                        <button type="button" id="route-search-clear" class="btn-secondary text-xs whitespace-nowrap">\u6E05\u7A7A</button>
                        <div id="route-search-count" class="text-xs text-soft sm:text-right sm:min-w-[120px]">0 / 0 \u6761\u7ED3\u679C</div>
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
                                <h4 class="gmail-dialog-title">\u521B\u5EFA\u90AE\u7BB1\u522B\u540D</h4>
                                <p class="gmail-dialog-copy mt-1">\u9009\u62E9\u57DF\u540D\u3001\u6709\u6548\u671F\u548C\u6295\u9012\u65B9\u5F0F\u3002</p>
                            </div>
                            <button type="button" onclick="closeRouteCreate()" class="overlay-close text-xl leading-none">\xD7</button>
                        </div>
                        <form onsubmit="handleRoute(event)" class="gmail-dialog-body">
                            <div class="split-field shadow-sm">
                                <input type="text" id="route-prefix" class="field w-1/2 min-w-[120px]" placeholder="\u524D\u7F00\uFF0C\u5982 admin" required>
                                <span class="split-addon text-sm">@</span>
                                <select id="route-domain" class="select w-1/2 min-w-0"></select>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <select id="route-duration" class="select min-w-0"></select>
                                <select id="route-delivery-mode" class="select min-w-0">
                                    <option value="inbox_only">\u4EC5\u7AD9\u5185\u6536\u4EF6\u7BB1</option>
                                    <option value="inbox_forward">\u7AD9\u5185\u6536\u4EF6\u7BB1 + \u4FDD\u5E95\u8F6C\u53D1</option>
                                    <option value="forward_only">\u4EC5\u8F6C\u53D1\u5230\u90AE\u7BB1</option>
                                </select>
                            </div>
                            <select id="route-destination" class="select w-full min-w-0"></select>
                            <input type="text" id="route-remark" maxlength="100" class="field w-full min-w-0" placeholder="\u7528\u9014\u5907\u6CE8\uFF08\u53EF\u9009\uFF09">
                            <div class="gmail-dialog-actions sm:flex-row sm:justify-end sm:items-center">
                                <button type="button" onclick="closeRouteCreate()" class="btn-secondary text-sm">\u53D6\u6D88</button>
                                <button type="submit" id="route-btn" class="btn-primary text-sm whitespace-nowrap">\u521B\u5EFA</button>
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
                                <h4 class="gmail-dialog-title">\u7F16\u8F91\u90AE\u7BB1\u522B\u540D</h4>
                                <p id="edit-route-address" class="gmail-dialog-address mt-1"></p>
                            </div>
                            <button type="button" onclick="closeRouteEdit()" class="overlay-close text-xl leading-none">\xD7</button>
                        </div>
                        <form onsubmit="saveRouteEdit(event)" class="gmail-dialog-body">
                            <input type="hidden" id="edit-route-id">
                            <label class="gmail-dialog-field">
                                <span class="gmail-dialog-field-label">\u6295\u9012\u65B9\u5F0F</span>
                                <select id="edit-route-delivery-mode" onchange="toggleRouteEditTarget()" class="select w-full min-w-0">
                                    <option value="inbox_only">\u4EC5\u7AD9\u5185\u6536\u4EF6\u7BB1</option>
                                    <option value="inbox_forward">\u7AD9\u5185\u6536\u4EF6\u7BB1 + \u4FDD\u5E95\u8F6C\u53D1</option>
                                    <option value="forward_only">\u4EC5\u8F6C\u53D1\u5230\u90AE\u7BB1</option>
                                </select>
                            </label>
                            <label id="edit-route-destination-wrap" class="gmail-dialog-field">
                                <span class="gmail-dialog-field-label">\u76EE\u6807\u90AE\u7BB1</span>
                                <select id="edit-route-destination" class="select w-full min-w-0"></select>
                                <span id="edit-route-destination-empty" class="hidden mt-1 text-xs text-rose-300">\u6CA1\u6709\u53EF\u7528\u8F6C\u53D1\u90AE\u7BB1\uFF0C\u8BF7\u5148\u5230\u8BBE\u7F6E\u91CC\u6DFB\u52A0\u5E76\u9A8C\u8BC1\u90AE\u7BB1\u3002</span>
                            </label>
                            <label class="gmail-dialog-field">
                                <span class="gmail-dialog-field-label">\u7528\u9014\u5907\u6CE8</span>
                                <input type="text" id="edit-route-remark" maxlength="100" class="field w-full min-w-0" placeholder="\u7528\u9014\u5907\u6CE8\uFF08\u53EF\u9009\uFF09">
                            </label>
                            <div class="gmail-dialog-actions sm:flex-row sm:justify-end sm:items-center">
                                <button type="button" onclick="closeRouteEdit()" class="btn-secondary text-sm">\u53D6\u6D88</button>
                                <button type="submit" id="edit-route-save-btn" class="btn-primary text-sm whitespace-nowrap">\u4FDD\u5B58</button>
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
                        <div class="workspace-section-head gmail-inbox-head">
                            <div class="gmail-inbox-head-line">
                                <div class="gmail-inbox-head-tools">
                                    <div class="gmail-inbox-search">
                                        <div class="gmail-searchbar flex-1">
                                            <svg class="gmail-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                                <path d="M8.75 3.5a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 0 0 0-10.5Zm0 0l6.75 6.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            <input type="text" id="inbox-search" class="field" placeholder="\u641C\u7D22\u90AE\u4EF6">
                                        </div>
                                        <button type="button" onclick="performInboxSearch()" class="btn-secondary text-xs whitespace-nowrap">\u641C\u7D22</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="gmail-list-meta border-b border-slate-200 bg-[#f8fafc] px-4 py-2.5">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="text-[12px] font-semibold text-slate-700">\u6536\u4EF6\u7BB1</span>
                        </div>
                        <span id="inbox-refresh-info" class="text-[11px] text-slate-500">\u81EA\u52A8\u5237\u65B0\u5DF2\u5F00\u542F</span>
                    </div>
                    <div id="inbox-layout" class="grid grid-cols-1 gap-0 flex-1 min-h-0">
                        <div id="inbox-list-panel" class="flex flex-col min-h-0 h-full overflow-hidden">
                            <div class="qq-mail-toolbar">
                                <div class="qq-mail-toolbar-main">
                                    <span id="inbox-selected-count" class="qq-mail-toolbar-count">\u5DF2\u9009 <strong>0</strong> \u5C01</span>
                                    <button type="button" onclick="deleteCheckedInboxMails()" id="inbox-bulk-delete-btn" class="btn-secondary text-xs px-3 py-1.5 qq-toolbar-btn">\u6279\u91CF\u5220\u9664</button>
                                </div>
                                <div class="qq-mail-toolbar-side">
                                    <button type="button" onclick="refreshInboxNow()" class="btn-secondary text-xs px-3 py-1.5">\u5237\u65B0</button>
                                </div>
                            </div>
                            <div id="inbox-list" class="text-sm flex-1 min-h-0 overflow-y-auto bg-white"></div>
                            <div class="qq-mail-pager">
                                <button type="button" onclick="changeInboxPage(-1)" class="btn-secondary text-xs px-3 py-1.5">\u4E0A\u4E00\u9875</button>
                                <span id="inbox-page-info" class="qq-mail-page-indicator">\u7B2C 1 \u9875</span>
                                <button type="button" onclick="changeInboxPage(1)" class="btn-secondary text-xs px-3 py-1.5">\u4E0B\u4E00\u9875</button>
                            </div>
                        </div>
                        <div id="inbox-detail" class="hidden detail-panel min-h-0 h-full items-center justify-center text-sm text-muted">\u9009\u62E9\u4E00\u5C01\u90AE\u4EF6\u67E5\u770B\u6B63\u6587</div>
                    </div>
                </div>
            </div>
            </section>
            <section id="dashboard-section-security" class="dashboard-section hidden h-full overflow-y-auto">
            <div class="gmail-section-shell space-y-4">
                <div class="gmail-workspace-shell">
                    <div class="gmail-workspace-head px-4 md:px-5 pt-4 md:pt-5 pb-2 bg-white">
                        <div class="workspace-section-head"></div>
                    </div>
                    <div class="gmail-toolbar-card gmail-toolbar-card-quiet">
                        <div class="panel-header flex gap-2 overflow-x-auto pb-1">
                            <button type="button" data-settings-section="destinations" onclick="switchSettingsSection('destinations')" class="settings-nav tab-link shrink-0 text-sm">\u8F6C\u53D1\u90AE\u7BB1</button>
                            <button type="button" data-settings-section="security" onclick="switchSettingsSection('security')" class="settings-nav tab-link shrink-0 text-sm">\u8D26\u6237\u5B89\u5168</button>
                        </div>
                    </div>
                </div>
                <div id="settings-section-destinations" class="settings-section gmail-settings-stack max-w-5xl">
                    <div class="gmail-content-card gmail-settings-block">
                        <div class="gmail-content-body py-4">
                        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-2.5 mb-2.5">
                            <div>
                                <h4 class="text-strong font-semibold">\u6DFB\u52A0\u8F6C\u53D1\u90AE\u7BB1</h4>
                                <p class="text-xs text-soft mt-1">\u53EF\u9009\u7ED1\u5B9A\u771F\u5B9E\u90AE\u7BB1\uFF0C\u7528\u4E8E\u4FDD\u5E95\u8F6C\u53D1\u6216\u4EC5\u8F6C\u53D1\uFF1B\u4EC5\u7AD9\u5185\u6536\u4EF6\u7BB1\u6A21\u5F0F\u65E0\u9700\u6DFB\u52A0\u3002</p>
                            </div>
                            <div id="dest-summary" class="text-xs text-soft md:text-right leading-6"></div>
                        </div>
                        <form onsubmit="handleDest(event)" class="gmail-dest-form grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_132px] lg:grid-cols-[minmax(0,1fr)_132px_112px] gap-2.5 mt-3">
                            <input type="email" id="dest-email" class="field" placeholder="\u5982 real-email@qq.com" required>
                            <select id="dest-duration" class="select"></select>
                            <button type="submit" id="dest-btn" class="btn-primary text-sm md:col-span-2 lg:col-span-1">\u53D1\u9001\u9A8C\u8BC1</button>
                        </form>
                        </div>
                    </div>
                    <div class="gmail-content-card gmail-settings-block">
                        <div class="gmail-panel-header px-4 py-3">
                            <h4 class="text-strong font-semibold">\u5DF2\u7ED1\u5B9A\u90AE\u7BB1</h4>
                            <p class="text-xs text-soft mt-1">\u5DF2\u9A8C\u8BC1\u90AE\u7BB1\u53EF\u4F5C\u4E3A\u522B\u540D\u7684\u8F6C\u53D1\u76EE\u6807\uFF0C\u5F85\u9A8C\u8BC1\u90AE\u7BB1\u53EF\u5728\u5B8C\u6210\u6536\u4FE1\u786E\u8BA4\u540E\u542F\u7528\u3002</p>
                        </div>
                        <div id="destination-list" class="gmail-list-shell text-sm"></div>
                    </div>
                </div>
                <div id="settings-section-security" class="settings-section hidden gmail-settings-stack max-w-4xl">
                    <div class="gmail-content-card gmail-settings-block">
                        <div class="gmail-content-body">
                        <h4 class="text-strong font-semibold mb-1">\u4FEE\u6539\u5BC6\u7801</h4>
                        <p class="text-xs text-soft mb-4">\u5EFA\u8BAE\u5B9A\u671F\u66F4\u65B0\u5BC6\u7801\uFF0C\u907F\u514D\u4E0E\u5176\u4ED6\u7AD9\u70B9\u4F7F\u7528\u76F8\u540C\u5BC6\u7801\u3002</p>
                        <form onsubmit="changePassword(event)" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            <input type="password" id="old-password" class="field" placeholder="\u5F53\u524D\u5BC6\u7801" required>
                            <input type="password" id="new-password" class="field" placeholder="\u65B0\u5BC6\u7801" required>
                            <button type="submit" class="btn-secondary text-sm md:col-span-2">\u4FEE\u6539\u5BC6\u7801</button>
                        </form>
                        </div>
                    </div>
                    <div class="gmail-section-frame gmail-section-frame-danger p-4">
                        <h4 class="text-danger font-semibold mb-1">\u6CE8\u9500\u8D26\u6237</h4>
                        <p class="text-xs text-soft mb-4">\u6B64\u64CD\u4F5C\u4F1A\u5220\u9664\u8D26\u6237\u3001\u7AD9\u5185\u6536\u4EF6\u7BB1\u548C\u5DF2\u521B\u5EFA\u7684\u90AE\u7BB1\u522B\u540D\uFF0C\u4E14\u65E0\u6CD5\u6062\u590D\u3002</p>
                        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-3 mt-4">
                            <input type="password" id="delete-account-password" class="field" placeholder="\u8F93\u5165\u5F53\u524D\u5BC6\u7801\u786E\u8BA4\u6CE8\u9500\u8D26\u6237">
                            <button onclick="deleteAccount()" class="btn-danger text-sm">\u6CE8\u9500\u8D26\u6237</button>
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
        var TURNSTILE_BYPASS = ${bypassTurnstile ? "true" : "false"};
        var publicConfig = { allowRegistration: true, inviteRequired: false, durationOptions: [] };
        var dashboardState = null;
        var routeSearchKeyword = '';
        var editingRouteId = null;
        var inboxPage = 1;
        var inboxRouteId = '';
        var inboxSelectedMailId = null;
        var inboxCheckedMailIds = [];
        var inboxCurrentItems = [];
        var inboxSortField = 'time';
        var inboxSortDirection = 'desc';
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
        function durationOptions(){ return publicConfig.durationOptions && publicConfig.durationOptions.length ? publicConfig.durationOptions : [{value:'1',label:'1 \u5C0F\u65F6'},{value:'8',label:'8 \u5C0F\u65F6'},{value:'24',label:'24 \u5C0F\u65F6'},{value:'48',label:'48 \u5C0F\u65F6'},{value:'72',label:'72 \u5C0F\u65F6'},{value:'168',label:'168 \u5C0F\u65F6'},{value:'permanent',label:'\u6C38\u4E45'}]; }
        function durationLabel(v){ var hit = durationOptions().find(function(o){ return o.value === String(v); }); return hit ? hit.label : String(v); }
        function parseDbDate(v){ if(!v) return null; v = String(v); return new Date(v.indexOf('T') >= 0 ? v : v.replace(' ', 'T') + 'Z'); }
        function formatDate(v){ if(!v) return '\u6C38\u4E45'; var d = parseDbDate(v); return isNaN(d.getTime()) ? v : d.toLocaleString(); }
        function formatFileSize(bytes){ bytes = Number(bytes) || 0; if(bytes < 1024) return bytes + ' B'; if(bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; }
        function remainingText(v){ if(!v) return '\u6C38\u4E45'; var diff = parseDbDate(v).getTime() - Date.now(); if(diff <= 0) return '\u5DF2\u8FC7\u671F'; return '\u7EA6 ' + Math.ceil(diff / 3600000) + ' \u5C0F\u65F6'; }
        function deliveryModeNeedsDestination(mode){ return mode === 'inbox_forward' || mode === 'forward_only'; }
        function routeDeliveryMode(route) {
            if (route && route.delivery_mode) return route.delivery_mode;
            if (String(route && route.inbox_enabled || 'false') === 'true') return route && route.destination_id == null ? 'inbox_only' : 'inbox_forward';
            return 'forward_only';
        }
        function deliveryModeLabel(mode) {
            if (mode === 'inbox_forward') return '\u7AD9\u5185\u540C\u6B65 + \u4FDD\u5E95\u8F6C\u53D1';
            if (mode === 'forward_only') return '\u4EC5\u8F6C\u53D1\u5230\u90AE\u7BB1';
            return '\u4EC5\u7AD9\u5185\u6536\u4EF6\u7BB1';
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
            s.innerHTML = opts.length ? opts.map(function(o){ return '<option value="' + escapeHTML(o.value) + '">' + escapeHTML(o.label) + '</option>'; }).join('') : '<option value="" disabled>\u6682\u65E0\u53EF\u7528\u6709\u6548\u671F</option>';
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
            if (el) el.textContent = text || '\u81EA\u52A8\u5237\u65B0\u4E2D';
        }
        function inboxIsMobile() {
            return window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024;
        }
        function setInboxResponsiveView(view) {
            inboxMobileView = view === 'detail' ? 'detail' : 'list';
            var layout = document.getElementById('inbox-layout');
            var listPanel = document.getElementById('inbox-list-panel');
            var detail = document.getElementById('inbox-detail');
            if (layout) layout.classList.toggle('inbox-reading', inboxMobileView === 'detail');
            if (listPanel) listPanel.classList.toggle('hidden', inboxMobileView === 'detail');
            if (detail) detail.classList.toggle('hidden', inboxMobileView !== 'detail');
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
            updateInboxRefreshInfo('\u81EA\u52A8\u5237\u65B0\u4E2D');
            inboxAutoRefreshTimer = setInterval(function(){
                if (activeDashboardSection === 'inbox') loadInbox(inboxPage, {silent:true, preserveSelection:true, preserveChecked:true});
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
                var emptyTitle = searching ? '\u6CA1\u6709\u5339\u914D\u7684\u90AE\u7BB1\u522B\u540D' : '\u8FD8\u6CA1\u6709\u90AE\u7BB1\u522B\u540D';
                var emptyAction = searching
                    ? '<button type="button" onclick="clearRouteSearch()" class="mt-3 btn-secondary text-xs">\u6E05\u7A7A\u641C\u7D22</button>'
                    : '<button type="button" onclick="openRouteCreate()" class="mt-3 btn-primary text-xs">\u65B0\u5EFA\u90AE\u7BB1\u522B\u540D</button>';
                container.innerHTML = '<div class="empty-state"><div class="empty-state-title">' + emptyTitle + '</div><div class="empty-state-copy mt-1">' + (searching ? '\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5\uFF0C\u6216\u8005\u6E05\u7A7A\u5F53\u524D\u641C\u7D22\uFF0C\u5217\u8868\u4F1A\u81EA\u52A8\u6062\u590D\u5168\u90E8\u53EF\u7528\u522B\u540D\u3002' : '\u521B\u5EFA\u540E\u4F1A\u5728\u8FD9\u91CC\u663E\u793A\u522B\u540D\u5730\u5740\u3001\u6295\u9012\u65B9\u5F0F\u3001\u8F6C\u53D1\u76EE\u6807\u548C\u6709\u6548\u671F\u3002') + '</div>' + emptyAction + '</div>';
                return;
            }
            container.innerHTML = routes.map(function(r){
                var routeDurationText = r.duration_hours ? durationLabel(r.duration_hours) : (r.expires_at ? '\u6309\u8FC7\u671F\u65F6\u95F4' : '\u6C38\u4E45');
                var remark = r.remark || '';
                var address = (r.tag || '') + '@' + (r.domain || '');
                var avatarText = ((r.tag || r.domain || '?').charAt(0) || '?').toUpperCase();
                var expiryText = r.expires_at ? (routeDurationText + '\uFF0C\u5230 ' + formatDate(r.expires_at)) : routeDurationText;
                var deliveryMode = routeDeliveryMode(r);
                var badgeClass = deliveryMode === 'forward_only'
                    ? 'badge-status pill-muted'
                    : (deliveryMode === 'inbox_forward' ? 'badge-status badge-primary' : 'badge-status badge-info');
                var deliveryBadge = '<span class="' + badgeClass + '">' + deliveryModeLabel(deliveryMode) + '</span>';
                var targetText = deliveryMode === 'inbox_only'
                    ? '\u4EC5\u6536\u8FDB\u7AD9\u5185\u6536\u4EF6\u7BB1'
                    : (r.destination_email || '\u6682\u672A\u9009\u62E9\u8F6C\u53D1\u90AE\u7BB1');
                var remarkText = remark ? escapeHTML(remark) : '\u8FD9\u4E2A\u522B\u540D\u8FD8\u6CA1\u6709\u5907\u6CE8';
                var secondaryLine = deliveryMode === 'inbox_only'
                    ? '<span class="gmail-route-target">\u7AD9\u5185\u6536\u4EF6\u7BB1</span>'
                    : '<span class="gmail-route-target">' + escapeHTML(targetText) + '</span>';
                var deliveryLineText = deliveryMode === 'inbox_only'
                    ? '\u53EA\u4FDD\u7559\u5728\u7AD9\u5185\u6536\u4EF6\u7BB1'
                    : ('\u540C\u65F6\u6295\u9012\u5230 ' + targetText);
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
                            '<div class="gmail-route-meta"><span><strong>\u6295\u9012\u53BB\u5411</strong> ' + escapeHTML(deliveryLineText) + '</span><span><strong>\u6709\u6548\u671F</strong> ' + escapeHTML(expiryText) + '</span></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gmail-route-side">' +
                        '<div class="gmail-route-actions">' +
                            '<button type="button" onclick="openRouteEdit(' + r.id + ')" class="btn-secondary text-xs">\u7F16\u8F91</button>' +
                            '<button type="button" onclick="deleteRoute(' + r.id + ')" class="btn-secondary text-xs text-danger">\u5220\u9664</button>' +
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
        function setUserScreen(screen) {
            var booting = document.getElementById('booting-panel');
            var authPanel = document.getElementById('auth-panel');
            var dashboardPanel = document.getElementById('dashboard-panel');
            if (!booting || !authPanel || !dashboardPanel) return;
            booting.classList.toggle('hidden', screen !== 'boot');
            authPanel.classList.toggle('hidden', screen !== 'auth');
            dashboardPanel.classList.toggle('hidden', screen !== 'dashboard');
        }
        function withTimeout(promise, timeoutMs) {
            return new Promise(function(resolve, reject) {
                var done = false;
                var timer = setTimeout(function() {
                    if (done) return;
                    done = true;
                    reject(new Error('timeout'));
                }, timeoutMs);
                Promise.resolve(promise).then(function(value) {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    resolve(value);
                }).catch(function(error) {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    reject(error);
                });
            });
        }
        applyThemePreference(getStoredThemePreference());
        watchSystemThemeChange();

        function bootApp() {
            setupRouteSearch();
            window.addEventListener('resize', syncInboxResponsiveView);
            (async function() {
                try {
                    await withTimeout(loadPublicConfig(), 4000).catch(function() {
                        updateInviteField();
                    });
                    var session = await withTimeout(fetch('/api/check-session'), 10000);
                    if (session && session.ok) {
                        setUserScreen('dashboard');
                        loadDashboard();
                    } else {
                        setUserScreen('auth');
                    }
                } catch (_) {
                    setUserScreen('auth');
                }
            })();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootApp);
        } else {
            bootApp();
        }
        function switchTab(m) {
            mode = m;
            document.getElementById('submit-btn').innerText = m==='login'?'\u767B\u5F55':'\u6CE8\u518C';
            document.getElementById('tab-login').className = m==='login'?'auth-tab auth-tab-active w-1/2 text-center':'auth-tab w-1/2 text-center';
            document.getElementById('tab-register').className = m==='register'?'auth-tab auth-tab-active w-1/2 text-center':'auth-tab w-1/2 text-center';
            updateInviteField();
            if (!TURNSTILE_BYPASS && window.turnstile) window.turnstile.reset();
        }
        async function handleAuth(e) {
            e.preventDefault();
            var t = new FormData(e.target).get('cf-turnstile-response');
            if (TURNSTILE_BYPASS && !t) t = 'bypass';
            if(!t) return showToast('\u8BF7\u5B8C\u6210\u4EBA\u673A\u9A8C\u8BC1', true);
            var payload = {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                turnstileToken: TURNSTILE_BYPASS ? '' : t
            };
            if (mode === 'register' && publicConfig.inviteRequired) payload.invitationCode = document.getElementById('invite-code').value.trim();
            var res = await fetch('/api/'+mode, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            if(res.ok){
                mode==='login' ? location.reload() : (showToast('\u6CE8\u518C\u6210\u529F\uFF0C\u8BF7\u767B\u5F55'), switchTab('login'));
            } else {
                var d = await res.json();
                var errMsg = d.error || '\u8BF7\u6C42\u5931\u8D25';
                showToast(errMsg, true);
                if (window.turnstile && /\u6960\u5C83\u7609|turnstile|captcha/i.test(String(errMsg))) window.turnstile.reset();
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
            if (btn && btn.disabled) return showToast('\u5F53\u524D\u8FD8\u4E0D\u80FD\u65B0\u5EFA\u90AE\u7BB1\u522B\u540D\uFF0C\u8BF7\u5148\u68C0\u67E5\u914D\u989D\u3001\u57DF\u540D\u6216\u8F6C\u53D1\u90AE\u7BB1\u72B6\u6001', true);
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
                : '<option value="" disabled>\u6682\u65E0\u53EF\u7528\u5DF2\u9A8C\u8BC1\u90AE\u7BB1</option>';
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
            if (!route) return showToast('\u8FD9\u4E2A\u90AE\u7BB1\u522B\u540D\u5DF2\u7ECF\u4E0D\u5B58\u5728\uFF0C\u6216\u5217\u8868\u521A\u521A\u5237\u65B0\u8FC7', true);
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
            container.innerHTML = '<div class="empty-state"><div class="empty-state-title">\u8FD8\u6CA1\u6709\u6DFB\u52A0\u4EFB\u4F55\u8F6C\u53D1\u90AE\u7BB1</div><div class="empty-state-copy mt-1">\u6DFB\u52A0\u5E76\u9A8C\u8BC1\u90AE\u7BB1\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u53EF\u7528\u72B6\u6001\u3001\u9ED8\u8BA4\u884C\u4E3A\u548C\u6709\u6548\u671F\u3002</div></div>';
                return;
            }
            container.innerHTML = list.map(function(item){
                var statusText = item.status === 'verified' ? '\u5DF2\u9A8C\u8BC1' : '\u5F85\u9A8C\u8BC1';
                var statusClass = item.status === 'verified' ? 'badge-status badge-success' : 'badge-status badge-info';
                var durationText = item.duration_hours ? durationLabel(item.duration_hours) : (item.expires_at ? '\u6309\u8FC7\u671F\u65F6\u95F4' : '\u6C38\u4E45');
                var avatarText = ((item.email || '?').charAt(0) || '?').toUpperCase();
                var expiryText = item.status === 'pending'
                    ? ('\u90AE\u7BB1\u6709\u6548\u671F\uFF1A' + durationText + '\uFF0C\u9A8C\u8BC1\u622A\u6B62\uFF1A' + formatDate(item.pending_expires_at))
                    : (item.expires_at ? ('\u90AE\u7BB1\u6709\u6548\u671F\uFF1A' + durationText + '\uFF0C\u5230\u671F\u65F6\u95F4\uFF1A' + formatDate(item.expires_at) + '\uFF08' + remainingText(item.expires_at) + '\uFF09') : '\u90AE\u7BB1\u6709\u6548\u671F\uFF1A\u6C38\u4E45');
                var refreshBtn = item.status === 'pending'
                    ? '<button onclick="refreshDestination(' + item.id + ')" class="btn-linkish text-xs">\u5237\u65B0\u9A8C\u8BC1</button>'
                    : '';
                var inboxDefaultText = String(item.inbox_default || 'true') === 'true' ? '\u65B0\u5EFA\u522B\u540D\u65F6\u4F1A\u9ED8\u8BA4\u9009\u4E2D\u5B83' : '\u53EA\u5728\u4F60\u624B\u52A8\u6307\u5B9A\u65F6\u624D\u4F1A\u4F7F\u7528';
                var inboxDefaultBadge = String(item.inbox_default || 'true') === 'true'
                    ? '<span class="gmail-route-target">\u9ED8\u8BA4\u76EE\u6807</span>'
                    : '<span class="gmail-route-target">\u624B\u52A8\u9009\u62E9</span>';
                var statusDetail = item.status === 'pending'
                    ? '\u7B49\u5F85\u4F60\u5728\u90AE\u7BB1\u91CC\u5B8C\u6210\u9A8C\u8BC1'
                    : '\u53EF\u4EE5\u7ACB\u5373\u4F5C\u4E3A\u8F6C\u53D1\u76EE\u6807';
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
                            '<div class="gmail-route-meta"><span><strong>\u5F53\u524D\u72B6\u6001</strong> ' + escapeHTML(statusDetail) + '</span><span><strong>\u6709\u6548\u671F</strong> ' + escapeHTML(durationText) + '</span><span><strong>\u63D0\u9192</strong> ' + escapeHTML(expiryText) + '</span></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gmail-route-side">' +
                        '<div class="gmail-route-actions">' + refreshBtn + '<button onclick="deleteDestination(' + item.id + ')" class="btn-secondary text-xs text-danger">\u5220\u9664</button></div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        function applyDashboardState() {
            fillDurationSelect('dest-duration', dashboardState.limits.destinationMax);
            var quota = dashboardState.quota || {used:0,max:0,destinationUsed:0,destinationMax:0};
            document.getElementById('dest-summary').innerHTML = '<span class="gmail-stat-inline"><strong>' + quota.destinationUsed + '</strong><span>/ ' + quota.destinationMax + ' \u4E2A\u8F6C\u53D1\u90AE\u7BB1</span></span>';
            document.getElementById('dashboard-dest-summary').innerHTML = '<strong>\u8F6C\u53D1\u90AE\u7BB1</strong><span>' + quota.destinationUsed + ' / ' + quota.destinationMax + '</span>';
            renderDestinationList();

            document.getElementById('route-quota').innerHTML = '<span class="gmail-stat-inline"><strong>' + quota.used + '</strong><span>/ ' + quota.max + ' \u4E2A\u90AE\u7BB1\u522B\u540D</span></span>';
            document.getElementById('dashboard-route-summary').innerHTML = '<strong>\u90AE\u7BB1\u522B\u540D</strong><span>' + quota.used + ' / ' + quota.max + '</span>';
            var domains = dashboardState.domains || [];
            var routeDomainSelect = document.getElementById('route-domain');
            routeDomainSelect.innerHTML = domains.length ? domains.map(function(x){ return '<option value="' + x.id + '">' + escapeHTML(x.domain) + '</option>'; }).join('') : '<option value="" disabled>\u7BA1\u7406\u5458\u6682\u672A\u5F00\u653E\u53EF\u7528\u57DF\u540D</option>';
            fitSelectToLongestText(routeDomainSelect, 16, 42);

            var availableDestinations = verifiedDestinations();
            var routeDeliverySelect = document.getElementById('route-delivery-mode');
            var routeDeliveryMode = routeDeliverySelect ? routeDeliverySelect.value : 'inbox_only';
            var routeNeedsDestination = deliveryModeNeedsDestination(routeDeliveryMode);
            var routeDestinationSelect = document.getElementById('route-destination');
            var selectedRouteDestinationId = routeDestinationSelect.value;
            routeDestinationSelect.innerHTML = availableDestinations.length ? availableDestinations.map(function(x){ return '<option value="' + x.id + '">' + escapeHTML(x.email) + '</option>'; }).join('') : '<option value="" disabled>\u6682\u65E0\u53EF\u7528\u5DF2\u9A8C\u8BC1\u90AE\u7BB1\uFF0C\u8BF7\u5230 \u8BBE\u7F6E > \u8F6C\u53D1\u90AE\u7BB1 \u6DFB\u52A0</option>';
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
            showToast(res.ok ? '\u5907\u6CE8\u5DF2\u4FDD\u5B58' : (d.error || '\u5907\u6CE8\u4FDD\u5B58\u5931\u8D25'), !res.ok);
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
            showToast(res.ok ? (d.message || '\u6295\u9012\u8BBE\u7F6E\u5DF2\u66F4\u65B0') : (d.error || '\u66F4\u65B0\u5931\u8D25'), !res.ok);
            if (res.ok) await loadDashboard();
        }
        async function saveRouteEdit(e) {
            e.preventDefault();
            var id = document.getElementById('edit-route-id').value || editingRouteId;
            var mode = document.getElementById('edit-route-delivery-mode').value;
            var destEl = document.getElementById('edit-route-destination');
            if (deliveryModeNeedsDestination(mode) && (!destEl || !destEl.value)) return showToast('\u8BF7\u9009\u62E9\u8F6C\u53D1\u76EE\u6807\u90AE\u7BB1', true);
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
                showToast(res.ok ? (d.message || '\u4E13\u5C5E\u90AE\u7BB1\u5DF2\u66F4\u65B0') : (d.error || '\u66F4\u65B0\u5931\u8D25'), !res.ok);
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
            showToast(d.message || d.error || '\u8BF7\u6C42\u5B8C\u6210', !res.ok);
            if (res.ok) document.getElementById('dest-email').value = '';
            await loadDashboard();
        }
        async function refreshDestination(id) {
            var res = await fetch('/api/destinations/' + id + '/refresh', {method:'POST'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(d.message || d.error || '\u8BF7\u6C42\u5B8C\u6210', !res.ok);
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
            showToast(d.success ? (d.message || '\u90AE\u7BB1\u522B\u540D\u521B\u5EFA\u6210\u529F') : (d.error || '\u521B\u5EFA\u5931\u8D25'), !d.success);
            if(d.success) {
                document.getElementById('route-prefix').value = '';
                document.getElementById('route-remark').value = '';
                closeRouteCreate();
                await loadDashboard();
            }
        }
        async function deleteRoute(id) {
            if(!confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u5417\uFF1F\u5220\u9664\u540E Cloudflare \u8DEF\u7531\u4E5F\u4F1A\u4E00\u8D77\u79FB\u9664\u3002')) return;
            var res = await fetch('/api/routes/' + id, {method:'DELETE'});
            var d = await res.json();
            showToast(d.message || d.error || '\u8BF7\u6C42\u5B8C\u6210', !res.ok);
            await loadDashboard();
        }
        async function deleteDestination(id) {
            if(!confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u5E95\u5C42\u6536\u4EF6\u7BB1\u5417\uFF1F\u82E5\u4ECD\u88AB\u8DEF\u7531\u4F7F\u7528\u5C06\u88AB\u963B\u6B62\u3002')) return;
            var res = await fetch('/api/destinations/' + id, {method:'DELETE'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(d.message || d.error || '\u8BF7\u6C42\u5B8C\u6210', !res.ok);
            await loadDashboard();
        }
function renderInboxDetailPlaceholder(text) {
            var detail = document.getElementById('inbox-detail');
            if (!detail) return;
            detail.className = inboxDetailClassName('placeholder');
            detail.innerHTML = '<div class="gmail-detail-placeholder"><div class="gmail-detail-placeholder-mark">@</div><div class="empty-state-title">\u7AD9\u5185\u6536\u4EF6\u7BB1</div><div class="empty-state-copy">' + escapeHTML(text || '\u4ECE\u5DE6\u4FA7\u9009\u62E9\u4E00\u5C01\u90AE\u4EF6\uFF0C\u5373\u53EF\u5728\u8FD9\u91CC\u67E5\u770B\u6B63\u6587\u3001\u6295\u9012\u4FE1\u606F\u548C\u9644\u4EF6\u3002') + '</div></div>';
            setInboxResponsiveView('list');
        }
        function inboxVisibleMailIds(items) {
            return (Array.isArray(items) ? items : []).map(function(item){ return Number(item && item.id); }).filter(function(id){ return Number.isFinite(id) && id > 0; });
        }
        function getInboxCheckedMailIds() {
            return inboxCheckedMailIds.slice();
        }
        function clearInboxCheckedMailIds() {
            inboxCheckedMailIds = [];
            syncInboxSelectionUi();
        }
        function syncInboxCheckedMailIds(items) {
            var allowed = new Set(inboxVisibleMailIds(items));
            inboxCheckedMailIds = inboxCheckedMailIds.filter(function(id){ return allowed.has(Number(id)); });
            syncInboxSelectionUi();
        }
        function getInboxSortArrow(field) {
            if (inboxSortField !== field) return '';
            return inboxSortDirection === 'asc' ? '\u25B2' : '\u25BC';
        }
        function getInboxSortClass(field) {
            return inboxSortField === field ? ' qq-mail-sort-active' : '';
        }
        function sortInboxItems(items) {
            var rows = Array.isArray(items) ? items.slice() : [];
            var direction = inboxSortDirection === 'asc' ? 1 : -1;
            rows.sort(function(left, right) {
                var a;
                var b;
                if (inboxSortField === 'sender') {
                    a = String(left && left.from_email || '').toLowerCase();
                    b = String(right && right.from_email || '').toLowerCase();
                } else if (inboxSortField === 'subject') {
                    a = String(left && left.subject || '').toLowerCase();
                    b = String(right && right.subject || '').toLowerCase();
                } else {
                    a = Date.parse((left && left.received_at) || '') || 0;
                    b = Date.parse((right && right.received_at) || '') || 0;
                }
                if (a < b) return -1 * direction;
                if (a > b) return 1 * direction;
                return 0;
            });
            return rows;
        }
        function toggleInboxSort(field) {
            if (!field) return;
            if (inboxSortField === field) {
                inboxSortDirection = inboxSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                inboxSortField = field;
                inboxSortDirection = field === 'time' ? 'desc' : 'asc';
            }
            renderInboxList(inboxCurrentItems);
            syncInboxSelectionUi();
        }
        function isInboxMailChecked(id) {
            return inboxCheckedMailIds.indexOf(Number(id)) >= 0;
        }
        function toggleInboxMailChecked(event, id) {
            if (event && event.stopPropagation) event.stopPropagation();
            id = Number(id);
            if (!Number.isFinite(id) || id < 1) return;
            var next = getInboxCheckedMailIds();
            var index = next.indexOf(id);
            if (index >= 0) next.splice(index, 1);
            else next.push(id);
            inboxCheckedMailIds = next;
            renderInboxList(inboxCurrentItems);
            syncInboxSelectionUi();
        }
        function inboxCurrentPageFullyChecked() {
            var ids = inboxVisibleMailIds(inboxCurrentItems);
            if (!ids.length) return false;
            return ids.every(function(id){ return isInboxMailChecked(id); });
        }
        function toggleInboxCurrentPageSelection(event) {
            if (event && event.stopPropagation) event.stopPropagation();
            var box = document.getElementById('inbox-check-all');
            var ids = inboxVisibleMailIds(inboxCurrentItems);
            if (!ids.length) {
                inboxCheckedMailIds = [];
                renderInboxList(inboxCurrentItems);
                syncInboxSelectionUi();
                return;
            }
            inboxCheckedMailIds = (box && box.checked) ? ids.slice() : [];
            renderInboxList(inboxCurrentItems);
            syncInboxSelectionUi();
        }
        function syncInboxSelectionUi() {
            var countEl = document.getElementById('inbox-selected-count');
            if (countEl) countEl.innerHTML = '\u5DF2\u9009 <strong>' + String(inboxCheckedMailIds.length) + '</strong> \u5C01';
            var bulkBtn = document.getElementById('inbox-bulk-delete-btn');
            if (bulkBtn) bulkBtn.disabled = inboxCheckedMailIds.length < 1;
            var allBox = document.getElementById('inbox-check-all');
            if (allBox) {
                var total = inboxVisibleMailIds(inboxCurrentItems).length;
                allBox.checked = total > 0 && inboxCurrentPageFullyChecked();
                allBox.indeterminate = inboxCheckedMailIds.length > 0 && !allBox.checked;
            }
        }
        function performInboxSearch() {
            clearInboxCheckedMailIds();
            loadInbox(1);
        }
        function closeInboxMail() {
            inboxSelectedMailId = null;
            renderInboxDetailPlaceholder();
            loadInbox(inboxPage, {silent:true, preserveSelection:true, preserveChecked:true});
        }
        async function refreshInboxNow() {
            updateInboxRefreshInfo('\u6B63\u5728\u5237\u65B0...');
            await loadInbox(inboxPage, {preserveSelection:true, preserveChecked:true});
        }
        async function loadInbox(page, options) {
            options = options || {};
            if (inboxLoading) return;
            inboxLoading = true;
            inboxPage = page || 1;
            if (inboxPage < 1) inboxPage = 1;
            if (!options.preserveChecked) clearInboxCheckedMailIds();
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
                    if (!options.silent) showToast('\u6536\u4EF6\u7BB1\u5237\u65B0\u5931\u8D25', true);
                    return;
                }
                var d = await res.json().catch(function(){ return {data:[]}; });
                inboxCurrentItems = Array.isArray(d.data) ? d.data : [];
                syncInboxCheckedMailIds(inboxCurrentItems);
                renderInboxList(inboxCurrentItems);
                document.getElementById('inbox-page-info').innerText = '\u7B2C ' + inboxPage + ' \u9875';
                updateInboxRefreshInfo('\u5DF2\u5237\u65B0 ' + new Date().toLocaleTimeString());
            } finally {
                inboxLoading = false;
            }
        }
function renderInboxList(items) {
            var list = document.getElementById('inbox-list');
            if (!list) return;
            if (!items.length) {
                list.innerHTML = '<div class="qq-mail-empty"><div class="empty-state"><div class="empty-state-title mb-2">\u6536\u4EF6\u7BB1\u8FD8\u662F\u7A7A\u7684</div><div class="empty-state-copy">\u65B0\u6536\u5230\u7684\u90AE\u4EF6\u4F1A\u6574\u9F50\u5730\u51FA\u73B0\u5728\u8FD9\u91CC\uFF0C\u4F60\u4E5F\u53EF\u4EE5\u901A\u8FC7\u5DE6\u4E0A\u89D2\u641C\u7D22\u5FEB\u901F\u7B5B\u9009\u53D1\u4EF6\u4EBA\u3001\u4E3B\u9898\u6216\u6B63\u6587\u5185\u5BB9\u3002</div></div></div>';
                syncInboxSelectionUi();
                return;
            }
            var rows = sortInboxItems(items);
            list.innerHTML = '<div class="qq-mail-table"><div class="qq-mail-head">' +
                '<div class="qq-mail-checkbox"><label class="qq-mail-head-select"><input type="checkbox" id="inbox-check-all" onclick="toggleInboxCurrentPageSelection(event)" aria-label="\u5168\u9009\u5F53\u524D\u9875"></label></div>' +
                '<div class="qq-col-sender"><button type="button" onclick="toggleInboxSort(&apos;sender&apos;)" class="qq-mail-sort' + getInboxSortClass('sender') + '">\u53D1\u4EF6\u4EBA<span class="qq-mail-sort-arrow">' + getInboxSortArrow('sender') + '</span></button></div>' +
                '<div class="qq-col-summary"><button type="button" onclick="toggleInboxSort(&apos;subject&apos;)" class="qq-mail-sort' + getInboxSortClass('subject') + '">\u4E3B\u9898<span class="qq-mail-sort-arrow">' + getInboxSortArrow('subject') + '</span></button></div>' +
                '<div class="qq-col-alias">\u522B\u540D</div>' +
                '<div class="qq-col-time text-right"><button type="button" onclick="toggleInboxSort(&apos;time&apos;)" class="qq-mail-sort' + getInboxSortClass('time') + '">\u65F6\u95F4<span class="qq-mail-sort-arrow">' + getInboxSortArrow('time') + '</span></button></div>' +
            '</div>' + rows.map(function(m){
                var unread = !m.read_at;
                var selected = Number(m.id) === Number(inboxSelectedMailId);
                var subject = m.subject || '(\u65E0\u4E3B\u9898)';
                var preview = m.preview || '';
                var senderText = String(m.from_email || '\u672A\u77E5\u53D1\u4EF6\u4EBA').trim() || '\u672A\u77E5\u53D1\u4EF6\u4EBA';
                var itemClass = selected ? 'list-row list-row-selected qq-mail-row' : ((unread ? 'list-row list-row-unread ' : 'list-row list-row-read ') + 'qq-mail-row');
                return '<div onclick="openInboxMail(' + m.id + ')" class="' + itemClass + '">' +
                    '<div class="qq-mail-checkbox"><input type="checkbox" ' + (isInboxMailChecked(m.id) ? 'checked ' : '') + 'onclick="toggleInboxMailChecked(event,' + m.id + ')" aria-label="\u52FE\u9009\u90AE\u4EF6"></div>' +
                    '<div class="qq-mail-sender">' + escapeHTML(senderText) + '</div>' +
                    '<div class="qq-mail-summary"><div class="qq-mail-subject">' + escapeHTML(subject) + '</div><span class="qq-mail-divider">-</span><div class="qq-mail-preview">' + escapeHTML(preview || '\u65E0\u6B63\u6587\u9884\u89C8') + '</div></div>' +
                    '<div class="qq-mail-alias">' + escapeHTML(m.route_address || '-') + '</div>' +
                    '<div class="qq-mail-timebox">' +
                        '<span class="qq-mail-time">' + escapeHTML(formatDate(m.received_at)) + '</span>' +
                        '<button onclick="deleteInboxMail(event,' + m.id + ')" class="qq-mail-delete" aria-label="\u5220\u9664\u90AE\u4EF6">\u5220\u9664</button>' +
                    '</div>' +
                '</div>';
            }).join('') + '</div>';
            syncInboxSelectionUi();
        }
        function renderInboxAttachments(mailId, attachments, statusText) {
            var rows = Array.isArray(attachments) ? attachments : [];
            var notice = statusText ? '<div class="mb-2 notice-warning text-xs rounded px-3 py-2">' + escapeHTML(statusText) + '</div>' : '';
            if (!rows.length) return notice;
            return '<div class="gmail-attach-shell">' + notice + '<div class="gmail-attach-head"><div class="text-xs font-bold text-muted">\u9644\u4EF6</div><div class="text-xs text-soft">\u5171 ' + escapeHTML(String(rows.length)) + ' \u4E2A\u6587\u4EF6</div></div><div class="gmail-attach-grid">' + rows.map(function(a){
                var url = '/api/inbox/' + encodeURIComponent(mailId) + '/attachments/' + encodeURIComponent(a.id);
                return '<div class="gmail-attach-card"><div class="min-w-0"><div class="text-sm text-strong truncate">' + escapeHTML(a.filename || 'attachment') + '</div><div class="text-xs text-soft">' + escapeHTML(a.content_type || 'application/octet-stream') + ' \xB7 ' + escapeHTML(formatFileSize(a.size_bytes)) + '</div></div><a href="' + url + '" target="_blank" rel="noopener" class="btn-linkish text-xs whitespace-nowrap">\u4E0B\u8F7D</a></div>';
            }).join('') + '</div></div>';
        }
        async function openInboxMail(id) {
            inboxSelectedMailId = id;
            var detail = document.getElementById('inbox-detail');
            if (detail) {
                detail.className = inboxDetailClassName('placeholder');
                detail.innerHTML = '<div class="gmail-detail-placeholder"><div class="gmail-detail-placeholder-mark">@</div><div class="empty-state-title">\u6B63\u5728\u8BFB\u53D6\u90AE\u4EF6</div><div class="empty-state-copy">\u6B63\u5728\u52A0\u8F7D\u6B63\u6587\u3001\u6295\u9012\u5730\u5740\u548C\u9644\u4EF6\u4FE1\u606F\u3002</div></div>';
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
                return showToast(d.error || '\u8BFB\u53D6\u90AE\u4EF6\u5931\u8D25', true);
            }
            var m = d.data || {};
            if (detail) {
                var senderText = String(m.from_email || '').trim();
                var senderLetter = senderText ? senderText.charAt(0).toUpperCase() : '@';
                detail.className = inboxDetailClassName('reader');
                detail.innerHTML = '<div class="qq-detail-head">' +
                    '<div class="qq-detail-actions">' +
                        '<button onclick="closeInboxMail()" class="btn-secondary qq-detail-back whitespace-nowrap">\u8FD4\u56DE\u5217\u8868</button>' +
                        '<button onclick="openAdjacentInboxMail(-1)" class="btn-secondary qq-detail-action-btn whitespace-nowrap">\u4E0A\u4E00\u5C01</button>' +
                        '<button onclick="openAdjacentInboxMail(1)" class="btn-secondary qq-detail-action-btn whitespace-nowrap">\u4E0B\u4E00\u5C01</button>' +
                        '<button onclick="deleteInboxMail(null,' + (m.id || id) + ')" class="btn-secondary qq-detail-action-btn whitespace-nowrap">\u5220\u9664</button>' +
                    '</div>' +
                    '<div class="qq-detail-main">' +
                        '<div class="qq-detail-topline">' +
                            '<div class="qq-detail-title">' + escapeHTML(m.subject || '(\u65E0\u4E3B\u9898)') + '</div>' +
                        '</div>' +
                        '<div class="qq-detail-meta-row">' +
                            '<div class="qq-detail-sender">' +
                                '<div class="qq-detail-avatar">' + escapeHTML(senderLetter) + '</div>' +
                                '<div class="min-w-0">' +
                                    '<div class="qq-detail-sender-name">' + escapeHTML(m.from_email || '\u672A\u77E5\u53D1\u4EF6\u4EBA') + '</div>' +
                                    '<div class="qq-detail-sender-sub">\u53D1\u9001\u5230 ' + escapeHTML(m.route_address || '') + '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="qq-detail-meta">' +
                                '<span>' + escapeHTML(formatDate(m.received_at)) + '</span>' +
                                '<span>\u6295\u9012\u5230\uFF1A' + escapeHTML(m.route_address || '') + '</span>' +
                                '<span class="qq-detail-stat">' + escapeHTML((Array.isArray(m.attachments) ? m.attachments.length : 0)) + ' \u4E2A\u9644\u4EF6</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div><div class="qq-detail-body"><div class="gmail-detail-card"><div class="qq-detail-body-surface"><div id="inbox-body-container" class="email-html break-words"></div></div></div></div><div class="qq-detail-attachments">' + renderInboxAttachments(m.id || id, m.attachments || [], m.attachment_status_text || '') + '</div>';
                var bodyContainer = document.getElementById('inbox-body-container');
                if (bodyContainer) {
                    if (m.body_html) bodyContainer.innerHTML = m.body_html;
                    else bodyContainer.innerHTML = '<pre class="whitespace-pre-wrap break-words text-sm text-strong m-0">' + escapeHTML(m.body_text || '') + '</pre>';
                }
                setInboxResponsiveView('detail');
            }
            await loadInbox(inboxPage, {silent:true, preserveSelection:true, preserveChecked:true});
        }
        function openAdjacentInboxMail(delta) {
            var ids = inboxVisibleMailIds(inboxCurrentItems);
            if (!ids.length) return;
            var currentId = Number(inboxSelectedMailId);
            var index = ids.indexOf(currentId);
            if (index < 0) index = 0;
            var nextIndex = index + Number(delta || 0);
            if (nextIndex < 0 || nextIndex >= ids.length) return showToast('\u5DF2\u7ECF\u5230\u5934\u4E86', true);
            openInboxMail(ids[nextIndex]);
        }
        async function deleteInboxMail(event, id) {
            if (event && event.stopPropagation) event.stopPropagation();
            if(!confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u5C01\u7AD9\u5185\u90AE\u4EF6\u5417\uFF1F\u771F\u5B9E\u90AE\u7BB1\u4E2D\u7684\u4FDD\u5E95\u8F6C\u53D1\u4E0D\u53D7\u5F71\u54CD\u3002')) return;
            var res = await fetch('/api/inbox/' + id, {method:'DELETE'});
            var d = await res.json().catch(function(){ return {}; });
            showToast(res.ok ? (d.message || '\u90AE\u4EF6\u5DF2\u5220\u9664') : (d.error || '\u5220\u9664\u5931\u8D25'), !res.ok);
            if(res.ok) {
                inboxCheckedMailIds = inboxCheckedMailIds.filter(function(itemId){ return Number(itemId) !== Number(id); });
                if (Number(inboxSelectedMailId) === Number(id)) {
                    inboxSelectedMailId = null;
                    renderInboxDetailPlaceholder();
                }
                await loadInbox(inboxPage, {preserveSelection:true, preserveChecked:true});
            }
        }
        async function deleteCheckedInboxMails() {
            var ids = getInboxCheckedMailIds();
            if (!ids.length) return showToast('\u8BF7\u5148\u52FE\u9009\u8981\u5220\u9664\u7684\u90AE\u4EF6', true);
            if(!confirm('\u786E\u5B9A\u5220\u9664\u5F53\u524D\u52FE\u9009\u7684 ' + ids.length + ' \u5C01\u7AD9\u5185\u90AE\u4EF6\u5417\uFF1F\u771F\u5B9E\u90AE\u7BB1\u4E2D\u7684\u4FDD\u5E95\u8F6C\u53D1\u4E0D\u53D7\u5F71\u54CD\u3002')) return;
            var res = await fetch('/api/inbox/batch-delete', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ids:ids})
            });
            var d = await res.json().catch(function(){ return {}; });
            showToast(res.ok ? (d.message || ('\u5DF2\u5220\u9664 ' + (d.deleted || ids.length) + ' \u5C01\u90AE\u4EF6')) : (d.error || '\u6279\u91CF\u5220\u9664\u5931\u8D25'), !res.ok);
            if (!res.ok) return;
            if (ids.indexOf(Number(inboxSelectedMailId)) >= 0) {
                inboxSelectedMailId = null;
                renderInboxDetailPlaceholder();
            }
            clearInboxCheckedMailIds();
            await loadInbox(inboxPage, {preserveSelection:true, preserveChecked:true});
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
            if(newPassword.length < 6) return showToast('\u65B0\u5BC6\u7801\u81F3\u5C11 6 \u4F4D', true);
            var res = await fetch('/api/password', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({oldPassword:oldPassword,newPassword:newPassword})});
            var d = await res.json();
            showToast(d.message || d.error || '\u8BF7\u6C42\u5B8C\u6210', !res.ok);
            if(res.ok){ document.getElementById('old-password').value=''; document.getElementById('new-password').value=''; }
        }
        async function deleteAccount() {
            var password = document.getElementById('delete-account-password').value;
            if(!password) return showToast('\u8BF7\u8F93\u5165\u5F53\u524D\u5BC6\u7801\u786E\u8BA4\u6CE8\u9500', true);
            if(!confirm('\u786E\u5B9A\u6C38\u4E45\u5220\u9664\u81EA\u5DF1\u7684\u8D26\u53F7\u5417\uFF1F\u8D26\u53F7\u3001\u5E95\u5C42\u6536\u4EF6\u7BB1\u548C\u6240\u6709\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u90FD\u4F1A\u88AB\u5220\u9664\u3002')) return;
            var res = await fetch('/api/account', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:password})});
            var d = await res.json();
            showToast(d.message || d.error || '\u8BF7\u6C42\u5B8C\u6210', !res.ok);
            if(res.ok) setTimeout(function(){ location.reload(); }, 600);
        }
        async function logout(){ await fetch('/api/logout',{method:'POST'}); location.reload();}
    <\/script>
</body>
</html>`, "renderUserHTML");
var renderAdminHTML = /* @__PURE__ */ __name((adminPath, sitekey, bypassTurnstile = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>\u90AE\u4EF6\u5DE5\u4F5C\u533A\u8BBE\u7F6E</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    ${bypassTurnstile ? "" : '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer><\/script>'}
    ${renderThemeBootstrapScript()}
    ${renderSharedThemeStyle()}
    ${renderPostThemeOverrides()}
    ${renderSharedThemeRuntimeScript()}
    <style>
body.admin-page{background:linear-gradient(180deg,#f6f8fc 0%,#eef3fb 100%)!important;color:var(--text-strong)!important}
body.admin-page.auth-mode{display:flex!important;justify-content:center!important;align-items:center!important;padding:1rem!important;min-height:100vh!important}
body.admin-page.dashboard-mode{display:block!important;padding:0!important;min-height:100vh!important;overflow:hidden!important}
#dashboard-panel{background:transparent!important;border-radius:0!important;overflow:hidden;width:100%;min-height:100vh;box-shadow:none!important}
.surface-card{border-radius:var(--radius-panel)!important}
.topbar{background:rgba(255,255,255,.88)!important;border-bottom:1px solid rgba(226,232,240,.9)!important;backdrop-filter:blur(18px)!important;position:sticky;top:0;z-index:20}
.gmail-admin-canvas{max-width:82rem!important;margin:0 auto!important}
.gmail-admin-topbar{padding:.1rem 0!important;gap:.75rem!important;justify-content:space-between!important}
.gmail-admin-brand{max-width:32rem!important}
.gmail-admin-copy{display:none!important}
.gmail-admin-tab-group{align-items:center!important;gap:1rem!important}
.gmail-admin-tabs{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:999px!important;padding:.22rem!important;gap:.2rem!important}
.admin-nav{border-radius:999px!important;padding:.68rem 1rem!important}
.gmail-admin-grid{gap:1rem!important}
#view-domains .gmail-admin-grid-wide{grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr)!important}
.gmail-admin-domain-stack .gmail-content-body{padding-bottom:.92rem!important}
.gmail-admin-domain-stack .gmail-admin-row{background:#f8fafd!important}
.gmail-admin-domain-stack .gmail-admin-row:hover{background:#f3f6fb!important}
.gmail-panel-header{padding-top:.88rem!important;padding-bottom:.82rem!important}
.gmail-content-card{border-radius:.9rem!important;border:1px solid rgba(226,232,240,.95)!important;box-shadow:0 10px 30px rgba(15,23,42,.04)!important}
.gmail-content-body{padding:1rem 1.08rem!important}
.gmail-admin-card-main{gap:.24rem!important}
.gmail-admin-meta-line{line-height:1.48!important}
.surface-page{padding:.9rem 1rem 1.2rem!important}
.gmail-user-copy,.gmail-admin-copy,.gmail-admin-section-copy,.workspace-section-copy{color:#5f6368!important}
@media (min-width:1024px){
body.admin-page.dashboard-mode .surface-page{padding:1rem 1.25rem 1.5rem!important}
}
@media (max-width:1023px){
body.admin-page.dashboard-mode{padding:0!important}
.gmail-admin-topbar{align-items:flex-start!important}
.gmail-admin-tabs{width:100%;border-radius:1rem!important}
.gmail-admin-tab-group{align-items:stretch!important}
#view-domains .gmail-admin-stack{grid-template-columns:minmax(0,1fr)!important}
}
    
    #booting-panel.hidden,#auth-panel.hidden,#login-panel.hidden,#dashboard-panel.hidden{display:none!important}</style>

</head>
<body class="admin-page auth-mode app-shell font-sans min-h-screen p-4 flex justify-center items-center">
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2"></div>

    <div id="booting-panel" class="hidden surface-card w-full max-w-[26rem] p-8 text-center text-muted fade-in">
        <div class="auth-shell-head items-center text-center mb-0 mx-auto">
            <span class="auth-shell-badge">\u7BA1\u7406\u5DE5\u4F5C\u533A</span>
            <div class="text-strong text-lg font-semibold">\u6B63\u5728\u68C0\u67E5\u767B\u5F55\u72B6\u6001</div>
            <div class="auth-shell-copy">\u6B63\u5728\u6062\u590D\u57DF\u540D\u3001\u9080\u8BF7\u7801\u548C\u7528\u6237\u7BA1\u7406\u72B6\u6001\u3002</div>
            <div id="booting-error" class="hidden mt-4 p-3 rounded-lg bg-rose-900/30 border border-rose-800 text-rose-300 text-sm">\u8FDE\u63A5\u5931\u8D25\uFF0C<a href="#" class="underline hover:text-rose-200" onclick="location.reload()">\u70B9\u51FB\u91CD\u8BD5</a></div>
        </div>
    </div>

    <div id="login-panel" class="surface-card hidden w-full max-w-[26rem] p-8 fade-in">
        <div class="auth-shell-head items-center text-center mx-auto">
            <span class="auth-shell-badge">\u7BA1\u7406\u5DE5\u4F5C\u533A</span>
            <div class="text-strong text-2xl font-bold">\u90AE\u4EF6\u5DE5\u4F5C\u533A\u8BBE\u7F6E</div>
            <div class="auth-shell-copy">\u96C6\u4E2D\u7BA1\u7406\u57DF\u540D\u5F00\u653E\u3001\u5BB9\u91CF\u9650\u5236\u3001\u9080\u8BF7\u7801\u4E0E\u7528\u6237\u72B6\u6001\u3002</div>
        </div>
        <form onsubmit="handleAdminLogin(event)" class="space-y-4">
            <input type="text" id="admin-user" class="field" placeholder="\u7BA1\u7406\u5458\u8D26\u53F7" required>
            <input type="password" id="admin-pass" class="field" placeholder="\u767B\u5F55\u5BC6\u7801" required>
            '<div class="cf-turnstile flex justify-center py-2" data-sitekey="' + sitekey + '"></div>'
            <button type="submit" class="btn-primary w-full justify-center font-bold py-3 transition-all">\u89E3\u9501</button>
        </form>
    </div>

    <div id="dashboard-panel" class="hidden app-shell w-full h-screen overflow-hidden fade-in flex flex-col">
        <div class="topbar px-4 md:px-6 py-3 md:py-4">
            <div class="gmail-admin-topbar gmail-admin-canvas">
                <div class="gmail-admin-brand">
                    <div class="gmail-admin-kicker">Workspace</div>
                    <div class="text-lg font-semibold text-strong">\u90AE\u4EF6\u5DE5\u4F5C\u533A\u8BBE\u7F6E</div>
                </div>
                <div class="gmail-admin-tab-group">
                    <div class="gmail-admin-tabs">
                        <button onclick="nav('domains')" id="nav-domains" class="admin-nav admin-nav-active">\u57DF\u540D</button>
                        <button onclick="nav('settings')" id="nav-settings" class="admin-nav">\u8BBE\u7F6E</button>
                        <button onclick="nav('invites')" id="nav-invites" class="admin-nav">\u9080\u8BF7\u7801</button>
                        <button onclick="nav('users')" id="nav-users" class="admin-nav">\u7528\u6237</button>
                    </div>
                    <button onclick="logout()" class="btn-secondary text-sm whitespace-nowrap">\u9000\u51FA\u767B\u5F55</button>
                </div>
            </div>
        </div>
        

        <div class="px-4 md:px-6 py-4 overflow-y-auto flex-1 surface-page">
            <div id="view-domains" class="gmail-admin-grid gmail-admin-canvas">
                <div class="gmail-admin-stack gmail-admin-domain-stack">
                    <div class="gmail-content-card">
                        <div class="gmail-panel-header px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 class="gmail-admin-section-title">\u53EF\u7528\u57DF\u540D</h3>
                                <p class="gmail-admin-section-copy mt-1">\u5148\u540C\u6B65 Cloudflare \u57DF\u540D\uFF0C\u518D\u51B3\u5B9A\u54EA\u4E9B\u5730\u5740\u7A7A\u95F4\u5BF9\u7528\u6237\u5F00\u653E\uFF0C\u7528\u6765\u521B\u5EFA\u90AE\u7BB1\u522B\u540D\u3002</p>
                            </div>
                            <button onclick="syncDomains()" class="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">\u540C\u6B65 Cloudflare</button>
                        </div>
                        <div class="gmail-content-body">
                            <div id="domain-list" class="space-y-3 text-sm"></div>
                        </div>
                    </div>
                    <div class="gmail-content-card">
                        <div class="gmail-panel-header px-5 py-4">
                            <h4 class="gmail-admin-section-title">\u5F00\u653E\u8303\u56F4</h4>
                            <p class="gmail-admin-section-copy mt-1">\u8FFD\u52A0\u5B50\u57DF\uFF0C\u6216\u8005\u56DE\u770B\u5F53\u524D\u5DF2\u5F00\u653E\u7684\u6839\u57DF\u4E0E\u5B50\u57DF\uFF0C\u7EDF\u4E00\u5728\u8FD9\u91CC\u7EF4\u62A4\u3002</p>
                        </div>
                        <div class="gmail-content-body space-y-4">
                            <form onsubmit="addSubdomain(event)" class="grid grid-cols-1 md:grid-cols-[180px_1fr_120px] gap-3">
                                <select id="sub-zone" class="select"></select>
                                <input type="text" id="sub-name" class="field" placeholder="\u5B50\u57DF\u540D\u524D\u7F00\uFF0C\u5982 mail \u6216 corp">
                                <button type="submit" class="btn-primary text-sm">\u65B0\u589E\u5B50\u57DF</button>
                            </form>
                            <div id="authorized-domain-list" class="space-y-3 text-sm"></div>
                        </div>
                    </div>
                </div>
                
            </div>

            
            <div id="view-settings" class="hidden gmail-admin-grid gmail-admin-canvas">
<div class="gmail-content-card">
                    <div class="gmail-panel-header px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 class="gmail-admin-section-title">\u5BB9\u91CF\u4E0E\u89C4\u5219</h3>
                            <p class="gmail-admin-section-copy mt-1">\u7EDF\u4E00\u63A7\u5236\u6CE8\u518C\u3001\u5BB9\u91CF\u3001\u6709\u6548\u671F\u548C\u9644\u4EF6\u9650\u5236\uFF0C\u8BA9\u6574\u4E2A\u90AE\u4EF6\u5DE5\u4F5C\u533A\u5728\u9AD8\u5CF0\u65F6\u4E5F\u66F4\u7A33\u3002</p>
                        </div>
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
                        <h3 class="gmail-admin-section-title">\u9080\u8BF7\u7801</h3>
                        <p class="gmail-admin-section-copy mt-1">\u751F\u6210\u3001\u8C03\u6574\u548C\u56DE\u6536\u9080\u8BF7\u7801\uFF0C\u7528\u66F4\u76F4\u63A5\u7684\u65B9\u5F0F\u63A7\u5236\u8C01\u53EF\u4EE5\u8FDB\u5165\u6CE8\u518C\u6D41\u7A0B\u3002</p>
                    </div>
                    <div class="gmail-content-body space-y-5">
                        <form onsubmit="createInvite(event)" class="grid grid-cols-1 md:grid-cols-[1fr_160px_120px_120px] gap-3">
                            <input type="text" id="new-invite-code" class="field" placeholder="\u9080\u8BF7\u7801\uFF0C\u5982 ABCD-2026" required>
                            <input type="number" min="1" id="new-invite-max" class="field" placeholder="\u53EF\u7528\u6B21\u6570" required>
                            <button type="button" onclick="randomInvite()" class="btn-secondary text-sm">\u968F\u673A\u751F\u6210</button>
                            <button type="submit" class="btn-primary text-sm">\u65B0\u589E</button>
                        </form>
                        <div id="invite-table-body" class="gmail-admin-list"></div>
                    </div>
                </div>
            </div>

            <div id="view-users" class="hidden gmail-admin-grid gmail-admin-canvas">
                <div class="gmail-content-card">
                    <div class="gmail-panel-header px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <h3 class="gmail-admin-section-title">\u7528\u6237</h3>
                            <p class="gmail-admin-section-copy mt-1">\u641C\u7D22\u7528\u6237\u3001\u67E5\u770B\u90AE\u7BB1\u7ED1\u5B9A\u72B6\u6001\uFF0C\u5E76\u5728\u5FC5\u8981\u65F6\u6E05\u7406\u8D26\u6237\u6570\u636E\u3002</p>
                        </div>
                        <div class="gmail-user-search lg:w-auto">
                            <input type="text" id="search-user" class="field flex-1 lg:w-[220px]" placeholder="\u641C\u7D22\u7528\u6237\u540D...">
                            <button onclick="loadUsers(1)" class="btn-secondary text-sm whitespace-nowrap">\u7CBE\u51C6\u641C\u7D22</button>
                        </div>
                    </div>
                    <div class="gmail-content-body space-y-4">
                        <div id="user-table-body" class="gmail-admin-list"></div>
                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-sm">
                            <span id="page-info" class="text-soft font-medium"></span>
                            <div class="flex gap-2">
                                <button onclick="changePage(-1)" class="btn-secondary text-sm px-3 py-1.5">\u4E0A\u4E00\u9875</button>
                                <button onclick="changePage(1)" class="btn-secondary text-sm px-3 py-1.5">\u4E0B\u4E00\u9875</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const basePath = '${adminPath}';
        const TURNSTILE_BYPASS = ${bypassTurnstile ? "true" : "false"};
        const durationOptions = [{value:'1',label:'1 \u5C0F\u65F6'},{value:'8',label:'8 \u5C0F\u65F6'},{value:'24',label:'24 \u5C0F\u65F6'},{value:'48',label:'48 \u5C0F\u65F6'},{value:'72',label:'72 \u5C0F\u65F6'},{value:'168',label:'168 \u5C0F\u65F6'},{value:'permanent',label:'\u6C38\u4E45'}];
        const durationConfigKeys = ['max_destination_duration_hours','max_route_duration_hours'];
        const booleanConfigKeys = ['allow_registration','enable_invitation_code'];
        const bytesPerMB = 1048576;
        const sizeConfigKeys = ['max_inbound_body_bytes','max_inbound_attachment_bytes','max_inbound_total_attachment_bytes','max_inbound_r2_storage_bytes'];
        const cfgOrder = ['allow_registration','enable_invitation_code','max_users','max_routes_per_user','max_total_destinations','max_destinations_per_user','max_regs_per_ip_24h','max_destination_duration_hours','max_route_duration_hours','pending_dest_expiry_hours','unverified_user_expiry_hours','inbound_mail_retention_days','max_inbound_body_bytes','max_inbound_attachment_bytes','max_inbound_total_attachment_bytes','max_inbound_r2_storage_bytes','max_inbound_attachments_per_email','allowed_countries'];
        const cfgDict = {
            'max_users': '\u7CFB\u7EDF\u6700\u5927\u6CE8\u518C\u603B\u4EBA\u6570',
            'max_routes_per_user': '\u5355\u7528\u6237\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u4E0A\u9650',
            'max_total_destinations': '\u5168\u5C40\u76EE\u6807\u90AE\u7BB1\u603B\u914D\u989D',
            'max_destinations_per_user': '\u5355\u7528\u6237\u5E95\u5C42\u6536\u4EF6\u7BB1\u4E0A\u9650',
            'max_regs_per_ip_24h': '\u5355 IP \u6BCF 24 \u5C0F\u65F6\u6CE8\u518C\u4E0A\u9650',
            'unverified_user_expiry_hours': '\u65E0\u90AE\u7BB1\u50F5\u5C38\u53F7\u6E05\u7406\u65F6\u95F4(\u65F6)',
            'pending_dest_expiry_hours': '\u9A8C\u8BC1\u90AE\u4EF6\u672A\u786E\u8BA4\u8D85\u65F6(\u65F6)',
            'allowed_countries': '\u5141\u8BB8\u6CE8\u518C\u7684\u56FD\u5BB6\u4EE3\u7801(ALL\u4E0D\u9650)',
            'allow_registration': '\u662F\u5426\u5F00\u653E\u65B0\u6CE8\u518C',
            'enable_invitation_code': '\u662F\u5426\u542F\u7528\u9080\u8BF7\u7801',
            'max_destination_duration_hours': '\u7ED1\u5B9A\u9A8C\u8BC1\u90AE\u7BB1\u6700\u5927\u6709\u6548\u671F',
            'max_route_duration_hours': '\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u6700\u5927\u6709\u6548\u671F',
            'inbound_mail_retention_days': '\u7AD9\u5185\u90AE\u4EF6\u4FDD\u7559\u5929\u6570',
            'max_inbound_body_bytes': '\u7AD9\u5185\u90AE\u4EF6\u6B63\u6587\u6700\u5927\u5927\u5C0F(MB)',
            'max_inbound_attachment_bytes': '\u5355\u9644\u4EF6\u6700\u5927\u5927\u5C0F(MB)',
            'max_inbound_total_attachment_bytes': '\u5355\u5C01\u90AE\u4EF6\u9644\u4EF6\u603B\u5927\u5C0F(MB)',
            'max_inbound_r2_storage_bytes': '\u7AD9\u5185\u9644\u4EF6 R2 \u5B58\u50A8\u4E0A\u9650(MB)',
            'max_inbound_attachments_per_email': '\u5355\u5C01\u90AE\u4EF6\u9644\u4EF6\u6570\u91CF\u4E0A\u9650'
        };
        let currPage = 1;
        let cfZones = [];
        let bypassWarned = false;

        function escapeHTML(s) {
            var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return map[ch]; });
        }
        function escapeAttr(s) {
            return escapeHTML(String(s == null ? '' : s));
        }
        function parsePositiveIntAttr(value) {
            var n = parseInt(String(value == null ? '' : value), 10);
            return Number.isFinite(n) && n >= 0 ? n : null;
        }
        function handleAdminActionClick(event) {
            var target = event.target.closest('[data-admin-action]');
            if (!target) return;
            var action = target.getAttribute('data-admin-action') || '';
            if (!action) return;
            event.preventDefault();
            if (action === 'save-config') return saveC(target.getAttribute('data-key') || '');
            if (action === 'toggle-domain') {
                var domainRef = parsePositiveIntAttr(target.getAttribute('data-ref'));
                if (domainRef == null) return;
                return tDom(target.getAttribute('data-mode') || '', domainRef);
            }
            if (action === 'save-invite') return saveInvite(target.getAttribute('data-code') || '');
            if (action === 'delete-invite') return deleteInvite(target.getAttribute('data-code') || '');
            if (action === 'delete-user') {
                var userId = parsePositiveIntAttr(target.getAttribute('data-user-id'));
                if (userId == null) return;
                return deleteUser(userId);
            }
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
        function setAdminScreen(mode) {
            var body = document.body;
            var booting = document.getElementById('booting-panel');
            var loginPanel = document.getElementById('login-panel');
            var dashboardPanel = document.getElementById('dashboard-panel');
            if (!body || !booting || !loginPanel || !dashboardPanel) return;
            body.classList.remove('auth-mode', 'dashboard-mode');
            if (mode === 'dashboard') {
                body.classList.add('dashboard-mode');
                booting.classList.add('hidden');
                loginPanel.classList.add('hidden');
                dashboardPanel.classList.remove('hidden');
                return;
            }
            body.classList.add('auth-mode');
            dashboardPanel.classList.add('hidden');
            if (mode === 'boot') {
                booting.classList.remove('hidden');
                loginPanel.classList.add('hidden');
                return;
            }
            booting.classList.add('hidden');
            loginPanel.classList.remove('hidden');
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
            var boundLabel = storage.r2Bound ? 'R2 \u5DF2\u7ED1\u5B9A' : 'R2 \u672A\u7ED1\u5B9A';
            var boundClass = storage.r2Bound ? 'badge-status badge-success' : 'badge-status badge-warning';
            var limitText = limit > 0 ? formatStorageSize(limit) : '\u4E0D\u4FDD\u5B58\u9644\u4EF6';
            box.innerHTML = '<div class="gmail-content-card"><div class="gmail-content-body py-4">' +
                '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">' +
                  '<div><div class="text-sm font-bold text-strong">\u7AD9\u5185\u9644\u4EF6 R2 \u7528\u91CF</div><div class="text-xs text-soft mt-1">\u5F53\u524D\u7CFB\u7EDF\u9644\u4EF6\u5360\u7528 ' + escapeHTML(formatStorageSize(used)) + ' / ' + escapeHTML(limitText) + '\uFF0C\u5171 ' + escapeHTML(storage.attachmentCount || 0) + ' \u4E2A\u9644\u4EF6</div></div>' +
                  '<div class="flex items-center gap-1.5 flex-shrink-0"><span class="text-xs px-2.5 py-1 rounded-lg border ' + boundClass + '">' + boundLabel + '</span><button onclick="runCleanup()" class="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">\u7ACB\u5373\u6E05\u7406\u8FC7\u671F\u6570\u636E</button></div>' +
                '</div>' +
                '<div class="h-2 surface-inset rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:' + percent.toFixed(1) + '%"></div></div>' +
                '<div class="mt-2 text-xs text-soft">\u5360\u6BD4 ' + percent.toFixed(1) + '%</div>' +
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

        function bootAdmin() {
            (async function() {
                try {
                    var ac = new AbortController();
                    var to = setTimeout(function(){ ac.abort(); }, 10000);
                    var session;
                    try {
                        session = await fetch(basePath+'/config', {signal: ac.signal});
                    } finally {
                        clearTimeout(to);
                    }
                    if (session.ok) {
                        setAdminScreen('dashboard');
                        loadConfigs(); syncDomains(); loadUsers(1); loadInvites();
                    } else {
                        setAdminScreen('login');
                    }
                } catch (_) {
                    setAdminScreen('login');
                }
            })();
        }
        document.addEventListener('click', handleAdminActionClick);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootAdmin, {once:true});
        } else {
            bootAdmin();
        }
        function nav(tab){
            ['domains','settings','invites','users'].forEach(function(name){
                document.getElementById('view-'+name).style.display = tab===name?'block':'none';
                document.getElementById('nav-'+name).className = tab===name?'admin-nav admin-nav-active':'admin-nav';
            });
            if(tab === 'invites') loadInvites();
            if(tab === 'settings') loadConfigs();
        }
        async function handleAdminLogin(e){
            e.preventDefault();
            var t = new FormData(e.target).get('cf-turnstile-response');
            if (TURNSTILE_BYPASS && !t) t = 'bypass';
            if(!t) return showT('\u8BF7\u5B8C\u6210\u4EBA\u673A\u9A8C\u8BC1', true);
            const res=await fetch(basePath+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('admin-user').value,password:document.getElementById('admin-pass').value,turnstileToken: TURNSTILE_BYPASS ? '' : t})});
            if(res.ok) location.reload();
            else {
                const d = await res.json().catch(function(){ return {}; });
                showT(d.error || '\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8D26\u53F7\u5BC6\u7801', true);
                if (!TURNSTILE_BYPASS && window.turnstile) window.turnstile.reset();
            }
        }
        async function loadConfigs(){
            const d = await (await fetch(basePath+'/config')).json();
            renderStorageStatus(d.storage || {});

            const rows = (d.data || []).sort(function(a,b){
                var ai = cfgOrder.indexOf(a.key), bi = cfgOrder.indexOf(b.key);
                return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            });
            document.getElementById('config-list').innerHTML = rows.map(function(i){
                return '<div class="gmail-config-card">' +
                    '<div class="gmail-config-card-head">' +
                        '<span class="gmail-config-card-title">' + escapeHTML(cfgDict[i.key]||i.key) + '</span>' +
                        '<span class="gmail-config-card-key">' + escapeHTML(i.key) + '</span>' +
                        '<span class="gmail-config-card-copy">\u4FEE\u6539\u540E\u4F1A\u7ACB\u5373\u5F71\u54CD\u7528\u6237\u521B\u5EFA\u90AE\u7BB1\u3001\u7AD9\u5185\u6536\u4EF6\u9650\u5236\u6216\u7CFB\u7EDF\u5BB9\u91CF\u7B56\u7565\u3002</span>' +
                    '</div>' +
                    '<div class="gmail-config-card-control">' + configControl(i) + '<button type="button" data-admin-action="save-config" data-key="' + escapeAttr(i.key) + '" class="btn-primary text-sm whitespace-nowrap">\u4FDD\u5B58</button></div>' +
                '</div>';
            }).join('');
        }
        async function saveC(k){
            let v=document.getElementById('cfg-'+k).value;
            if (sizeConfigKeys.indexOf(k) >= 0) {
                v = mbToBytesValue(v);
                if (v == null) return showT('\u8BF7\u8F93\u5165\u6709\u6548\u7684 MB \u6570\u503C', true);
            }
            const r=await fetch(basePath+'/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?'\u53C2\u6570\u5DF2\u4FDD\u5B58':(d.error || '\u4FDD\u5B58\u5931\u8D25'),!r.ok);
            if(r.ok) loadConfigs();
        }
        async function syncDomains(){
            document.getElementById('domain-list').innerHTML='<span class="text-emerald-500 animate-pulse">\u6B63\u5728\u901A\u8FC7 Cloudflare \u63A5\u53E3\u62C9\u53D6\u5168\u90E8\u57DF\u540D...</span>';
            try {
                const cfResRaw = await fetch(basePath+'/cf-zones');
                const cfRes = await cfResRaw.json();
                if (cfRes.error) {
                    return document.getElementById('domain-list').innerHTML='<div class="p-4 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300"><b>Cloudflare \u63A5\u53E3\u62D2\u7EDD\u8BBF\u95EE\uFF1A</b><br/>' + escapeHTML(JSON.stringify(cfRes.details)) + '<br/>\u8BF7\u68C0\u67E5 API Token \u662F\u5426\u5177\u5907 Zone:Read \u6743\u9650\uFF0C\u5E76\u786E\u8BA4\u5DF2\u7ECF\u6388\u6743 All Zones\u3002</div>';
                }
                const dbR = await fetch(basePath+'/domains');
                const dbD = (await dbR.json()).data||[];
                cfZones = cfRes.data||[];
                if(!cfZones.length) return document.getElementById('domain-list').innerHTML='<div class="empty-state"><div class="empty-state-title mb-2">\u5F53\u524D\u8D26\u53F7\u4E0B\u6CA1\u6709\u53EF\u7528\u57DF\u540D</div><div class="empty-state-copy">Cloudflare \u8FD4\u56DE\u6210\u529F\uFF0C\u4F46\u8D26\u53F7\u91CC\u6682\u65F6\u6CA1\u6709\u53EF\u6388\u6743\u7ED9\u90AE\u7BB1\u7CFB\u7EDF\u7684\u57DF\u540D\u3002</div></div>';
                document.getElementById('sub-zone').innerHTML = cfZones.map(function(z, idx){ return '<option value="' + idx + '">' + escapeHTML(z.name) + '</option>'; }).join('');
                document.getElementById('domain-list').innerHTML = cfZones.map(function(z, idx){
                    const on = dbD.find(function(d){ return d.zone_id===z.id && d.domain===z.name; });
                return on ? '<div class="gmail-admin-row gmail-admin-row-active"><div class="gmail-admin-row-main"><div class="gmail-admin-row-title mono-accent">' + escapeHTML(z.name) + '</div><div class="gmail-admin-row-note">\u5F53\u524D\u5DF2\u5F00\u653E\uFF0C\u7528\u6237\u73B0\u5728\u5C31\u53EF\u4EE5\u7528\u5B83\u521B\u5EFA\u90AE\u7BB1\u522B\u540D\u3002</div></div><button type="button" data-admin-action="toggle-domain" data-mode="del" data-ref="' + escapeAttr(on.id) + '" class="btn-secondary text-xs px-3 py-1.5 text-danger">\u5173\u95ED\u5E76\u6E05\u7A7A\u8DEF\u7531</button></div>'
                              : '<div class="gmail-admin-row"><div class="gmail-admin-row-main"><div class="gmail-admin-row-title">' + escapeHTML(z.name) + '</div><div class="gmail-admin-row-note">\u8FD8\u6CA1\u6709\u5BF9\u7528\u6237\u5F00\u653E\uFF0C\u6388\u6743\u540E\u5C31\u4F1A\u51FA\u73B0\u5728\u521B\u5EFA\u522B\u540D\u65F6\u7684\u53EF\u9009\u57DF\u540D\u91CC\u3002</div></div><button type="button" data-admin-action="toggle-domain" data-mode="add" data-ref="' + escapeAttr(idx) + '" class="btn-secondary text-xs px-3 py-1.5">\u5F00\u653E\u7ED9\u7528\u6237</button></div>';
                }).join('');
                renderAuthorizedDomains(dbD);
            } catch (err) { document.getElementById('domain-list').innerHTML='<div class="empty-state"><div class="empty-state-title mb-2">\u57DF\u540D\u52A0\u8F7D\u5931\u8D25</div><div class="empty-state-copy">\u7F51\u7EDC\u8BF7\u6C42\u51FA\u73B0\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF0C\u6216\u68C0\u67E5 Cloudflare API \u914D\u7F6E\u3002</div></div>'; }
        }
        function renderAuthorizedDomains(items){
            document.getElementById('authorized-domain-list').innerHTML = items.length ? items.map(function(d){
                const zone = cfZones.find(function(z){ return z.id === d.zone_id; });
                const isSub = zone && d.domain !== zone.name;
                return '<div class="gmail-admin-row"><div class="gmail-admin-row-main"><div class="gmail-admin-row-title mono-accent">' + escapeHTML(d.domain) + '</div><div class="gmail-admin-row-note">' + (isSub ? '\u5B50\u57DF\u540D\uFF0C\u9002\u5408\u6309\u54C1\u724C\u6216\u7528\u9014\u5206\u6D41\u3002' : '\u6839\u57DF\u540D\uFF0C\u9002\u5408\u4F5C\u4E3A\u4E3B\u5165\u53E3\u5F00\u653E\u3002') + '</div></div><button type="button" data-admin-action="toggle-domain" data-mode="del" data-ref="' + escapeAttr(d.id) + '" class="btn-secondary text-xs px-3 py-1.5 text-danger">\u79FB\u9664</button></div>';
            }).join('') : '<div class="empty-state"><div class="empty-state-title mb-2">\u8FD8\u6CA1\u6709\u5F00\u653E\u90AE\u7BB1\u57DF\u540D</div><div class="empty-state-copy">\u6388\u6743\u6839\u57DF\u540D\u6216\u65B0\u589E\u5B50\u57DF\u540D\u540E\uFF0C\u5B83\u4EEC\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\uFF0C\u7528\u6237\u4E5F\u5C31\u53EF\u4EE5\u5F00\u59CB\u521B\u5EFA\u90AE\u7BB1\u522B\u540D\u3002</div></div>';
        }
        async function tDom(act, ref){
            if(act==='del' && !confirm('\u9AD8\u5371\u64CD\u4F5C\uFF1A\u6B64\u64CD\u4F5C\u5C06\u5F3A\u5236\u5220\u9664 Cloudflare \u4E0A\u8BE5\u57DF\u540D\u6240\u5C5E\u7684\u6240\u6709\u7528\u6237\u8DEF\u7531\uFF0C\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F')) return;
            if (act === 'del') await fetch(basePath+'/domains/'+ref,{method:'DELETE'});
            else {
                const z = cfZones[ref];
                const r = await fetch(basePath+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:z.name,zone_id:z.id,zone_name:z.name})});
                const d = await r.json().catch(function(){ return {}; });
                if(!r.ok) showT(d.error || '\u57DF\u540D\u5F00\u653E\u5931\u8D25', true);
            }
            syncDomains();
        }
        async function addSubdomain(e){
            e.preventDefault();
            const z = cfZones[document.getElementById('sub-zone').value];
            if(!z) return showT('\u8BF7\u5148\u9009\u62E9\u6839\u57DF\u540D', true);
            let sub = document.getElementById('sub-name').value.trim().toLowerCase();
            if(!sub) return showT('\u8BF7\u8F93\u5165\u5B50\u57DF\u540D\u524D\u7F00', true);
            sub = sub.replace(/^@\\./,'').replace(/\\.$/,'');
            if(sub === z.name) return showT('\u6839\u57DF\u540D\u8BF7\u4F7F\u7528\u4E0A\u65B9\u6388\u6743\u5F00\u653E\uFF0C\u4E0D\u8981\u4F5C\u4E3A\u5B50\u57DF\u540D\u6DFB\u52A0', true);
            if(sub.indexOf('.') >= 0 && !sub.endsWith('.' + z.name)) return showT('\u5B8C\u6574\u5B50\u57DF\u540D\u5FC5\u987B\u5C5E\u4E8E\u6240\u9009\u6839\u57DF\u540D', true);
            const full = sub.endsWith('.' + z.name) ? sub : sub + '.' + z.name;
            const r = await fetch(basePath+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:full,zone_id:z.id,zone_name:z.name})});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?'\u5B50\u57DF\u540D\u5DF2\u5F00\u653E\uFF0CCloudflare Email Routing DNS \u5DF2\u914D\u7F6E':(d.error || '\u5B50\u57DF\u540D\u5F00\u653E\u5931\u8D25'),!r.ok);
            if(r.ok){ document.getElementById('sub-name').value=''; syncDomains(); }
        }
        async function runCleanup(){
            const r = await fetch(basePath + '/cleanup', {method:'POST'});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?(d.message || '\u6E05\u7406\u5B8C\u6210'):(d.error || '\u6E05\u7406\u5931\u8D25'), !r.ok);
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
                        '<div class="gmail-admin-meta-line">\u521B\u5EFA\u65F6\u95F4\uFF1A' + escapeHTML(new Date(i.created_at).toLocaleString()) + '</div>' +
                        '<div class="gmail-admin-meta-line">\u4F60\u53EF\u4EE5\u76F4\u63A5\u8C03\u6574\u603B\u6B21\u6570\u548C\u5DF2\u4F7F\u7528\u6B21\u6570\uFF0C\u4FDD\u5B58\u540E\u4F1A\u9A6C\u4E0A\u5F71\u54CD\u6CE8\u518C\u653E\u884C\u89C4\u5219\u3002</div>' +
                    '</div>' +
                    '<div class="gmail-admin-card-side">' +
                        '<div class="gmail-admin-metrics"><span class="gmail-admin-metric">\u6700\u5927 ' + i.max_uses + '</span><span class="gmail-admin-metric">\u5DF2\u7528 ' + (i.used_count || 0) + '</span><span class="gmail-admin-metric">\u5269\u4F59 ' + left + '</span></div>' +
                        '<div class="grid grid-cols-2 gap-2"><input id="inv-max-' + code + '" type="number" min="1" value="' + i.max_uses + '" class="field px-2 py-1 text-sm" placeholder="\u6700\u5927\u6B21\u6570"><input id="inv-used-' + code + '" type="number" min="0" value="' + (i.used_count || 0) + '" class="field px-2 py-1 text-sm" placeholder="\u5DF2\u4F7F\u7528"></div>' +
                    '</div>' +
                    '<div class="gmail-admin-card-actions"><button type="button" data-admin-action="save-invite" data-code="' + code + '" class="btn-primary text-xs px-3 py-1.5">\u4FDD\u5B58</button><button type="button" data-admin-action="delete-invite" data-code="' + code + '" class="btn-secondary text-xs px-3 py-1.5 text-danger">\u5220\u9664</button></div>' +
                '</div>';
            }).join('') || '<div class="gmail-admin-card gmail-admin-card-compact gmail-admin-card-split justify-center"><div class="empty-state w-full"><div class="empty-state-title mb-2">\u8FD8\u6CA1\u6709\u9080\u8BF7\u7801</div><div class="empty-state-copy">\u751F\u6210\u9080\u8BF7\u7801\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\uFF0C\u4F60\u53EF\u4EE5\u968F\u65F6\u8C03\u6574\u6B21\u6570\u3001\u56DE\u6536\u6216\u91CD\u65B0\u5206\u914D\u3002</div></div></div>';
        }
        async function createInvite(e){
            e.preventDefault();
            const code = document.getElementById('new-invite-code').value.trim();
            const max = document.getElementById('new-invite-max').value;
            const r = await fetch(basePath + '/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code,max_uses:max})});
            const d = await r.json();
            showT(r.ok?'\u9080\u8BF7\u7801\u5DF2\u65B0\u589E':(d.error || '\u65B0\u589E\u5931\u8D25'),!r.ok);
            if(r.ok){ document.getElementById('new-invite-code').value=''; document.getElementById('new-invite-max').value=''; loadInvites(); }
        }
        async function saveInvite(code){
            const max = document.getElementById('inv-max-'+code).value;
            const used = document.getElementById('inv-used-'+code).value;
            const r = await fetch(basePath + '/invitations/' + encodeURIComponent(code),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({max_uses:max,used_count:used})});
            const d = await r.json();
            showT(r.ok?'\u9080\u8BF7\u7801\u5DF2\u4FDD\u5B58':(d.error || '\u4FDD\u5B58\u5931\u8D25'),!r.ok);
            if(r.ok) loadInvites();
        }
        async function deleteInvite(code){
            if(!confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u9080\u8BF7\u7801\u5417\uFF1F')) return;
            const r = await fetch(basePath + '/invitations/' + encodeURIComponent(code),{method:'DELETE'});
            showT(r.ok?'\u9080\u8BF7\u7801\u5DF2\u5220\u9664':'\u5220\u9664\u5931\u8D25',!r.ok);
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
                        var statusText = verified ? '\u5DF2\u9A8C\u8BC1' : '\u5F85\u9A8C\u8BC1';
                        var statusClass = verified
                            ? 'badge-status badge-success'
                            : 'badge-status badge-info';
                        return '<div class="gmail-user-card-list-item"><span class="mono-accent">' + escapeHTML(dest.email || '') + '</span><span class="' + statusClass + '">' + statusText + '</span></div>';
                    }).join('')
                    : '<span class="text-soft italic">\u6682\u65E0\u90AE\u7BB1</span>';
                return '<div class="gmail-admin-card gmail-admin-card-compact gmail-user-card">' +
                    '<div class="gmail-user-card-head">' +
                        '<div class="gmail-user-card-identity">' +
                            '<div class="gmail-user-card-title">' + escapeHTML(u.username) + ' <span class="gmail-user-card-id">#' + u.id + '</span></div>' +
                            '<div class="gmail-user-card-copy">\u8FD9\u91CC\u96C6\u4E2D\u5C55\u793A\u8FD9\u4E2A\u7528\u6237\u7684\u6CE8\u518C\u4FE1\u606F\u3001\u8F6C\u53D1\u90AE\u7BB1\u548C\u5F53\u524D\u8DEF\u7531\u5360\u7528\uFF0C\u65B9\u4FBF\u5FEB\u901F\u5224\u65AD\u662F\u5426\u9700\u8981\u6E05\u7406\u8D26\u6237\u3002</div>' +
                        '</div>' +
                        '<div class="gmail-user-card-metrics"><span class="gmail-user-metric-chip">' + u.route_count + ' \u6761\u8DEF\u7531</span><span class="gmail-user-metric-chip">' + destinations.length + ' \u4E2A\u90AE\u7BB1</span></div>' +
                    '</div>' +
                    '<div class="gmail-user-card-grid">' +
                        '<div class="gmail-user-card-panel">' +
                            '<div class="gmail-user-card-panel-head"><div class="gmail-user-card-panel-title">\u8D26\u6237\u6982\u89C8</div></div>' +
                            '<div class="gmail-user-card-panel-copy">\u6CE8\u518C\u65F6\u95F4\uFF1A' + new Date(u.created_at).toLocaleString() + '</div>' +
                            '<div class="gmail-user-card-panel-copy">\u6CE8\u518C IP\uFF1A<span class="font-mono">' + escapeHTML(u.reg_ip) + '</span></div>' +
                        '</div>' +
                        '<div class="gmail-user-card-panel">' +
                            '<div class="gmail-user-card-panel-head"><div class="gmail-user-card-panel-title">\u8F6C\u53D1\u90AE\u7BB1</div></div>' +
                            '<div class="gmail-user-card-list">' + destinationHTML + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gmail-user-card-panel gmail-user-card-panel-danger">' +
                        '<div class="gmail-user-card-panel-head"><div class="gmail-user-card-panel-title">\u5371\u9669\u64CD\u4F5C</div></div>' +
                        '<div class="gmail-user-card-panel-copy">\u5220\u9664\u540E\u4F1A\u540C\u65F6\u6E05\u9664\u8FD9\u4E2A\u7528\u6237\u7684\u8F6C\u53D1\u90AE\u7BB1\u3001\u90AE\u7BB1\u522B\u540D\u548C\u5F53\u524D\u4F1A\u8BDD\u3002</div>' +
                        '<div class="gmail-admin-card-actions gmail-user-card-actions"><button type="button" data-admin-action="delete-user" data-user-id="' + escapeAttr(u.id) + '" class="btn-secondary text-xs px-3 py-1.5 text-danger">\u5220\u9664\u8D26\u6237</button></div>' +
                    '</div>' +
                '</div>';
            }).join('') || '<div class="gmail-admin-card gmail-admin-card-compact gmail-admin-card-split justify-center"><div class="empty-state w-full"><div class="empty-state-title mb-2">\u6CA1\u6709\u627E\u5230\u7528\u6237</div><div class="empty-state-copy">\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5\uFF0C\u6216\u8005\u6E05\u7A7A\u641C\u7D22\u540E\u91CD\u65B0\u67E5\u770B\u5168\u90E8\u7528\u6237\u5217\u8868\u3002</div></div></div>';
            document.getElementById('page-info').innerText = '\u7B2C ' + page + ' \u9875';
        }
        async function deleteUser(id){
            if(!confirm('\u786E\u5B9A\u6E05\u9664\u8FD9\u4E2A\u7528\u6237\u5417\uFF1F\u8BE5\u7528\u6237\u7684\u8F6C\u53D1\u90AE\u7BB1\u3001\u90AE\u7BB1\u522B\u540D\u548C\u4F1A\u8BDD\u90FD\u4F1A\u88AB\u5220\u9664\u3002')) return;
            const r = await fetch(basePath + '/users/' + id, {method:'DELETE'});
            const d = await r.json().catch(function(){ return {}; });
            showT(r.ok?(d.message || '\u7528\u6237\u5DF2\u6E05\u9664'):(d.error || '\u6E05\u9664\u5931\u8D25'), !r.ok);
            if(r.ok) loadUsers(currPage);
        }
        function changePage(d){ if(currPage+d>0) loadUsers(currPage+d); }
        async function logout(){ await fetch(basePath+'/logout',{method:'POST'}); location.reload(); }
    <\/script>
</body>
</html>`, "renderAdminHTML");
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, method = req.method;
    const jsonRes = jsonResponse;
    const readBody = /* @__PURE__ */ __name(async () => {
      const parsed = await readJsonBody(req);
      if (!parsed.ok) return { ok: false, response: jsonRes({ error: parsed.error }, 400) };
      return { ok: true, data: parsed.data };
    }, "readBody");
    if (!isTrustedOrigin(req, url)) return jsonRes({ error: "\u8DE8\u7AD9\u8BF7\u6C42\u5DF2\u88AB\u62D2\u7EDD" }, 403);
    if (!env.DB) return jsonRes({ error: "\u8BF7\u5728 Settings -> Bindings \u4E2D\u7ED1\u5B9A DB \u6570\u636E\u5E93" }, 500);
    const db = env.DB, adminPath = env.ADMIN_PATH || "/admin";
    const genT = /* @__PURE__ */ __name(() => crypto.randomUUID(), "genT"), getC = /* @__PURE__ */ __name((n) => req.headers.get("Cookie")?.match(new RegExp("(^| )" + n + "=([^;]+)"))?.[2], "getC");
    try {
      await ensureSystem(db);
      const cfg = await getConfigMap(db);
      const turnstileBypass = String(env.TURNSTILE_BYPASS || "").toLowerCase() === "true";
      if (turnstileBypass) console.warn("[security_mode=turnstile_bypass]", JSON.stringify({ path, method }));
      if (path === "/favicon.ico") return emptyResponse(204);
      if (path === "/") return htmlResponse(renderUserHTML(env.TURNSTILE_SITEKEY, turnstileBypass));
      if (path === adminPath) return htmlResponse(renderAdminHTML(adminPath, env.TURNSTILE_SITEKEY, turnstileBypass), { "Cache-Control": "no-cache,no-store,must-revalidate" });
      if (path === "/api/public-config" && method === "GET") return jsonRes(await getPublicConfig(db, cfg));
      const verifyTurnstile = /* @__PURE__ */ __name(async (t, ip) => {
        if (turnstileBypass) return { ok: true };
        if (!env.TURNSTILE_SECRET) return { ok: false, error: "Turnstile Secret \u672A\u914D\u7F6E" };
        if (!t) return { ok: false, error: "\u8BF7\u5B8C\u6210\u4EBA\u673A\u9A8C\u8BC1" };
        const body = new URLSearchParams();
        body.set("secret", env.TURNSTILE_SECRET);
        body.set("response", t);
        if (ip && ip !== "0" && ip !== "0.0.0.0") body.set("remoteip", ip);
        try {
          const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
          const data = await res.json();
          if (data.success) return { ok: true };
          const codes = data["error-codes"] || [];
          if (codes.includes("timeout-or-duplicate")) return { ok: false, error: "\u4EBA\u673A\u9A8C\u8BC1\u5DF2\u8FC7\u671F\u6216\u5DF2\u88AB\u4F7F\u7528\uFF0C\u8BF7\u91CD\u65B0\u52FE\u9009\u9A8C\u8BC1" };
          if (codes.includes("invalid-input-secret")) return { ok: false, error: "Turnstile Secret \u914D\u7F6E\u9519\u8BEF" };
          if (codes.includes("invalid-input-response") || codes.includes("missing-input-response")) return { ok: false, error: "\u4EBA\u673A\u9A8C\u8BC1\u65E0\u6548\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5" };
          return { ok: false, error: "\u4EBA\u673A\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" };
        } catch (_) {
          return { ok: false, error: "\u4EBA\u673A\u9A8C\u8BC1\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
        }
      }, "verifyTurnstile");
      if (path.startsWith(adminPath)) {
        const act = path.replace(adminPath, "");
        if (act === "/login" && method === "POST") {
          const body = await readBody();
          if (!body.ok) return body.response;
          const { username, password, turnstileToken } = body.data;
          const ip = getClientIp(req);
          const adminName = normalizeUsername(username);
          const adminPassword = String(password || "");
          const adminMatched = adminName === String(env.ADMIN_USERNAME || "") && adminPassword === String(env.ADMIN_PASSWORD || "");
          if (!adminMatched && await isAuthRateLimited(db, "admin_login", ip, adminName)) {
            return jsonRes({ error: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, 429);
          }
          const turnstile = await verifyTurnstile(turnstileToken, ip);
          if (!turnstile.ok) {
            await recordAuthFailure(db, "admin_login", ip, adminName);
            return jsonRes({ error: turnstile.error }, 400);
          }
          if (adminMatched) {
            await clearAuthFailures(db, "admin_login", ip, adminName);
            const t = genT();
            await db.prepare("INSERT INTO sessions(token,role,expires_at) VALUES(?,'admin',datetime('now','+1 day'))").bind(t).run();
            return jsonRes({ success: true }, 200, { "Set-Cookie": buildCookie("admin_token", t, adminPath, 86400) });
          }
          await recordAuthFailure(db, "admin_login", ip, adminName);
          return jsonRes({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u4E0D\u6B63\u786E" }, 401);
        }
        if (act === "/logout" && method === "POST") return jsonRes({ success: true }, 200, { "Set-Cookie": buildCookie("admin_token", "", adminPath, 0) });
        const aT = getC("admin_token");
        if (!aT) return jsonRes({ error: "\u65E0\u6743\u8BBF\u95EE" }, 403);
        if (!await db.prepare("SELECT 1 FROM sessions WHERE token=? AND role='admin' AND expires_at>datetime('now')").bind(aT).first()) return jsonRes({ error: "\u767B\u5F55\u72B6\u6001\u5931\u6548" }, 403);
        if (act === "/config" && method === "GET") {
          return jsonRes({
            data: (await db.prepare("SELECT key, value FROM sys_config").all()).results,
            storage: await getInboundAttachmentStorageUsage(db, env, cfg),
            security: {
              turnstileBypass,
              securityMode: turnstileBypass ? "turnstile_bypass" : "normal"
            }
          });
        }
        if (act === "/config" && method === "POST") {
          const body = await readBody();
          if (!body.ok) return body.response;
          const { key, value } = body.data;
          const cleanKey = String(key || "");
          if (!DEFAULT_CONFIGS.some(([k]) => k === cleanKey)) return jsonRes({ error: "\u672A\u77E5\u914D\u7F6E\u9879" }, 400);
          const nextValue = validateConfigValue(cleanKey, value);
          if (!nextValue.ok) return jsonRes({ error: nextValue.error }, 400);
          const nextCfg = { ...cfg, [cleanKey]: nextValue.value };
          if (durationRank(nextCfg.max_route_duration_hours) > durationRank(nextCfg.max_destination_duration_hours)) {
            return jsonRes({ error: "\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u6700\u5927\u6709\u6548\u671F\u4E0D\u80FD\u8D85\u8FC7\u7ED1\u5B9A\u9A8C\u8BC1\u90AE\u7BB1\u6700\u5927\u6709\u6548\u671F" }, 400);
          }
          await db.prepare("INSERT INTO sys_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(cleanKey, nextValue.value).run();
          return jsonRes({ success: true });
        }
        if (act === "/cleanup" && method === "POST") {
          await runTimedCleanup(db, env, cfg);
          return jsonRes({ success: true, message: "\u8FC7\u671F\u6570\u636E\u5DF2\u6E05\u7406" });
        }
        if (act === "/cf-zones" && method === "GET") {
          const cf = await cfRequest(env, "/zones", { label: "list_zones" });
          if (!cf.ok) return jsonRes({ error: true, details: cf.data.errors || cf.data }, 400);
          return jsonRes({ data: cf.data.result || [] });
        }
        if (act === "/domains" && method === "GET") return jsonRes({ data: (await db.prepare("SELECT id,domain,zone_id FROM domains ORDER BY domain ASC").all()).results });
        if (act === "/domains" && method === "POST") {
          const body = await readBody();
          if (!body.ok) return body.response;
          const { domain, zone_id, zone_name } = body.data;
          const cleanDomain = normalizeDomain(domain);
          const cleanZoneName = normalizeDomain(zone_name || domain);
          const cleanZoneId = String(zone_id || "").trim();
          if (!cleanZoneId || cleanZoneId.length > 128) return jsonRes({ error: "\u7F02\u54C4\u76AF Zone ID" }, 400);
          if (!isValidDomainName(cleanDomain)) return jsonRes({ error: "\u57DF\u540D\u683C\u5F0F\u4E0D\u6B63\u786E" }, 400);
          if (!isValidDomainName(cleanZoneName) || !domainBelongsToZone(cleanDomain, cleanZoneName)) return jsonRes({ error: "\u5B50\u57DF\u540D\u5FC5\u987B\u5C5E\u4E8E\u6240\u9009\u6839\u57DF\u540D" }, 400);
          if (await db.prepare("SELECT id FROM domains WHERE domain=?").bind(cleanDomain).first()) return jsonRes({ error: "\u8FD9\u4E2A\u90AE\u7BB1\u57DF\u540D\u5DF2\u7ECF\u5F00\u653E" }, 400);
          if (cleanDomain !== cleanZoneName) {
            const cf = await cfEnableEmailRoutingDomain(cleanZoneId, cleanDomain, env);
            const details = JSON.stringify(cf.data?.errors || cf.data?.messages || cf.data || {});
            if (!cf.ok && !/already|exist|enabled|configured/i.test(details)) {
              return jsonRes({ error: "Cloudflare \u672A\u80FD\u542F\u7528\u8BE5\u5B50\u57DF\u540D\u7684 Email Routing DNS\uFF0C\u8BF7\u786E\u8BA4 API Token \u5177\u5907 Zone Settings Write \u6743\u9650", details: cf.data?.errors || cf.data }, 500);
            }
          }
          await db.prepare("INSERT INTO domains(domain,zone_id) VALUES(?,?)").bind(cleanDomain, cleanZoneId).run();
          return jsonRes({ success: true });
        }
        if (act.startsWith("/domains/") && method === "DELETE") {
          const id = parseInt(act.split("/")[2], 10);
          if (!Number.isFinite(id) || id < 1) return jsonRes({ error: "\u57DF\u540D ID \u4E0D\u6B63\u786E" }, 400);
          const dData = await db.prepare("SELECT zone_id FROM domains WHERE id=?").bind(id).first();
          if (dData) {
            const rts = await db.prepare("SELECT cf_rule_id FROM email_routes WHERE domain_id=?").bind(id).all();
            for (const r of rts.results || []) {
              if (r.cf_rule_id) await cfDeleteRoute(env, dData.zone_id, r.cf_rule_id, "delete_domain_route");
            }
            await db.prepare("DELETE FROM email_routes WHERE domain_id=?").bind(id).run();
            await db.prepare("DELETE FROM domains WHERE id=?").bind(id).run();
          }
          return jsonRes({ success: true });
        }
        if (act === "/invitations" && method === "GET") {
          return jsonRes({ data: (await db.prepare("SELECT code,max_uses,used_count,created_at FROM invitation_codes ORDER BY created_at DESC").all()).results });
        }
        if (act === "/invitations" && method === "POST") {
          const body = await readBody();
          if (!body.ok) return body.response;
          const { code, max_uses } = body.data;
          const cleanCode = String(code || "").trim();
          const maxUses = parseInt(max_uses, 10);
          if (!/^[A-Za-z0-9_-]{3,64}$/.test(cleanCode)) return jsonRes({ error: "\u9080\u8BF7\u7801\u53EA\u80FD\u4F7F\u7528 3-64 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF" }, 400);
          if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > MAX_INVITATION_USES) return jsonRes({ error: `\u6700\u5927\u4F7F\u7528\u6B21\u6570\u5FC5\u987B\u5728 1 \u5230 ${MAX_INVITATION_USES} \u4E4B\u95F4` }, 400);
          try {
            await db.prepare("INSERT INTO invitation_codes(code,max_uses,used_count) VALUES(?,?,0)").bind(cleanCode, maxUses).run();
            return jsonRes({ success: true });
          } catch (_) {
            return jsonRes({ error: "\u8FD9\u4E2A\u9080\u8BF7\u7801\u5DF2\u7ECF\u5B58\u5728" }, 400);
          }
        }
        if (act.startsWith("/invitations/") && method === "PUT") {
          const decoded = safeDecodeURIComponent(act.split("/")[2] || "");
          if (!decoded.ok || !/^[A-Za-z0-9_-]{3,64}$/.test(decoded.value)) return jsonRes({ error: "\u9080\u8BF7\u7801\u4E0D\u6B63\u786E" }, 400);
          const code = decoded.value;
          const body = await readBody();
          if (!body.ok) return body.response;
          const { max_uses, used_count } = body.data;
          const maxUses = parseInt(max_uses, 10);
          const usedCount = parseInt(used_count, 10);
          if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > MAX_INVITATION_USES) return jsonRes({ error: `\u6700\u5927\u4F7F\u7528\u6B21\u6570\u5FC5\u987B\u5728 1 \u5230 ${MAX_INVITATION_USES} \u4E4B\u95F4` }, 400);
          if (!Number.isFinite(usedCount) || usedCount < 0 || usedCount > maxUses) return jsonRes({ error: "\u5DF2\u4F7F\u7528\u6B21\u6570\u5FC5\u987B\u5728 0 \u5230\u6700\u5927\u6B21\u6570\u4E4B\u95F4" }, 400);
          await db.prepare("UPDATE invitation_codes SET max_uses=?, used_count=? WHERE code=?").bind(maxUses, usedCount, code).run();
          return jsonRes({ success: true });
        }
        if (act.startsWith("/invitations/") && method === "DELETE") {
          const decoded = safeDecodeURIComponent(act.split("/")[2] || "");
          if (!decoded.ok || !/^[A-Za-z0-9_-]{3,64}$/.test(decoded.value)) return jsonRes({ error: "\u9080\u8BF7\u7801\u4E0D\u6B63\u786E" }, 400);
          const code = decoded.value;
          await db.prepare("DELETE FROM invitation_codes WHERE code=?").bind(code).run();
          return jsonRes({ success: true });
        }
        if (act.startsWith("/users/") && method === "DELETE") {
          const userId = parseInt(act.split("/")[2], 10);
          if (!Number.isFinite(userId)) return jsonRes({ error: "\u7528\u6237 ID \u4E0D\u6B63\u786E" }, 400);
          const user = await db.prepare("SELECT id FROM users WHERE id=?").bind(userId).first();
          if (!user) return jsonRes({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
          await deleteUserAccount(db, env, userId);
          return jsonRes({ success: true, message: "\u7528\u6237\u5DF2\u6E05\u9664" });
        }
        if (act.startsWith("/users") && method === "GET") {
          const page = parsePositiveInteger(url.searchParams.get("page") || "1", 1, 1, 1e5), search = normalizeSearch(url.searchParams.get("search") || "");
          const offset = (page - 1) * 20;
          const q = `SELECT u.id, u.username, u.reg_ip, u.created_at, (SELECT d.email FROM user_destinations d WHERE d.user_id=u.id AND d.status='verified' AND (d.expires_at IS NULL OR datetime(d.expires_at)>datetime('now')) ORDER BY d.id DESC LIMIT 1) AS dest_email, (SELECT COUNT(*) FROM email_routes r WHERE r.user_id=u.id AND r.status='active' AND (r.expires_at IS NULL OR datetime(r.expires_at)>datetime('now'))) AS route_count FROM users u WHERE u.username LIKE ? ORDER BY u.id DESC LIMIT 20 OFFSET ?`;
          const users = (await db.prepare(q).bind("%" + search + "%", offset).all()).results || [];
          if (!users.length) return jsonRes({ data: [] });
          const pendingHours = getPendingExpiryHours(cfg);
          const userIds = users.map((u) => parseInt(u.id, 10)).filter((id) => Number.isFinite(id));
          let destinations = [];
          if (userIds.length) {
            const placeholders = userIds.map(() => "?").join(",");
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
            user.destinations = Number.isFinite(uid) ? byUser[uid] || [] : [];
            if (user.destinations.length > 0) user.dest_email = user.destinations[0].email;
          }
          return jsonRes({ data: users });
        }
        return jsonRes({ error: "\u8BF7\u6C42\u4E0D\u5B58\u5728" }, 404);
      }
      if (path === "/api/register" && method === "POST") {
        const body = await readBody();
        if (!body.ok) return body.response;
        const { username, password, turnstileToken, invitationCode } = body.data, ip = getClientIp(req);
        const usernameCheck = validateUsername(username);
        const registerIdentifier = usernameCheck.ok ? usernameCheck.value : normalizeUsername(username);
        if (await isAuthRateLimited(db, "register", ip, registerIdentifier)) return jsonRes({ error: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, 429);
        const rejectRegister = /* @__PURE__ */ __name(async (payload, status = 400) => {
          await recordAuthFailure(db, "register", ip, registerIdentifier);
          return jsonRes(payload, status);
        }, "rejectRegister");
        if (!usernameCheck.ok) return await rejectRegister({ error: usernameCheck.error }, 400);
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.ok) return await rejectRegister({ error: passwordCheck.error }, 400);
        const turnstile = await verifyTurnstile(turnstileToken, ip);
        if (!turnstile.ok) return await rejectRegister({ error: turnstile.error }, 400);
        if (cfg.allow_registration !== "true") return await rejectRegister({ error: "\u62B1\u6B49\uFF0C\u7CFB\u7EDF\u5F53\u524D\u5DF2\u5173\u95ED\u65B0\u7528\u6237\u6CE8\u518C" }, 403);
        const allowedCountryConfig = String(cfg.allowed_countries || "ALL").trim().toUpperCase();
        const allowedCountries = allowedCountryConfig.split(",").map((i) => i.trim());
        if (allowedCountryConfig !== "ALL" && !allowedCountries.includes(req.cf?.country || "XX")) return await rejectRegister({ error: "\u5730\u533A\u62E6\u622A\uFF1A\u60A8\u6240\u5728\u7684\u5730\u533A\u6682\u65F6\u4E0D\u5141\u8BB8\u6CE8\u518C" }, 403);
        let maxUsers = parseInt(cfg.max_users || "1000", 10);
        if (!Number.isFinite(maxUsers) || maxUsers < 0) maxUsers = 1e3;
        if ((await db.prepare("SELECT COUNT(*) as c FROM users").first()).c >= maxUsers) return await rejectRegister({ error: "\u7CFB\u7EDF\u540D\u989D\u5DF2\u88AB\u6CE8\u518C\u5B8C\u6BD5" }, 403);
        const inviteCount = (await db.prepare("SELECT COUNT(*) AS c FROM invitation_codes").first())?.c || 0;
        const inviteRequired = cfg.enable_invitation_code === "true" && inviteCount > 0;
        let invite = null;
        if (inviteRequired) {
          const code = String(invitationCode || "").trim();
          if (!code) return await rejectRegister({ error: "\u8BF7\u8F93\u5165\u9080\u8BF7\u7801" }, 400);
          invite = await db.prepare("SELECT code,max_uses,used_count FROM invitation_codes WHERE code=?").bind(code).first();
          if (!invite || invite.used_count >= invite.max_uses) return await rejectRegister({ error: "\u9080\u8BF7\u7801\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u7528\u5B8C" }, 400);
        }
        let ipLim = parseInt(cfg.max_regs_per_ip_24h || "1", 10);
        if (!Number.isFinite(ipLim) || ipLim < 1) ipLim = 1;
        if ((await db.prepare("SELECT COUNT(*) as c FROM users WHERE reg_ip=? AND created_at>datetime('now','-1 day')").bind(ip).first()).c >= ipLim) {
          return await rejectRegister({ error: `\u98CE\u63A7\u62E6\u622A\uFF1A\u6BCF\u4E2A IP \u6BCF 24 \u5C0F\u65F6\u4EC5\u5141\u8BB8\u6CE8\u518C ${ipLim} \u4E2A\u8D26\u6237` }, 429);
        }
        try {
          const hashedPassword = await hashPassword(passwordCheck.value);
          await db.prepare("INSERT INTO users(username,password,reg_ip) VALUES(?,?,?)").bind(usernameCheck.value, hashedPassword, ip).run();
          if (invite) await db.prepare("UPDATE invitation_codes SET used_count=used_count+1 WHERE code=?").bind(invite.code).run();
          await clearAuthFailures(db, "register", ip, registerIdentifier);
          return jsonRes({ success: true });
        } catch (_) {
          return await rejectRegister({ error: "\u7528\u6237\u540D\u5DF2\u88AB\u5360\u7528\uFF0C\u6362\u4E00\u4E2A\u5427" }, 400);
        }
      }
      if (path === "/api/login" && method === "POST") {
        const body = await readBody();
        if (!body.ok) return body.response;
        const { username, password, turnstileToken } = body.data;
        const ip = getClientIp(req);
        const loginName = normalizeUsername(username);
        if (await isAuthRateLimited(db, "user_login", ip, loginName)) return jsonRes({ error: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, 429);
        const rejectLogin = /* @__PURE__ */ __name(async (status = 401, payload = { error: "\u8D26\u53F7\u6216\u5BC6\u7801\u8F93\u5165\u4E0D\u6B63\u786E" }) => {
          await recordAuthFailure(db, "user_login", ip, loginName);
          return jsonRes(payload, status);
        }, "rejectLogin");
        const turnstile = await verifyTurnstile(turnstileToken, ip);
        if (!turnstile.ok) return await rejectLogin(400, { error: turnstile.error });
        if (!loginName || String(password == null ? "" : password).length > MAX_PASSWORD_LENGTH) return await rejectLogin();
        const u = await db.prepare("SELECT id,password FROM users WHERE username=?").bind(loginName).first();
        if (!u || !await verifyPassword(password, u.password)) return await rejectLogin();
        await clearAuthFailures(db, "user_login", ip, loginName);
        const t = genT();
        await db.prepare("INSERT INTO sessions(token,user_id,role,expires_at) VALUES(?,?,'user',datetime('now','+7 days'))").bind(t, u.id).run();
        return jsonRes({ success: true }, 200, { "Set-Cookie": buildCookie("session_token", t, "/", 604800) });
      }
      if (path === "/api/logout" && method === "POST") return jsonRes({ success: true }, 200, { "Set-Cookie": buildCookie("session_token", "", "/", 0) });
      const uT = getC("session_token");
      if (!uT) return jsonRes({ error: "\u8BF7\u5148\u767B\u5F55" }, 401);
      const uS = await db.prepare("SELECT user_id FROM sessions WHERE token=? AND role='user' AND expires_at>datetime('now')").bind(uT).first();
      if (!uS) return jsonRes({ error: "\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" }, 401);
      if (path === "/api/check-session") return jsonRes({ success: true });
      if (path === "/api/me") return jsonRes(await getUserState(db, env, uS.user_id, cfg));
      if (path === "/api/domains") return jsonRes((await db.prepare("SELECT id,domain FROM domains ORDER BY domain ASC").all()).results);
      if (path === "/api/password" && method === "POST") {
        const body = await readBody();
        if (!body.ok) return body.response;
        const { oldPassword, newPassword } = body.data;
        const nextPassword = validatePassword(newPassword, "\u65B0\u5BC6\u7801");
        if (!nextPassword.ok) return jsonRes({ error: nextPassword.error }, 400);
        if (String(oldPassword == null ? "" : oldPassword).length > MAX_PASSWORD_LENGTH) return jsonRes({ error: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" }, 403);
        const user = await db.prepare("SELECT password FROM users WHERE id=?").bind(uS.user_id).first();
        if (!user || !await verifyPassword(oldPassword, user.password)) return jsonRes({ error: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" }, 403);
        const hashedPassword = await hashPassword(nextPassword.value);
        await db.prepare("UPDATE users SET password=? WHERE id=?").bind(hashedPassword, uS.user_id).run();
        await db.prepare("DELETE FROM sessions WHERE user_id=? AND token!=?").bind(uS.user_id, uT).run();
        return jsonRes({ message: "\u5BC6\u7801\u5DF2\u4FEE\u6539" });
      }
      if (path === "/api/account" && method === "DELETE") {
        const body = await readBody();
        if (!body.ok) return body.response;
        const { password } = body.data;
        if (String(password == null ? "" : password).length > MAX_PASSWORD_LENGTH) return jsonRes({ error: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" }, 403);
        const user = await db.prepare("SELECT password FROM users WHERE id=?").bind(uS.user_id).first();
        if (!user || !await verifyPassword(password, user.password)) return jsonRes({ error: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" }, 403);
        await deleteUserAccount(db, env, uS.user_id);
        return jsonRes({ message: "\u8D26\u53F7\u5DF2\u6CE8\u9500" }, 200, { "Set-Cookie": buildCookie("session_token", "", "/", 0) });
      }
      if (path === "/api/inbox" && method === "GET") {
        const page = parsePositiveInteger(url.searchParams.get("page") || "1", 1, 1, 1e5);
        const routeId = parseInt(url.searchParams.get("routeId") || "", 10);
        const search = normalizeInboxSearch(url.searchParams.get("search") || "");
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
          SELECT id,route_id,route_address,from_email,subject,raw_size,message_id,forward_status,attachment_count,received_at,read_at,
                 substr(COALESCE(body_text,''),1,240) AS preview
          FROM inbound_emails
          WHERE ${where.join(" AND ")}
          ORDER BY id DESC
          LIMIT 20 OFFSET ?
        `).bind(...binds, offset).all()).results || [];
        return jsonRes({ data: rows, page });
      }
      if (path === "/api/inbox/batch-delete" && method === "POST") {
        const body = await readBody();
        if (!body.ok) return body.response;
        const sourceIds = Array.isArray(body.data?.ids) ? body.data.ids : null;
        if (!sourceIds) return jsonRes({ error: "\u8BF7\u6C42\u4F53\u5FC5\u987B\u63D0\u4F9B ids \u6570\u7EC4" }, 400);
        const ids = Array.from(new Set(sourceIds.map((value) => parseInt(value, 10)).filter((value) => Number.isFinite(value) && value > 0)));
        if (!ids.length) return jsonRes({ error: "\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u5C01\u90AE\u4EF6" }, 400);
        if (ids.length !== sourceIds.length) return jsonRes({ error: "\u90AE\u4EF6 ID \u5217\u8868\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u4E0D\u80FD\u5305\u542B\u91CD\u590D\u503C\u6216\u975E\u6CD5\u503C" }, 400);
        if (ids.length > 20) return jsonRes({ error: "\u5355\u6B21\u6700\u591A\u53EA\u80FD\u6279\u91CF\u5220\u9664 20 \u5C01\u90AE\u4EF6" }, 400);
        let deleted = 0;
        for (const mailId of ids) {
          if (await deleteInboundMailById(db, env, uS.user_id, mailId)) deleted += 1;
        }
        return jsonRes({ success: true, deleted, message: `\u5DF2\u5220\u9664 ${deleted} \u5C01\u90AE\u4EF6` });
      }
      if (path.includes("/attachments/") && path.startsWith("/api/inbox/") && method === "GET") {
        const parts = path.split("/");
        const mailId = parseInt(parts[3], 10);
        const attachmentId = parseInt(parts[5], 10);
        if (!Number.isFinite(mailId) || mailId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) return jsonRes({ error: "\u9644\u4EF6 ID \u4E0D\u6B63\u786E" }, 400);
        const attachment = await db.prepare(`
          SELECT a.id,a.filename,a.content_type,a.size_bytes,a.r2_key
          FROM inbound_attachments a
          JOIN inbound_emails m ON m.id=a.mail_id AND m.user_id=a.user_id
          WHERE a.id=? AND a.mail_id=? AND a.user_id=?
        `).bind(attachmentId, mailId, uS.user_id).first();
        if (!attachment) return jsonRes({ error: "\u9644\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u60A8" }, 404);
        if (!env.INBOUND_ATTACHMENTS) return jsonRes({ error: "\u9644\u4EF6\u5B58\u50A8\u672A\u7ED1\u5B9A" }, 404);
        const object = await env.INBOUND_ATTACHMENTS.get(attachment.r2_key);
        if (!object) return jsonRes({ error: "\u9644\u4EF6\u6587\u4EF6\u4E0D\u5B58\u5728" }, 404);
        const filename = normalizeAttachmentFilename(attachment.filename, "attachment");
        const inline = url.searchParams.get("inline") === "1";
        const disposition = inline ? "inline" : "attachment";
        return new Response(object.body, {
          headers: buildHeaders({
            "Content-Type": attachment.content_type || "application/octet-stream",
            "Content-Length": String(attachment.size_bytes || object.size || 0),
            "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            "Cache-Control": "private, max-age=3600"
          })
        });
      }
      if (path.startsWith("/api/inbox/") && method === "GET") {
        const mailId = parseInt(path.split("/")[3], 10);
        if (!Number.isFinite(mailId) || mailId < 1) return jsonRes({ error: "\u90AE\u4EF6 ID \u4E0D\u6B63\u786E" }, 400);
        const mail = await db.prepare(`
          SELECT id,route_id,route_address,from_email,subject,body_text,body_html,raw_size,message_id,forward_status,attachment_count,attachment_status,received_at,read_at
          FROM inbound_emails
          WHERE id=? AND user_id=?
        `).bind(mailId, uS.user_id).first();
        if (!mail) return jsonRes({ error: "\u90AE\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u60A8" }, 404);
        if (!mail.read_at) await db.prepare("UPDATE inbound_emails SET read_at=datetime('now') WHERE id=? AND user_id=?").bind(mailId, uS.user_id).run();
        mail.read_at = mail.read_at || sqlDateFromMs(Date.now());
        mail.attachment_status_text = attachmentStatusText(mail.attachment_status);
        mail.attachments = (await db.prepare(`
          SELECT id,filename,content_type,size_bytes,content_id,disposition
          FROM inbound_attachments
          WHERE mail_id=? AND user_id=?
          ORDER BY id ASC
        `).bind(mailId, uS.user_id).all()).results || [];
        return jsonRes({ data: mail });
      }
      if (path.startsWith("/api/inbox/") && path.endsWith("/read") && method === "POST") {
        const mailId = parseInt(path.split("/")[3], 10);
        if (!Number.isFinite(mailId) || mailId < 1) return jsonRes({ error: "\u90AE\u4EF6 ID \u4E0D\u6B63\u786E" }, 400);
        await db.prepare("UPDATE inbound_emails SET read_at=datetime('now') WHERE id=? AND user_id=?").bind(mailId, uS.user_id).run();
        return jsonRes({ success: true });
      }
      if (path.startsWith("/api/inbox/") && method === "DELETE") {
        const mailId = parseInt(path.split("/")[3], 10);
        if (!Number.isFinite(mailId) || mailId < 1) return jsonRes({ error: "\u90AE\u4EF6 ID \u4E0D\u6B63\u786E" }, 400);
        await deleteInboundMailById(db, env, uS.user_id, mailId);
        return jsonRes({ success: true, message: "\u90AE\u4EF6\u5DF2\u5220\u9664" });
      }
      const createDestination = /* @__PURE__ */ __name(async (payload) => {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const { email, durationHours, inboxDefault } = payload || {};
        const chosenDuration = String(durationHours || "");
        const defaultInbox = inboxDefault === false ? "false" : "true";
        const emailCheck = validateEmail(email);
        if (!emailCheck.ok) return jsonRes({ error: emailCheck.error }, 400);
        const cleanEmail = emailCheck.value;
        if (!isValidDuration(chosenDuration)) return jsonRes({ error: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u90AE\u7BB1\u6709\u6548\u671F" }, 400);
        if (!isWithinMaxDuration(chosenDuration, cfg.max_destination_duration_hours || "168")) return jsonRes({ error: "\u8D85\u8FC7\u7BA1\u7406\u5458\u5141\u8BB8\u7684\u7ED1\u5B9A\u90AE\u7BB1\u6700\u5927\u6709\u6548\u671F" }, 403);
        const userDestinationLimit = getMaxDestinationsPerUser(cfg);
        const userDestCount = (await db.prepare("SELECT COUNT(*) AS c FROM user_destinations WHERE user_id=? AND status!='expired'").bind(uS.user_id).first())?.c || 0;
        if (userDestCount >= userDestinationLimit) return jsonRes({ error: `\u60A8\u7684\u8F6C\u53D1\u90AE\u7BB1\u914D\u989D\u5DF2\u8FBE\u4E0A\u9650\uFF08\u6700\u591A ${userDestinationLimit} \u4E2A\uFF09` }, 403);
        if (await db.prepare("SELECT id FROM user_destinations WHERE user_id=? AND email=? AND status!='expired'").bind(uS.user_id, cleanEmail).first()) return jsonRes({ error: "\u8BE5\u90AE\u7BB1\u5DF2\u7ECF\u7ED1\u5B9A\uFF0C\u8BF7\u52FF\u91CD\u590D\u6DFB\u52A0" }, 400);
        let cfgMaxD = parseInt(cfg.max_total_destinations || "180", 10);
        if (!Number.isFinite(cfgMaxD) || cfgMaxD < 0) cfgMaxD = 180;
        if ((await db.prepare("SELECT COUNT(*) as c FROM user_destinations WHERE status!='expired'").first()).c >= cfgMaxD) return jsonRes({ error: "\u7CFB\u7EDF\u5168\u5C40\u76EE\u6807\u90AE\u7BB1\u914D\u989D\u5DF2\u6EE1" }, 403);
        const cf = await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`, {
          method: "POST",
          body: { email: cleanEmail },
          label: "create_email_address"
        });
        const d = cf.data;
        if (!cf.ok || !d.result?.id) return jsonRes({ error: "Cloudflare \u9650\u5236\u4E86\u5F53\u524D\u8BF7\u6C42\uFF0C\u6216\u90AE\u7BB1\u5730\u5740\u683C\u5F0F\u4E0D\u7B26\u5408\u8981\u6C42", details: d.errors || d }, 500);
        await db.prepare("INSERT INTO user_destinations(user_id,cf_address_id,email,status,expires_at,duration_hours,inbox_default,created_at) VALUES(?,?,?,'pending',NULL,?,?,datetime('now'))").bind(uS.user_id, d.result.id, cleanEmail, chosenDuration, defaultInbox).run();
        return jsonRes({ message: "\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001\uFF0C\u8BF7\u524D\u5F80\u8F6C\u53D1\u90AE\u7BB1\u786E\u8BA4\u3002" });
      }, "createDestination");
      if (path === "/api/destination" && method === "POST") {
        const body = await readBody();
        if (!body.ok) return body.response;
        return await createDestination(body.data);
      }
      if (path === "/api/destinations" && method === "POST") {
        const body = await readBody();
        if (!body.ok) return body.response;
        return await createDestination(body.data);
      }
      if (path === "/api/destination/refresh" && method === "POST") {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const latestPending = await db.prepare("SELECT * FROM user_destinations WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 1").bind(uS.user_id).first();
        if (!latestPending) return jsonRes({ error: "\u5F53\u524D\u6CA1\u6709\u7B49\u5F85\u9A8C\u8BC1\u7684\u90AE\u7BB1\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6" }, 400);
        const cfAddress = (await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${latestPending.cf_address_id}`, { label: "refresh_latest_email_address" })).data;
        if (!cfAddress.result?.verified) return jsonRes({ error: "\u8FD8\u6CA1\u6709\u68C0\u6D4B\u5230\u9A8C\u8BC1\u5B8C\u6210\uFF0C\u8BF7\u786E\u8BA4\u90AE\u7BB1\u91CC\u7684\u9A8C\u8BC1\u94FE\u63A5\u5DF2\u7ECF\u70B9\u51FB" }, 400);
        const chosenDuration = isValidDuration(latestPending.duration_hours) ? latestPending.duration_hours : cfg.max_destination_duration_hours || "168";
        const expiresAt = expiryFromDuration(chosenDuration);
        await db.prepare("UPDATE user_destinations SET status='verified', expires_at=? WHERE id=?").bind(expiresAt, latestPending.id).run();
        return jsonRes({ message: "\u90AE\u7BB1\u9A8C\u8BC1\u5DF2\u5237\u65B0\u6210\u529F\uFF0C\u73B0\u5728\u53EF\u4EE5\u521B\u5EFA\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u3002" });
      }
      if (path.startsWith("/api/destinations/") && path.endsWith("/refresh") && method === "POST") {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const destinationId = parseInt(path.split("/")[3], 10);
        if (!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({ error: "\u90AE\u7BB1 ID \u4E0D\u6B63\u786E" }, 400);
        const dest = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, uS.user_id).first();
        if (!dest) return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F" }, 404);
        if (dest.status === "verified") return jsonRes({ message: "\u90AE\u7BB1\u5DF2\u7ECF\u5B8C\u6210\u9A8C\u8BC1" });
        if (dest.status !== "pending") return jsonRes({ error: "\u5F53\u524D\u90AE\u7BB1\u72B6\u6001\u65E0\u6CD5\u5237\u65B0\u9A8C\u8BC1" }, 400);
        const cfAddress = (await cfRequest(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${dest.cf_address_id}`, { label: "refresh_email_address" })).data;
        if (!cfAddress.result?.verified) return jsonRes({ error: "\u8FD8\u6CA1\u6709\u68C0\u6D4B\u5230\u9A8C\u8BC1\u5B8C\u6210\uFF0C\u8BF7\u786E\u8BA4\u90AE\u7BB1\u91CC\u7684\u9A8C\u8BC1\u94FE\u63A5\u5DF2\u7ECF\u70B9\u51FB" }, 400);
        const chosenDuration = isValidDuration(dest.duration_hours) ? dest.duration_hours : cfg.max_destination_duration_hours || "168";
        const expiresAt = expiryFromDuration(chosenDuration);
        await db.prepare("UPDATE user_destinations SET status='verified', expires_at=? WHERE id=?").bind(expiresAt, dest.id).run();
        return jsonRes({ message: "\u90AE\u7BB1\u9A8C\u8BC1\u5DF2\u5237\u65B0\u6210\u529F\uFF0C\u73B0\u5728\u53EF\u4EE5\u521B\u5EFA\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u3002" });
      }
      if (path.startsWith("/api/destinations/") && path.endsWith("/inbox-default") && method === "PUT") {
        const destinationId = parseInt(path.split("/")[3], 10);
        const body = await readBody();
        if (!body.ok) return body.response;
        if (!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({ error: "\u90AE\u7BB1 ID \u4E0D\u6B63\u786E" }, 400);
        const enabled = body.data.enabled !== false;
        const dest = await db.prepare("SELECT id FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(destinationId, uS.user_id).first();
        if (!dest) return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F" }, 404);
        await db.prepare("UPDATE user_destinations SET inbox_default=? WHERE id=?").bind(boolText(enabled), destinationId).run();
        return jsonRes({ success: true, message: enabled ? "\u9ED8\u8BA4\u7AD9\u5185\u540C\u6B65\u5DF2\u5F00\u542F" : "\u9ED8\u8BA4\u7AD9\u5185\u540C\u6B65\u5DF2\u5173\u95ED" });
      }
      if (path === "/api/destination" && method === "DELETE") return jsonRes({ error: "\u8BF7\u4F7F\u7528 /api/destinations/:id \u5220\u9664\u6307\u5B9A\u5E95\u5C42\u6536\u4EF6\u7BB1" }, 400);
      if (path.startsWith("/api/destinations/") && method === "DELETE") {
        const destinationId = parseInt(path.split("/")[3], 10);
        if (!Number.isFinite(destinationId) || destinationId < 1) return jsonRes({ error: "\u90AE\u7BB1 ID \u4E0D\u6B63\u786E" }, 400);
        const removed = await deleteUserDestination(db, env, uS.user_id, destinationId);
        if (removed === true) return jsonRes({ message: "\u8F6C\u53D1\u90AE\u7BB1\u5DF2\u5220\u9664" });
        if (!removed || removed.reason === "not_found") return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F" }, 404);
        if (removed.reason === "in_use") return jsonRes({ error: `\u8BE5\u90AE\u7BB1\u4ECD\u88AB ${removed.routeCount || 0} \u6761\u4E13\u5C5E\u8DEF\u7531\u4F7F\u7528\uFF0C\u8BF7\u5148\u8FC1\u79FB\u8DEF\u7531\u76EE\u6807\u540E\u518D\u5220\u9664` }, 400);
        return jsonRes({ error: "\u5220\u9664\u5931\u8D25" }, 400);
      }
      if (path.startsWith("/api/routes/") && method === "DELETE") {
        const routeId = parseInt(path.split("/")[3], 10);
        if (!Number.isFinite(routeId) || routeId < 1) return jsonRes({ error: "\u8DEF\u7531 ID \u4E0D\u6B63\u786E" }, 400);
        const removed = await deleteRouteById(db, env, routeId, uS.user_id);
        if (!removed) return jsonRes({ error: "\u8FD9\u4E2A\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u60A8" }, 404);
        return jsonRes({ message: "\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u5DF2\u5220\u9664" });
      }
      if (path.startsWith("/api/routes/") && path.endsWith("/inbox") && method === "PUT") {
        const routeId = parseInt(path.split("/")[3], 10);
        const body = await readBody();
        if (!body.ok) return body.response;
        if (!Number.isFinite(routeId) || routeId < 1) return jsonRes({ error: "\u8DEF\u7531 ID \u4E0D\u6B63\u786E" }, 400);
        const enabled = body.data.enabled === true;
        const route = await db.prepare(`
          SELECT r.id,r.tag,r.cf_rule_id,r.status,d.zone_id,d.domain,
                 ud.email AS destination_email, ud.status AS destination_status, ud.expires_at AS destination_expires_at
          FROM email_routes r
          JOIN domains d ON d.id=r.domain_id
          LEFT JOIN user_destinations ud ON ud.id=r.destination_id
          WHERE r.id=? AND r.user_id=?
        `).bind(routeId, uS.user_id).first();
        if (!route) return jsonRes({ error: "\u8FD9\u4E2A\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u60A8" }, 404);
        if (!route.destination_email) return jsonRes({ error: "\u8BF7\u5148\u8BBE\u7F6E\u53EF\u7528\u7684\u8F6C\u53D1\u76EE\u6807\u90AE\u7BB1" }, 400);
        if (route.destination_status !== "verified" || route.destination_expires_at && dbDateMs(route.destination_expires_at) <= Date.now()) return jsonRes({ error: "\u8F6C\u53D1\u76EE\u6807\u90AE\u7BB1\u672A\u9A8C\u8BC1\u6216\u5DF2\u8FC7\u671F" }, 400);
        const routeAddress = `${route.tag}@${route.domain}`;
        const rule = buildEmailRouteRule(env, routeAddress, route.destination_email, uS.user_id, route.tag, boolText(enabled));
        if (!rule.ok) return jsonRes({ error: rule.error }, 400);
        const cf = await cfSyncRouteRule(env, route, routeAddress, rule.value, "toggle_route_inbox");
        if (!cf.ok) return jsonRes({ error: `Cloudflare \u8DEF\u7531\u66F4\u65B0\u5931\u8D25\uFF1A${summarizeEmailRouteRuleError(cf.data, env)}`, details: cf.data.errors || cf.data }, 500);
        await db.prepare("UPDATE email_routes SET inbox_enabled=?, cf_rule_id=COALESCE(?, cf_rule_id) WHERE id=?").bind(boolText(enabled), cf.ruleId || null, routeId).run();
        return jsonRes({ success: true, message: enabled ? "\u7AD9\u5185\u6536\u4EF6\u7BB1\u540C\u6B65\u5DF2\u5F00\u542F" : "\u7AD9\u5185\u6536\u4EF6\u7BB1\u540C\u6B65\u5DF2\u5173\u95ED" });
      }
      if (path.startsWith("/api/routes/") && method === "PUT") {
        const routeId = parseInt(path.split("/")[3], 10);
        const body = await readBody();
        if (!body.ok) return body.response;
        const { remark, destinationId, deliveryMode } = body.data;
        const cleanRemark = normalizeRouteRemark(remark);
        const hasDestinationField = Object.prototype.hasOwnProperty.call(body.data, "destinationId");
        const hasDeliveryModeField = Object.prototype.hasOwnProperty.call(body.data, "deliveryMode");
        const requestedDeliveryMode = normalizeDeliveryMode(deliveryMode);
        if (!Number.isFinite(routeId) || routeId < 1) return jsonRes({ error: "\u8DEF\u7531 ID \u4E0D\u6B63\u786E" }, 400);
        if (remark != null && cleanRemark.length > MAX_ROUTE_REMARK_LENGTH) return jsonRes({ error: `\u5907\u6CE8\u6700\u591A ${MAX_ROUTE_REMARK_LENGTH} \u4E2A\u5B57\u7B26` }, 400);
        if (hasDeliveryModeField && !requestedDeliveryMode) return jsonRes({ error: "\u6295\u9012\u65B9\u5F0F\u4E0D\u6B63\u786E" }, 400);
        const route = await db.prepare(`
          SELECT r.id,r.tag,r.domain_id,r.duration_hours,r.expires_at,r.destination_id,r.cf_rule_id,r.status,r.remark,COALESCE(r.inbox_enabled,'false') AS inbox_enabled,d.zone_id,d.domain
          FROM email_routes r
          JOIN domains d ON d.id=r.domain_id
          WHERE r.id=? AND r.user_id=?
        `).bind(routeId, uS.user_id).first();
        if (!route) return jsonRes({ error: "\u8FD9\u4E2A\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u60A8" }, 404);
        let targetDestinationId = route.destination_id == null ? null : parseInt(route.destination_id, 10);
        let nextDeliveryMode = hasDeliveryModeField ? requestedDeliveryMode : routeDeliveryMode(route);
        if (hasDestinationField) {
          if (destinationId == null || String(destinationId).trim() === "") {
            targetDestinationId = null;
            if (!hasDeliveryModeField) nextDeliveryMode = "inbox_only";
          } else {
            const parsedDestinationId = parseInt(destinationId, 10);
            if (!Number.isFinite(parsedDestinationId) || parsedDestinationId < 1) return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1 ID \u4E0D\u6B63\u786E" }, 400);
            targetDestinationId = parsedDestinationId;
          }
        }
        if (nextDeliveryMode === "inbox_only") targetDestinationId = null;
        if (deliveryModeNeedsDestination(nextDeliveryMode) && (!Number.isFinite(targetDestinationId) || targetDestinationId < 1)) return jsonRes({ error: "\u8BF7\u9009\u62E9\u8F6C\u53D1\u76EE\u6807\u90AE\u7BB1" }, 400);
        let targetDestination = null;
        let nextDurationHours = isValidDuration(route.duration_hours) ? String(route.duration_hours) : cfg.max_route_duration_hours || "72";
        let nextExpiresAt = route.expires_at;
        if (deliveryModeNeedsDestination(nextDeliveryMode)) {
          targetDestination = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status='verified'").bind(targetDestinationId, uS.user_id).first();
          if (!targetDestination) return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1\u4E0D\u5B58\u5728\u3001\u672A\u9A8C\u8BC1\u6216\u5DF2\u5931\u6548" }, 400);
          if (targetDestination.expires_at && dbDateMs(targetDestination.expires_at) <= Date.now()) return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1\u5DF2\u8FC7\u671F" }, 400);
          const targetDuration = isValidDuration(targetDestination.duration_hours) ? String(targetDestination.duration_hours) : null;
          if (targetDuration && durationRank(nextDurationHours) > durationRank(targetDuration)) nextDurationHours = targetDuration;
          const routeRawExpiry = expiryFromDuration(nextDurationHours);
          nextExpiresAt = minExpiry(routeRawExpiry, targetDestination.expires_at);
        } else if (hasDeliveryModeField || hasDestinationField) {
          nextExpiresAt = expiryFromDuration(nextDurationHours);
        }
        const nextInboxEnabled = nextDeliveryMode !== "forward_only";
        const shouldSyncRule = hasDeliveryModeField || hasDestinationField;
        if (shouldSyncRule) {
          const routeAddress = `${route.tag}@${route.domain}`;
          const rule = buildEmailRouteRule(env, routeAddress, targetDestination?.email || "", uS.user_id, route.tag, boolText(nextInboxEnabled));
          if (!rule.ok) return jsonRes({ error: rule.error }, 400);
          const cf = await cfSyncRouteRule(env, route, routeAddress, rule.value, "update_email_route");
          if (!cf.ok) return jsonRes({ error: `Cloudflare \u8DEF\u7531\u66F4\u65B0\u5931\u8D25\uFF1A${summarizeEmailRouteRuleError(cf.data, env)}`, details: cf.data.errors || cf.data }, 500);
          route.cf_rule_id = cf.ruleId || route.cf_rule_id;
        }
        const nextRemark = remark == null ? route.remark : cleanRemark;
        await db.prepare("UPDATE email_routes SET remark=?, destination_id=?, duration_hours=?, expires_at=?, inbox_enabled=?, cf_rule_id=COALESCE(?, cf_rule_id) WHERE id=?").bind(nextRemark, targetDestinationId, nextDurationHours, nextExpiresAt, boolText(nextInboxEnabled), route.cf_rule_id || null, routeId).run();
        return jsonRes({ success: true, message: shouldSyncRule ? "\u6295\u9012\u8BBE\u7F6E\u5DF2\u66F4\u65B0\uFF0CCloudflare \u8DEF\u7531\u5DF2\u540C\u6B65" : "\u5907\u6CE8\u5DF2\u4FDD\u5B58" });
      }
      if (path === "/api/routes" && method === "POST") {
        await expireLocalForUser(db, env, uS.user_id, cfg);
        const body = await readBody();
        if (!body.ok) return body.response;
        const { prefix, domainId, durationHours, remark, destinationId, deliveryMode } = body.data;
        const cleanPrefix = String(prefix || "").trim().toLowerCase();
        const chosenDuration = String(durationHours || "");
        const cleanRemark = normalizeRouteRemark(remark);
        const requestedDeliveryMode = normalizeDeliveryMode(deliveryMode);
        const pickedDestinationId = parseInt(destinationId, 10);
        const pickedDomainId = parseInt(domainId, 10);
        if (!/^[a-z0-9._+-]{1,64}$/.test(cleanPrefix)) return jsonRes({ error: "\u90AE\u7BB1\u524D\u7F00\u53EA\u80FD\u4F7F\u7528\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u3001\u52A0\u53F7\u6216\u77ED\u6A2A\u7EBF" }, 400);
        if (!isValidDuration(chosenDuration)) return jsonRes({ error: "\u8BF7\u9009\u62E9\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u6709\u6548\u671F" }, 400);
        if (!isWithinMaxDuration(chosenDuration, cfg.max_route_duration_hours || "72")) return jsonRes({ error: "\u8D85\u8FC7\u7BA1\u7406\u5458\u5141\u8BB8\u7684\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u6700\u5927\u6709\u6548\u671F" }, 403);
        if (cleanRemark.length > MAX_ROUTE_REMARK_LENGTH) return jsonRes({ error: `\u5907\u6CE8\u6700\u591A ${MAX_ROUTE_REMARK_LENGTH} \u4E2A\u5B57\u7B26` }, 400);
        if (deliveryMode != null && !requestedDeliveryMode) return jsonRes({ error: "\u6295\u9012\u65B9\u5F0F\u4E0D\u6B63\u786E" }, 400);
        const selectedDeliveryMode = requestedDeliveryMode || (Number.isFinite(pickedDestinationId) && pickedDestinationId > 0 ? "inbox_forward" : "inbox_only");
        if (deliveryModeNeedsDestination(selectedDeliveryMode) && (!Number.isFinite(pickedDestinationId) || pickedDestinationId < 1)) return jsonRes({ error: "\u8BF7\u9009\u62E9\u8F6C\u53D1\u76EE\u6807\u90AE\u7BB1" }, 400);
        if (!Number.isFinite(pickedDomainId) || pickedDomainId < 1) return jsonRes({ error: "\u8BF7\u9009\u62E9\u6709\u6548\u57DF\u540D" }, 400);
        let d = null;
        let targetDestinationId = null;
        let routeExpiry = expiryFromDuration(chosenDuration);
        if (deliveryModeNeedsDestination(selectedDeliveryMode)) {
          d = await db.prepare("SELECT * FROM user_destinations WHERE id=? AND user_id=? AND status!='expired'").bind(pickedDestinationId, uS.user_id).first();
          if (!d) return jsonRes({ error: "\u8BF7\u5148\u7ED1\u5B9A\u5E76\u9A8C\u8BC1\u60A8\u7684\u771F\u5B9E\u6536\u4EF6\u7BB1" }, 400);
          if (d.status === "pending") return jsonRes({ error: "\u8BF7\u5148\u70B9\u51FB\u201C\u5237\u65B0\u9A8C\u8BC1\u201D\uFF0C\u786E\u8BA4\u5E95\u5C42\u6536\u4EF6\u7BB1\u5DF2\u7ECF\u5B8C\u6210\u9A8C\u8BC1" }, 400);
          if (d.status !== "verified") return jsonRes({ error: "\u771F\u5B9E\u6536\u4EF6\u7BB1\u72B6\u6001\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u7ED1\u5B9A" }, 400);
          if (d.expires_at && dbDateMs(d.expires_at) <= Date.now()) return jsonRes({ error: "\u76EE\u6807\u90AE\u7BB1\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u7ED1\u5B9A" }, 400);
          if (d.duration_hours && durationRank(chosenDuration) > durationRank(d.duration_hours)) return jsonRes({ error: "\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u6709\u6548\u671F\u4E0D\u80FD\u8D85\u8FC7\u7ED1\u5B9A\u90AE\u7BB1\u6709\u6548\u671F" }, 400);
          if (chosenDuration === "permanent" && d.expires_at) return jsonRes({ error: "\u7ED1\u5B9A\u90AE\u7BB1\u4E0D\u662F\u6C38\u4E45\u6709\u6548\uFF0C\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u4E0D\u80FD\u9009\u62E9\u6C38\u4E45" }, 400);
          routeExpiry = minExpiry(routeExpiry, d.expires_at);
          targetDestinationId = pickedDestinationId;
        }
        let cfgMaxR = parseInt(cfg.max_routes_per_user || "10", 10);
        if (!Number.isFinite(cfgMaxR) || cfgMaxR < 0) cfgMaxR = 10;
        if ((await db.prepare("SELECT COUNT(*) as c FROM email_routes WHERE user_id=? AND status='active' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(uS.user_id).first()).c >= cfgMaxR) return jsonRes({ error: "\u60A8\u7684\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u914D\u989D\u5DF2\u8017\u5C3D" }, 403);
        const dom = await db.prepare("SELECT * FROM domains WHERE id=?").bind(pickedDomainId).first();
        if (!dom) return jsonRes({ error: "\u60A8\u9009\u62E9\u7684\u57DF\u540D\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u4E0B\u67B6" }, 400);
        if (await db.prepare("SELECT id FROM email_routes WHERE domain_id=? AND tag=? AND status='active'").bind(dom.id, cleanPrefix).first()) return jsonRes({ error: "\u8BE5\u524D\u7F00\u5DF2\u88AB\u5360\u7528\uFF0C\u8BF7\u6362\u4E00\u4E2A\u91CD\u8BD5" }, 400);
        let inboxEnabled = selectedDeliveryMode !== "forward_only";
        const routeAddress = `${cleanPrefix}@${dom.domain}`;
        const rule = buildEmailRouteRule(env, routeAddress, d?.email || "", uS.user_id, cleanPrefix, boolText(inboxEnabled));
        if (!rule.ok) return jsonRes({ error: rule.error }, 400);
        let cf = await cfRequest(env, `/zones/${dom.zone_id}/email/routing/rules`, {
          method: "POST",
          body: rule.value,
          label: "create_email_route"
        });
        const cfD = cf.data;
        if (!cf.ok || !cfD.result?.id) return jsonRes({ error: `Cloudflare \u8DEF\u7531\u521B\u5EFA\u5931\u8D25\uFF1A${summarizeEmailRouteRuleError(cfD, env)}`, details: cfD.errors || cfD }, 500);
        try {
          await db.prepare("INSERT INTO email_routes(user_id,cf_rule_id,tag,domain_id,expires_at,duration_hours,remark,destination_id,inbox_enabled,status) VALUES(?,?,?,?,?,?,?,?,?, 'active')").bind(uS.user_id, cfD.result.id, cleanPrefix, pickedDomainId, routeExpiry, chosenDuration, cleanRemark, targetDestinationId, boolText(inboxEnabled)).run();
        } catch (e) {
          await cfDeleteRoute(env, dom.zone_id, cfD.result.id, "rollback_created_route_after_d1_error");
          if (isUniqueConstraintError(e)) return jsonRes({ error: "\u8BE5\u524D\u7F00\u5DF2\u88AB\u5360\u7528\uFF0C\u8BF7\u6362\u4E00\u4E2A\u91CD\u8BD5" }, 400);
          console.error("[route_create_d1_error]", e?.stack || e?.message || e);
          return jsonRes({ error: "\u4E13\u5C5E\u57DF\u540D\u90AE\u7BB1\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 500);
        }
        return jsonRes({ success: true, message: "\u90AE\u7BB1\u522B\u540D\u521B\u5EFA\u6210\u529F" });
      }
      return jsonRes({ error: "404 Not Found" }, 404);
    } catch (e) {
      console.error("[server_error]", e?.stack || e?.message || e);
      return jsonRes({ error: "Server Error" }, 500);
    }
  },
  async email(message, env, ctx) {
    await handleInboundEmail(message, env);
  },
  async scheduled(evt, env) {
    if (!env.DB) return;
    const db = env.DB;
    await ensureSystem(db);
    const cfg = await getConfigMap(db);
    await runTimedCleanup(db, env, cfg);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map


