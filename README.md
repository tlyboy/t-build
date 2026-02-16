# t-build

📦 T-Build - Project build management system

A project build management tool based on Next.js, supporting multi-project management, Git integration, and build artifact downloads.

- Multi-project management: add, edit, and delete projects
- Git integration: clone projects from Git, automatically pull the latest code before building
- Credential management: SSH keys and HTTPS authentication (encrypted storage)
- Build management: execute build commands, view real-time logs
- Artifact download: configure build artifact paths and download as a package with one click

## Install

```bash
git clone https://github.com/tlyboy/t-build.git
```

## Usage

This project uses [Node.js](https://nodejs.org/) (version 24.x) and [pnpm](https://pnpm.io/). Make sure they are installed locally.

```sh
pnpm install
pnpm dev
pnpm build
pnpm start
```

### Deployment

#### Node.js Deployment

```sh
pnpm build
pnpm start
```

Supports building all types of projects, including desktop applications like Tauri and Electron (requires the corresponding build environment installed on the host machine).

#### Docker Deployment

```sh
docker compose up -d
```

Includes Node.js, pnpm, JDK 17, Maven, and Git, supporting builds for frontend and Java projects.

## License

[MIT](https://opensource.org/licenses/MIT) © Guany
