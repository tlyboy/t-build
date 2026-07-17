# t-build

📦 T-Build - Internal project build, webhook, and deployment console

| Category  | Stack                                               |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16, React 19                                |
| Language  | TypeScript                                          |
| Auth      | Better Auth, username/password, organization        |
| Storage   | SQLite, better-sqlite3                              |
| UI        | Tailwind CSS, shadcn-style components, lucide-react |
| Runtime   | Node.js 24.x, pnpm 10                               |

T-Build is an open-source build management console for internal teams. It manages multiple projects, Git credentials, build queues, artifacts, GitHub/Codeup webhook callbacks, and optional post-build deployment commands from one local or self-hosted service.

## Install

### Requirements

- Node.js 24.x
- pnpm 10.x
- Git
- The build toolchains required by your projects, such as Node, pnpm, Rust, Tauri, Electron, Java, or other host-level dependencies

### Clone

```bash
git clone https://github.com/tlyboy/t-build.git
cd t-build
corepack enable
pnpm install
```

### Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
openssl rand -base64 32
```

Set at least these values:

```env
BETTER_AUTH_SECRET="replace-with-generated-secret"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS=""
T_BUILD_DATA_DIR=""
T_BUILD_DATABASE_PATH=""
T_BUILD_HISTORY_LIMIT="5"
```

By default, SQLite data is stored at `~/.t-build/t-build.sqlite`. Use `T_BUILD_DATA_DIR`, `T_BUILD_DATABASE_PATH`, or `DATABASE_URL=file:/absolute/path/t-build.sqlite` when you need a custom location. `T_BUILD_HISTORY_LIMIT` controls how many recent build records are retained and defaults to `5`; it must be a positive integer. Pending and running builds are never removed. Keep `.env.local` private.

## Usage

### Development

```bash
pnpm dev
```

Open `http://localhost:3000`. On the first launch, create the administrator account with a username, password, and organization name. Public sign-up is disabled for the internal open-source edition.

### Production

```bash
pnpm build
pnpm start
```

For public deployment, set:

```env
BETTER_AUTH_URL="https://your-domain.example"
BETTER_AUTH_TRUSTED_ORIGINS="https://your-domain.example"
```

Put T-Build behind your reverse proxy and make sure the proxy forwards requests to the Next.js server. Persist the SQLite database path across deployments.

### Projects

Create a project with:

- Project name
- Local project path or Git clone source
- Build command, one command per line
- Optional build output paths for artifact downloads
- Optional deploy command that runs after the build succeeds
- Optional Git credential and auto pull before build. Auto pull discards
  tracked changes and removes untracked, non-ignored files from the project
  working tree before running a fast-forward-only pull.
- Optional webhook configuration during project creation

Build commands and deploy commands support comment lines beginning with `#`. A standalone `cd path` line changes the working directory for following lines.

Example build command:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Example deploy command:

```bash
cd dist
rsync -av ./ deploy@example.com:/var/www/app/
ssh deploy@example.com "systemctl reload nginx"
```

### Webhooks

T-Build can create project-bound webhook callbacks for GitHub and Codeup. Copy the callback URL from the project form or settings page and paste it into the code platform webhook settings.

- GitHub: select push events and use the same Secret. T-Build verifies `X-Hub-Signature-256`.
- Codeup: use the same Secret token. T-Build verifies `X-Codeup-Token`.
- Branch filters are optional. Leave the branch empty to accept pushes from all branches.
- Ping, unsupported events, deleted refs, and branch mismatches are ignored safely.

### Build Queue

The queue runs builds sequentially across projects. If the same project receives several pending builds while one build is already running, T-Build keeps only the newest pending build for that project and marks older pending builds as skipped. This avoids wasting build time on outdated commits while still preserving cross-project queue order.

### Data Storage

T-Build stores application data in SQLite:

- Better Auth users, sessions, organizations, and members
- Projects
- Builds and logs
- Environment variables
- Git credentials
- Webhook configuration

Credential-like values are encrypted before storage. The data layer is intentionally centralized so a future SaaS edition can switch the storage backend to Postgres with less surface-area change.

## License

[MIT](https://opensource.org/licenses/MIT) © tlyboy
