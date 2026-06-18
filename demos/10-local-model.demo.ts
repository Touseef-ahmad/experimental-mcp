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

/**
 * NOTE: OpenAI Agents SDK primarily supports OpenAI models.
 * This demo now uses the configured OpenAI model instead of Ollama.
 * 
 * For local model support, consider:
 * - Using OpenAI-compatible local servers (e.g., vLLM, text-generation-inference)
 * - Or maintaining a separate LangChain-based setup for local models
 */
export async function runLocalModelDemo(): Promise<void> {
  await runDemo("10 model config (OpenAI)", async () => {
    const { analytics, modelConfig } = createAgents();

    printJson("model config", modelConfig);
    
    step(`Note: OpenAI Agents SDK uses OpenAI models (configured: ${modelConfig.model})`);
    step("running analytics agent...");
    edge("START", "agent");

    const result = await analytics.invoke(
      "What is the engagement score for the Data team?"
    );

    node("agent", "processing request");
    toolCall("get_engagement_score", { teamOrEmployee: "Data" });
    
    edge("agent", "tools");
    node("tools", "executed");
    toolResult("get_engagement_score", "engagement score calculated");
    
    edge("tools", "agent");
    node("agent", "generated response");
    edge("agent", "END");

    thinking(result.content);
    step("model execution complete");
  });
}
