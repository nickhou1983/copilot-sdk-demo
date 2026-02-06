# Project Guidelines

## Code Style
- 使用 TypeScript，遵循严格类型检查，参考 [src/server.ts]、[src/copilot.ts]。
- 统一使用 2 空格缩进，单引号为主，分号可选但推荐统一。
- 前端为原生 JS/CSS/HTML，结构清晰，样式集中于 [public/css/style.css]。
- 代码注释以英文为主，必要时可用中文补充说明。

## Architecture
- 后端基于 Node.js + Express + Socket.io，入口为 [src/server.ts]。
- Copilot SDK 封装在 [src/copilot.ts]，所有 AI 相关逻辑集中于此。
- 工具注册与自定义在 [src/tools.ts] 和 [src/tools/] 目录下，支持扩展。
- 文件上传路由在 [src/routes/upload.ts]，会话/存储相关逻辑在 [src/services/]。
- 前端静态资源位于 [public/]，核心逻辑在 [public/js/app.js]。

## Build and Test
- 安装依赖：`npm install`
- 启动开发服务器：`npm run dev`
- 支持 Copilot CLI Server 模式，详见 README。
- 暂无自动化测试脚本，建议手动验证主要功能。

## Project Conventions
- 工具扩展采用模块化，新增工具放于 [src/tools/]，并在 [src/tools/index.ts] 注册。
- 所有服务类统一放于 [src/services/]，如 agentManager、toolRegistry、storage。
- Socket.io 事件命名与前后端严格对应，详见 README 的“API 接口”部分。
- 环境变量通过 `.env` 或启动参数配置，参考 `.env.example`。

## Integration Points
- 依赖 @github/copilot-sdk，需预先完成 `gh copilot` 认证。
- 支持多模型切换，模型列表在 [README.md]“支持的模型”部分。
- 文件上传接口为 `/api/upload`，会话管理接口为 `/api/sessions`。

## Security
- 文件上传目录为 [uploads/]，请确保生产环境下有访问控制。
- Copilot CLI 认证信息仅本地使用，不应暴露于前端。
- 建议生产环境关闭详细日志，避免敏感信息泄露。

---
如有不明确或遗漏之处，请反馈以便完善。