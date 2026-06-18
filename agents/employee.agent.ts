import { Agent, run } from "@openai/agents";
import { employeeTools } from "./tools.js";
import { getModelConfig } from "./model.config.js";

export function createEmployeeAgent() {
  const config = getModelConfig();

  const agent = new Agent({
    name: "Employee Agent",
    model: config.model,
    instructions:
      "You are an employee data specialist. Help users find employee information including team membership and managers.",
    tools: employeeTools,
  });

  return {
    name: "employee-agent",
    agent,
    tools: employeeTools,
    async invoke(message: string) {
      const result = await run(agent, message);
      return {
        content: String(result.finalOutput ?? ""),
      };
    },
  };
}

export type EmployeeAgent = ReturnType<typeof createEmployeeAgent>;
