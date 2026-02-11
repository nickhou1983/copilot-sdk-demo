import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";

/**
 * 获取当前时间工具
 */
export const getCurrentTimeTool = defineTool("get_current_time", {
  description: "获取当前的日期和时间，支持指定时区",
  parameters: z.object({
    timezone: z
      .string()
      .optional()
      .describe("时区，例如 'Asia/Shanghai'、'America/New_York'，默认为系统时区"),
  }) as any,
  handler: async (args: unknown) => {
    const { timezone } = args as { timezone?: string };
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: timezone || undefined,
    };

    const now = new Date();
    const formatted = new Intl.DateTimeFormat("zh-CN", options).format(now);

    return {
      datetime: formatted,
      timestamp: now.getTime(),
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  },
});

export const toolInfo = {
  id: "get_current_time",
  name: "获取当前时间",
  description: "获取当前的日期和时间，支持指定时区",
  parameters: [
    {
      name: "timezone",
      type: "string" as const,
      description: "时区，例如 'Asia/Shanghai'、'America/New_York'，默认为系统时区",
      required: false,
    },
  ],
};
