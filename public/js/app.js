/**
 * Copilot SDK Demo - 前端应用
 */

// ===== 全局状态 =====
const state = {
  socket: null,
  currentSessionId: null,
  sessions: [],
  messages: [],
  attachments: [],
  isProcessing: false,
  selectedModel: "claude-opus-4.5",
  pendingMessage: null,
  // 消息状态映射：按消息ID存储，防止竞态条件
  messageStates: new Map(),
  // 当前正在处理的消息ID
  activeMessageId: null,
  // 当前 Agent ID
  currentAgentId: null,
};

// 将 state 暴露到全局，供其他模块访问
window.state = state;

// ===== DOM 元素 =====
const elements = {
  chatContainer: null,
  messageInput: null,
  sendBtn: null,
  fileInput: null,
  attachmentsPreview: null,
  sessionsList: null,
  newChatBtn: null,
  modelSelect: null,
  headerTitle: null,
  statusDot: null,
  statusText: null,
};

// ===== 初始化 =====
document.addEventListener("DOMContentLoaded", () => {
  initElements();
  initSocket();
  initEventListeners();
  loadModels();
  
  // 初始化 Agent 和 Tool 管理器
  if (window.agentManager) {
    window.agentManager.init(state.socket);
  }
  if (window.toolManager) {
    window.toolManager.init(state.socket);
  }
  // 初始化 MCP 和 Skills 管理器
  if (typeof MCPManager !== 'undefined') {
    mcpManager = new MCPManager(state.socket);
  }
  if (typeof SkillManager !== 'undefined') {
    skillManager = new SkillManager(state.socket);
  }
});

function initElements() {
  elements.chatContainer = document.getElementById("chat-container");
  elements.messageInput = document.getElementById("message-input");
  elements.sendBtn = document.getElementById("send-btn");
  elements.fileInput = document.getElementById("file-input");
  elements.attachmentsPreview = document.getElementById("attachments-preview");
  elements.sessionsList = document.getElementById("sessions-list");
  elements.newChatBtn = document.getElementById("new-chat-btn");
  elements.modelSelect = document.getElementById("model-select");
  elements.headerTitle = document.getElementById("header-title");
  elements.statusDot = document.getElementById("status-dot");
  elements.statusText = document.getElementById("status-text");
}

// ===== Socket.IO =====
function initSocket() {
  state.socket = io();

  state.socket.on("connect", () => {
    console.log("✅ 已连接到服务器");
    updateConnectionStatus(true);
    refreshSessions();
  });

  state.socket.on("disconnect", () => {
    console.log("❌ 与服务器断开连接");
    updateConnectionStatus(false);
  });

  // 会话事件
  state.socket.on("session-created", handleSessionCreated);
  state.socket.on("sessions-list", handleSessionsList);
  state.socket.on("session-deleted", handleSessionDeleted);
  state.socket.on("messages-history", handleMessagesHistory);

  // 消息事件
  state.socket.on("message-start", handleMessageStart);
  state.socket.on("message-delta", handleMessageDelta);
  state.socket.on("message-complete", handleMessageComplete);
  state.socket.on("message-error", handleMessageError);
  state.socket.on("reasoning-delta", handleReasoningDelta);

  // 工具事件
  state.socket.on("tool-call", handleToolCall);
  state.socket.on("tool-result", handleToolResult);

  // 用户输入请求事件
  state.socket.on("user-input-request", handleUserInputRequest);
}

function updateConnectionStatus(connected) {
  elements.statusDot.classList.toggle("disconnected", !connected);
  elements.statusText.textContent = connected ? "已连接" : "已断开";
}

// ===== 事件监听 =====
function initEventListeners() {
  // 发送消息
  elements.sendBtn.addEventListener("click", sendMessage);
  elements.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 自动调整输入框高度
  elements.messageInput.addEventListener("input", () => {
    elements.messageInput.style.height = "auto";
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 200) + "px";
  });

  // 文件上传
  document.getElementById("attach-btn").addEventListener("click", () => {
    elements.fileInput.click();
  });
  elements.fileInput.addEventListener("change", handleFileSelect);

  // 粘贴图片
  elements.messageInput.addEventListener("paste", handlePaste);

  // 新建会话
  elements.newChatBtn.addEventListener("click", createNewSession);

  // 模型选择
  elements.modelSelect.addEventListener("change", (e) => {
    state.selectedModel = e.target.value;
  });

  // 功能卡片点击
  document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        elements.messageInput.value = prompt;
        elements.messageInput.focus();
      }
    });
  });
}

