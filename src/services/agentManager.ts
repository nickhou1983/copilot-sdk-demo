/**
 * Agent Manager Service
 * Manages agent configurations and converts to SDK-native CustomAgentConfig
 */

import type { CustomAgentConfig } from "@github/copilot-sdk";
import {
  loadAgents,
  getAgent,
  getDefaultAgent,
  saveAgent,
  deleteAgent as deleteAgentFromStorage,
  generateId,
} from "./storage.js";
import { getMCPServersByIds } from "./mcpManager.js";
import type {
  AgentConfig,
  CreateAgentRequest,
  UpdateAgentRequest,
} from "../types/agent.js";

/**
 * Convert an AgentConfig to SDK-native CustomAgentConfig
 */
export function convertToSDKAgent(agent: AgentConfig): CustomAgentConfig {
  const sdkAgent: CustomAgentConfig = {
    name: agent.name,
    displayName: agent.displayName || agent.name,
    description: agent.description || "",
    prompt: agent.prompt || "",
    tools: agent.tools ?? undefined,
    infer: agent.infer ?? true,
  };

  // Attach MCP servers if configured
  if (agent.mcpServerIds && agent.mcpServerIds.length > 0) {
    sdkAgent.mcpServers = getMCPServersByIds(agent.mcpServerIds);
  }

  return sdkAgent;
}

/**
 * Get all agents as SDK-native CustomAgentConfig array
 */
export function getAllSDKAgents(): CustomAgentConfig[] {
  const agents = loadAgents();
  return agents
    .filter((a) => a.prompt && a.prompt.trim() !== "")
    .map(convertToSDKAgent);
}

/**
 * Get all agents
 */
export function getAllAgents(): AgentConfig[] {
  return loadAgents();
}

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AgentConfig | undefined {
  return getAgent(id);
}

/**
 * Get the default agent
 */
export function getDefaultAgentConfig(): AgentConfig {
  return getDefaultAgent();
}

/**
 * Create a new agent
 */
export function createAgent(request: CreateAgentRequest): AgentConfig {
  const now = new Date().toISOString();

  const agent: AgentConfig = {
    id: generateId("agent"),
    name: request.name,
    displayName: request.displayName || request.name,
    description: request.description || "",
    prompt: request.prompt || "",
    systemMessage: request.systemMessage,
    tools: request.tools ?? null,
    mcpServerIds: request.mcpServerIds || [],
    infer: request.infer ?? true,
    preferredModel: request.preferredModel,
    icon: request.icon || "🤖",
    color: request.color || "#6366f1",
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  return saveAgent(agent);
}

/**
 * Update an existing agent
 */
export function updateAgent(request: UpdateAgentRequest): AgentConfig {
  const existing = getAgent(request.id);
  if (!existing) {
    throw new Error(`Agent not found: ${request.id}`);
  }

  const updated: AgentConfig = {
    ...existing,
    name: request.name ?? existing.name,
    displayName: request.displayName ?? existing.displayName,
    description: request.description ?? existing.description,
    prompt: request.prompt ?? existing.prompt,
    systemMessage: request.systemMessage !== undefined ? request.systemMessage : existing.systemMessage,
    tools: request.tools !== undefined ? request.tools : existing.tools,
    mcpServerIds: request.mcpServerIds ?? existing.mcpServerIds,
    infer: request.infer ?? existing.infer,
    preferredModel: request.preferredModel ?? existing.preferredModel,
    icon: request.icon ?? existing.icon,
    color: request.color ?? existing.color,
    updatedAt: new Date().toISOString(),
  };

  return saveAgent(updated);
}

/**
 * Delete an agent
 */
export function deleteAgentById(id: string): boolean {
  return deleteAgentFromStorage(id);
}

/**
 * Set an agent as default
 */
export function setDefaultAgent(id: string): AgentConfig {
  const agents = loadAgents();
  const targetAgent = agents.find((a) => a.id === id);

  if (!targetAgent) {
    throw new Error(`Agent not found: ${id}`);
  }

  // Update all agents - remove default from others, set on target
  for (const agent of agents) {
    if (agent.isDefault && agent.id !== id) {
      agent.isDefault = false;
      saveAgent(agent);
    }
  }

  targetAgent.isDefault = true;
  return saveAgent(targetAgent);
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: Partial<CreateAgentRequest>): string[] {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length < 2) {
    errors.push("Agent名称至少需要2个字符");
  }

  if (config.name && config.name.length > 50) {
    errors.push("Agent名称不能超过50个字符");
  }

  if (config.prompt && config.prompt.length > 10000) {
    errors.push("Agent Prompt不能超过10000个字符");
  }

  // Validate name format (for SDK compatibility)
  if (config.name && !/^[a-zA-Z0-9_-]+$/.test(config.name)) {
    errors.push("Agent名称只能包含字母、数字、下划线和连字符");
  }

  return errors;
}

/**
 * Get agent's preferred model or undefined
 */
export function getAgentPreferredModel(agentId: string): string | undefined {
  const agent = getAgent(agentId);
  return agent?.preferredModel;
}
