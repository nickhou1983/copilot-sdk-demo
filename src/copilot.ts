import { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { getAllTools } from "./services/toolRegistry.js";
import { initializeToolRegistry } from "./services/toolRegistry.js";
import {
  getAgentById,
  getDefaultAgentConfig,
  getAllSDKAgents,
  getAgentPreferredModel,
} from "./services/agentManager.js";
import { getMCPServersForSession } from "./services/mcpManager.js";
import { getSkillsForSession } from "./services/skillManager.js";
import { initializeStorage } from "./services/storage.js";

import type { SystemMessageStorageConfig, PermissionPolicy, InfiniteSessionStorageConfig } from "./types/agent.js";

/**
 * Copilot 客户端封装
 * 提供统一的接口管理 CopilotClient 和会话
 *
 * 支持两种模式：
 * 1. 默认模式 (stdio) - SDK 自动管理 CLI 进程
 * 2. Server 模式 - 连接到外部已运行的 CLI 服务器
 *
 * 环境变量配置：
 * - COPILOT_CLI_URL: CLI 服务器地址（设置后启用 Server 模式）
 *   例如: "localhost:8080" 或 "http://127.0.0.1:9000"
 * - COPILOT_CLI_PATH: 自定义 CLI 可执行文件路径
 * - COPILOT_LOG_LEVEL: 日志级别 ("none" | "error" | "warning" | "info" | "debug" | "all")
 */

// 静态模型列表（作为动态列表不可用时的 fallback）
export const FALLBACK_MODELS = [
  { id: "claude-opus-4.5", name: "Claude Opus 4.5", description: "Anthropic Claude Opus 4.5" },
  { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Anthropic Claude Sonnet 4.5" },
  { id: "gpt-5.2-codex", name: "GPT-5.2-Codex", description: "OpenAI GPT-5.2-Codex" },
  { id: "gpt-4o", name: "GPT-4o", description: "OpenAI GPT-4o" },
  { id: "gpt-4.1", name: "GPT-4.1", description: "OpenAI GPT-4.1" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Anthropic Claude Sonnet 4" },
  { id: "o3-mini", name: "o3-mini", description: "OpenAI o3-mini" },
] as const;

export type ModelId = string;

// 客户端单例
let clientInstance: CopilotClient | null = null;

// 活跃会话缓存
const activeSessions = new Map<string, CopilotSession>();

// 会话关联的 Agent ID 缓存
const sessionAgentMap = new Map<string, string>();

// 本地消息历史缓存（存储完整的消息内容）
const messageHistoryCache = new Map<string, Array<{ role: string; content: string }>>();

// Per-session user input request handlers (set by server.ts when sending messages)
const userInputHandlers = new Map<string, (request: UserInputRequest) => Promise<UserInputResponse>>();

// Per-session permission request handlers (set by server.ts when sending messages)
const permissionHandlers = new Map<string, (request: PermissionRequestData) => Promise<PermissionResponseData>>();

// Per-session permission policy cache (populated from agent config)
const sessionPermissionPolicy = new Map<string, PermissionPolicy>();

export interface UserInputRequest {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
}

export interface UserInputResponse {
  answer: string;
  wasFreeform: boolean;
}

export interface PermissionRequestData {
  kind: "shell" | "write" | "mcp" | "read" | "url";
  toolCallId?: string;
  [key: string]: unknown;
}

export interface PermissionResponseData {
  kind: "approved" | "denied-by-rules" | "denied-no-approval-rule-and-could-not-request-from-user" | "denied-interactively-by-user";
}

/**
 * 设置会话的用户输入请求处理器
 * 在发送消息时由 server.ts 调用，将处理器绑定到当前 socket
 */
export function setUserInputHandler(
  sessionId: string,
  handler: (request: UserInputRequest) => Promise<UserInputResponse>
): void {
  userInputHandlers.set(sessionId, handler);
}

/**
 * 清除会话的用户输入请求处理器
 */
export function clearUserInputHandler(sessionId: string): void {
  userInputHandlers.delete(sessionId);
}

/**
 * 设置会话的权限请求处理器
 * 在发送消息时由 server.ts 调用，将处理器绑定到当前 socket
 */
export function setPermissionHandler(
  sessionId: string,
  handler: (request: PermissionRequestData) => Promise<PermissionResponseData>
): void {
  permissionHandlers.set(sessionId, handler);
}

/**
 * 清除会话的权限请求处理器
 */
export function clearPermissionHandler(sessionId: string): void {
  permissionHandlers.delete(sessionId);
}

// 每个会话最大消息数量限制
const MAX_MESSAGES_PER_SESSION = 100;

// 默认消息超时时间（5分钟）
const DEFAULT_MESSAGE_TIMEOUT = 5 * 60 * 1000;

/**
 * 添加消息到本地缓存
 * 自动裁剪超出限制的旧消息
 */
function addMessageToCache(sessionId: string, role: string, content: string) {
  if (!messageHistoryCache.has(sessionId)) {
    messageHistoryCache.set(sessionId, []);
  }
  const messages = messageHistoryCache.get(sessionId)!;
  messages.push({ role, content });

  // 如果超出限制，移除最旧的消息
  if (messages.length > MAX_MESSAGES_PER_SESSION) {
    const excess = messages.length - MAX_MESSAGES_PER_SESSION;
    messages.splice(0, excess);
  }
}

/**
 * 获取客户端配置选项
 */
function getClientOptions(): Record<string, unknown> {
  const options: Record<string, unknown> = {
    autoStart: true,
    autoRestart: true,
  };

  // Server 模式：连接到外部 CLI 服务器
  const cliUrl = process.env.COPILOT_CLI_URL;
  if (cliUrl) {
    options.cliUrl = cliUrl;
    console.log(`🔗 使用 Server 模式，连接到: ${cliUrl}`);
  } else {
    console.log(`🚀 使用默认模式（stdio），自动管理 CLI 进程`);
  }

  // 自定义 CLI 路径
  const cliPath = process.env.COPILOT_CLI_PATH;
  if (cliPath) {
    options.cliPath = cliPath;
    console.log(`📍 CLI 路径: ${cliPath}`);
  }

  // 日志级别
  const logLevel = process.env.COPILOT_LOG_LEVEL;
  if (logLevel) {
    options.logLevel = logLevel;
  }

  return options;
}

/**
 * 构建会话配置（包含 MCP, Custom Agents, Skills）
 */
function buildSessionConfig(agentId?: string) {
  // 获取所有注册的工具
  const tools = getAllTools();

  // 获取 MCP 服务器配置（全局 + Agent 级别）
  const mcpServers = getMCPServersForSession(agentId);

  // 获取 SDK 原生 Custom Agents 配置
  const customAgents = getAllSDKAgents();

  // 获取 Skills 配置
  const skillsConfig = getSkillsForSession();

  // 获取 Agent 的 systemMessage 配置
  let systemMessage: { mode?: string; content?: string } | undefined;
  let permissionPolicy: PermissionPolicy = "ask-user";
  let infiniteSession: InfiniteSessionStorageConfig | undefined;
  if (agentId) {
    const agent = getAgentById(agentId);
    if (agent?.systemMessage && agent.systemMessage.content) {
      systemMessage = {
        mode: agent.systemMessage.mode,
        content: agent.systemMessage.content,
      };
    }
    if (agent?.permissionPolicy) {
      permissionPolicy = agent.permissionPolicy;
    }
    if (agent?.infiniteSession) {
      infiniteSession = agent.infiniteSession;
    }
  }

  return {
    tools,
    mcpServers,
    customAgents,
    skillDirectories: skillsConfig.skillDirectories,
    disabledSkills: skillsConfig.disabledSkills,
    systemMessage,
    permissionPolicy,
    infiniteSession,
  };
}

/**
 * 初始化 Copilot 服务（包括存储和工具注册）
 */
export async function initializeCopilot(): Promise<void> {
  // 初始化存储服务
  initializeStorage();
  // 初始化工具注册中心
  initializeToolRegistry();
  console.log("✅ Agent、Tool、MCP 和 Skills 系统已初始化");
}

/**
 * 动态获取可用模型列表
 */
export async function listAvailableModels(): Promise<
  Array<{ id: string; name: string; description: string }>
> {
  try {
    const client = await getClient();
    const models = await client.listModels();
    return models.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.name || m.id,
    }));
  } catch (e) {
    console.warn("⚠️ 动态获取模型列表失败，使用静态列表:", (e as Error).message);
    return [...FALLBACK_MODELS];
  }
}

