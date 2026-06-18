import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { getModelConfig } from "../agents/model.config.js";
import {
  runDemo,
  step,
  node,
  edge,
  thinking,
  printJson,
} from "./utils/demo-utils.js";

export async function runMultiStepPlanningDemo(): Promise<void> {
  await runDemo("08 multi-step planning", async () => {
    const config = getModelConfig();

    // Track execution for demonstration
    const executed: string[] = [];

    // Tool to execute a plan step
    const executePlanStep = tool({
      name: "execute_plan_step",
      description: "Executes a single step in the plan",
      parameters: z.object({
        stepDescription: z.string().describe("Description of the step to execute"),
      }),
      execute: async ({ stepDescription }) => {
        executed.push(stepDescription);
        return `Completed: ${stepDescription}`;
      },
    });

    const agent = new Agent({
      name: "Planning Agent",
      model: config.model,
      instructions: `You are a planning agent. When given a goal:
1. Create a plan with 3-4 specific steps
2. Execute each step using the execute_plan_step tool
3. Summarize what was accomplished

For "prepare engagement report", create steps like:
- Analyze goal requirements
- Collect employee engagement signals
- Calculate engagement trends
- Generate final report`,
      tools: [executePlanStep],
    });

    step("running planning agent...");
    edge("START", "planner");

    const result = await run(agent, "prepare engagement report");

    // Show execution trace
    node("planner", `created ${executed.length} steps`);
    
    for (let i = 0; i < executed.length; i++) {
      thinking(`planned: ${executed[i]}`);
      if (i === 0) {
        edge("planner", "execute");
      }
      node("execute", `step ${i + 1}: ${executed[i]}`);
      if (i < executed.length - 1) {
        edge("execute", "execute (loop)");
      }
    }

    edge("execute", "END");

    printJson("executed steps", executed);
    step(`total execution steps: ${executed.length}`);
    step(`final output: ${result.finalOutput}`);
  });
}
