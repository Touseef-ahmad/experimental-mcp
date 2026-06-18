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

    step("running reporting agent...");
    edge("START", "agent");

    const result = await reporting.invoke(
      "Build a report titled 'Q4 Engagement Summary' with key points: stable metrics, team growth, new initiatives planned"
    );

    node("agent", "generating report");
    toolCall("build_report", {
      title: "Q4 Engagement Summary",
      keyPoints: ["stable metrics", "team growth", "new initiatives planned"],
    });

    edge("agent", "tools");
    node("tools", "executed build_report");
    edge("tools", "agent");
    edge("agent", "END");

    thinking(result.content);

    // Try to extract and validate JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const validated = ReportSchema.parse(parsed);
        step("structured output validated with Zod ✅");
        printJson("report", validated);
      } catch (e) {
        step(`validation note: ${(e as Error).message}`);
        step(`raw response: ${result.content}`);
      }
    } else {
      step(`agent response: ${result.content}`);
    }
  });
}
