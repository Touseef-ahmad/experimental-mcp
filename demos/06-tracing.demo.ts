import { Agent, run } from "@openai/agents";
import { runDemo, step, node, edge, printJson } from "./utils/demo-utils.js";
import { getModelConfig } from "../agents/model.config.js";

export async function runTracingDemo(): Promise<void> {
  await runDemo("06 tracing", async () => {
    const config = getModelConfig();

    // Simple agent to demonstrate tracing
    const agent = new Agent({
      name: "Tracing Demo Agent",
      model: config.model,
      instructions: `You are a simple assistant. Process the user's request step by step:
1. First, acknowledge you received the request
2. Then provide your response
Always be concise.`,
    });

    step("running agent with tracing...");
    edge("START", "step1");

    // The OpenAI Agents SDK has built-in tracing
    // We'll simulate the trace by tracking our own execution
    const trace: string[] = [];
    
    trace.push("entered step1");
    node("step1", "trace updated");
    edge("step1", "step2");

    const result = await run(agent, "Process this request and confirm completion");

    trace.push("entered step2");
    node("step2", "trace updated");
    edge("step2", "END");

    trace.push("completed");

    printJson("collected trace", trace);
    step(`final output: ${result.finalOutput}`);
  });
}
