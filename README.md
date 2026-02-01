# Copilot SDK Demo

基于 [@github/copilot-sdk](https://www.npmjs.com/package/@github/copilot-sdk) 的对话助手演示应用，展示如何使用 GitHub Copilot CLI SDK 构建自定义 AI 对话应用。

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ 功能特性

- 🚀 **流式对话** - 支持实时流式输出，提供流畅的对话体验
- 🔧 **工具调用** - 正确处理 Copilot CLI 内置工具调用（文件读取、项目探索等）
- 🧠 **思考过程** - 显示模型的推理思考过程（Reasoning）
- 📎 **文件附件** - 支持上传文件进行分析
- 💾 **会话管理** - 支持创建、恢复、删除会话
- 🔄 **多模型切换** - 支持多种 AI 模型选择
- 📱 **响应式 UI** - 简洁美观的聊天界面

## 🤖 支持的模型

| 模型 | 说明 |
|------|------|
| `claude-opus-4.5` | Claude Opus 4.5（默认） |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `gpt-4o` | GPT-4o |
| `gpt-4.1` | GPT-4.1 |
| `o3-mini` | O3 Mini |

## 📦 技术栈

- **后端**: Node.js + Express + Socket.io
- **前端**: 原生 HTML/CSS/JavaScript
- **SDK**: @github/copilot-sdk
- **语言**: TypeScript

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

### 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📁 项目结构

```
copilot-sdk-demo/
├── public/                  # 前端静态文件
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── style.css       # 样式表
│   └── js/
│       └── app.js          # 前端逻辑
├── src/                     # 后端源码
│   ├── server.ts           # Express 服务器 + Socket.io
│   ├── copilot.ts          # Copilot SDK 封装
│   ├── tools.ts            # 自定义工具定义
│   └── routes/
│       └── upload.ts       # 文件上传路由
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

// 创建会话
const session = await client.createSession({
  streaming: true,
  model: "claude-opus-4.5",
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

### 处理工具调用场景

当模型需要调用内置工具（如读取文件）时，SDK 会发送带有 `toolRequests` 的 `assistant.message` 事件，此时需要等待工具执行完成后再获取最终回复：

```typescript
session.on("assistant.message", (event) => {
  const { content, toolRequests } = event.data;
  
  // 有工具请求但无内容时，等待工具执行
  if (toolRequests?.length > 0 && !content) {
    return; // 继续等待
  }
  
  // 有内容时，处理最终回复
  if (content) {
    console.log("Response:", content);
  }
});
```

## 📡 API 接口

### Socket.io 事件

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `create-session` | Client → Server | 创建新会话 |
| `resume-session` | Client → Server | 恢复已有会话 |
| `send-message` | Client → Server | 发送消息 |
| `abort` | Client → Server | 中止当前请求 |
| `delete-session` | Client → Server | 删除会话 |
| `message-start` | Server → Client | 消息开始 |
| `message-delta` | Server → Client | 流式内容增量 |
| `reasoning-delta` | Server → Client | 思考过程增量 |
| `tool-call` | Server → Client | 工具调用开始 |
| `tool-result` | Server → Client | 工具调用结果 |
| `message-complete` | Server → Client | 消息完成 |
| `error` | Server → Client | 错误信息 |

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 上传文件附件 |
| `/api/sessions` | GET | 获取所有会话列表 |

## 🎨 界面预览

应用提供简洁的聊天界面：

- 💬 消息气泡（用户/助手）
- 🧠 可折叠的思考过程展示
- 📎 文件附件指示
- ⚙️ 模型选择下拉菜单
- 📝 会话历史侧边栏

## 🔍 调试技巧

启用详细日志查看 SDK 事件：

```typescript
session.on((event) => {
  console.log(`Event: ${event.type}`, event.data);
});
```

## 📝 注意事项

1. **认证**: 需要先通过 `gh auth login` 和 `gh copilot` 完成 GitHub Copilot CLI 认证
2. **会话持久化**: SDK 内置会话持久化，会话 ID 可用于恢复历史对话
3. **工具调用**: Copilot CLI 内置工具（如文件读取）会自动执行，无需额外配置
4. **流式输出**: 对于涉及工具调用的复杂请求，SDK 可能返回完整内容而非增量，应用会自动进行模拟流式输出

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [@github/copilot-sdk NPM](https://www.npmjs.com/package/@github/copilot-sdk)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli)
