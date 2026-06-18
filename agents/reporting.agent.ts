import { Agent, run } from "@openai/agents";
import { reportingTools } from "./tools.js";
import { getModelConfig } from "./model.config.js";

export function createReportingAgent() {
  const config = getModelConfig();

  const agent = new Agent({
    name: "Reporting Agent",
    model: config.model,
    instructions:
      "You are a reporting specialist. Generate structured reports from data with titles, key points, and risk assessments.",
    tools: reportingTools,
  });

  return {
    name: "reporting-agent",
    agent,
    tools: reportingTools,
    async invoke(message: string) {
      const result = await run(agent, message);
      return {
        content: String(result.finalOutput ?? ""),
      };
    },
  };
}

export type ReportingAgent = ReturnType<typeof createReportingAgent>;