/**
 * 获取或创建 CopilotClient 实例
 */
export async function getClient(): Promise<CopilotClient> {
  if (!clientInstance) {
    const options = getClientOptions();
    clientInstance = new CopilotClient(options as any);
    await clientInstance.start();
    console.log("✅ CopilotClient 已启动");
  }
  return clientInstance;
}

/**
 * 停止客户端
 */
export async function stopClient(): Promise<void> {
  if (clientInstance) {
    for (const session of activeSessions.values()) {
      try {
        await session.destroy();
      } catch (e) {
        // 忽略销毁错误
      }
    }
    activeSessions.clear();

    await clientInstance.stop();
    clientInstance = null;
    console.log("🛑 CopilotClient 已停止");
  }
}

/**
 * 创建新会话
 */
export async function createSession(
  sessionId?: string,
  model: ModelId = "claude-opus-4.5",
  agentId?: string
): Promise<CopilotSession> {
  const client = await getClient();

  // 确定使用的 Agent
  let resolvedAgentId: string;
  if (agentId) {
    const agent = getAgentById(agentId);
    if (agent) {
      resolvedAgentId = agent.id;
      if (agent.preferredModel) {
        model = agent.preferredModel as ModelId;
      }
    } else {
      resolvedAgentId = getDefaultAgentConfig().id;
    }
  } else {
    resolvedAgentId = getDefaultAgentConfig().id;
  }

  // 构建会话配置（MCP + Custom Agents + Skills）
  const sessionConfig = buildSessionConfig(resolvedAgentId);

  // 缓存权限策略
  const permPolicy = sessionConfig.permissionPolicy;

  // 构建 onPermissionRequest 回调
  const onPermissionRequest = async (request: any, invocation: any) => {
    const sid = id || sessionId || invocation?.sessionId || "";
    const policy = sessionPermissionPolicy.get(sid) || permPolicy;

    // 自动批准模式
    if (policy === "auto-approve") {
      console.log(`✅ [权限] 自动批准: ${request.kind}`);
      return { kind: "approved" as const };
    }
    // 全部拒绝模式
    if (policy === "deny-all") {
      console.log(`❌ [权限] 自动拒绝: ${request.kind}`);
      return { kind: "denied-by-rules" as const };
    }
    // 询问用户模式 - 转发到前端
    const handler = permissionHandlers.get(sid);
    if (handler) {
      return handler(request);
    }
    // 没有处理器时默认拒绝
    return { kind: "denied-no-approval-rule-and-could-not-request-from-user" as const };
  };

  // 构建 infiniteSessions 配置
  const infiniteSessionsConfig = sessionConfig.infiniteSession
    ? {
        enabled: sessionConfig.infiniteSession.enabled,
        backgroundCompactionThreshold: sessionConfig.infiniteSession.backgroundCompactionThreshold,
        bufferExhaustionThreshold: sessionConfig.infiniteSession.bufferExhaustionThreshold,
      }
    : undefined;

  const session = await client.createSession({
    sessionId,
    model,
    streaming: true,
    tools: sessionConfig.tools as any,
    mcpServers: Object.keys(sessionConfig.mcpServers).length > 0 ? sessionConfig.mcpServers : undefined,
    customAgents: sessionConfig.customAgents.length > 0 ? sessionConfig.customAgents : undefined,
    skillDirectories: sessionConfig.skillDirectories.length > 0 ? sessionConfig.skillDirectories : undefined,
    disabledSkills: sessionConfig.disabledSkills.length > 0 ? sessionConfig.disabledSkills : undefined,
    systemMessage: sessionConfig.systemMessage as any,
    infiniteSessions: infiniteSessionsConfig,
    onPermissionRequest,
    onUserInputRequest: async (request: any) => {
      const handler = userInputHandlers.get(id || sessionId || "");
      if (handler) {
        return handler(request);
      }
      return { answer: "", wasFreeform: true };
    },
  });

  const id = sessionId || session.sessionId;
  activeSessions.set(id, session);
  sessionAgentMap.set(id, resolvedAgentId);
  sessionPermissionPolicy.set(id, permPolicy);

  console.log(`📝 会话已创建: ${id}, 模型: ${model}, Agent: ${resolvedAgentId}, 权限策略: ${permPolicy}${infiniteSessionsConfig ? ', 无限会话: 开启' : ''}`);
  return session;
}

