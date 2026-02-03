import { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { allTools } from "./tools.js";

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

// 支持的模型列表
export const AVAILABLE_MODELS = [
  { id: "claude-opus-4.5", name: "Claude Opus 4.5", description: "Anthropic Claude Opus 4.5" },
  { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Anthropic Claude Sonnet 4.5" },
  { id: "gpt-5.2-codex", name: "GPT-5.2-Codex", description: "OpenAI GPT-5.2-Codex" },
  { id: "gpt-4o", name: "GPT-4o", description: "OpenAI GPT-4o" },
  { id: "gpt-4.1", name: "GPT-4.1", description: "OpenAI GPT-4.1" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Anthropic Claude Sonnet 4" },
  { id: "o3-mini", name: "o3-mini", description: "OpenAI o3-mini" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// 客户端单例
let clientInstance: CopilotClient | null = null;

// 活跃会话缓存
const activeSessions = new Map<string, CopilotSession>();

// 本地消息历史缓存（存储完整的消息内容）
const messageHistoryCache = new Map<string, Array<{ role: string; content: string }>>();

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
  
  // 如果超出限制，移除最旧的消息（保留系统消息）
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
    // 清理所有活跃会话
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
  model: ModelId = "claude-opus-4.5"
): Promise<CopilotSession> {
  const client = await getClient();

  const session = await client.createSession({
    sessionId,
    model,
    streaming: true,
    tools: allTools,
  });

  const id = sessionId || session.sessionId;
  activeSessions.set(id, session);

  console.log(`📝 会话已创建: ${id}, 模型: ${model}`);
  return session;
}

/**
 * 获取或恢复会话
 */
export async function getOrCreateSession(
  sessionId: string,
  model: ModelId = "claude-opus-4.5"
): Promise<CopilotSession> {
  // 检查缓存
  if (activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId)!;
  }

  const client = await getClient();

  // 尝试恢复已存在的会话
  try {
    const sessions = await client.listSessions();
    if (sessions.some((s) => s.sessionId === sessionId)) {
      const session = await client.resumeSession(sessionId, {
        streaming: true,
        tools: allTools,
      });
      activeSessions.set(sessionId, session);
      console.log(`🔄 会话已恢复: ${sessionId}`);
      return session;
    }
  } catch (e) {
    // 会话不存在，创建新的
  }

  return createSession(sessionId, model);
}

/**
 * 列出所有会话（包含最后一条用户消息作为标题）
 */
export async function listSessions(): Promise<
  Array<{ sessionId: string; createdAt?: Date; messageCount?: number; title?: string }>
> {
  const client = await getClient();
  const sessions = await client.listSessions();
  
  // 为每个会话添加标题（使用最后一条用户消息）
  return sessions.map((session) => {
    const cachedMessages = messageHistoryCache.get(session.sessionId);
    let title: string | undefined;
    
    if (cachedMessages && cachedMessages.length > 0) {
      // 从缓存中找到最后一条用户消息
      const userMessages = cachedMessages.filter((m) => m.role === "user");
      if (userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1].content;
        // 截取前 50 个字符作为标题
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

  // 从缓存中移除
  const session = activeSessions.get(sessionId);
  if (session) {
    try {
      await session.destroy();
    } catch (e) {
      // 忽略
    }
    activeSessions.delete(sessionId);
  }
  
  // 清理本地消息缓存
  messageHistoryCache.delete(sessionId);

  await client.deleteSession(sessionId);
  console.log(`🗑️ 会话已删除: ${sessionId}`);
}

/**
 * 获取会话消息历史
 * 优先使用本地缓存（包含完整内容），如果没有则尝试从 SDK 获取
 */
export async function getSessionMessages(
  sessionId: string
): Promise<Array<{ role: string; content: string }>> {
  // 优先返回本地缓存的消息（包含完整内容）
  if (messageHistoryCache.has(sessionId)) {
    const cached = messageHistoryCache.get(sessionId)!;
    console.log(`📋 [${sessionId}] 从本地缓存获取消息历史，共 ${cached.length} 条`);
    return cached;
  }
  
  // 如果本地没有缓存，尝试从 SDK 获取（可能内容不完整）
  const session = activeSessions.get(sessionId);
  if (!session) {
    return [];
  }

  try {
    const events = await session.getMessages();
    
    // 调试：打印原始事件结构
    console.log(`📋 [${sessionId}] 从 SDK 获取消息历史，共 ${events.length} 条事件`);
    events.forEach((e, idx) => {
      if (e.type === "user.message" || e.type === "assistant.message") {
        console.log(`  [${idx}] type=${e.type}, data keys=${Object.keys(e.data || {}).join(", ")}`);
        const data = e.data as Record<string, unknown>;
        // 打印每个可能的内容字段
        if (data.prompt) console.log(`    prompt (${String(data.prompt).length} chars): ${String(data.prompt).substring(0, 100)}...`);
        if (data.content) console.log(`    content (${String(data.content).length} chars): ${String(data.content).substring(0, 100)}...`);
        if (data.text) console.log(`    text (${String(data.text).length} chars): ${String(data.text).substring(0, 100)}...`);
        if (data.message) console.log(`    message (${String(data.message).length} chars): ${String(data.message).substring(0, 100)}...`);
      }
    });
    
    const messages = events
      .filter((e) => e.type === "user.message" || e.type === "assistant.message")
      .map((e) => {
        const data = e.data as Record<string, unknown>;
        let content = "";
        
        if (e.type === "user.message") {
          // 用户消息的内容可能在 prompt 或 content 字段中
          content = (data.prompt as string) || (data.content as string) || (data.text as string) || "";
        } else {
          // 助手消息的内容可能在 content、text 或 message 字段中
          content = (data.content as string) || (data.text as string) || (data.message as string) || "";
        }
        
        return {
          role: e.type === "user.message" ? "user" : "assistant",
          content,
        };
      })
      .filter((m) => m.content.trim().length > 0);
    
    // 将从 SDK 获取的消息存入本地缓存
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
    attachments,
    onDelta,
    onReasoningDelta,
    onToolCall,
    onToolResult,
    onComplete,
    onError,
  } = options;

  // 存储取消订阅函数
  const unsubscribers: Array<() => void> = [];
  let cleanupCalled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  // 清理所有监听器的函数（确保只执行一次）
  const cleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    
    // 清除超时计时器
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    
    // 安全地取消订阅所有监听器
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
    const session = await getOrCreateSession(sessionId, model);

    // 将用户消息保存到本地缓存
    addMessageToCache(sessionId, "user", prompt);

    let fullContent = "";
    let hasDelta = false;
    let completed = false;
    let pendingToolCalls = 0; // 追踪正在执行的工具数量
    const toolNameByCallId = new Map<string, string>();

    const finalize = (content: string) => {
      if (completed) return;
      completed = true;

      // 将助手回复保存到本地缓存
      if (content.trim().length > 0) {
        addMessageToCache(sessionId, "assistant", content);
      }

      onComplete?.(content);
      // 延迟执行 cleanup，确保队列中的事件都能被处理
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

    // 订阅事件（并保存取消订阅函数）

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
        pendingToolCalls++; // 工具开始执行，计数加1
        toolNameByCallId.set(event.data.toolCallId, event.data.toolName);
        onToolCall?.(event.data.toolName, event.data.arguments, event.data.toolCallId);
      })
    );

    unsubscribers.push(
      session.on("tool.execution_complete", (event) => {
        pendingToolCalls = Math.max(0, pendingToolCalls - 1); // 工具执行完成，计数减1
        const name = toolNameByCallId.get(event.data.toolCallId) || event.data.toolCallId;
        onToolResult?.(name, event.data.result, event.data.toolCallId);
      })
    );

    unsubscribers.push(
      session.on("assistant.message", (event) => {
        const content = event.data.content || "";
        const toolRequests = (event.data as { toolRequests?: unknown[] }).toolRequests;

        // 如果有工具请求但没有内容，说明模型正在请求工具调用，不要完成消息
        if (toolRequests && toolRequests.length > 0 && content.length === 0) {
          return;
        }

        // 如果有工具正在执行，不要完成消息
        if (pendingToolCalls > 0) {
          // 但仍然要处理内容
          if (content.length > 0 && fullContent.length === 0) {
            fullContent = content;
          }
          return;
        }

        if (!hasDelta && content.length > 0) {
          // 如果没有收到增量事件，回退为"模拟流式"输出
          fullContent = content;
          void streamFallback(content).then(() => finalize(fullContent));
          return;
        }
        if (content.length > 0 && fullContent.length === 0) {
          // 极端情况下补齐内容
          fullContent = content;
        }
        // 只有当有内容时才完成
        if (content.length > 0 || fullContent.length > 0) {
          finalize(fullContent || content);
        }
      })
    );

    unsubscribers.push(
      session.on("session.error", (event) => {
        onError?.(new Error(event.data.message || "未知错误"));
        // 出错后也清理监听器
        cleanup();
      })
    );

    // 备用完成信号：当 assistant.message 没有触发时（如只有 reasoning）
    unsubscribers.push(
      session.on("session.idle", () => {
        // 如果有工具正在执行，不要完成消息
        if (!completed && pendingToolCalls === 0) {
          finalize(fullContent);
        }
      })
    );

    // 创建完成 Promise（带超时保护）
    const completionPromise = new Promise<void>((resolve, reject) => {
      const checkComplete = setInterval(() => {
        if (completed) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 100);
      
      // 超时保护：防止无限等待
      timeoutHandle = setTimeout(() => {
        clearInterval(checkComplete);
        if (!completed) {
          // 如果有部分内容则正常完成，否则报超时错误
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

    // 发送消息（非阻塞）
    await session.send({
      prompt,
      attachments,
    });

    // 等待完成（有超时保护）
    await completionPromise;
  } catch (error) {
    cleanup();
    onError?.(error instanceof Error ? error : new Error(String(error)));
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
