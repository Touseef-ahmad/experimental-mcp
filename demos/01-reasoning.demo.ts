import { Agent, run } from "@openai/agents";
import { runDemo, step, node, edge } from "./utils/demo-utils.js";
import { getModelConfig } from "../agents/model.config.js";

export async function runReasoningDemo(): Promise<void> {
  await runDemo("01 reasoning", async () => {
    const config = getModelConfig();

    // Simple reasoning agent that answers questions
    const agent = new Agent({
      name: "Reasoning Agent",
      model: config.model,
      instructions: `You are a reasoning agent. When asked about the time, provide the current UTC timestamp. 
For other questions, reason through them step by step and provide a clear answer.`,
    });

    step("running agent...");
    edge("START", "agent");

    const result = await run(agent, "Can you tell me the time?");

    node("agent", "processed question");
    edge("agent", "END");

    step(`answer: ${result.finalOutput}`);
  });
}
