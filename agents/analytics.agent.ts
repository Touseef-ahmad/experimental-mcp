import { Agent, run } from "@openai/agents";
import { analyticsTools } from "./tools.js";
import { getModelConfig } from "./model.config.js";

export function createAnalyticsAgent() {
  const config = getModelConfig();

  const agent = new Agent({
    name: "Analytics Agent",
    model: config.model,
    instructions:
      "You are an analytics specialist. Analyze engagement scores, trends, and project health metrics.",
    tools: analyticsTools,
  });

  return {
    name: "analytics-agent",
    agent,
    tools: analyticsTools,
    async invoke(message: string) {
      const result = await run(agent, message);
      return {
        content: String(result.finalOutput ?? ""),
      };
    },
  };
}

export type AnalyticsAgent = ReturnType<typeof createAnalyticsAgent>;
