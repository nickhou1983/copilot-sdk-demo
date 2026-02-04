# 工具开发模板

本目录包含了创建自定义工具的模板和示例。

## HTTP API 工具模板

```typescript
import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";

/**
 * HTTP API 工具示例
 * 调用外部 REST API 并返回结果
 */
export const myApiTool = defineTool("my_api_tool", {
  description: "调用某个 API 获取数据",
  parameters: z.object({
    query: z.string().describe("查询参数"),
    limit: z.number().optional().default(10).describe("返回结果数量限制"),
  }) as any,
  handler: async (args: unknown) => {
    const { query, limit } = args as { query: string; limit?: number };
    
    try {
      const url = `https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // 如果需要认证，在这里添加
          // "Authorization": `Bearer ${process.env.API_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        data: data,
        query: query,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  },
});

// 导出工具信息，用于 UI 显示
export const toolInfo = {
  id: "my_api_tool",
  name: "我的 API 工具",
  description: "调用某个 API 获取数据",
  parameters: [
    {
      name: "query",
      type: "string" as const,
      description: "查询参数",
      required: true,
    },
    {
      name: "limit",
      type: "number" as const,
      description: "返回结果数量限制",
      required: false,
      default: 10,
    },
  ],
};
```

## 数据库查询工具模板

```typescript
import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";
// 假设使用某个数据库客户端
// import { db } from "../db";

/**
 * 数据库查询工具示例
 */
export const dbQueryTool = defineTool("db_query", {
  description: "查询数据库中的用户信息",
  parameters: z.object({
    userId: z.string().optional().describe("用户 ID"),
    email: z.string().optional().describe("用户邮箱"),
  }) as any,
  handler: async (args: unknown) => {
    const { userId, email } = args as { userId?: string; email?: string };
    
    if (!userId && !email) {
      return { error: "必须提供 userId 或 email" };
    }
    
    try {
      // 示例查询
      // const user = await db.users.findFirst({
      //   where: userId ? { id: userId } : { email: email },
      // });
      
      // 模拟返回
      const user = {
        id: userId || "user-123",
        email: email || "user@example.com",
        name: "示例用户",
        createdAt: new Date().toISOString(),
      };
      
      return {
        success: true,
        user: user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
      };
    }
  },
});
```

## 注册自定义工具

在 `src/tools/index.ts` 中注册你的工具：

```typescript
// 导入你的工具
import { myApiTool, toolInfo as myApiToolInfo } from "./templates/httpApiTool.js";

// 添加到 builtinToolsMap
builtinToolsMap.set("my_api_tool", myApiTool);

// 添加到 builtinToolsInfo
builtinToolsInfo.push(myApiToolInfo);
```

## 通过 UI 创建自定义工具

你也可以通过 Web UI 动态创建工具：

1. 点击侧边栏的 Agent 选择器
2. 选择"管理 Agents"
3. 切换到"工具"标签页
4. 点击"+ 创建工具"

支持的处理器类型：
- **HTTP GET**: 发送 GET 请求到指定 URL
- **HTTP POST**: 发送 POST 请求到指定 URL
- **JavaScript**: 执行自定义 JavaScript 代码（沙盒环境）

## 工具参数定义

参数定义使用 JSON 数组格式：

```json
[
  {
    "name": "query",
    "type": "string",
    "description": "搜索关键词",
    "required": true
  },
  {
    "name": "limit",
    "type": "number",
    "description": "结果数量限制",
    "required": false,
    "default": 10
  },
  {
    "name": "format",
    "type": "string",
    "description": "输出格式",
    "required": false,
    "enum": ["json", "text", "markdown"]
  }
]
```

支持的类型：`string`, `number`, `boolean`, `object`, `array`