// ===== 会话管理 =====
function refreshSessions() {
  state.socket.emit("list-sessions");
}

function createNewSession() {
  const sessionId = `session-${Date.now()}`;
  // 获取当前选中的 Agent
  const agentId = window.agentManager?.getCurrentAgentId();
  state.socket.emit("create-session", {
    sessionId,
    model: state.selectedModel,
    agentId,
  });
}

function switchSession(sessionId, options = {}) {
  const { preserveMessages = false, skipHistory = false } = options;

  state.currentSessionId = sessionId;
  if (!preserveMessages) {
    state.messages = [];
    elements.chatContainer.innerHTML = "";
  }
  
  // 更新 UI
  document.querySelectorAll(".session-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.sessionId === sessionId);
  });
  
  elements.headerTitle.textContent = `会话: ${sessionId.substring(0, 20)}...`;
  
  // 获取消息历史
  if (!skipHistory) {
    state.socket.emit("get-messages", { sessionId });
  }
  
  // 隐藏欢迎消息
  const welcome = document.getElementById("welcome-message");
  if (welcome) {
    welcome.style.display = "none";
  }
}

function deleteSession(sessionId, e) {
  e.stopPropagation();
  if (confirm("确定要删除这个会话吗？")) {
    state.socket.emit("delete-session", { sessionId });
  }
}

// ===== 会话事件处理 =====
function handleSessionCreated(data) {
  if (data.success) {
    console.log("会话已创建:", data.sessionId);
    refreshSessions();
    if (state.pendingMessage) {
      switchSession(data.sessionId, { preserveMessages: true, skipHistory: true });
      const pending = state.pendingMessage;
      state.pendingMessage = null;
      sendMessageToSession(data.sessionId, pending.prompt, pending.attachments, pending.model);
    } else {
      switchSession(data.sessionId);
    }
  } else {
    showError("创建会话失败: " + data.error);
  }
}

function handleSessionsList(data) {
  if (data.success) {
    state.sessions = data.sessions;
    renderSessionsList();
    
    // 保持首页欢迎内容可见，等待用户手动选择会话
  }
}

function handleSessionDeleted(data) {
  if (data.success) {
    if (state.currentSessionId === data.sessionId) {
      state.currentSessionId = null;
      state.messages = [];
      elements.chatContainer.innerHTML = "";
      elements.headerTitle.textContent = "Copilot SDK Demo";
    }
    refreshSessions();
  }
}

function handleMessagesHistory(data) {
  if (data.success && data.sessionId === state.currentSessionId) {
    state.messages = data.messages;
    renderMessages();
  }
}

function renderSessionsList() {
  elements.sessionsList.innerHTML = state.sessions
    .map(
      (session) => `
      <div class="session-item ${session.sessionId === state.currentSessionId ? "active" : ""}" 
           data-session-id="${session.sessionId}"
           onclick="switchSession('${session.sessionId}')">
        <span class="session-icon">💬</span>
        <div class="session-info">
          <div class="session-name">${escapeHtml(session.title || session.sessionId.substring(0, 20) + "...")}</div>
          <div class="session-meta">${session.messageCount || 0} 条消息</div>
        </div>
        <button class="session-delete" onclick="deleteSession('${session.sessionId}', event)">🗑️</button>
      </div>
    `
    )
    .join("");
}

// ===== 消息处理 =====
function sendMessage() {
  const prompt = elements.messageInput.value.trim();
  if (!prompt && state.attachments.length === 0) return;
  if (state.isProcessing) return;

  const attachmentsSnapshot = [...state.attachments];

  // 确保有活跃会话
  if (!state.currentSessionId) {
    state.pendingMessage = {
      prompt,
      attachments: attachmentsSnapshot,
      model: state.selectedModel,
    };
  }

  // 添加用户消息到 UI
  addMessage("user", prompt, attachmentsSnapshot);

  // 清空输入
  elements.messageInput.value = "";
  elements.messageInput.style.height = "auto";
  clearAttachments();

  // 没有会话则先创建，等创建完成后发送
  if (!state.currentSessionId) {
    createNewSession();
    return;
  }

  sendMessageToSession(state.currentSessionId, prompt, attachmentsSnapshot, state.selectedModel);
}

