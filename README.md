# Copilot SDK Demo

基于 [@github/copilot-sdk](https://www.npmjs.com/package/@github/copilot-sdk) 的全功能 AI 对话平台，展示如何使用 GitHub Copilot CLI SDK 构建可定制的智能助手应用，支持自定义 Agent、工具扩展、MCP 集成和技能系统。

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ 功能特性

### 核心对话

- 🚀 **流式对话** - 支持实时流式输出（Streaming）和同步等待（SendAndWait）两种模式
- 🧠 **思考过程** - 显示模型的推理思考过程（Reasoning）
- 📎 **文件附件** - 支持上传文件和目录进行分析
- 🖼️ **粘贴图片** - 支持直接粘贴剪贴板图片（Ctrl/Cmd+V）
- 💾 **会话管理** - 支持创建、恢复、删除会话，本地消息历史缓存
- 🔄 **多模型切换** - 支持动态获取可用模型列表，运行时切换
- 🗨️ **用户交互输入** - 支持 SDK 发起的用户确认/选择交互（User Input Request）
- 🔐 **权限审批** - 支持 SDK Permission Handler，三种策略：询问用户、自动批准、全部拒绝
- ♾️ **无限会话** - 支持 SDK Infinite Sessions，自动压缩上下文窗口，支持超长对话

### 自定义 Agent 系统

- 🤖 **Agent 管理** - 创建、编辑、删除自定义 Agent，支持设置默认 Agent
- 📝 **System Prompt 配置** - 每个 Agent 可配置独立的 system prompt（支持 append/replace 模式）
- 🔧 **工具绑定** - Agent 可绑定特定工具集，或设为 `null` 使用全部工具
- 🌐 **MCP 关联** - Agent 可关联特定 MCP Server，实现能力扩展
- 🎯 **推断模式** - 支持 `infer` 配置，控制 Agent 的工具推断行为
- 🎨 **个性化** - 支持自定义图标、颜色、首选模型等 UI 元数据
- 📂 **持久化存储** - Agent 配置以 JSON 文件存储于 `data/agents/`

### 工具系统

- 🔨 **内置工具** - 提供计算器（calculator）、时间（time）、天气（weather）、文本处理（text）等内置工具
- 🛠️ **自定义工具** - 支持通过 UI 动态创建自定义工具，三种 Handler 类型：
  - `http_get` - HTTP GET 请求，URL 支持参数模板
  - `http_post` - HTTP POST 请求，支持 Body 模板
  - `javascript` - 沙箱执行 JavaScript 代码
- 📦 **工具分组** - 支持将工具组织为逻辑分组（Tool Groups）
- 🔌 **结构化结果** - 支持 `ToolResultObject`，包括二进制结果（图片等）
- 📂 **持久化存储** - 自定义工具配置存储于 `data/tools/`，工具分组存储于 `data/config/`

### MCP Server 集成

- 🌐 **MCP 协议支持** - 完整支持 Model Context Protocol，连接外部工具服务
- 📡 **多种传输方式** - 支持 `local`/`stdio`（本地进程）和 `http`/`sse`（远程服务）
- ⚙️ **灵活配置** - 支持自定义环境变量、工作目录、请求头、超时等
- 🔀 **作用域控制** - MCP Server 支持 `global`（全局）和 `agent`（Agent 级别）两种作用域
- ✅ **动态启停** - 支持运行时启用/禁用 MCP Server
- 📂 **持久化存储** - MCP 配置存储于 `data/config/mcpServers.json`

### Skills 技能系统

- 📚 **Markdown 技能** - 以 Markdown 文件定义技能，注入为 session-level skills
- 📁 **多目录扫描** - 支持配置多个 skill 目录，自动递归扫描 `.md` 文件
- ✏️ **在线编辑** - 支持通过 UI 创建、编辑、删除 skill 文件
- 🔀 **启用/禁用** - 支持按名称启用或禁用特定 skill
- 📂 **持久化存储** - Skill 配置存储于 `data/config/skills.json`，skill 文件位于 `data/skills/`

### 前端界面

- 📱 **响应式 UI** - 简洁美观的聊天界面
- 💬 **消息气泡** - 区分用户/助手消息，支持 Markdown 渲染
- 🧠 **思考过程展示** - 可折叠的 Reasoning 区块
- 🔧 **工具调用可视化** - 展示工具调用过程和结果
- ⚙️ **管理面板** - Agent、Tool、MCP、Skill 的可视化管理界面
- 📝 **会话侧边栏** - 会话历史管理

## 🤖 支持的模型

动态从 SDK 获取可用模型列表，以下为 fallback 列表：

| 模型 | 说明 |
|------|------|
| `claude-opus-4.5` | Anthropic Claude Opus 4.5 |
| `claude-sonnet-4.5` | Anthropic Claude Sonnet 4.5 |
| `claude-sonnet-4` | Anthropic Claude Sonnet 4 |
| `gpt-5.2-codex` | OpenAI GPT-5.2-Codex |
| `gpt-4o` | OpenAI GPT-4o |
| `gpt-4.1` | OpenAI GPT-4.1 |
| `o3-mini` | OpenAI o3-mini |

## 📦 技术栈

- **后端**: Node.js + Express + Socket.io
- **前端**: 原生 HTML/CSS/JavaScript
- **SDK**: @github/copilot-sdk
- **语言**: TypeScript
- **校验**: Zod（工具参数 schema）
- **文件上传**: Multer

## 🚀 快速开始

### 前置要求

1. Node.js >= 18.0.0
2. 已安装并认证 GitHub Copilot CLI（`gh copilot`）

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/nickhou1983/copilot-sdk-demo.git
cd copilot-sdk-demo

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### Server 模式（可选）

SDK 支持两种运行模式：

1. **默认模式 (stdio)** - SDK 自动管理 CLI 进程生命周期
2. **Server 模式** - 连接到外部已运行的 Copilot CLI 服务器

使用 Server 模式需要先手动启动 CLI 服务器：

```bash
# 终端 1：启动 Copilot CLI 服务器
copilot server --port 8080

# 终端 2：设置环境变量并启动应用
COPILOT_CLI_URL=localhost:8080 npm run dev
```

支持的环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `COPILOT_CLI_URL` | CLI 服务器地址（启用 Server 模式） | `localhost:8080` |
| `COPILOT_CLI_PATH` | 自定义 CLI 可执行文件路径 | `/usr/local/bin/copilot` |
| `COPILOT_LOG_LEVEL` | 日志级别 | `debug` |
| `PORT` | 应用监听端口（默认 3000） | `8000` |

也可以创建 `.env` 文件配置（参考 `.env.example`）。

### 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📁 项目结构

```
copilot-sdk-demo/
├── public/                      # 前端静态文件
│   ├── index.html              # 主页面
│   ├── css/
│   │   └── style.css           # 样式表
│   └── js/
│       ├── app.js              # 核心前端逻辑（对话、会话管理）
│       ├── agentManager.js     # Agent 管理 UI
│       ├── toolManager.js      # Tool 管理 UI
│       ├── mcpManager.js       # MCP Server 管理 UI
│       └── skillManager.js     # Skill 管理 UI
├── src/                         # 后端源码
│   ├── server.ts               # Express 服务器 + Socket.io 事件处理
│   ├── copilot.ts              # Copilot SDK 封装（客户端、会话、消息）
│   ├── tools.ts                # 静态自定义工具定义（时间、计算器、天气）
│   ├── routes/
│   │   └── upload.ts           # 文件上传路由
│   ├── services/
│   │   ├── agentManager.ts     # Agent 管理服务（CRUD + SDK 转换）
│   │   ├── toolRegistry.ts     # 工具注册表（内置 + 自定义工具）
│   │   ├── mcpManager.ts       # MCP Server 管理服务
│   │   ├── skillManager.ts     # Skill 管理服务（目录扫描、文件读写）
│   │   └── storage.ts          # JSON 文件持久化存储
│   ├── tools/
│   │   ├── index.ts            # 内置工具注册中心
│   │   ├── customHandler.ts    # 自定义工具运行时处理器
│   │   ├── builtin/            # 内置工具实现
│   │   │   ├── calculator.ts   # 数学计算
│   │   │   ├── time.ts         # 时间日期
│   │   │   ├── weather.ts      # 天气查询（模拟）
│   │   │   └── text.ts         # 文本处理
│   │   └── templates/          # 工具模板参考
│   └── types/
│       └── agent.ts            # TypeScript 类型定义
├── data/                        # 数据持久化目录
│   ├── agents/
│   │   └── agents.json         # Agent 配置
│   ├── config/
│   │   ├── mcpServers.json     # MCP Server 配置
│   │   ├── skills.json         # Skill 系统配置
│   │   └── toolGroups.json     # 工具分组配置
│   ├── skills/                 # Skill Markdown 文件
│   └── tools/
│       └── custom.json         # 自定义工具配置
├── uploads/                     # 文件上传目录
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 核心实现

### SDK 初始化

```typescript
import { CopilotClient, CopilotSession } from "@github/copilot-sdk";

// 创建客户端（自动使用 gh copilot 认证）
const client = new CopilotClient();
await client.start();

// 创建会话（支持 Agent、Tools、MCP、Skills）
const session = await client.createSession({
  streaming: true,
  model: "claude-opus-4.5",
  agents: sdkAgents,       // 自定义 Agent 配置
  tools: allTools,         // 注册的工具列表
  mcpServers: mcpConfig,   // MCP Server 配置
  skills: skillContents,   // Skill 内容
});
```

### 发送消息并处理事件

```typescript
// 监听流式输出
session.on("assistant.message_delta", (event) => {
  console.log(event.data.deltaContent);
});

// 监听思考过程
session.on("assistant.reasoning_delta", (event) => {
  console.log("Thinking:", event.data.deltaContent);
});

// 监听工具调用
session.on("tool.execution_start", (event) => {
  console.log("Tool:", event.data.toolName);
});

// 发送消息并等待完成
const result = await session.sendAndWait({ prompt: "Hello!" });
```

### 自定义 Agent 示例

```json
{
  "id": "agent_001",
  "name": "code-reviewer",
  "displayName": "Code Reviewer",
  "description": "专注于代码审查的 Agent",
  "prompt": "你是一个专业的代码审查助手，帮助用户审查代码质量...",
  "systemMessage": {
    "mode": "append",
    "content": "始终使用中文回复"
  },
  "tools": ["calculate", "get_current_time"],
  "mcpServerIds": ["mcp_001"],
  "infer": true,
  "preferredModel": "claude-sonnet-4",
  "icon": "🔍",
  "color": "#10b981"
}
```

### 自定义工具示例

```json
{
  "name": "ip_lookup",
  "description": "查询 IP 地址的地理位置信息",
  "parameters": [
    { "name": "ip", "type": "string", "description": "IP 地址", "required": true }
  ],
  "handlerType": "http_get",
  "handlerConfig": {
    "url": "https://ipapi.co/{{ip}}/json/",
    "resultPath": "$.country_name"
  }
}
```

## 📡 API 接口

### Socket.io 事件

#### 会话管理

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `create-session` | Client → Server | 创建新会话（支持 agentId） |
| `list-sessions` | Client → Server | 获取会话列表 |
| `delete-session` | Client → Server | 删除会话 |
| `get-messages` | Client → Server | 获取会话消息历史 |
| `send-message` | Client → Server | 流式发送消息 |
| `send-message-sync` | Client → Server | 同步发送消息（SendAndWait） |
| `abort` | Client → Server | 中止当前请求 |

#### 消息事件

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `message-start` | Server → Client | 消息开始 |
| `message-delta` | Server → Client | 流式内容增量 |
| `reasoning-delta` | Server → Client | 思考过程增量 |
| `tool-call` | Server → Client | 工具调用开始 |
| `tool-result` | Server → Client | 工具调用结果（支持结构化） |
| `message-complete` | Server → Client | 消息完成 |
| `message-error` | Server → Client | 错误信息 |
| `user-input-request` | Server → Client | 请求用户输入 |
| `user-input-response:${id}` | Client → Server | 用户输入响应 |
| `permission-request` | Server → Client | 请求权限审批 |
| `permission-response:${id}` | Client → Server | 权限审批响应 |

#### Agent 管理

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `list-agents` | Client → Server | 获取所有 Agent |
| `get-agent` | Client → Server | 获取单个 Agent |
| `create-agent` | Client → Server | 创建 Agent |
| `update-agent` | Client → Server | 更新 Agent |
| `delete-agent` | Client → Server | 删除 Agent |
| `set-default-agent` | Client → Server | 设置默认 Agent |
| `get-session-agent` | Client → Server | 获取会话关联的 Agent |
| `set-session-agent` | Client → Server | 设置会话的 Agent |

#### Tool 管理

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `list-tools` | Client → Server | 获取所有工具（内置 + 自定义） |
| `list-tool-groups` | Client → Server | 获取工具分组 |
| `create-custom-tool` | Client → Server | 创建自定义工具 |
| `update-custom-tool` | Client → Server | 更新自定义工具 |
| `delete-custom-tool` | Client → Server | 删除自定义工具 |
| `create-tool-group` | Client → Server | 创建工具分组 |
| `delete-tool-group` | Client → Server | 删除工具分组 |

#### MCP Server 管理

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `list-mcp-servers` | Client → Server | 获取 MCP Server 列表 |
| `create-mcp-server` | Client → Server | 创建 MCP Server |
| `update-mcp-server` | Client → Server | 更新 MCP Server |
| `delete-mcp-server` | Client → Server | 删除 MCP Server |
| `toggle-mcp-server` | Client → Server | 启用/禁用 MCP Server |

#### Skill 管理

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `list-skills` | Client → Server | 获取所有 Skill |
| `get-skill` | Client → Server | 获取 Skill 详情 |
| `create-skill` | Client → Server | 创建 Skill |
| `update-skill` | Client → Server | 更新 Skill |
| `delete-skill` | Client → Server | 删除 Skill |
| `toggle-skill` | Client → Server | 启用/禁用 Skill |
| `list-skill-directories` | Client → Server | 获取 Skill 目录 |
| `add-skill-directory` | Client → Server | 添加 Skill 目录 |
| `remove-skill-directory` | Client → Server | 移除 Skill 目录 |

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 上传文件附件 |
| `/api/models` | GET | 获取可用模型列表 |

## 🔍 调试技巧

启用详细日志查看 SDK 事件：

```bash
COPILOT_LOG_LEVEL=debug npm run dev
```

## 📝 注意事项

1. **认证**: 需要先通过 `gh auth login` 和 `gh copilot` 完成 GitHub Copilot CLI 认证
2. **会话持久化**: SDK 内置会话持久化，会话 ID 可用于恢复历史对话
3. **工具调用**: 内置工具和自定义工具均通过 SDK 自动调度执行
4. **流式输出**: 支持流式（Streaming）和同步（SendAndWait）两种消息模式
5. **数据存储**: 所有配置以 JSON 文件存储于 `data/` 目录，无需数据库
6. **安全**: 文件上传目录为 `uploads/`，生产环境需配置访问控制；Copilot CLI 认证信息仅本地使用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [@github/copilot-sdk NPM](https://www.npmjs.com/package/@github/copilot-sdk)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli)
