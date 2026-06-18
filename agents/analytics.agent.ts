import { createAgent } from "langchain";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { analyticsTools } from "./tools.js";

export function createAnalyticsAgent(llm: BaseChatModel) {
  const agent = createAgent({
    model: llm,
    tools: analyticsTools,
  });

  return {
    name: "analytics-agent",
    systemPrompt:
      "You are an analytics specialist. Analyze engagement, trends, and project health.",
    tools: analyticsTools,
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

export type AnalyticsAgent = ReturnType<typeof createAnalyticsAgent>;