function sendMessageToSession(sessionId, prompt, attachments, model) {
  // 获取当前选中的 Agent
  const agentId = window.agentManager?.getCurrentAgentId();
  const syncMode = document.getElementById('sync-mode-toggle')?.checked || false;
  const eventName = syncMode ? 'send-message-sync' : 'send-message';

  state.socket.emit(eventName, {
    sessionId,
    prompt,
    model,
    agentId,
    attachments: (attachments || []).map((a) => ({
      type: "file",
      path: a.path,
      displayName: a.originalName,
    })),
  });
}

function handleMessageStart(data) {
  if (data.sessionId !== state.currentSessionId) return;
  
  state.isProcessing = true;
  updateSendButton();
  
  // 创建唯一的消息ID
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 初始化该消息的状态
  state.messageStates.set(messageId, {
    content: "",
    reasoningContent: "",
    sessionId: data.sessionId,
  });
  state.activeMessageId = messageId;
  
  // 创建助手消息占位符
  const messageHtml = `
    <div class="message assistant" id="${messageId}" data-session-id="${data.sessionId}">
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-bubble">
          <div class="reasoning-block hidden">
            <div class="reasoning-title">💭 思考过程</div>
            <div class="reasoning-content"></div>
          </div>
          <div class="tools-container"></div>
          <div class="assistant-content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  elements.chatContainer.insertAdjacentHTML("beforeend", messageHtml);
  scrollToBottom();
  
  // 保留旧的字段以兼容其他代码
  state.currentMessageId = messageId;
  state.currentMessageContent = "";
  state.currentReasoningContent = "";
}

function handleMessageDelta(data) {
  if (data.sessionId !== state.currentSessionId) return;
  
  // 使用当前活跃的消息ID
  const messageId = state.activeMessageId;
  if (!messageId) return;
  
  const msgState = state.messageStates.get(messageId);
  if (!msgState || msgState.sessionId !== data.sessionId) return;
  
  msgState.content += data.content;
  // 同步更新旧字段
  state.currentMessageContent = msgState.content;
  
  const messageEl = document.getElementById(messageId);
  if (messageEl) {
    const contentEl = messageEl.querySelector(".assistant-content");
    if (contentEl) {
      contentEl.innerHTML = renderMarkdown(msgState.content);
    }
    scrollToBottom();
  }
}

function handleReasoningDelta(data) {
  if (data.sessionId !== state.currentSessionId) return;

  const messageId = state.activeMessageId;
  if (!messageId) return;
  
  const msgState = state.messageStates.get(messageId);
  if (!msgState || msgState.sessionId !== data.sessionId) return;
  
  msgState.reasoningContent += data.content;
  state.currentReasoningContent = msgState.reasoningContent;

  const messageEl = document.getElementById(messageId);
  if (messageEl) {
    const block = messageEl.querySelector(".reasoning-block");
    const content = messageEl.querySelector(".reasoning-content");
    if (block && content) {
      block.classList.remove("hidden");
      content.textContent = msgState.reasoningContent;
    }
    scrollToBottom();
  }
}

function handleMessageComplete(data) {
  if (data.sessionId !== state.currentSessionId) return;

  state.isProcessing = false;
  updateSendButton();

  // Sync mode: no prior deltas, render full content now
  if (data.mode === "sync" && data.content) {
    const messageId = state.activeMessageId;
    if (messageId) {
      const messageEl = document.getElementById(messageId);
      if (messageEl) {
        const contentEl = messageEl.querySelector(".assistant-content");
        if (contentEl) {
          contentEl.innerHTML = renderMarkdown(data.content);
        }
      }
    }
  }

  // 清理消息状态
  const messageId = state.activeMessageId;
  if (messageId) {
    state.messageStates.delete(messageId);
    state.activeMessageId = null;
  }

  // 保存到消息历史
  state.messages.push({
    role: "assistant",
    content: data.content,
  });

  // 更新会话消息数
  refreshSessions();
}

function handleMessageError(data) {
  if (data.sessionId !== state.currentSessionId) return;
  
  state.isProcessing = false;
  updateSendButton();
  
  // 清理消息状态
  const messageId = state.activeMessageId;
  if (messageId) {
    state.messageStates.delete(messageId);
    state.activeMessageId = null;
    
    const messageEl = document.getElementById(messageId);
    if (messageEl) {
      const bubble = messageEl.querySelector(".message-bubble");
      bubble.innerHTML = `<span style="color: var(--error-color)">❌ 错误: ${escapeHtml(data.error)}</span>`;
    }
  }
}

function handleToolCall(data) {
  if (data.sessionId !== state.currentSessionId) return;

  const messageEl = document.getElementById(state.currentMessageId);
  if (messageEl) {
    const toolsContainer = messageEl.querySelector(".tools-container");
    if (toolsContainer) {
      const toolHtml = `
        <div class="tool-call" id="tool-call-${data.toolCallId}">
          <div class="tool-call-header">🔧 调用工具: ${data.toolName}</div>
          <div class="tool-call-args">${formatToolArgs(data.args)}</div>
          <div class="tool-call-status">⏳ 执行中...</div>
        </div>
      `;
      toolsContainer.insertAdjacentHTML("beforeend", toolHtml);
      scrollToBottom();
    }
  }
}

function formatToolArgs(args) {
  if (!args) return '';
  try {
    const str = JSON.stringify(args, null, 2);
    return str.length > 200 ? str.substring(0, 200) + '...' : str;
  } catch {
    return String(args);
  }
}

function handleToolResult(data) {
  if (data.sessionId !== state.currentSessionId) return;

  const messageEl = document.getElementById(state.currentMessageId);
  if (messageEl) {
    // 使用 toolCallId 精确匹配对应的工具调用
    const toolCallEl = messageEl.querySelector(`#tool-call-${data.toolCallId}`);
    if (toolCallEl) {
      const statusEl = toolCallEl.querySelector(".tool-call-status");
      if (statusEl) {
        // Structured result (ToolResultObject)
        if (data.isStructured && data.result && typeof data.result === 'object') {
          statusEl.outerHTML = renderStructuredToolResult(data.result);
        }
        // Legacy: plain error check
        else if (data.result && data.result.error) {
          statusEl.outerHTML = `
            <div class="tool-call-result tool-call-error">
              <span class="tool-result-label">❌ 失败</span>
              <span class="tool-result-preview">${escapeHtml(data.result.error)}</span>
            </div>
          `;
        }
        // Legacy: plain string result
        else {
          const resultPreview = formatToolResult(data.result);
          statusEl.outerHTML = `
            <div class="tool-call-result">
              <span class="tool-result-label">✅ 完成</span>
              <span class="tool-result-preview">${resultPreview}</span>
            </div>
          `;
        }
      }
    }
    scrollToBottom();
  }
}

