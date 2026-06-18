import { createAgents } from "../agents/agent.factory.js";
import { runDemo, step, node, edge, thinking } from "./utils/demo-utils.js";

export async function runHandoffsDemo(): Promise<void> {
  await runDemo("03 handoffs", async () => {
    const { coordinator } = createAgents();

    step("streaming coordinator execution...");
    edge("START", "coordinator");

    const result = await coordinator.run(
      "Create report for employee engagement",
    );

    // Show handoff chain
    for (let i = 0; i < result.trace.length; i++) {
      const agentName = result.trace[i];
      node(agentName, "executing");
      if (i < result.trace.length - 1) {
        edge(agentName, result.trace[i + 1]);
      } else {
        edge(agentName, "END");
      }
    }

    thinking(result.output);
    step(`handoff chain: ${result.trace.join(" → ")}`);
  });
}
