/**
 * Agent, Tool, MCP, and Skill type definitions
 */

// ===============================
// Tool Types
// ===============================

/**
 * Custom tool handler types
 */
export type CustomToolHandlerType = "http_get" | "http_post" | "javascript";

/**
 * HTTP handler configuration
 */
export interface HttpHandlerConfig {
  url: string; // URL template, supports {{paramName}} placeholders
  headers?: Record<string, string>;
  bodyTemplate?: string; // JSON template for POST requests
  resultPath?: string; // JSONPath to extract result from response
}

/**
 * JavaScript handler configuration
 */
export interface JavaScriptHandlerConfig {
  code: string; // JavaScript code to execute (sandboxed)
}

/**
 * Tool parameter definition (JSON Schema style)
 */
export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

/**
 * Custom tool configuration stored in JSON
 */
export interface CustomToolConfig {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  handlerType: CustomToolHandlerType;
  handlerConfig: HttpHandlerConfig | JavaScriptHandlerConfig;
  enabled: boolean;
  groupId?: string;
  // Result enhancement configuration
  resultConfig?: {
    useStructuredResult?: boolean;   // Return ToolResultObject instead of plain string
    binaryResultPath?: string;       // JSONPath to extract base64 data from response
    binaryMimeType?: string;         // MIME type for binary results
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Tool group for organizing tools
 */
export interface ToolGroup {
  id: string;
  name: string;
  description: string;
  toolIds: string[]; // IDs of tools in this group (both builtin and custom)
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Builtin tool info (read-only)
 */
export interface BuiltinToolInfo {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
}

// ===============================
// Tool Result Types (SDK-aligned)
// ===============================

export type ToolResultType = "success" | "failure" | "rejected" | "denied";

export interface ToolBinaryResult {
  data: string;           // Base64 encoded binary data
  mimeType: string;       // e.g. "image/png"
  type: string;           // Custom type identifier
  description?: string;
}

export interface ToolResultObject {
  textResultForLlm: string;
  binaryResultsForLlm?: ToolBinaryResult[];
  resultType: ToolResultType;
  error?: string;
  sessionLog?: string;
  toolTelemetry?: Record<string, unknown>;
}

export type ToolResult = string | ToolResultObject;

// ===============================
// System Message Types
// ===============================

/**
 * System message storage config
 * Maps to SDK SystemMessageAppendConfig | SystemMessageReplaceConfig
 */
export interface SystemMessageStorageConfig {
  mode: "append" | "replace";
  content: string;
}

// ===============================
// MCP Server Types
// ===============================

/**
 * MCP server storage configuration
 * Maps to SDK MCPLocalServerConfig | MCPRemoteServerConfig
 */
export interface MCPServerStorageConfig {
  id: string;
  name: string;
  type: "local" | "stdio" | "http" | "sse";
  // local/stdio fields
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // remote fields
  url?: string;
  headers?: Record<string, string>;
  // common
  tools: string[];
  timeout?: number;
  enabled: boolean;
  scope: "global" | "agent";
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * MCP servers data file structure
 */
export interface MCPServersDataFile {
  version: string;
  servers: MCPServerStorageConfig[];
}

// ===============================
// Agent Types (SDK-native aligned)
// ===============================

/**
 * Permission policy for agent sessions
 * Controls how tool permission requests are handled
 */
export type PermissionPolicy = "ask-user" | "auto-approve" | "deny-all";

/**
 * Infinite session configuration for agent
 * Maps to SDK InfiniteSessionConfig
 */
export interface InfiniteSessionStorageConfig {
  enabled: boolean;
  backgroundCompactionThreshold?: number; // 0.0-1.0, default 0.80
  bufferExhaustionThreshold?: number;     // 0.0-1.0, default 0.95
}

/**
 * Agent configuration
 * Core fields align with SDK CustomAgentConfig
 */
export interface AgentConfig {
  id: string;
  name: string;              // SDK CustomAgentConfig.name
  displayName: string;       // SDK CustomAgentConfig.displayName
  description: string;       // SDK CustomAgentConfig.description
  prompt: string;            // SDK CustomAgentConfig.prompt
  systemMessage?: SystemMessageStorageConfig; // Session-level system message config
  tools?: string[] | null;   // SDK CustomAgentConfig.tools (tool names, null=all)
  mcpServerIds?: string[];   // References to MCPServerStorageConfig IDs
  infer?: boolean;           // SDK CustomAgentConfig.infer
  // Permission & Infinite Session (SDK-native)
  permissionPolicy?: PermissionPolicy;          // How to handle SDK permission requests
  infiniteSession?: InfiniteSessionStorageConfig; // SDK InfiniteSessionConfig
  // UI metadata
  preferredModel?: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent with resolved tools (runtime use) - kept for backward compat
 */
export interface ResolvedAgent extends AgentConfig {
  resolvedTools: unknown[];
}

// ===============================
// Skills Types
// ===============================

/**
 * Single skill info (derived from file scan)
 */
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  filename: string;
  directory: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Skills configuration data file
 */
export interface SkillsConfig {
  version: string;
  directories: string[];
  disabledSkills: string[];
}

// ===============================
// Data Store Types
// ===============================

/**
 * Agents data file structure
 */
export interface AgentsDataFile {
  version: string;
  agents: AgentConfig[];
}

/**
 * Custom tools data file structure
 */
export interface CustomToolsDataFile {
  version: string;
  tools: CustomToolConfig[];
}

/**
 * Tool groups data file structure
 */
export interface ToolGroupsDataFile {
  version: string;
  groups: ToolGroup[];
}

// ===============================
// API Types
// ===============================

/**
 * Create agent request
 */
export interface CreateAgentRequest {
  name: string;
  displayName?: string;
  description?: string;
  prompt?: string;
  systemMessage?: SystemMessageStorageConfig;
  tools?: string[] | null;
  mcpServerIds?: string[];
  infer?: boolean;
  permissionPolicy?: PermissionPolicy;
  infiniteSession?: InfiniteSessionStorageConfig;
  preferredModel?: string;
  icon?: string;
  color?: string;
}

/**
 * Update agent request
 */
export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  id: string;
}

/**
 * Create custom tool request
 */
export interface CreateCustomToolRequest {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handlerType: CustomToolHandlerType;
  handlerConfig: HttpHandlerConfig | JavaScriptHandlerConfig;
  groupId?: string;
}

/**
 * Update custom tool request
 */
export interface UpdateCustomToolRequest extends Partial<CreateCustomToolRequest> {
  id: string;
  enabled?: boolean;
}

/**
 * Create tool group request
 */
export interface CreateToolGroupRequest {
  name: string;
  description?: string;
  toolIds?: string[];
  icon?: string;
}

/**
 * Update tool group request
 */
export interface UpdateToolGroupRequest extends Partial<CreateToolGroupRequest> {
  id: string;
}

/**
 * Create MCP server request
 */
export interface CreateMCPServerRequest {
  name: string;
  type: "local" | "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  tools?: string[];
  timeout?: number;
  scope?: "global" | "agent";
  agentId?: string;
}

/**
 * Update MCP server request
 */
export interface UpdateMCPServerRequest extends Partial<CreateMCPServerRequest> {
  id: string;
  enabled?: boolean;
}