function renderStructuredToolResult(result) {
  const statusIcons = { success: '✅', failure: '❌', rejected: '🚫', denied: '⛔' };
  const statusLabels = { success: '成功', failure: '失败', rejected: '已拒绝', denied: '已禁止' };
  const icon = statusIcons[result.resultType] || '✅';
  const label = statusLabels[result.resultType] || result.resultType;
  const cssClass = `tool-result-${result.resultType || 'success'}`;

  let html = `<div class="tool-call-result tool-result-structured ${cssClass}">`;
  html += `<div class="tool-result-status">${icon} ${label}</div>`;

  // Text preview
  if (result.textResultForLlm) {
    const preview = result.textResultForLlm.length > 200
      ? result.textResultForLlm.substring(0, 200) + '...'
      : result.textResultForLlm;
    html += `<span class="tool-result-preview">${escapeHtml(preview)}</span>`;
  }

  // Error
  if (result.error) {
    html += `<div class="tool-result-error-msg">${escapeHtml(result.error)}</div>`;
  }

  // Binary results (image preview)
  if (result.binaryResultsForLlm?.length) {
    result.binaryResultsForLlm.forEach(bin => {
      if (bin.mimeType?.startsWith('image/')) {
        html += `<img class="tool-binary-image" src="data:${bin.mimeType};base64,${bin.data}" alt="${escapeHtml(bin.description || 'Binary result')}" />`;
      } else {
        html += `<div class="tool-binary-info">📦 ${escapeHtml(bin.mimeType)} (${escapeHtml(bin.type)})</div>`;
      }
    });
  }

  // Session log (collapsible)
  if (result.sessionLog) {
    html += `<details class="tool-result-log"><summary>执行日志</summary><pre>${escapeHtml(result.sessionLog)}</pre></details>`;
  }

  html += '</div>';
  return html;
}