/**
 * 获取或恢复会话
 */
export async function getOrCreateSession(
  sessionId: string,
  model: ModelId = "claude-opus-4.5",
  agentId?: string
): Promise<CopilotSession> {
  if (activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId)!;
  }

  const client = await getClient();
  const existingAgentId = sessionAgentMap.get(sessionId) || agentId;
  const sessionConfig = buildSessionConfig(existingAgentId);

  try {
    const sessions = await client.listSessions();
    if (sessions.some((s) => s.sessionId === sessionId)) {
      const session = await client.resumeSession(sessionId, {
        streaming: true,
        tools: sessionConfig.tools as any,
        mcpServers: Object.keys(sessionConfig.mcpServers).length > 0 ? sessionConfig.mcpServers : undefined,
        customAgents: sessionConfig.customAgents.length > 0 ? sessionConfig.customAgents : undefined,
        skillDirectories: sessionConfig.skillDirectories.length > 0 ? sessionConfig.skillDirectories : undefined,
        disabledSkills: sessionConfig.disabledSkills.length > 0 ? sessionConfig.disabledSkills : undefined,
        onPermissionRequest: async (request: any, invocation: any) => {
          const policy = sessionPermissionPolicy.get(sessionId) || sessionConfig.permissionPolicy;
          if (policy === "auto-approve") return { kind: "approved" as const };
          if (policy === "deny-all") return { kind: "denied-by-rules" as const };
          const handler = permissionHandlers.get(sessionId);
          if (handler) return handler(request);
          return { kind: "denied-no-approval-rule-and-could-not-request-from-user" as const };
        },
        onUserInputRequest: async (request: any) => {
          const handler = userInputHandlers.get(sessionId);
          if (handler) {
            return handler(request);
          }
          return { answer: "", wasFreeform: true };
        },
      });
      activeSessions.set(sessionId, session);
      sessionPermissionPolicy.set(sessionId, sessionConfig.permissionPolicy);
      console.log(`🔄 会话已恢复: ${sessionId}`);
      return session;
    }
  } catch (e) {
    // 会话不存在，创建新的
  }

  return createSession(sessionId, model, agentId);
}

