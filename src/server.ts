import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";

import uploadRouter from "./routes/upload.js";
import {
  createSession,
  listSessions,
  deleteSession,
  getSessionMessages,
  sendMessage,
  abortSession,
  stopClient,
  AVAILABLE_MODELS,
  type ModelId,
} from "./copilot.js";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(process.cwd(), "public")));

// API 路由
app.use("/api/upload", uploadRouter);

// 获取可用模型列表
app.get("/api/models", (_req, res) => {
  res.json({
    success: true,
    models: AVAILABLE_MODELS,
  });
});

// Socket.IO 连接处理
io.on("connection", (socket) => {
  console.log(`🔌 客户端连接: ${socket.id}`);

  // 创建新会话
  socket.on("create-session", async (data: { sessionId?: string; model?: ModelId }) => {
    try {
      const session = await createSession(data.sessionId, data.model);
      socket.emit("session-created", {
        success: true,
        sessionId: session.sessionId,
        model: data.model || "gpt-4o",
      });
    } catch (error) {
      socket.emit("session-created", {
        success: false,
        error: error instanceof Error ? error.message : "创建会话失败",
      });
    }
  });

  // 获取会话列表
  socket.on("list-sessions", async () => {
    try {
      const sessions = await listSessions();
      socket.emit("sessions-list", {
        success: true,
        sessions,
      });
    } catch (error) {
      socket.emit("sessions-list", {
        success: false,
        error: error instanceof Error ? error.message : "获取会话列表失败",
      });
    }
  });

  // 删除会话
  socket.on("delete-session", async (data: { sessionId: string }) => {
    try {
      await deleteSession(data.sessionId);
      socket.emit("session-deleted", {
        success: true,
        sessionId: data.sessionId,
      });
    } catch (error) {
      socket.emit("session-deleted", {
        success: false,
        error: error instanceof Error ? error.message : "删除会话失败",
      });
    }
  });

  // 获取会话消息历史
  socket.on("get-messages", async (data: { sessionId: string }) => {
    try {
      const messages = await getSessionMessages(data.sessionId);
      socket.emit("messages-history", {
        success: true,
        sessionId: data.sessionId,
        messages,
      });
    } catch (error) {
      socket.emit("messages-history", {
        success: false,
        error: error instanceof Error ? error.message : "获取消息历史失败",
      });
    }
  });

  // 发送消息
  socket.on(
    "send-message",
    async (data: {
      sessionId: string;
      prompt: string;
      model?: ModelId;
      attachments?: Array<{
        type: "file" | "directory";
        path: string;
        displayName?: string;
      }>;
    }) => {
      console.log(`📨 收到消息: [${data.sessionId}] ${data.prompt.substring(0, 50)}...`);

      // 通知开始处理
      socket.emit("message-start", {
        sessionId: data.sessionId,
      });

      // 使用 Promise 包装，等待真正完成
      try {
        await sendMessage({
          sessionId: data.sessionId,
          prompt: data.prompt,
          model: data.model,
          attachments: data.attachments,
          onDelta: (content) => {
            socket.emit("message-delta", {
              sessionId: data.sessionId,
              content,
            });
          },
          onReasoningDelta: (content) => {
            socket.emit("reasoning-delta", {
              sessionId: data.sessionId,
              content,
            });
          },
          onToolCall: (toolName, args, toolCallId) => {
            socket.emit("tool-call", {
              sessionId: data.sessionId,
              toolName,
              args,
              toolCallId,
            });
          },
          onToolResult: (toolName, result, toolCallId) => {
            socket.emit("tool-result", {
              sessionId: data.sessionId,
              toolName,
              result,
              toolCallId,
            });
          },
          onComplete: (fullContent) => {
            socket.emit("message-complete", {
              sessionId: data.sessionId,
              content: fullContent,
            });
            console.log(`✅ 消息完成: [${data.sessionId}]`);
          },
          onError: (error) => {
            socket.emit("message-error", {
              sessionId: data.sessionId,
              error: error.message,
            });
            console.error(`❌ 消息错误: [${data.sessionId}]`, error.message);
          },
        });
      } catch (error) {
        console.error(`❌ sendMessage 异常: [${data.sessionId}]`, error);
      }
    }
  );

  // 中止请求
  socket.on("abort", async (data: { sessionId: string }) => {
    try {
      await abortSession(data.sessionId);
      socket.emit("aborted", {
        success: true,
        sessionId: data.sessionId,
      });
    } catch (error) {
      socket.emit("aborted", {
        success: false,
        error: error instanceof Error ? error.message : "中止失败",
      });
    }
  });

  // 断开连接
  socket.on("disconnect", () => {
    console.log(`🔌 客户端断开: ${socket.id}`);
  });
});

// 启动服务器
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Copilot SDK Demo 服务器已启动                     ║
║                                                        ║
║   📍 地址: http://localhost:${PORT}                       ║
║                                                        ║
║   📋 功能:                                             ║
║      • 流式对话                                        ║
║      • 文件附件分析                                    ║
║      • 会话管理（创建/恢复/删除）                      ║
║      • 多模型切换                                      ║
║      • 自定义工具调用                                  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

// 优雅退出
process.on("SIGINT", async () => {
  console.log("\n🛑 正在关闭服务器...");
  await stopClient();
  httpServer.close(() => {
    console.log("👋 再见!");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  await stopClient();
  httpServer.close(() => {
    process.exit(0);
  });
});
