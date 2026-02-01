import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";

/**
 * 自定义工具定义
 * 演示 Copilot SDK 的工具调用能力
 */

// 获取当前时间工具
export const getCurrentTimeTool = defineTool("get_current_time", {
  description: "获取当前的日期和时间，支持指定时区",
  parameters: z.object({
    timezone: z
      .string()
      .optional()
      .describe("时区，例如 'Asia/Shanghai'、'America/New_York'，默认为系统时区"),
  }),
  handler: async ({ timezone }) => {
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

// 计算器工具
export const calculatorTool = defineTool("calculate", {
  description: "执行数学计算，支持加减乘除和基本数学函数",
  parameters: z.object({
    expression: z
      .string()
      .describe("数学表达式，例如 '2 + 3 * 4'、'sqrt(16)'、'pow(2, 10)'"),
  }),
  handler: async ({ expression }) => {
    try {
      // 安全的数学表达式计算
      const safeExpression = expression
        .replace(/sqrt/g, "Math.sqrt")
        .replace(/pow/g, "Math.pow")
        .replace(/abs/g, "Math.abs")
        .replace(/sin/g, "Math.sin")
        .replace(/cos/g, "Math.cos")
        .replace(/tan/g, "Math.tan")
        .replace(/log/g, "Math.log")
        .replace(/exp/g, "Math.exp")
        .replace(/floor/g, "Math.floor")
        .replace(/ceil/g, "Math.ceil")
        .replace(/round/g, "Math.round")
        .replace(/PI/g, "Math.PI")
        .replace(/E/g, "Math.E");

      // 检查是否只包含安全字符
      if (!/^[\d\s+\-*/().Math,sqrtpowabsincostanlogexpfloorceround\sPI\sE]+$/.test(safeExpression)) {
        throw new Error("表达式包含不允许的字符");
      }

      // eslint-disable-next-line no-eval
      const result = eval(safeExpression);

      return {
        expression: expression,
        result: result,
        type: typeof result,
      };
    } catch (error) {
      return {
        expression: expression,
        error: `计算错误: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});

// 天气查询工具（模拟）
export const getWeatherTool = defineTool("get_weather", {
  description: "获取指定城市的天气信息（演示用，返回模拟数据）",
  parameters: z.object({
    city: z.string().describe("城市名称，例如 '北京'、'上海'、'New York'"),
  }),
  handler: async ({ city }) => {
    // 模拟天气数据
    const weatherConditions = ["晴", "多云", "阴", "小雨", "大雨", "雪"];
    const condition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    const temperature = Math.floor(Math.random() * 35) - 5;
    const humidity = Math.floor(Math.random() * 60) + 40;

    return {
      city: city,
      condition: condition,
      temperature: `${temperature}°C`,
      humidity: `${humidity}%`,
      note: "这是模拟数据，仅用于演示工具调用功能",
    };
  },
});

// 文本处理工具
export const textProcessorTool = defineTool("process_text", {
  description: "处理文本：统计字数、提取关键信息等",
  parameters: z.object({
    text: z.string().describe("要处理的文本内容"),
    operation: z
      .enum(["count", "uppercase", "lowercase", "reverse"])
      .describe("操作类型：count(统计)、uppercase(大写)、lowercase(小写)、reverse(反转)"),
  }),
  handler: async ({ text, operation }) => {
    switch (operation) {
      case "count":
        return {
          characters: text.length,
          charactersNoSpaces: text.replace(/\s/g, "").length,
          words: text.split(/\s+/).filter((w) => w.length > 0).length,
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

// 导出所有工具
export const allTools = [
  getCurrentTimeTool,
  calculatorTool,
  getWeatherTool,
  textProcessorTool,
];