/**
 * 列出所有会话
 */
export async function listSessions(): Promise<
  Array<{ sessionId: string; createdAt?: Date; messageCount?: number; title?: string }>
> {
  const client = await getClient();
  const sessions = await client.listSessions();

  return sessions.map((session) => {
    const cachedMessages = messageHistoryCache.get(session.sessionId);
    let title: string | undefined;

    if (cachedMessages && cachedMessages.length > 0) {
      const userMessages = cachedMessages.filter((m) => m.role === "user");
      if (userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1].content;
        title = lastUserMessage.length > 50
          ? lastUserMessage.substring(0, 50) + "..."
          : lastUserMessage;
      }
    }

    const sessionData = session as { sessionId: string; createdAt?: Date; messageCount?: number };

    return {
      sessionId: session.sessionId,
      createdAt: sessionData.createdAt,
      messageCount: cachedMessages?.length || sessionData.messageCount || 0,
      title,
    };
  });
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const client = await getClient();

  const session = activeSessions.get(sessionId);
  if (session) {
    try {
      await session.destroy();
    } catch (e) {
      // 忽略
    }
    activeSessions.delete(sessionId);
  }

  messageHistoryCache.delete(sessionId);
  sessionAgentMap.delete(sessionId);

  await client.deleteSession(sessionId);
  console.log(`🗑️ 会话已删除: ${sessionId}`);
}

/**
 * 获取会话消息历史
 */
export async function getSessionMessages(
  sessionId: string
): Promise<Array<{ role: string; content: string }>> {
  if (messageHistoryCache.has(sessionId)) {
    const cached = messageHistoryCache.get(sessionId)!;
    console.log(`📋 [${sessionId}] 从本地缓存获取消息历史，共 ${cached.length} 条`);
    return cached;
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    return [];
  }

  try {
    const events = await session.getMessages();
    console.log(`📋 [${sessionId}] 从 SDK 获取消息历史，共 ${events.length} 条事件`);

    const messages = events
      .filter((e) => e.type === "user.message" || e.type === "assistant.message")
      .map((e) => {
        const data = e.data as Record<string, unknown>;
        let content = "";

        if (e.type === "user.message") {
          content = (data.prompt as string) || (data.content as string) || (data.text as string) || "";
        } else {
          content = (data.content as string) || (data.text as string) || (data.message as string) || "";
        }

        return {
          role: e.type === "user.message" ? "user" : "assistant",
          content,
        };
      })
      .filter((m) => m.content.trim().length > 0);

    if (messages.length > 0) {
      messageHistoryCache.set(sessionId, messages);
    }

    return messages;
  } catch (e) {
    return [];
  }
}

