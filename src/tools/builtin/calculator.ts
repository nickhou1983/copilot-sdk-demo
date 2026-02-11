import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";

/**
 * 计算器工具
 */
export const calculatorTool = defineTool("calculate", {
  description: "执行数学计算，支持加减乘除和基本数学函数",
  parameters: z.object({
    expression: z
      .string()
      .describe("数学表达式，例如 '2 + 3 * 4'、'sqrt(16)'、'pow(2, 10)'"),
  }) as any,
  handler: async (args: unknown) => {
    const { expression } = args as { expression: string };
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

export const toolInfo = {
  id: "calculate",
  name: "计算器",
  description: "执行数学计算，支持加减乘除和基本数学函数",
  parameters: [
    {
      name: "expression",
      type: "string" as const,
      description: "数学表达式，例如 '2 + 3 * 4'、'sqrt(16)'、'pow(2, 10)'",
      required: true,
    },
  ],
};
