/**
 * Tools module index
 * Re-exports all builtin tools and provides utility functions
 */

import { getCurrentTimeTool, toolInfo as timeInfo } from "./builtin/time.js";
import { calculatorTool, toolInfo as calculatorInfo } from "./builtin/calculator.js";
import { getWeatherTool, toolInfo as weatherInfo } from "./builtin/weather.js";
import { textProcessorTool, toolInfo as textInfo } from "./builtin/text.js";
import type { BuiltinToolInfo } from "../types/agent.js";

// Re-export individual tools for backward compatibility
export { getCurrentTimeTool } from "./builtin/time.js";
export { calculatorTool } from "./builtin/calculator.js";
export { getWeatherTool } from "./builtin/weather.js";
export { textProcessorTool } from "./builtin/text.js";

/**
 * Map of builtin tool IDs to tool instances
 */
export const builtinToolsMap: Map<string, unknown> = new Map([
  ["get_current_time", getCurrentTimeTool],
  ["calculate", calculatorTool],
  ["get_weather", getWeatherTool],
  ["process_text", textProcessorTool],
]);

/**
 * Builtin tools info for UI display
 */
export const builtinToolsInfo: BuiltinToolInfo[] = [
  timeInfo,
  calculatorInfo,
  weatherInfo,
  textInfo,
];

/**
 * Get builtin tool by ID
 */
export function getBuiltinTool(id: string): unknown | undefined {
  return builtinToolsMap.get(id);
}

/**
 * Get all builtin tools as array
 */
export function getAllBuiltinTools(): unknown[] {
  return Array.from(builtinToolsMap.values());
}

/**
 * Alias for getAllBuiltinTools
 */
export const getAllTools = getAllBuiltinTools;

/**
 * Check if tool ID is a builtin tool
 */
export function isBuiltinTool(id: string): boolean {
  return builtinToolsMap.has(id);
}

// Legacy export for backward compatibility
export const allTools = getAllBuiltinTools();
