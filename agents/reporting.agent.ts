import { createAgent } from "langchain";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { reportingTools } from "./tools.js";

export function createReportingAgent(llm: BaseChatModel) {
  const agent = createAgent({
    model: llm,
    tools: reportingTools,
  });

  return {
    name: "reporting-agent",
    systemPrompt:
      "You are a reporting specialist. Generate structured reports from data.",
    tools: reportingTools,
    async invoke(message: string) {
      const result = await agent.invoke({
        messages: [["user", message]],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      return {
        content:
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content),
        messages: result.messages,
      };
    },
    async stream(message: string) {
      return agent.stream({
        messages: [["user", message]],
      });
    },
  };
}

export type ReportingAgent = ReturnType<typeof createReportingAgent>;
