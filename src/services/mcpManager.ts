/**
 * MCP (Model Context Protocol) Server Manager
 * Converts storage configs to SDK-compatible MCPServerConfig format
 */

import type { MCPServerConfig, MCPLocalServerConfig, MCPRemoteServerConfig } from "@github/copilot-sdk";
import type { MCPServerStorageConfig } from "../types/agent.js";
import {
  loadMCPServers,
  getMCPServer,
  saveMCPServer,
  deleteMCPServer as deleteFromStorage,
  getMCPServersForAgent,
  generateId,
} from "./storage.js";

/**
 * Convert a storage config to SDK MCPServerConfig
 */
export function convertToSDKConfig(storageConfig: MCPServerStorageConfig): MCPServerConfig {
  const type = storageConfig.type;

  if (type === "local" || type === "stdio") {
    const config: MCPLocalServerConfig = {
      type: type,
      command: storageConfig.command || "",
      args: storageConfig.args || [],
      tools: storageConfig.tools || ["*"],
    };
    if (storageConfig.env) config.env = storageConfig.env;
    if (storageConfig.cwd) config.cwd = storageConfig.cwd;
    if (storageConfig.timeout) config.timeout = storageConfig.timeout;
    return config;
  } else {
    const config: MCPRemoteServerConfig = {
      type: type as "http" | "sse",
      url: storageConfig.url || "",
      tools: storageConfig.tools || ["*"],
    };
    if (storageConfig.headers) config.headers = storageConfig.headers;
    if (storageConfig.timeout) config.timeout = storageConfig.timeout;
    return config;
  }
}

/**
 * Get MCP servers for a session as SDK-compatible Record<string, MCPServerConfig>
 * Merges global servers with agent-specific servers
 */
export function getMCPServersForSession(agentId?: string): Record<string, MCPServerConfig> {
  const servers = getMCPServersForAgent(agentId);
  const result: Record<string, MCPServerConfig> = {};

  for (const server of servers) {
    result[server.name] = convertToSDKConfig(server);
  }

  return result;
}

/**
 * Get MCP servers from a list of server IDs (for agent-level reference)
 */
export function getMCPServersByIds(serverIds: string[]): Record<string, MCPServerConfig> {
  const result: Record<string, MCPServerConfig> = {};

  for (const id of serverIds) {
    const server = getMCPServer(id);
    if (server && server.enabled) {
      result[server.name] = convertToSDKConfig(server);
    }
  }

  return result;
}

/**
 * Validate MCP server config
 */
export function validateMCPServerConfig(config: Partial<MCPServerStorageConfig>): string | null {
  if (!config.name || config.name.trim() === "") {
    return "Server name is required";
  }

  if (!config.type) {
    return "Server type is required";
  }

  const type = config.type;
  if (type === "local" || type === "stdio") {
    if (!config.command || config.command.trim() === "") {
      return "Command is required for local MCP servers";
    }
  } else if (type === "http" || type === "sse") {
    if (!config.url || config.url.trim() === "") {
      return "URL is required for remote MCP servers";
    }
    try {
      new URL(config.url);
    } catch {
      return "Invalid URL format";
    }
  } else {
    return `Invalid server type: ${type}`;
  }

  return null;
}

/**
 * Create a new MCP server config
 */
export function createMCPServer(data: {
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
}): MCPServerStorageConfig {
  const now = new Date().toISOString();
  const server: MCPServerStorageConfig = {
    id: generateId("mcp"),
    name: data.name,
    type: data.type,
    command: data.command,
    args: data.args || [],
    env: data.env,
    cwd: data.cwd,
    url: data.url,
    headers: data.headers,
    tools: data.tools || ["*"],
    timeout: data.timeout,
    enabled: true,
    scope: data.scope || "global",
    agentId: data.agentId,
    createdAt: now,
    updatedAt: now,
  };

  const error = validateMCPServerConfig(server);
  if (error) {
    throw new Error(error);
  }

  return saveMCPServer(server);
}

/**
 * Update an existing MCP server config
 */
export function updateMCPServer(id: string, data: Partial<MCPServerStorageConfig>): MCPServerStorageConfig {
  const existing = getMCPServer(id);
  if (!existing) {
    throw new Error(`MCP server not found: ${id}`);
  }

  const updated = { ...existing, ...data, id: existing.id };

  const error = validateMCPServerConfig(updated);
  if (error) {
    throw new Error(error);
  }

  return saveMCPServer(updated);
}

/**
 * Delete an MCP server
 */
export function removeMCPServer(id: string): boolean {
  return deleteFromStorage(id);
}

/**
 * List all MCP servers
 */
export function listMCPServers(): MCPServerStorageConfig[] {
  return loadMCPServers();
}

/**
 * Toggle MCP server enabled/disabled
 */
export function toggleMCPServer(id: string, enabled: boolean): MCPServerStorageConfig {
  const existing = getMCPServer(id);
  if (!existing) {
    throw new Error(`MCP server not found: ${id}`);
  }
  existing.enabled = enabled;
  return saveMCPServer(existing);
}
