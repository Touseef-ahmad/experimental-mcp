import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { getModelConfig } from "../agents/model.config.js";
import { runDemo, step, node, edge, toolResult } from "./utils/demo-utils.js";

// Simulated flaky tool that fails first 2 attempts
let attemptCount = 0;

export async function runFailureHandlingDemo(): Promise<void> {
  await runDemo("09 failure handling", async () => {
    const config = getModelConfig();
    
    // Reset attempt counter for each demo run
    attemptCount = 0;

    // A flaky tool that fails initially but eventually succeeds
    const flakyTool = tool({
      name: "flaky_operation",
      description: "A flaky operation that may fail. Keep retrying if it fails.",
      parameters: z.object({
        operation: z.string().describe("The operation to perform"),
      }),
      execute: async ({ operation }) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("transient tool failure");
        }
        return `Success on attempt ${attemptCount}: ${operation}`;
      },
    });

    const agent = new Agent({
      name: "Resilient Agent",
      model: config.model,
      instructions: `You handle operations that may fail. When using the flaky_operation tool:
1. If it fails, try again (up to 3 times)
2. Report the final result or failure

Always attempt the operation when asked.`,
      tools: [flakyTool],
    });

    step("running agent with retry logic...");
    edge("START", "agent");

    const result = await run(agent, "Execute the critical operation");

    // Show the retry pattern
    for (let i = 1; i <= attemptCount; i++) {
      const status = i < 3 ? "failed" : "ok";
      node("agent", `attempt ${i} → ${status}`);
      
      if (i < 3) {
        toolResult("flaky_operation", `❌ error=transient tool failure`);
        if (i < attemptCount) {
          edge("agent", "agent (retry)");
        }
      } else {
        toolResult("flaky_operation", `✅ Success on attempt ${i}`);
        edge("agent", "END");
      }
    }

    step("retry pattern: fail → fail → success (or max attempts)");
    step(`final output: ${result.finalOutput}`);
  });
}
