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
  sendMessageSync,
  abortSession,
  stopClient,
  initializeCopilot,
  getSessionAgentId,
  setSessionAgent,
  listAvailableModels,
  setUserInputHandler,
  clearUserInputHandler,
  FALLBACK_MODELS,
  type ModelId,
} from "./copilot.js";

// Agent 和 Tool 管理服务
import {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgentById,
  setDefaultAgent,
  validateAgentConfig,
} from "./services/agentManager.js";
import {
  getBuiltinToolsInfo,
  getCustomToolsInfo,
  getToolGroupsInfo,
  registerCustomTool,
  unregisterCustomTool,
  refreshCustomTools,
} from "./services/toolRegistry.js";
import {
  saveCustomTool,
  deleteCustomTool,
  saveToolGroup,
  deleteToolGroup,
  generateId,
  loadToolGroups,
} from "./services/storage.js";
import { validateToolConfig } from "./tools/customHandler.js";
// MCP 管理服务
import {
  listMCPServers,
  createMCPServer,
  updateMCPServer,
  removeMCPServer,
  toggleMCPServer,
} from "./services/mcpManager.js";
// Skills 管理服务
import {
  getAllSkills,
  getSkill,
  getSkillContent,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillEnabled,
  getSkillDirectories,
  addSkillDirectory,
  removeSkillDirectory,
} from "./services/skillManager.js";
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
  CreateCustomToolRequest,
  UpdateCustomToolRequest,
  CustomToolConfig,
  ToolGroup,
  CreateToolGroupRequest,
  CreateMCPServerRequest,
  UpdateMCPServerRequest,
} from "./types/agent.js";

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

// 获取可用模型列表（动态获取）
app.get("/api/models", async (_req, res) => {
  try {
    const models = await listAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    res.json({ success: true, models: FALLBACK_MODELS });
  }
});

