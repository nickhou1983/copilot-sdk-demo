import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";

/**
 * 文本处理工具
 */
export const textProcessorTool = defineTool("process_text", {
  description: "处理文本：统计字数、提取关键信息等",
  parameters: z.object({
    text: z.string().describe("要处理的文本内容"),
    operation: z
      .enum(["count", "uppercase", "lowercase", "reverse"])
      .describe("操作类型：count(统计)、uppercase(大写)、lowercase(小写)、reverse(反转)"),
  }) as any,
  handler: async (args: unknown) => {
    const { text, operation } = args as { text: string; operation: "count" | "uppercase" | "lowercase" | "reverse" };
    switch (operation) {
      case "count":
        return {
          characters: text.length,
          charactersNoSpaces: text.replace(/\s/g, "").length,
          words: text.split(/\s+/).filter((w: string) => w.length > 0).length,
          lines: text.split("\n").length,
        };
      case "uppercase":
        return { result: text.toUpperCase() };
      case "lowercase":
        return { result: text.toLowerCase() };
      case "reverse":
        return { result: text.split("").reverse().join("") };
      default:
        return { error: "未知操作" };
    }
  },
});

export const toolInfo = {
  id: "process_text",
  name: "文本处理",
  description: "处理文本：统计字数、提取关键信息等",
  parameters: [
    {
      name: "text",
      type: "string" as const,
      description: "要处理的文本内容",
      required: true,
    },
    {
      name: "operation",
      type: "string" as const,
      description: "操作类型：count(统计)、uppercase(大写)、lowercase(小写)、reverse(反转)",
      required: true,
      enum: ["count", "uppercase", "lowercase", "reverse"],
    },
  ],
};