function formatToolResult(result) {
  if (!result) return '无结果';
  try {
    const str = typeof result === 'string' ? result : JSON.stringify(result);
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
  } catch {
    return '结果已获取';
  }
}

// ===== UI 辅助函数 =====
function addMessage(role, content, attachments = [], save = true) {
  const messageHtml = `
    <div class="message ${role}">
      <div class="message-avatar">${role === "user" ? "👤" : "🤖"}</div>
      <div class="message-content">
        <div class="message-bubble">
          ${role === "user" ? escapeHtml(content) : renderMarkdown(content)}
        </div>
        ${
          attachments.length > 0
            ? `
          <div class="message-attachments">
            ${attachments.map((a) => `<span class="attachment-tag">📎 ${a.originalName}</span>`).join("")}
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
  elements.chatContainer.insertAdjacentHTML("beforeend", messageHtml);
  scrollToBottom();
  
  // 保存到消息历史
  if (save) {
    state.messages.push({ role, content });
  }
}

function renderMessages() {
  elements.chatContainer.innerHTML = "";
  state.messages.forEach((msg) => {
    addMessage(msg.role, msg.content, [], false);
  });
}

function scrollToBottom() {
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function updateSendButton() {
  if (state.isProcessing) {
    elements.sendBtn.innerHTML = "⏹️";
    elements.sendBtn.classList.add("stop-btn");
    elements.sendBtn.onclick = () => {
      state.socket.emit("abort", { sessionId: state.currentSessionId });
    };
  } else {
    elements.sendBtn.innerHTML = "➤";
    elements.sendBtn.classList.remove("stop-btn");
    elements.sendBtn.onclick = sendMessage;
  }
}

function showError(message) {
  alert(message);
}

// ===== 文件上传 =====
async function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  await uploadFiles(files);

  // 清空文件输入
  e.target.value = "";
}

// 处理粘贴事件
async function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const blob = item.getAsFile();
      if (blob) {
        // 为粘贴的图片生成文件名
        const ext = item.type.split("/")[1] || "png";
        const fileName = `pasted-image-${Date.now()}.${ext}`;
        const file = new File([blob], fileName, { type: item.type });
        imageFiles.push(file);
      }
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    await uploadFiles(imageFiles);
  }
}

// 上传文件到服务器
async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      state.attachments.push(...result.files);
      renderAttachments();
    } else {
      showError("上传失败: " + result.error);
    }
  } catch (error) {
    showError("上传失败: " + error.message);
  }
}

function renderAttachments() {
  elements.attachmentsPreview.innerHTML = state.attachments
    .map((a, i) => {
      const isImage = a.mimetype?.startsWith("image/");
      if (isImage) {
        return `
          <div class="attachment-preview attachment-image">
            <img src="/uploads/${a.filename}" alt="${a.originalName}" />
            <button class="remove-btn" onclick="removeAttachment(${i})" title="移除">×</button>
          </div>
        `;
      }
      return `
        <div class="attachment-preview">
          <span>📎 ${a.originalName}</span>
          <button class="remove-btn" onclick="removeAttachment(${i})">×</button>
        </div>
      `;
    })
    .join("");
}

function removeAttachment(index) {
  const attachment = state.attachments[index];
  
  // 从服务器删除文件
  fetch(`/api/upload/${attachment.filename}`, { method: "DELETE" });
  
  // 从状态中移除
  state.attachments.splice(index, 1);
  renderAttachments();
}

function clearAttachments() {
  state.attachments.forEach((a) => {
    fetch(`/api/upload/${a.filename}`, { method: "DELETE" });
  });
  state.attachments = [];
  renderAttachments();
}

// ===== 模型加载 =====
async function loadModels() {
  try {
    const response = await fetch("/api/models");
    const result = await response.json();
    if (result.success) {
      elements.modelSelect.innerHTML = result.models
        .map((m) => `<option value="${m.id}">${m.name}</option>`)
        .join("");
    }
  } catch (error) {
    console.error("加载模型列表失败:", error);
  }
}