/**
 * 发送消息并返回事件流
 */
export interface SendMessageOptions {
  sessionId: string;
  prompt: string;
  model?: ModelId;
  agentId?: string;
  attachments?: Array<{
    type: "file" | "directory";
    path: string;
    displayName?: string;
  }>;
  onDelta?: (content: string) => void;
  onReasoningDelta?: (content: string) => void;
  onToolCall?: (toolName: string, args: unknown, toolCallId: string) => void;
  onToolResult?: (toolName: string, result: unknown, toolCallId: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}

export async function sendMessage(options: SendMessageOptions): Promise<void> {
  const {
    sessionId,
    prompt,
    model = "claude-opus-4.5",
    agentId,
    attachments,
    onDelta,
    onReasoningDelta,
    onToolCall,
    onToolResult,
    onComplete,
    onError,
  } = options;

  const unsubscribers: Array<() => void> = [];
  let cleanupCalled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    unsubscribers.forEach((unsub) => {
      try {
        if (typeof unsub === 'function') {
          unsub();
        }
      } catch (e) {
        // 忽略取消订阅错误
      }
    });
    unsubscribers.length = 0;
  };

  try {
    const session = await getOrCreateSession(sessionId, model, agentId);

    addMessageToCache(sessionId, "user", prompt);

    let fullContent = "";
    let hasDelta = false;
    let completed = false;
    let pendingToolCalls = 0;
    const toolNameByCallId = new Map<string, string>();

    const finalize = (content: string) => {
      if (completed) return;
      completed = true;

      if (content.trim().length > 0) {
        addMessageToCache(sessionId, "assistant", content);
      }

      onComplete?.(content);
      setTimeout(() => cleanup(), 100);
    };

    const streamFallback = async (content: string) => {
      const chunkSize = 24;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        onDelta?.(chunk);
        await new Promise((r) => setTimeout(r, 15));
      }
    };

    unsubscribers.push(
      session.on("assistant.message_delta", (event) => {
        const delta = event.data.deltaContent || "";
        if (delta.length > 0) {
          hasDelta = true;
        }
        fullContent += delta;
        onDelta?.(delta);
      })
    );

    unsubscribers.push(
      session.on("assistant.reasoning_delta", (event) => {
        const delta = event.data.deltaContent || "";
        if (delta.length > 0) {
          onReasoningDelta?.(delta);
        }
      })
    );

    unsubscribers.push(
      session.on("tool.execution_start", (event) => {
        pendingToolCalls++;
        toolNameByCallId.set(event.data.toolCallId, event.data.toolName);
        onToolCall?.(event.data.toolName, event.data.arguments, event.data.toolCallId);
      })
    );

    unsubscribers.push(
      session.on("tool.execution_complete", (event) => {
        pendingToolCalls = Math.max(0, pendingToolCalls - 1);
        const name = toolNameByCallId.get(event.data.toolCallId) || event.data.toolCallId;
        onToolResult?.(name, event.data.result, event.data.toolCallId);
      })
    );

    unsubscribers.push(
      (session.on as any)("tool.execution_error", (event: any) => {
        pendingToolCalls = Math.max(0, pendingToolCalls - 1);
        const name = toolNameByCallId.get(event.data.toolCallId) || event.data.toolCallId;
        console.error(`⚠️ 工具执行错误 [${name}]:`, event.data.error);
        onToolResult?.(name, { error: event.data.error || "工具执行失败" }, event.data.toolCallId);
      })
    );

    unsubscribers.push(
      session.on("assistant.message", (event) => {
        const content = event.data.content || "";
        const toolRequests = (event.data as { toolRequests?: unknown[] }).toolRequests;

        if (toolRequests && toolRequests.length > 0 && content.length === 0) {
          return;
        }

        if (pendingToolCalls > 0) {
          if (content.length > 0 && fullContent.length === 0) {
            fullContent = content;
          }
          return;
        }

        if (!hasDelta && content.length > 0) {
          fullContent = content;
          void streamFallback(content).then(() => finalize(fullContent));
          return;
        }
        if (content.length > 0 && fullContent.length === 0) {
          fullContent = content;
        }
        if (content.length > 0 || fullContent.length > 0) {
          finalize(fullContent || content);
        }
      })
    );

