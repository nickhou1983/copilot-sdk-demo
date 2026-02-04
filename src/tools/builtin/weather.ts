import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";

/**
 * 天气查询工具（模拟）
 */
export const getWeatherTool = defineTool("get_weather", {
  description: "获取指定城市的天气信息（演示用，返回模拟数据）",
  parameters: z.object({
    city: z.string().describe("城市名称，例如 '北京'、'上海'、'New York'"),
  }) as any,
  handler: async (args: unknown) => {
    const { city } = args as { city: string };
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

export const toolInfo = {
  id: "get_weather",
  name: "天气查询",
  description: "获取指定城市的天气信息（演示用，返回模拟数据）",
  parameters: [
    {
      name: "city",
      type: "string" as const,
      description: "城市名称，例如 '北京'、'上海'、'New York'",
      required: true,
    },
  ],
};