// ===== Markdown 渲染 =====
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    // 配置 marked
    marked.setOptions({
      highlight: function (code, lang) {
        if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return code;
      },
      breaks: true,
    });
    return marked.parse(text);
  }
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== 用户输入请求处理 =====
function handleUserInputRequest(data) {
  if (data.sessionId !== state.currentSessionId) return;

  const overlay = document.getElementById("user-input-dialog");
  const questionEl = document.getElementById("user-input-question");
  const choicesEl = document.getElementById("user-input-choices");
  const freeformEl = document.getElementById("user-input-freeform");
  const textInput = document.getElementById("user-input-text");
  const submitBtn = document.getElementById("user-input-submit");

  // Display question
  questionEl.textContent = data.question;

  // Render choices if provided
  choicesEl.innerHTML = "";
  if (data.choices && data.choices.length > 0) {
    data.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "user-input-choice-btn";
      btn.textContent = choice;
      btn.onclick = () => {
        submitUserInput(data.sessionId, choice, false);
      };
      choicesEl.appendChild(btn);
    });

    // Show divider if freeform is also allowed
    if (data.allowFreeform !== false) {
      const divider = document.createElement("div");
      divider.className = "user-input-divider";
      divider.textContent = "— 或输入自定义回答 —";
      choicesEl.appendChild(divider);
    }
  }

  // Show/hide freeform input
  if (data.allowFreeform !== false) {
    freeformEl.style.display = "flex";
    textInput.value = "";
    textInput.focus();
  } else {
    freeformEl.style.display = "none";
  }

  // Handle freeform submit
  const onSubmit = () => {
    const answer = textInput.value.trim();
    if (answer) {
      submitUserInput(data.sessionId, answer, true);
    }
  };
  submitBtn.onclick = onSubmit;
  textInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Show dialog
  overlay.classList.add("show");
}

function submitUserInput(sessionId, answer, wasFreeform) {
  const overlay = document.getElementById("user-input-dialog");
  overlay.classList.remove("show");

  state.socket.emit(`user-input-response:${sessionId}`, {
    answer,
    wasFreeform,
  });

  // Show the interaction in chat as a visual indicator
  const messageEl = document.getElementById(state.activeMessageId);
  if (messageEl) {
    const toolsContainer = messageEl.querySelector(".tools-container");
    if (toolsContainer) {
      const inputHtml = `
        <div class="tool-call">
          <div class="tool-call-header">🙋 AI 询问</div>
          <div class="tool-call-args">${escapeHtml(document.getElementById("user-input-question").textContent)}</div>
          <div class="tool-call-result">
            <span class="tool-result-label">💬 回答</span>
            <span class="tool-result-preview">${escapeHtml(answer)}</span>
          </div>
        </div>
      `;
      toolsContainer.insertAdjacentHTML("beforeend", inputHtml);
      scrollToBottom();
    }
  }
}

// ===== 暴露到全局 =====
window.switchSession = switchSession;
window.deleteSession = deleteSession;
window.removeAttachment = removeAttachment;

// ===== 模态框辅助函数 =====
function openSettingsModal() {
  document.getElementById('settings-modal').classList.add('show');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('show');
}

function switchTab(tabId) {
  // 移除所有 tab 的 active 状态
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  // 激活选中的 tab
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.classList.add('active');
    // 找到对应的按钮并激活
    const tabIds = ['agents-tab', 'tools-tab', 'groups-tab', 'mcp-tab', 'skills-tab'];
    const btnIndex = tabIds.indexOf(tabId);
    const btns = document.querySelectorAll('.modal-tabs .tab-btn');
    if (btns[btnIndex]) {
      btns[btnIndex].classList.add('active');
    }
  }

  // 刷新对应 tab 的数据
  if (tabId === 'tools-tab') {
    state.socket.emit('list-tools');
  } else if (tabId === 'groups-tab') {
    state.socket.emit('list-tool-groups');
  } else if (tabId === 'mcp-tab') {
    if (mcpManager) mcpManager.loadServers();
  } else if (tabId === 'skills-tab') {
    if (skillManager) skillManager.loadSkills();
  }
}

// 点击模态框外部关闭
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
});

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.switchTab = switchTab;
window.showToast = window.agentManager?.showToast;
