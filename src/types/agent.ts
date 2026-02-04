/**
 * Agent and Tool type definitions
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
// Agent Types
// ===============================

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string; // Will be injected as message prefix
  toolGroupIds: string[]; // Tool groups this agent has access to
  enabledBuiltinTools: string[]; // IDs of builtin tools to enable
  enabledCustomTools: string[]; // IDs of custom tools to enable
  preferredModel?: string; // Default model for this agent
  icon?: string; // Emoji or icon identifier
  color?: string; // Theme color
  isDefault?: boolean; // Is this the default agent
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent with resolved tools (runtime use)
 */
export interface ResolvedAgent extends AgentConfig {
  tools: unknown[]; // Actual tool instances
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
  description?: string;
  systemPrompt?: string;
  toolGroupIds?: string[];
  enabledBuiltinTools?: string[];
  enabledCustomTools?: string[];
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