// 初始化 Copilot 服务并启动服务器
async function startServer() {
  // 初始化 Agent/Tool 系统
  await initializeCopilot();
  // Socket.IO 连接处理
  io.on("connection", (socket) => {
    console.log(`🔌 客户端连接: ${socket.id}`);

    // ===============================
    // Agent 管理事件
    // ===============================

    // 获取所有 Agent
    socket.on("list-agents", () => {
      try {
        const agents = getAllAgents();
        socket.emit("agents-list", { success: true, agents });
      } catch (error) {
        socket.emit("agents-list", {
          success: false,
          error: error instanceof Error ? error.message : "获取 Agent 列表失败",
        });
      }
    });

    // 获取单个 Agent
    socket.on("get-agent", (data: { agentId: string }) => {
      try {
        const agent = getAgentById(data.agentId);
        if (agent) {
          socket.emit("agent-detail", { success: true, agent });
        } else {
          socket.emit("agent-detail", { success: false, error: "Agent 不存在" });
        }
      } catch (error) {
        socket.emit("agent-detail", {
          success: false,
          error: error instanceof Error ? error.message : "获取 Agent 失败",
        });
      }
    });

    // 创建 Agent
    socket.on("create-agent", (data: CreateAgentRequest) => {
      try {
        const errors = validateAgentConfig(data);
        if (errors.length > 0) {
          socket.emit("agent-created", { success: false, errors });
          return;
        }
        const agent = createAgent(data);
        socket.emit("agent-created", { success: true, agent });
      } catch (error) {
        socket.emit("agent-created", {
          success: false,
          error: error instanceof Error ? error.message : "创建 Agent 失败",
        });
      }
    });

    // 更新 Agent
    socket.on("update-agent", (data: UpdateAgentRequest) => {
      try {
        const agent = updateAgent(data);
        socket.emit("agent-updated", { success: true, agent });
      } catch (error) {
        socket.emit("agent-updated", {
          success: false,
          error: error instanceof Error ? error.message : "更新 Agent 失败",
        });
      }
    });

    // 删除 Agent
    socket.on("delete-agent", (data: { agentId: string }) => {
      try {
        const success = deleteAgentById(data.agentId);
        socket.emit("agent-deleted", { success, agentId: data.agentId });
      } catch (error) {
        socket.emit("agent-deleted", {
          success: false,
          error: error instanceof Error ? error.message : "删除 Agent 失败",
        });
      }
    });

    // 设置默认 Agent
    socket.on("set-default-agent", (data: { agentId: string }) => {
      try {
        const agent = setDefaultAgent(data.agentId);
        socket.emit("default-agent-set", { success: true, agent });
      } catch (error) {
        socket.emit("default-agent-set", {
          success: false,
          error: error instanceof Error ? error.message : "设置默认 Agent 失败",
        });
      }
    });

    // ===============================
    // Tool 管理事件
    // ===============================

    // 获取所有工具（内置 + 自定义）
    socket.on("list-tools", () => {
      try {
        const builtinTools = getBuiltinToolsInfo();
        const customTools = getCustomToolsInfo();
        socket.emit("tools-list", {
          success: true,
          builtinTools,
          customTools,
        });
      } catch (error) {
        socket.emit("tools-list", {
          success: false,
          error: error instanceof Error ? error.message : "获取工具列表失败",
        });
      }
    });

    // 获取工具分组
    socket.on("list-tool-groups", () => {
      try {
        const groups = getToolGroupsInfo();
        socket.emit("tool-groups-list", { success: true, groups });
      } catch (error) {
        socket.emit("tool-groups-list", {
          success: false,
          error: error instanceof Error ? error.message : "获取工具分组失败",
        });
      }
    });

    // 创建自定义工具
    socket.on("create-custom-tool", (data: CreateCustomToolRequest) => {
      try {
        const toolConfig: CustomToolConfig = {
          id: generateId("tool"),
          name: data.name,
          description: data.description,
          parameters: data.parameters,
          handlerType: data.handlerType,
          handlerConfig: data.handlerConfig,
          enabled: true,
          groupId: data.groupId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const errors = validateToolConfig(toolConfig);
        if (errors.length > 0) {
          socket.emit("custom-tool-created", { success: false, errors });
          return;
        }

        // 保存到存储
        saveCustomTool(toolConfig);
        // 注册到运行时
        registerCustomTool(toolConfig);

        socket.emit("custom-tool-created", { success: true, tool: toolConfig });
      } catch (error) {
        socket.emit("custom-tool-created", {
          success: false,
          error: error instanceof Error ? error.message : "创建自定义工具失败",
        });
      }
    });

    // 更新自定义工具
    socket.on("update-custom-tool", (data: UpdateCustomToolRequest) => {
      try {
        const existingTools = getCustomToolsInfo();
        const existing = existingTools.find(t => t.id === data.id);
        if (!existing) {
          socket.emit("custom-tool-updated", { success: false, error: "工具不存在" });
          return;
        }

        const updated: CustomToolConfig = {
          ...existing,
          name: data.name ?? existing.name,
          description: data.description ?? existing.description,
          parameters: data.parameters ?? existing.parameters,
          handlerType: data.handlerType ?? existing.handlerType,
          handlerConfig: data.handlerConfig ?? existing.handlerConfig,
          enabled: data.enabled ?? existing.enabled,
          groupId: data.groupId ?? existing.groupId,
          updatedAt: new Date().toISOString(),
        };

        saveCustomTool(updated);
        // 刷新运行时工具缓存
        refreshCustomTools();

        socket.emit("custom-tool-updated", { success: true, tool: updated });
      } catch (error) {
        socket.emit("custom-tool-updated", {
          success: false,
          error: error instanceof Error ? error.message : "更新自定义工具失败",
        });
      }
    });

    // 删除自定义工具
    socket.on("delete-custom-tool", (data: { toolId: string }) => {
      try {
        deleteCustomTool(data.toolId);
        unregisterCustomTool(data.toolId);
        socket.emit("custom-tool-deleted", { success: true, toolId: data.toolId });
      } catch (error) {
        socket.emit("custom-tool-deleted", {
          success: false,
          error: error instanceof Error ? error.message : "删除自定义工具失败",
        });
      }
    });

    // 创建工具分组
    socket.on("create-tool-group", (data: CreateToolGroupRequest) => {
      try {
        const group: ToolGroup = {
          id: generateId("group"),
          name: data.name,
          description: data.description || "",
          toolIds: data.toolIds || [],
          icon: data.icon,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveToolGroup(group);
        socket.emit("tool-group-created", { success: true, group });
      } catch (error) {
        socket.emit("tool-group-created", {
          success: false,
          error: error instanceof Error ? error.message : "创建工具分组失败",
        });
      }
    });

    // 删除工具分组
    socket.on("delete-tool-group", (data: { groupId: string }) => {
      try {
        deleteToolGroup(data.groupId);
        socket.emit("tool-group-deleted", { success: true, groupId: data.groupId });
      } catch (error) {
        socket.emit("tool-group-deleted", {
          success: false,
          error: error instanceof Error ? error.message : "删除工具分组失败",
        });
      }
    });

    // ===============================
    // MCP Server 管理事件
    // ===============================

    // 获取所有 MCP 服务器
    socket.on("list-mcp-servers", () => {
      try {
        const servers = listMCPServers();
        socket.emit("mcp-servers-list", { success: true, servers });
      } catch (error) {
        socket.emit("mcp-servers-list", {
          success: false,
          error: error instanceof Error ? error.message : "获取 MCP 服务器列表失败",
        });
      }
    });

    // 创建 MCP 服务器
    socket.on("create-mcp-server", (data: CreateMCPServerRequest) => {
      try {
        const server = createMCPServer(data);
        socket.emit("mcp-server-created", { success: true, server });
      } catch (error) {
        socket.emit("mcp-server-created", {
          success: false,
          error: error instanceof Error ? error.message : "创建 MCP 服务器失败",
        });
      }
    });

    // 更新 MCP 服务器
    socket.on("update-mcp-server", (data: UpdateMCPServerRequest) => {
      try {
        const server = updateMCPServer(data.id, data);
        socket.emit("mcp-server-updated", { success: true, server });
      } catch (error) {
        socket.emit("mcp-server-updated", {
          success: false,
          error: error instanceof Error ? error.message : "更新 MCP 服务器失败",
        });
      }
    });

    // 删除 MCP 服务器
    socket.on("delete-mcp-server", (data: { serverId: string }) => {
      try {
        const success = removeMCPServer(data.serverId);
        socket.emit("mcp-server-deleted", { success, serverId: data.serverId });
      } catch (error) {
        socket.emit("mcp-server-deleted", {
          success: false,
          error: error instanceof Error ? error.message : "删除 MCP 服务器失败",
        });
      }
    });

    // 启用/禁用 MCP 服务器
    socket.on("toggle-mcp-server", (data: { serverId: string; enabled: boolean }) => {
      try {
        const server = toggleMCPServer(data.serverId, data.enabled);
        socket.emit("mcp-server-toggled", { success: true, server });
      } catch (error) {
        socket.emit("mcp-server-toggled", {
          success: false,
          error: error instanceof Error ? error.message : "切换 MCP 服务器状态失败",
        });
      }
    });

    // ===============================
    // Skills 管理事件
    // ===============================

    // 获取所有 Skills
    socket.on("list-skills", () => {
      try {
        const skills = getAllSkills();
        socket.emit("skills-list", { success: true, skills });
      } catch (error) {
        socket.emit("skills-list", {
          success: false,
          error: error instanceof Error ? error.message : "获取 Skills 列表失败",
        });
      }
    });

    // 获取 Skill 详情
    socket.on("get-skill", (data: { skillId: string }) => {
      try {
        const skill = getSkill(data.skillId);
        if (skill) {
          socket.emit("skill-detail", { success: true, skill });
        } else {
          socket.emit("skill-detail", { success: false, error: "Skill 不存在" });
        }
      } catch (error) {
        socket.emit("skill-detail", {
          success: false,
          error: error instanceof Error ? error.message : "获取 Skill 详情失败",
        });
      }
    });

    // 创建 Skill
    socket.on("create-skill", (data: { name: string; content: string; directory?: string }) => {
      try {
        const skill = createSkill(data);
        socket.emit("skill-created", { success: true, skill });
      } catch (error) {
        socket.emit("skill-created", {
          success: false,
          error: error instanceof Error ? error.message : "创建 Skill 失败",
        });
      }
    });

    // 更新 Skill
    socket.on("update-skill", (data: { skillId: string; content: string }) => {
      try {
        const skill = updateSkill(data.skillId, data.content);
        socket.emit("skill-updated", { success: true, skill });
      } catch (error) {
        socket.emit("skill-updated", {
          success: false,
          error: error instanceof Error ? error.message : "更新 Skill 失败",
        });
      }
    });

    // 删除 Skill
    socket.on("delete-skill", (data: { skillId: string }) => {
      try {
        const success = deleteSkill(data.skillId);
        socket.emit("skill-deleted", { success, skillId: data.skillId });
      } catch (error) {
        socket.emit("skill-deleted", {
          success: false,
          error: error instanceof Error ? error.message : "删除 Skill 失败",
        });
      }
    });

    // 启用/禁用 Skill
    socket.on("toggle-skill", (data: { skillName: string; enabled: boolean }) => {
      try {
        const config = toggleSkillEnabled(data.skillName, data.enabled);
        socket.emit("skill-toggled", { success: true, config });
      } catch (error) {
        socket.emit("skill-toggled", {
          success: false,
          error: error instanceof Error ? error.message : "切换 Skill 状态失败",
        });
      }
    });

    // 获取 Skill 目录列表
    socket.on("list-skill-directories", () => {
      try {
        const directories = getSkillDirectories();
        socket.emit("skill-directories-list", { success: true, directories });
      } catch (error) {
        socket.emit("skill-directories-list", {
          success: false,
          error: error instanceof Error ? error.message : "获取 Skill 目录列表失败",
        });
      }
    });

    // 添加 Skill 目录
    socket.on("add-skill-directory", (data: { directory: string }) => {
      try {
        const config = addSkillDirectory(data.directory);
        socket.emit("skill-directory-added", { success: true, config });
      } catch (error) {
        socket.emit("skill-directory-added", {
          success: false,
          error: error instanceof Error ? error.message : "添加 Skill 目录失败",
        });
      }
    });

    // 移除 Skill 目录
    socket.on("remove-skill-directory", (data: { directory: string }) => {
      try {
        const config = removeSkillDirectory(data.directory);
        socket.emit("skill-directory-removed", { success: true, config });
      } catch (error) {
        socket.emit("skill-directory-removed", {
          success: false,
          error: error instanceof Error ? error.message : "移除 Skill 目录失败",
        });
      }
    });

    // 获取会话关联的 Agent
    socket.on("get-session-agent", (data: { sessionId: string }) => {
      const agentId = getSessionAgentId(data.sessionId);
      socket.emit("session-agent", {
        success: true,
        sessionId: data.sessionId,
        agentId,
      });
    });

    // 设置会话的 Agent
    socket.on("set-session-agent", (data: { sessionId: string; agentId: string }) => {
      try {
        setSessionAgent(data.sessionId, data.agentId);
        socket.emit("session-agent-set", {
          success: true,
          sessionId: data.sessionId,
          agentId: data.agentId,
        });
      } catch (error) {
        socket.emit("session-agent-set", {
          success: false,
          error: error instanceof Error ? error.message : "设置会话 Agent 失败",
        });
      }
    });

    // ===============================
    // 会话管理事件
    // ===============================

    // 创建新会话（支持 agentId）
    socket.on("create-session", async (data: { sessionId?: string; model?: ModelId; agentId?: string }) => {
      try {
        const session = await createSession(data.sessionId, data.model, data.agentId);
        socket.emit("session-created", {
          success: true,
          sessionId: session.sessionId,
          model: data.model || "gpt-4o",
          agentId: data.agentId,
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

  // 发送消息（支持 agentId）
  socket.on(
    "send-message",
    async (data: {
      sessionId: string;
      prompt: string;
      model?: ModelId;
      agentId?: string;
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

      // 注册用户输入请求处理器：当 SDK 需要用户输入时，转发到前端
      setUserInputHandler(data.sessionId, (request) => {
        return new Promise((resolve) => {
          socket.emit("user-input-request", {
            sessionId: data.sessionId,
            question: request.question,
            choices: request.choices,
            allowFreeform: request.allowFreeform ?? true,
          });
          // 监听用户的回答
          socket.once(`user-input-response:${data.sessionId}`, (response: { answer: string; wasFreeform?: boolean }) => {
            resolve({
              answer: response.answer,
              wasFreeform: response.wasFreeform ?? true,
            });
          });
        });
      });

      // 使用 Promise 包装，等待真正完成
      try {
        await sendMessage({
          sessionId: data.sessionId,
          prompt: data.prompt,
          model: data.model,
          agentId: data.agentId,
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
            const isStructured = result && typeof result === 'object' && 'resultType' in (result as Record<string, unknown>);
            socket.emit("tool-result", {
              sessionId: data.sessionId,
              toolName,
              result,
              toolCallId,
              isStructured,
              resultType: isStructured ? (result as Record<string, unknown>).resultType : undefined,
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
      } finally {
        clearUserInputHandler(data.sessionId);
      }
    }
  );

  // 同步发送消息（SendAndWait 模式）
  socket.on(
    "send-message-sync",
    async (data: {
      sessionId: string;
      prompt: string;
      model?: ModelId;
      agentId?: string;
      attachments?: Array<{
        type: "file" | "directory";
        path: string;
        displayName?: string;
      }>;
      timeout?: number;
    }) => {
      console.log(`📨 [Sync] 收到消息: [${data.sessionId}] ${data.prompt.substring(0, 50)}...`);

      socket.emit("message-start", {
        sessionId: data.sessionId,
        mode: "sync",
      });

      // Register user input handler (same pattern as streaming mode)
      setUserInputHandler(data.sessionId, (request) => {
        return new Promise((resolve) => {
          socket.emit("user-input-request", {
            sessionId: data.sessionId,
            question: request.question,
            choices: request.choices,
            allowFreeform: request.allowFreeform ?? true,
          });
          socket.once(`user-input-response:${data.sessionId}`, (response: { answer: string; wasFreeform?: boolean }) => {
            resolve({
              answer: response.answer,
              wasFreeform: response.wasFreeform ?? true,
            });
          });
        });
      });

      try {
        const result = await sendMessageSync({
          sessionId: data.sessionId,
          prompt: data.prompt,
          model: data.model,
          agentId: data.agentId,
          attachments: data.attachments,
          timeout: data.timeout,
          onToolCall: (toolName, args, toolCallId) => {
            socket.emit("tool-call", {
              sessionId: data.sessionId,
              toolName,
              args,
              toolCallId,
            });
          },
          onToolResult: (toolName, result, toolCallId) => {
            const isStructured = result && typeof result === 'object' && 'resultType' in (result as Record<string, unknown>);
            socket.emit("tool-result", {
              sessionId: data.sessionId,
              toolName,
              result,
              toolCallId,
              isStructured,
              resultType: isStructured ? (result as Record<string, unknown>).resultType : undefined,
            });
          },
          onError: (error) => {
            socket.emit("message-error", {
              sessionId: data.sessionId,
              error: error.message,
            });
          },
        });

        socket.emit("message-complete", {
          sessionId: data.sessionId,
          content: result.content,
          mode: "sync",
          toolCalls: result.toolCalls,
        });
        console.log(`✅ [Sync] 消息完成: [${data.sessionId}]`);
      } catch (error) {
        console.error(`❌ [Sync] sendMessageSync 异常: [${data.sessionId}]`, error);
        socket.emit("message-error", {
          sessionId: data.sessionId,
          error: error instanceof Error ? error.message : "同步消息发送失败",
        });
      } finally {
        clearUserInputHandler(data.sessionId);
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
║      • SDK 原生 Custom Agent                           ║
║      • MCP Server 集成                                 ║
║      • Skills 技能系统                                 ║
║      • 动态工具配置                                    ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

} // End of startServer function

// 启动服务器
startServer().catch(console.error);

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
