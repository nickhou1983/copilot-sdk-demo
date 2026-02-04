/**
 * JSON file storage service for agents and tools
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  AgentConfig,
  AgentsDataFile,
  CustomToolConfig,
  CustomToolsDataFile,
  ToolGroup,
  ToolGroupsDataFile,
} from "../types/agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");

// File paths
const AGENTS_FILE = path.join(DATA_DIR, "agents", "agents.json");
const CUSTOM_TOOLS_FILE = path.join(DATA_DIR, "tools", "custom.json");
const TOOL_GROUPS_FILE = path.join(DATA_DIR, "config", "toolGroups.json");

// Current data versions
const AGENTS_VERSION = "1.0";
const TOOLS_VERSION = "1.0";
const GROUPS_VERSION = "1.0";

/**
 * Ensure directory exists
 */
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read JSON file with error handling
 */
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

/**
 * Write JSON file with error handling
 */
function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ===============================
// Default Data
// ===============================

function getDefaultAgents(): AgentsDataFile {
  const now = new Date().toISOString();
  return {
    version: AGENTS_VERSION,
    agents: [
      {
        id: "default",
        name: "通用助手",
        description: "默认的通用 AI 助手",
        systemPrompt: "",
        toolGroupIds: ["default"],
        enabledBuiltinTools: ["get_current_time", "calculate", "get_weather", "process_text"],
        enabledCustomTools: [],
        icon: "🤖",
        color: "#6366f1",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "coder",
        name: "代码助手",
        description: "专注于编程和代码相关任务的助手",
        systemPrompt: `你是一个专业的编程助手。请遵循以下原则：
1. 提供清晰、可维护的代码
2. 解释代码的工作原理
3. 遵循最佳实践和设计模式
4. 考虑性能和安全性
5. 使用适当的错误处理`,
        toolGroupIds: ["default"],
        enabledBuiltinTools: ["calculate"],
        enabledCustomTools: [],
        preferredModel: "claude-sonnet-4",
        icon: "👨‍💻",
        color: "#10b981",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "translator",
        name: "翻译助手",
        description: "专业的多语言翻译助手",
        systemPrompt: `你是一个专业的翻译助手。请遵循以下原则：
1. 保持原文的意思和语气
2. 使用自然流畅的目标语言表达
3. 注意文化差异和习语翻译
4. 对于专业术语，提供解释
5. 如果原文有歧义，说明并提供多种翻译`,
        toolGroupIds: [],
        enabledBuiltinTools: ["process_text"],
        enabledCustomTools: [],
        preferredModel: "gpt-4o",
        icon: "🌐",
        color: "#f59e0b",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "planner",
        name: "计划助手",
        description: "专业的计划和任务分解助手",
        systemPrompt: `你是一个专业的计划制定助手。请遵循以下原则：

1. **理解目标**：首先充分理解用户的最终目标和约束条件

2. **任务分解**：将大目标拆解为可执行的小任务
   - 每个任务应该具体、可衡量、可实现
   - 任务之间要有清晰的依赖关系
   - 识别关键路径和潜在风险点

3. **时间规划**：
   - 为每个任务估算合理的时间
   - 考虑缓冲时间应对意外
   - 设置明确的里程碑和检查点

4. **资源评估**：
   - 识别所需资源（人力、工具、材料等）
   - 评估可用资源与需求的差距
   - 提出资源获取或替代方案

5. **输出格式**：
   - 使用清晰的层级结构展示计划
   - 包含时间线或甘特图（用 Markdown 表格）
   - 标注优先级和依赖关系
   - 提供检查清单便于跟踪进度

6. **风险预案**：
   - 识别可能的阻碍和风险
   - 为关键节点准备 B 计划`,
        toolGroupIds: [],
        enabledBuiltinTools: ["get_current_time", "calculate"],
        enabledCustomTools: [],
        preferredModel: "claude-sonnet-4",
        icon: "📋",
        color: "#8b5cf6",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function getDefaultToolGroups(): ToolGroupsDataFile {
  const now = new Date().toISOString();
  return {
    version: GROUPS_VERSION,
    groups: [
      {
        id: "default",
        name: "默认工具组",
        description: "包含所有内置工具",
        toolIds: ["get_current_time", "calculate", "get_weather", "process_text"],
        icon: "🔧",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "utility",
        name: "实用工具",
        description: "日常实用工具",
        toolIds: ["get_current_time", "calculate"],
        icon: "⚙️",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function getDefaultCustomTools(): CustomToolsDataFile {
  return {
    version: TOOLS_VERSION,
    tools: [],
  };
}

// ===============================
// Initialization
// ===============================

/**
 * Initialize storage with default data if not exists
 */
export function initializeStorage(): void {
  // Ensure data directories exist
  ensureDir(AGENTS_FILE);
  ensureDir(CUSTOM_TOOLS_FILE);
  ensureDir(TOOL_GROUPS_FILE);

  // Create default files if they don't exist
  if (!fs.existsSync(AGENTS_FILE)) {
    writeJsonFile(AGENTS_FILE, getDefaultAgents());
    console.log("Created default agents configuration");
  }

  if (!fs.existsSync(TOOL_GROUPS_FILE)) {
    writeJsonFile(TOOL_GROUPS_FILE, getDefaultToolGroups());
    console.log("Created default tool groups configuration");
  }

  if (!fs.existsSync(CUSTOM_TOOLS_FILE)) {
    writeJsonFile(CUSTOM_TOOLS_FILE, getDefaultCustomTools());
    console.log("Created default custom tools configuration");
  }
}

// ===============================
// Agent Operations
// ===============================

/**
 * Load all agents
 */
export function loadAgents(): AgentConfig[] {
  const data = readJsonFile<AgentsDataFile>(AGENTS_FILE, getDefaultAgents());
  return data.agents;
}

/**
 * Get agent by ID
 */
export function getAgent(id: string): AgentConfig | undefined {
  const agents = loadAgents();
  return agents.find((a) => a.id === id);
}

/**
 * Get default agent
 */
export function getDefaultAgent(): AgentConfig {
  const agents = loadAgents();
  return agents.find((a) => a.isDefault) || agents[0];
}

/**
 * Save agent (create or update)
 */
export function saveAgent(agent: AgentConfig): AgentConfig {
  const data = readJsonFile<AgentsDataFile>(AGENTS_FILE, getDefaultAgents());
  const existingIndex = data.agents.findIndex((a) => a.id === agent.id);

  agent.updatedAt = new Date().toISOString();

  if (existingIndex >= 0) {
    data.agents[existingIndex] = agent;
  } else {
    agent.createdAt = agent.updatedAt;
    data.agents.push(agent);
  }

  writeJsonFile(AGENTS_FILE, data);
  return agent;
}

/**
 * Delete agent
 */
export function deleteAgent(id: string): boolean {
  const data = readJsonFile<AgentsDataFile>(AGENTS_FILE, getDefaultAgents());
  const index = data.agents.findIndex((a) => a.id === id);

  if (index >= 0) {
    // Don't allow deleting the default agent
    if (data.agents[index].isDefault) {
      throw new Error("Cannot delete the default agent");
    }
    data.agents.splice(index, 1);
    writeJsonFile(AGENTS_FILE, data);
    return true;
  }
  return false;
}

// ===============================
// Custom Tool Operations
// ===============================

/**
 * Load all custom tools
 */
export function loadCustomTools(): CustomToolConfig[] {
  const data = readJsonFile<CustomToolsDataFile>(CUSTOM_TOOLS_FILE, getDefaultCustomTools());
  return data.tools;
}

/**
 * Get custom tool by ID
 */
export function getCustomTool(id: string): CustomToolConfig | undefined {
  const tools = loadCustomTools();
  return tools.find((t) => t.id === id);
}

/**
 * Save custom tool (create or update)
 */
export function saveCustomTool(tool: CustomToolConfig): CustomToolConfig {
  const data = readJsonFile<CustomToolsDataFile>(CUSTOM_TOOLS_FILE, getDefaultCustomTools());
  const existingIndex = data.tools.findIndex((t) => t.id === tool.id);

  tool.updatedAt = new Date().toISOString();

  if (existingIndex >= 0) {
    data.tools[existingIndex] = tool;
  } else {
    tool.createdAt = tool.updatedAt;
    data.tools.push(tool);
  }

  writeJsonFile(CUSTOM_TOOLS_FILE, data);
  return tool;
}

/**
 * Delete custom tool
 */
export function deleteCustomTool(id: string): boolean {
  const data = readJsonFile<CustomToolsDataFile>(CUSTOM_TOOLS_FILE, getDefaultCustomTools());
  const index = data.tools.findIndex((t) => t.id === id);

  if (index >= 0) {
    data.tools.splice(index, 1);
    writeJsonFile(CUSTOM_TOOLS_FILE, data);
    return true;
  }
  return false;
}

// ===============================
// Tool Group Operations
// ===============================

/**
 * Load all tool groups
 */
export function loadToolGroups(): ToolGroup[] {
  const data = readJsonFile<ToolGroupsDataFile>(TOOL_GROUPS_FILE, getDefaultToolGroups());
  return data.groups;
}

/**
 * Get tool group by ID
 */
export function getToolGroup(id: string): ToolGroup | undefined {
  const groups = loadToolGroups();
  return groups.find((g) => g.id === id);
}

/**
 * Save tool group (create or update)
 */
export function saveToolGroup(group: ToolGroup): ToolGroup {
  const data = readJsonFile<ToolGroupsDataFile>(TOOL_GROUPS_FILE, getDefaultToolGroups());
  const existingIndex = data.groups.findIndex((g) => g.id === group.id);

  group.updatedAt = new Date().toISOString();

  if (existingIndex >= 0) {
    data.groups[existingIndex] = group;
  } else {
    group.createdAt = group.updatedAt;
    data.groups.push(group);
  }

  writeJsonFile(TOOL_GROUPS_FILE, data);
  return group;
}

/**
 * Delete tool group
 */
export function deleteToolGroup(id: string): boolean {
  const data = readJsonFile<ToolGroupsDataFile>(TOOL_GROUPS_FILE, getDefaultToolGroups());
  const index = data.groups.findIndex((g) => g.id === id);

  if (index >= 0) {
    data.groups.splice(index, 1);
    writeJsonFile(TOOL_GROUPS_FILE, data);
    return true;
  }
  return false;
}

// ===============================
// Utility Functions
// ===============================

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
