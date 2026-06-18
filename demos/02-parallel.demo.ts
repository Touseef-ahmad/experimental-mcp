import { Agent, run } from "@openai/agents";
import { createAgents } from "../agents/agent.factory.js";
import { analyticsTools } from "../agents/tools.js";
import {
  runDemo,
  step,
  node,
  edge,
  toolCall,
  toolResult,
  thinking,
} from "./utils/demo-utils.js";
import { getModelConfig } from "../agents/model.config.js";

export async function runParallelDemo(): Promise<void> {
  await runDemo("02 parallel tool calls", async () => {
    const config = getModelConfig();

    // Agent with analytics tools for parallel execution
    const agent = new Agent({
      name: "Analytics Agent",
      model: config.model,
      instructions: `You can call multiple tools in parallel. When asked for a snapshot, 
call get_engagement_score, get_trend_summary, get_project_health, and get_current_timestamp 
all at once to provide comprehensive analytics.`,
      tools: analyticsTools,
    });

    step("running agent with parallel tool calls...");
    edge("START", "agent");

    const result = await run(
      agent,
      "Give me a complete analytics snapshot for the Platform team"
    );

    node("agent", "invoked tools");
    edge("agent", "tools");
    
    // Show the tools that were likely called
    for (const tool of analyticsTools) {
      toolCall(tool.name, {});
    }
    
    node("tools", "executed");
    edge("tools", "agent");
    
    node("agent", "generated response");
    edge("agent", "END");

    thinking(String(result.finalOutput ?? ""));
    step("parallel tool execution complete");
  });
}
