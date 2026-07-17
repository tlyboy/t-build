# t-build

📦 T-Build - 企业内部项目构建、Webhook 与部署控制台

| 分类   | 技术栈                                      |
| ------ | ------------------------------------------- |
| 框架   | Next.js 16, React 19                        |
| 语言   | TypeScript                                  |
| 认证   | Better Auth, 用户名/密码, 组织              |
| 存储   | SQLite, better-sqlite3                      |
| UI     | Tailwind CSS, shadcn 风格组件, lucide-react |
| 运行时 | Node.js 24.x, pnpm 10                       |

T-Build 是面向企业内部团队的开源构建管理控制台。它可以统一管理多项目、Git 凭证、构建队列、构建产物、GitHub/Codeup Webhook 回调，以及构建成功后的可选部署命令。

## 安装

### 环境要求

- Node.js 24.x
- pnpm 10.x
- Git
- 目标项目所需的构建工具链，例如 Node、pnpm、Rust、Tauri、Electron、Java 或其他宿主机依赖

### 克隆项目

```bash
git clone https://github.com/tlyboy/t-build.git
cd t-build
corepack enable
pnpm install
```

### 环境变量

基于 `.env.example` 创建 `.env.local`：

```bash
cp .env.example .env.local
openssl rand -base64 32
```

至少配置这些值：

```env
BETTER_AUTH_SECRET="替换为生成的密钥"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS=""
T_BUILD_DATA_DIR=""
T_BUILD_DATABASE_PATH=""
T_BUILD_HISTORY_LIMIT="5"
```

默认 SQLite 数据库路径为 `~/.t-build/t-build.sqlite`。如果需要自定义数据位置，可以设置 `T_BUILD_DATA_DIR`、`T_BUILD_DATABASE_PATH`，或使用 `DATABASE_URL=file:/absolute/path/t-build.sqlite`。`T_BUILD_HISTORY_LIMIT` 用于配置保留的最近构建记录数，默认为 `5`，且必须是正整数；排队中和构建中的记录不会被清理。请不要提交 `.env.local`。

## 使用说明

### 本地开发

```bash
pnpm dev
```

打开 `http://localhost:3000`。首次启动时创建管理员账号，需要填写用户名、密码和组织名称。当前开源版面向企业内部使用，已关闭公开注册，不要求邮箱登录。

### 生产运行

```bash
pnpm build
pnpm start
```

公网部署时建议配置：

```env
BETTER_AUTH_URL="https://your-domain.example"
BETTER_AUTH_TRUSTED_ORIGINS="https://your-domain.example"
```

可以把 T-Build 放在 Nginx 等反向代理后面，并将请求转发到 Next.js 服务。生产环境请确保 SQLite 数据库路径可持久化。

### 项目配置

创建项目时可以配置：

- 项目名称
- 本地项目路径或 Git 克隆来源
- 构建命令，每行一个命令
- 可选的构建产物路径，用于打包下载
- 可选的部署命令，构建成功后执行
- 可选 Git 凭证，以及构建前自动拉取代码。自动拉取会先丢弃项目工作区中已跟踪文件的本地修改、删除未跟踪且未被忽略的文件，再执行仅快进拉取。
- 可选 Webhook，创建项目时即可绑定回调

构建命令和部署命令都支持以 `#` 开头的注释行。单独一行 `cd path` 会切换后续命令的工作目录。

构建命令示例：

```bash
pnpm install --frozen-lockfile
pnpm build
```

部署命令示例：

```bash
cd dist
rsync -av ./ deploy@example.com:/var/www/app/
ssh deploy@example.com "systemctl reload nginx"
```

### Webhook

T-Build 支持为项目创建 GitHub 和 Codeup Webhook 回调。在项目创建页或设置页复制回调地址，然后粘贴到代码平台的 Webhook 配置中。

- GitHub：选择 push 事件，并填写相同的 Secret。T-Build 会校验 `X-Hub-Signature-256`。
- Codeup：填写相同的 Secret token。T-Build 会校验 `X-Codeup-Token`。
- 分支过滤可选。留空表示接受所有分支推送。
- ping、非 push 事件、删除分支和分支不匹配的请求会被安全忽略。

### 构建队列

构建队列会跨项目串行执行。如果同一个项目在已有构建运行期间连续收到多次待构建请求，T-Build 只保留该项目最新的一次待构建任务，并将较旧的待构建任务标记为“已跳过”。这样可以避免为过期提交浪费构建时间，同时保留多个项目之间的队列顺序。

### 数据存储

T-Build 将业务数据统一存储在 SQLite：

- Better Auth 用户、会话、组织和成员
- 项目
- 构建记录和日志
- 环境变量
- Git 凭证
- Webhook 配置

凭证类数据会加密后再存储。数据访问层已集中收敛，后续 SaaS 版可以更平滑地将存储后端切换到 Postgres。

## 使用许可

[MIT](https://opensource.org/licenses/MIT) © tlyboy
