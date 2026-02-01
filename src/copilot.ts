import { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { allTools } from "./tools.js";

/**
 * Copilot 客户端封装
 * 提供统一的接口管理 CopilotClient 和会话
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

/**
 * 获取或创建 CopilotClient 实例
 */
export async function getClient(): Promise<CopilotClient> {
  if (!clientInstance) {
    clientInstance = new CopilotClient();
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
 * 列出所有会话
 */
export async function listSessions(): Promise<
  Array<{ sessionId: string; createdAt?: Date; messageCount?: number }>
> {
  const client = await getClient();
  const sessions = await client.listSessions();
  return sessions;
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

  await client.deleteSession(sessionId);
  console.log(`🗑️ 会话已删除: ${sessionId}`);
}

/**
 * 获取会话消息历史
 */
export async function getSessionMessages(
  sessionId: string
): Promise<Array<{ role: string; content: string }>> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return [];
  }

  try {
    const events = await session.getMessages();
    return events
      .filter((e) => e.type === "user.message" || e.type === "assistant.message")
      .map((e) => ({
        role: e.type === "user.message" ? "user" : "assistant",
        content: e.data.content || "",
      }))
      .filter((m) => m.content.trim().length > 0);
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
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
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

  // 清理所有监听器的函数
  const cleanup = () => {
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers.length = 0;
  };

  try {
    const session = await getOrCreateSession(sessionId, model);

    let fullContent = "";
    let hasDelta = false;
    let completed = false;
    const toolNameByCallId = new Map<string, string>();

    const finalize = (content: string) => {
      if (completed) return;
      completed = true;
      onComplete?.(content);
      cleanup();
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
        toolNameByCallId.set(event.data.toolCallId, event.data.toolName);
        onToolCall?.(event.data.toolName, event.data.arguments);
      })
    );

    unsubscribers.push(
      session.on("tool.execution_complete", (event) => {
        const name = toolNameByCallId.get(event.data.toolCallId) || event.data.toolCallId;
        onToolResult?.(name, event.data.result);
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
        if (!completed) {
          finalize(fullContent);
        }
      })
    );

    // 创建完成 Promise
    const completionPromise = new Promise<void>((resolve) => {
      const checkComplete = setInterval(() => {
        if (completed) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 100);
    });

    // 发送消息（非阻塞）
    await session.send({
      prompt,
      attachments,
    });

    // 等待完成（无超时限制，由 session.idle 或 assistant.message 触发）
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
