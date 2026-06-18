/// <reference types="node" />
import * as readline from "readline";
import {
  StateGraph,
  START,
  END,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createAgents } from "../agents/agent.factory.js";
import { approvalTools } from "../agents/tools.js";
import {
  runDemo,
  step,
  node,
  edge,
  toolCall,
  toolResult,
} from "./utils/demo-utils.js";

// Helper to prompt user in terminal
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() || "approved");
    });
  });
}

// HITL state with interrupt capability
const HITLState = Annotation.Root({
  ...MessagesAnnotation.spec,
  pendingApproval: Annotation<boolean>,
  humanDecision: Annotation<string | undefined>,
});

export async function runHitlDemo(): Promise<void> {
  await runDemo("04 human-in-the-loop", async () => {
    const { llm } = createAgents();

    const llmWithTools = llm.bindTools!(approvalTools);
    const toolNode = new ToolNode(approvalTools);

    const agentNode = async (state: typeof HITLState.State) => {
      const response = await llmWithTools.invoke(state.messages);
      return { messages: [response] };
    };

    // Node that checks if human review is needed
    const checkApprovalNode = async (state: typeof HITLState.State) => {
      // Check tool results for pending_review status
      for (const msg of state.messages) {
        if (msg && typeof msg === "object" && "content" in msg) {
          const content = typeof msg.content === "string" ? msg.content : "";
          if (content.includes("pending_review") || content.includes("high")) {
            return { pendingApproval: true };
          }
        }
      }
      return { pendingApproval: false };
    };

    // Human review node - prompts user for approval
    const humanReviewNode = async (state: typeof HITLState.State) => {
      console.log("\n  ⚠️  HUMAN REVIEW REQUIRED");
      console.log("  Request: Deploy to production with HIGH risk level");
      const decision = await promptUser(
        "  Enter decision (approved/rejected): ",
      );
      step(`human reviewer decision: ${decision}`);
      return {
        messages: [
          {
            role: "assistant",
            content: `Human review complete. Decision: ${decision}`,
          },
        ],
        pendingApproval: false,
        humanDecision: decision,
      };
    };

    const workflow = new StateGraph(HITLState)
      .addNode("agent", agentNode)
      .addNode("tools", toolNode)
      .addNode("check_approval", checkApprovalNode)
      .addNode("human_review", humanReviewNode)
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
        return "check_approval";
      })
      .addEdge("tools", "check_approval")
      .addConditionalEdges("check_approval", (state) => {
        return state.pendingApproval ? "human_review" : END;
      })
      .addEdge("human_review", END);

    const graph = workflow.compile();

    // Test with high risk request that requires human review
    step("streaming graph execution with HITL...");
    edge("START", "agent");

    const stream = await graph.stream({
      messages: [
        [
          "user",
          "Request approval for deploying to production with high risk level",
        ],
      ],
      pendingApproval: false,
      humanDecision: undefined,
    });

    let finalState: typeof HITLState.State | null = null;

    for await (const event of stream) {
      for (const [nodeName, output] of Object.entries(event)) {
        node(nodeName);

        const outputObj = output as {
          messages?: Array<{
            tool_calls?: Array<{ name: string; args: unknown }>;
            content?: string;
            role?: string;
          }>;
          pendingApproval?: boolean;
        };

        // Show tool calls
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
          }
        }

        // Show human review trigger
        if (outputObj?.pendingApproval !== undefined) {
          step(`pending approval: ${outputObj.pendingApproval}`);
          if (outputObj.pendingApproval) {
            edge(nodeName, "human_review");
          }
        }

        finalState = {
          ...finalState,
          ...(output as typeof HITLState.State),
        } as typeof HITLState.State;
      }
    }

    edge("human_review", "END");
    step(
      `final status: pendingApproval=${finalState?.pendingApproval ?? "unknown"}`,
    );
  });
}
