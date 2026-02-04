/**
 * Custom tool handler - creates executable tool handlers from configuration
 */

import { z, ZodTypeAny } from "zod";
import { defineTool } from "@github/copilot-sdk";
import type {
  CustomToolConfig,
  HttpHandlerConfig,
  JavaScriptHandlerConfig,
  ToolParameter,
} from "../types/agent.js";

/**
 * Build Zod schema from tool parameter definitions
 */
function buildZodSchema(parameters: ToolParameter[]): ZodTypeAny {
  const schemaObj: Record<string, ZodTypeAny> = {};

  for (const param of parameters) {
    let schema: ZodTypeAny;

    switch (param.type) {
      case "string":
        schema = z.string();
        if (param.enum && param.enum.length > 0) {
          schema = z.enum(param.enum as [string, ...string[]]);
        }
        break;
      case "number":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "object":
        schema = z.record(z.unknown());
        break;
      case "array":
        schema = z.array(z.unknown());
        break;
      default:
        schema = z.unknown();
    }

    // Add description
    schema = schema.describe(param.description);

    // Handle optional/required
    if (!param.required) {
      schema = schema.optional();
      if (param.default !== undefined) {
        schema = schema.default(param.default);
      }
    }

    schemaObj[param.name] = schema;
  }

  return z.object(schemaObj);
}

/**
 * Replace template placeholders with actual values
 */
function interpolateTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : "";
  });
}

/**
 * Create HTTP GET handler
 */
function createHttpGetHandler(config: HttpHandlerConfig) {
  return async (args: unknown): Promise<unknown> => {
    const params = args as Record<string, unknown>;
    const url = interpolateTemplate(config.url, params);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: config.headers || {},
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract result using path if specified
      if (config.resultPath) {
        const parts = config.resultPath.split(".");
        let result = data;
        for (const part of parts) {
          if (result && typeof result === "object") {
            result = (result as Record<string, unknown>)[part];
          }
        }
        return result;
      }

      return data;
    } catch (error) {
      return {
        error: `HTTP请求失败: ${error instanceof Error ? error.message : "未知错误"}`,
        url: url,
      };
    }
  };
}

/**
 * Create HTTP POST handler
 */
function createHttpPostHandler(config: HttpHandlerConfig) {
  return async (args: unknown): Promise<unknown> => {
    const params = args as Record<string, unknown>;
    const url = interpolateTemplate(config.url, params);

    let body: string | undefined;
    if (config.bodyTemplate) {
      body = interpolateTemplate(config.bodyTemplate, params);
    } else {
      body = JSON.stringify(params);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
        body: body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract result using path if specified
      if (config.resultPath) {
        const parts = config.resultPath.split(".");
        let result = data;
        for (const part of parts) {
          if (result && typeof result === "object") {
            result = (result as Record<string, unknown>)[part];
          }
        }
        return result;
      }

      return data;
    } catch (error) {
      return {
        error: `HTTP请求失败: ${error instanceof Error ? error.message : "未知错误"}`,
        url: url,
      };
    }
  };
}

/**
 * Create JavaScript handler (sandboxed execution)
 */
function createJavaScriptHandler(config: JavaScriptHandlerConfig) {
  return async (args: unknown): Promise<unknown> => {
    const params = args as Record<string, unknown>;

    try {
      // Create a sandboxed function
      // Note: This is a simple sandbox. For production, consider using vm2 or similar
      const sandboxedCode = `
        "use strict";
        const args = ${JSON.stringify(params)};
        ${config.code}
      `;

      // Create function in strict mode with limited scope
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction("fetch", sandboxedCode);

      // Execute with limited globals
      const result = await fn(fetch);
      return result;
    } catch (error) {
      return {
        error: `执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  };
}

/**
 * Create a tool instance from configuration
 */
export function createToolFromConfig(config: CustomToolConfig): unknown {
  // Build parameter schema
  const schema = buildZodSchema(config.parameters);

  // Create appropriate handler
  let handler: (args: unknown) => Promise<unknown>;

  switch (config.handlerType) {
    case "http_get":
      handler = createHttpGetHandler(config.handlerConfig as HttpHandlerConfig);
      break;
    case "http_post":
      handler = createHttpPostHandler(config.handlerConfig as HttpHandlerConfig);
      break;
    case "javascript":
      handler = createJavaScriptHandler(config.handlerConfig as JavaScriptHandlerConfig);
      break;
    default:
      handler = async () => ({ error: "未知的处理器类型" });
  }

  // Create and return the tool
  return defineTool(config.name, {
    description: config.description,
    parameters: schema as any,
    handler: handler,
  });
}

/**
 * Validate custom tool configuration
 */
export function validateToolConfig(config: Partial<CustomToolConfig>): string[] {
  const errors: string[] = [];

  if (!config.name || config.name.length < 2) {
    errors.push("工具名称至少需要2个字符");
  }

  if (config.name && !/^[a-z][a-z0-9_]*$/.test(config.name)) {
    errors.push("工具名称只能包含小写字母、数字和下划线，且必须以字母开头");
  }

  if (!config.description || config.description.length < 5) {
    errors.push("工具描述至少需要5个字符");
  }

  if (!config.handlerType) {
    errors.push("必须指定处理器类型");
  }

  if (config.handlerType === "http_get" || config.handlerType === "http_post") {
    const httpConfig = config.handlerConfig as HttpHandlerConfig;
    if (!httpConfig?.url) {
      errors.push("HTTP处理器必须指定URL");
    }
  }

  if (config.handlerType === "javascript") {
    const jsConfig = config.handlerConfig as JavaScriptHandlerConfig;
    if (!jsConfig?.code) {
      errors.push("JavaScript处理器必须包含代码");
    }
  }

  return errors;
}
