/**
 * Tool Registry Service
 * Manages registration and retrieval of both builtin and custom tools
 */

import {
  builtinToolsMap,
  builtinToolsInfo,
  getBuiltinTool,
  isBuiltinTool,
} from "../tools/index.js";
import { createToolFromConfig } from "../tools/customHandler.js";
import { loadCustomTools, loadToolGroups } from "./storage.js";
import type { CustomToolConfig, ToolGroup, BuiltinToolInfo } from "../types/agent.js";

// Cache for dynamically created custom tools
const customToolsCache: Map<string, unknown> = new Map();

/**
 * Initialize the tool registry
 * Load and cache all custom tools
 */
export function initializeToolRegistry(): void {
  refreshCustomTools();
  console.log(`Tool registry initialized: ${builtinToolsMap.size} builtin, ${customToolsCache.size} custom tools`);
}

/**
 * Refresh custom tools cache from storage
 */
export function refreshCustomTools(): void {
  customToolsCache.clear();
  const customTools = loadCustomTools();

  for (const config of customTools) {
    if (config.enabled) {
      try {
        const tool = createToolFromConfig(config);
        customToolsCache.set(config.id, tool);
      } catch (error) {
        console.error(`Failed to create custom tool ${config.id}:`, error);
      }
    }
  }
}

/**
 * Get a tool by ID (builtin or custom)
 */
export function getTool(id: string): unknown | undefined {
  // Check builtin first
  if (isBuiltinTool(id)) {
    return getBuiltinTool(id);
  }

  // Then check custom
  return customToolsCache.get(id);
}

/**
 * Get multiple tools by IDs
 */
export function getTools(ids: string[]): unknown[] {
  const tools: unknown[] = [];
  for (const id of ids) {
    const tool = getTool(id);
    if (tool) {
      tools.push(tool);
    }
  }
  return tools;
}

/**
 * Get all available tool IDs
 */
export function getAllToolIds(): string[] {
  const builtinIds = Array.from(builtinToolsMap.keys());
  const customIds = Array.from(customToolsCache.keys());
  return [...builtinIds, ...customIds];
}

/**
 * Get all available tools
 */
export function getAllTools(): unknown[] {
  return [
    ...Array.from(builtinToolsMap.values()),
    ...Array.from(customToolsCache.values()),
  ];
}

/**
 * Get tools by group ID
 */
export function getToolsByGroup(groupId: string): unknown[] {
  const group = loadToolGroups().find(g => g.id === groupId);
  if (!group) {
    return [];
  }
  return getTools(group.toolIds);
}

/**
 * Get tools for an agent based on its configuration
 */
export function getToolsForAgent(
  enabledBuiltinTools: string[],
  enabledCustomTools: string[],
  toolGroupIds: string[]
): unknown[] {
  const toolIds = new Set<string>();

  // Add enabled builtin tools
  for (const id of enabledBuiltinTools) {
    toolIds.add(id);
  }

  // Add enabled custom tools
  for (const id of enabledCustomTools) {
    toolIds.add(id);
  }

  // Add tools from groups
  const groups = loadToolGroups();
  for (const groupId of toolGroupIds) {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      for (const toolId of group.toolIds) {
        toolIds.add(toolId);
      }
    }
  }

  return getTools(Array.from(toolIds));
}

/**
 * Register a new custom tool (and cache it)
 */
export function registerCustomTool(config: CustomToolConfig): boolean {
  try {
    const tool = createToolFromConfig(config);
    customToolsCache.set(config.id, tool);
    return true;
  } catch (error) {
    console.error(`Failed to register custom tool ${config.id}:`, error);
    return false;
  }
}

/**
 * Unregister a custom tool
 */
export function unregisterCustomTool(id: string): boolean {
  return customToolsCache.delete(id);
}

/**
 * Get information about all builtin tools
 */
export function getBuiltinToolsInfo(): BuiltinToolInfo[] {
  return builtinToolsInfo;
}

/**
 * Get information about all custom tools
 */
export function getCustomToolsInfo(): CustomToolConfig[] {
  return loadCustomTools();
}

/**
 * Get all tool groups
 */
export function getToolGroupsInfo(): ToolGroup[] {
  return loadToolGroups();
}

/**
 * Check if a custom tool is currently active (cached)
 */
export function isCustomToolActive(id: string): boolean {
  return customToolsCache.has(id);
}
