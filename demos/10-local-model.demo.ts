import { createAgents } from "../agents/agent.factory.js";
import {
  runDemo,
  step,
  node,
  edge,
  toolCall,
  toolResult,
  thinking,
  printJson,
} from "./utils/demo-utils.js";

export async function runLocalModelDemo(): Promise<void> {
  await runDemo("10 local model (ollama)", async () => {
    const { analytics, modelConfig } = createAgents();

    printJson("model config", modelConfig);

    step("streaming analytics agent with local Ollama model...");
    edge("START", "agent");

    // Stream the agent execution
    const stream = await analytics.stream(
      "What is the engagement score for the Data team?",
    );

    const toolsUsed: string[] = [];
    let finalContent = "";

    for await (const event of stream) {
      for (const [nodeName, output] of Object.entries(event)) {
        node(nodeName);

        const outputObj = output as {
          messages?: Array<{
            tool_calls?: Array<{ name: string; args: unknown }>;
            content?: string;
            role?: string;
          }>;
        };

        if (outputObj?.messages) {
          for (const msg of outputObj.messages) {
            // Show tool calls
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
              for (const tc of msg.tool_calls) {
                toolsUsed.push(tc.name);
                toolCall(tc.name, tc.args);
              }
              edge(nodeName, "tools");
            }

            // Show tool results
            if (msg.role === "tool" && typeof msg.content === "string") {
              toolResult("tool", msg.content);
            }

            // Show final response
            if (
              msg.role === "assistant" &&
              msg.content &&
              !msg.tool_calls?.length
            ) {
              finalContent =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content);
              thinking(finalContent);
              edge(nodeName, "END");
            }
          }
        }
      }
    }

    if (toolsUsed.length > 0) {
      step(`tools invoked: ${toolsUsed.join(", ")}`);
    }
  });
}