    unsubscribers.push(
      session.on("session.error", (event) => {
        onError?.(new Error(event.data.message || "未知错误"));
        cleanup();
      })
    );

    unsubscribers.push(
      session.on("session.idle", () => {
        if (!completed && pendingToolCalls === 0) {
          finalize(fullContent);
        }
      })
    );

    const completionPromise = new Promise<void>((resolve, reject) => {
      const checkComplete = setInterval(() => {
        if (completed) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 100);

      timeoutHandle = setTimeout(() => {
        clearInterval(checkComplete);
        if (!completed) {
          if (fullContent.length > 0) {
            finalize(fullContent);
            resolve();
          } else {
            cleanup();
            reject(new Error('消息响应超时'));
          }
        } else {
          resolve();
        }
      }, DEFAULT_MESSAGE_TIMEOUT);
    });

    // SDK 原生 Custom Agents 处理 system prompt，直接发送原始消息
    await session.send({
      prompt,
      attachments,
    });

    await completionPromise;
  } catch (error) {
    cleanup();
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * SendAndWait 同步模式发送消息
 * 使用 SDK session.sendAndWait()，等待完成后一次性返回完整响应
 */
export interface SendMessageSyncOptions {
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
  onToolCall?: (toolName: string, args: unknown, toolCallId: string) => void;
  onToolResult?: (toolName: string, result: unknown, toolCallId: string) => void;
  onError?: (error: Error) => void;
}

export async function sendMessageSync(options: SendMessageSyncOptions): Promise<{
  content: string;
  toolCalls: Array<{ toolName: string; args: unknown; toolCallId: string; result?: unknown }>;
}> {
  const {
    sessionId,
    prompt,
    model = "claude-opus-4.5",
    agentId,
    attachments,
    timeout = DEFAULT_MESSAGE_TIMEOUT,
    onToolCall,
    onToolResult,
    onError,
  } = options;

  const unsubscribers: Array<() => void> = [];
  const toolCalls: Array<{ toolName: string; args: unknown; toolCallId: string; result?: unknown }> = [];
  const toolNameByCallId = new Map<string, string>();

  try {
    const session = await getOrCreateSession(sessionId, model, agentId);

    addMessageToCache(sessionId, "user", prompt);

    // Listen for tool events during sendAndWait
    unsubscribers.push(
      session.on("tool.execution_start", (event) => {
        const { toolName, arguments: args, toolCallId } = event.data;
        toolNameByCallId.set(toolCallId, toolName);
        toolCalls.push({ toolName, args, toolCallId });
        onToolCall?.(toolName, args, toolCallId);
      })
    );

    unsubscribers.push(
      session.on("tool.execution_complete", (event) => {
        const name = toolNameByCallId.get(event.data.toolCallId) || event.data.toolCallId;
        const entry = toolCalls.find(t => t.toolCallId === event.data.toolCallId);
        if (entry) {
          entry.result = event.data.result;
        }
        onToolResult?.(name, event.data.result, event.data.toolCallId);
      })
    );

    unsubscribers.push(
      (session.on as any)("tool.execution_error", (event: any) => {
        const name = toolNameByCallId.get(event.data.toolCallId) || event.data.toolCallId;
        const errorResult = { error: event.data.error || "工具执行失败" };
        const entry = toolCalls.find(t => t.toolCallId === event.data.toolCallId);
        if (entry) {
          entry.result = errorResult;
        }
        onToolResult?.(name, errorResult, event.data.toolCallId);
      })
    );

    // Use sendAndWait - blocks until session is idle
    const result = await (session as any).sendAndWait(
      { prompt, attachments },
      timeout
    );

    const content = result?.data?.content || result?.content || "";

    if (content.trim().length > 0) {
      addMessageToCache(sessionId, "assistant", content);
    }

    return { content, toolCalls };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return { content: "", toolCalls };
  } finally {
    unsubscribers.forEach((unsub) => {
      try { unsub(); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * 中止当前请求
 */
export async function abortSession(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (session) {
    await session.abort();
    console.log(`⏹️ 会话已中止: ${sessionId}`);
  }
}

/**
 * 获取会话关联的 Agent ID
 */
export function getSessionAgentId(sessionId: string): string | undefined {
  return sessionAgentMap.get(sessionId);
}

/**
 * 设置会话关联的 Agent ID
 */
export function setSessionAgent(sessionId: string, agentId: string): void {
  sessionAgentMap.set(sessionId, agentId);
}
