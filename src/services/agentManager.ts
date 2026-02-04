/**
 * Agent Manager Service
 * Manages agent configurations and provides runtime agent resolution
 */

import {
  loadAgents,
  getAgent,
  getDefaultAgent,
  saveAgent,
  deleteAgent as deleteAgentFromStorage,
  generateId,
} from "./storage.js";
import { getToolsForAgent } from "./toolRegistry.js";
import type {
  AgentConfig,
  ResolvedAgent,
  CreateAgentRequest,
  UpdateAgentRequest,
} from "../types/agent.js";

/**
 * System prompt injection format
 * This is prepended to the user's first message in a session
 */
const SYSTEM_PROMPT_TEMPLATE = `[System Instructions]
{systemPrompt}

[User Message]
{userMessage}`;

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
 * Resolve an agent with its tools loaded
 */
export function resolveAgent(agentId: string): ResolvedAgent | undefined {
  const agent = getAgent(agentId);
  if (!agent) {
    return undefined;
  }

  const tools = getToolsForAgent(
    agent.enabledBuiltinTools,
    agent.enabledCustomTools,
    agent.toolGroupIds
  );

  return {
    ...agent,
    tools,
  };
}

/**
 * Resolve the default agent with its tools loaded
 */
export function resolveDefaultAgent(): ResolvedAgent {
  const agent = getDefaultAgent();
  const tools = getToolsForAgent(
    agent.enabledBuiltinTools,
    agent.enabledCustomTools,
    agent.toolGroupIds
  );

  return {
    ...agent,
    tools,
  };
}

/**
 * Inject system prompt into user message
 * Returns the modified message if agent has a system prompt, otherwise returns original
 */
export function injectSystemPrompt(userMessage: string, agentId?: string): string {
  const agent = agentId ? getAgent(agentId) : getDefaultAgent();

  if (!agent || !agent.systemPrompt || agent.systemPrompt.trim() === "") {
    return userMessage;
  }

  return SYSTEM_PROMPT_TEMPLATE
    .replace("{systemPrompt}", agent.systemPrompt.trim())
    .replace("{userMessage}", userMessage);
}

/**
 * Check if a message should have system prompt injected
 * (Only inject for the first message or when explicitly requested)
 */
export function shouldInjectSystemPrompt(agentId: string, isFirstMessage: boolean): boolean {
  if (!isFirstMessage) {
    return false;
  }

  const agent = getAgent(agentId);
  return !!agent?.systemPrompt && agent.systemPrompt.trim() !== "";
}

/**
 * Create a new agent
 */
export function createAgent(request: CreateAgentRequest): AgentConfig {
  const now = new Date().toISOString();

  const agent: AgentConfig = {
    id: generateId("agent"),
    name: request.name,
    description: request.description || "",
    systemPrompt: request.systemPrompt || "",
    toolGroupIds: request.toolGroupIds || [],
    enabledBuiltinTools: request.enabledBuiltinTools || [],
    enabledCustomTools: request.enabledCustomTools || [],
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
    description: request.description ?? existing.description,
    systemPrompt: request.systemPrompt ?? existing.systemPrompt,
    toolGroupIds: request.toolGroupIds ?? existing.toolGroupIds,
    enabledBuiltinTools: request.enabledBuiltinTools ?? existing.enabledBuiltinTools,
    enabledCustomTools: request.enabledCustomTools ?? existing.enabledCustomTools,
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
  const targetAgent = agents.find(a => a.id === id);

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

  if (config.systemPrompt && config.systemPrompt.length > 10000) {
    errors.push("系统提示词不能超过10000个字符");
  }

  return errors;
}

/**
 * Get tools for a specific agent
 */
export function getAgentTools(agentId: string): unknown[] {
  const agent = getAgent(agentId);
  if (!agent) {
    return [];
  }

  return getToolsForAgent(
    agent.enabledBuiltinTools,
    agent.enabledCustomTools,
    agent.toolGroupIds
  );
}

/**
 * Get agent's preferred model or undefined
 */
export function getAgentPreferredModel(agentId: string): string | undefined {
  const agent = getAgent(agentId);
  return agent?.preferredModel;
}
