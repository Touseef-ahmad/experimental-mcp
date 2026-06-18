import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
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

export async function runParallelDemo(): Promise<void> {
  await runDemo("02 parallel tool calls", async () => {
    const { llm } = createAgents();

    // Bind tools to LLM for parallel execution
    const llmWithTools = llm.bindTools!(analyticsTools);
    const toolNode = new ToolNode(analyticsTools);

    // Agent that requests multiple tools in parallel
    const agentNode = async (state: typeof MessagesAnnotation.State) => {
      const systemMessage = {
        role: "system",
        content:
          "You can call multiple tools in parallel. When asked for a snapshot, call get_engagement_score, get_trend_summary, get_project_health, and get_current_timestamp all at once.",
      };

      const response = await llmWithTools.invoke([
        systemMessage,
        ...state.messages,
      ]);
      return { messages: [response] };
    };

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", agentNode)
      .addNode("tools", toolNode)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (
          lastMessage &&
          "tool_calls" in lastMessage &&
          Array.isArray(lastMessage.tool_calls) &&
          lastMessage.tool_calls.length > 0
        ) {
          return "tools";
        }
        return END;
      })
      .addEdge("tools", "agent");

    const graph = workflow.compile();

    step("streaming graph execution...");
    edge("START", "agent");

    const stream = await graph.stream({
      messages: [
        ["user", "Give me a complete analytics snapshot for the Platform team"],
      ],
    });

    const toolCalls: string[] = [];
    let lastContent = "";

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

        if (outputObj?.messages && Array.isArray(outputObj.messages)) {
          for (const msg of outputObj.messages) {
            // Show tool calls being made
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
              for (const tc of msg.tool_calls) {
                toolCalls.push(tc.name);
                toolCall(tc.name, tc.args);
              }
              edge(nodeName, "tools");
            }

            // Show tool results
            if (msg.role === "tool" && typeof msg.content === "string") {
              toolResult("tool", msg.content);
            }

            // Show AI thinking/response
            if (
              msg.role === "assistant" &&
              msg.content &&
              !msg.tool_calls?.length
            ) {
              lastContent =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content);
              thinking(lastContent);
              edge(nodeName, "END");
            }
          }
        }
      }
    }

    step(`tools called: ${toolCalls.join(", ")}`);
    step(`parallel execution: ${toolCalls.length > 1 ? "yes" : "no"}`);
  });
}
