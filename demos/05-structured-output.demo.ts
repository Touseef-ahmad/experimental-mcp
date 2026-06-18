import { z } from "zod";
import { createAgents } from "../agents/agent.factory.js";
import {
  runDemo,
  step,
  node,
  edge,
  thinking,
  toolCall,
  toolResult,
  printJson,
} from "./utils/demo-utils.js";

// Define expected structured output schema
const ReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  generatedAt: z.string(),
});

export async function runStructuredOutputDemo(): Promise<void> {
  await runDemo("05 structured output", async () => {
    const { reporting } = createAgents();

    step("streaming reporting agent...");
    edge("START", "agent");

    // Stream the agent execution
    const stream = await reporting.stream(
      "Build a report titled 'Q4 Engagement Summary' with key points: stable metrics, team growth, new initiatives planned",
    );

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
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
              for (const tc of msg.tool_calls) {
                toolCall(tc.name, tc.args);
              }
              edge(nodeName, "tools");
            }
            if (msg.role === "tool" && typeof msg.content === "string") {
              toolResult("tool", msg.content);
            }
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
            }
          }
        }
      }
    }

    edge("agent", "END");

    // Try to extract and validate JSON from response
    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const validated = ReportSchema.parse(parsed);
        step("structured output validated with Zod ✅");
        printJson("report", validated);
      } catch (e) {
        step(`validation note: ${(e as Error).message}`);
        step(`raw response: ${finalContent}`);
      }
    } else {
      step(`agent response: ${finalContent}`);
    }
  });
}
