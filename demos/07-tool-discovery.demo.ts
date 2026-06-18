import { createAgents } from "../agents/agent.factory.js";
import { allTools } from "../agents/tools.js";
import {
  runDemo,
  step,
  node,
  edge,
  toolCall,
  printJson,
} from "./utils/demo-utils.js";

export async function runToolDiscoveryDemo(): Promise<void> {
  await runDemo("07 tool discovery", async () => {
    const { toolRegistry } = createAgents();

    step("discovering available tools...");
    edge("START", "registry_scan");

    node("registry_scan", "examining tool registry");

    // Show tools organized by agent
    printJson("tools by agent", toolRegistry);

    // Show all tools with their schemas
    const toolDetails = allTools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema ? "defined" : "none",
    }));

    node("schema_extraction", "extracting tool schemas");
    edge("registry_scan", "schema_extraction");

    printJson("all tools", toolDetails);

    step(`total tools available: ${allTools.length}`);

    // Demonstrate tool selection based on query
    const query = "engagement metrics";
    const matchingTools = allTools.filter(
      (t) =>
        t.name.includes("engagement") ||
        t.description.toLowerCase().includes("engagement"),
    );

    node("tool_matching", `query="${query}"`);
    edge("schema_extraction", "tool_matching");

    for (const tool of matchingTools) {
      toolCall(tool.name, { matched: true });
    }

    edge("tool_matching", "END");

    step(
      `tools matching "${query}": ${matchingTools.map((t) => t.name).join(", ")}`,
    );
  });
}
