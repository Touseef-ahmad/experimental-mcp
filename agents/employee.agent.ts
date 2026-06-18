import { createAgent } from "langchain";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { employeeTools } from "./tools.js";

export function createEmployeeAgent(llm: BaseChatModel) {
  const agent = createAgent({
    model: llm,
    tools: employeeTools,
  });

  return {
    name: "employee-agent",
    systemPrompt:
      "You are an employee data specialist. Help users find employee information.",
    tools: employeeTools,
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

export type EmployeeAgent = ReturnType<typeof createEmployeeAgent>;
