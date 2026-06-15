# Email Worker

Cloudflare Email Routing 增强版 Worker，支持专属域名邮箱别名、站内收件箱、邮件转发。

## 前置条件

- Node.js
- 一个 Cloudflare 账号
- 该项目代码

## 所需环境变量

### Secrets（需通过 wrangler secret 或 Cloudflare Dashboard 设置，不写在 wrangler.toml 中）

| 变量名 | 说明 | 获取方式 |
|---|---|---|
| CF_API_TOKEN | Cloudflare API 令牌 | Dashboard -> My Profile -> API Tokens，需 Email Routing、Workers、D1、R2 权限 |
| CF_ACCOUNT_ID | Cloudflare 账户 ID | Dashboard 右侧栏 Account ID |
| TURNSTILE_SECRET | Turnstile 验证密钥 | Dashboard -> Turnstile -> 站点密钥对面的 Secret Key |
| ADMIN_PASSWORD | 管理员登录密码 | 自定义 |

### 普通环境变量（写在 wrangler.toml 的 [vars] 中或 Dashboard 设置）

| 变量名 | 示例值 | 说明 |
|---|---|---|
| TURNSTILE_SITEKEY | 0x4AAAAAADM20OKQdbxtArVM | Turnstile 站点密钥 |
| ADMIN_PATH | /admin | 管理员面板路径 |
| ADMIN_USERNAME | admin | 管理员用户名 |
| EMAIL_WORKER_NAME | email | Worker 名称，与 wrangler.toml 中的 name 一致 |
| TURNSTILE_BYPASS | false | 可选，设为 true 跳过 Turnstile 验证（调试用） |

### 绑定（wrangler.toml 或 Dashboard 中配置）

| 绑定名 | 类型 | 说明 |
|---|---|---|
| DB | D1 Database | 数据库，需先创建：wrangler d1 create <库名> |
| INBOUND_ATTACHMENTS | R2 Bucket | 附件存储桶，需先创建：wrangler r2 bucket create <桶名> |

## 部署步骤

`ash
# 1. 登录 Cloudflare（会弹出浏览器授权）
wrangler login

# 2. 设置 secrets
wrangler secret put CF_API_TOKEN
wrangler secret put CF_ACCOUNT_ID
wrangler secret put TURNSTILE_SECRET
wrangler secret put ADMIN_PASSWORD

# 3. 部署
wrangler deploy
`

## 备注

- 首次部署前需先创建 D1 数据库和 R2 存储桶，并将 ID/名称填入 wrangler.toml
- 部署后需在 Cloudflare Dashboard 中配置 Email Routing 域名，才能收发邮件
- 管理员面板路径由 ADMIN_PATH 控制，默认为 /admin
