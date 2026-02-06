# t-build

📦 T-Build - 项目构建管理系统

一个基于 Next.js 的项目构建管理工具，支持多项目管理、Git 集成、构建产物下载等功能。

## 功能特性

- 多项目管理：添加、编辑、删除项目
- Git 集成：支持从 Git 克隆项目，构建前自动拉取最新代码
- 凭证管理：支持 SSH 密钥和 HTTPS 认证（加密存储）
- 构建管理：执行构建命令、查看实时日志
- 产物下载：支持配置构建产物路径，一键打包下载

## 安装

这个项目使用 [Node.js](https://nodejs.org/)（版本 24.x）和 [pnpm](https://pnpm.io/)。请确保你本地安装了它们。

```sh
pnpm install
```

## 使用说明

```sh
# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 运行 ESLint 检查
pnpm lint
```

## 部署

### Node.js 部署

```sh
pnpm build
pnpm start
```

支持所有类型项目的构建，包括 Tauri、Electron 等桌面应用（需要本机已安装相应的构建环境）。

### Docker 部署

```sh
docker compose up -d
```

内置 Node.js、pnpm、JDK 17、Maven、Git，支持前端和 Java 项目的构建。

## 使用许可

[MIT](https://opensource.org/licenses/MIT) © Guany
