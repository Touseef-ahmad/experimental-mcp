/// <reference types="node" />
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { approvalTools } from "./tools.js";
import { Annotation } from "@langchain/langgraph";

// Extended state for HITL approval workflow
const ApprovalState = Annotation.Root({
  ...MessagesAnnotation.spec,
  needsHumanReview: Annotation<boolean>,
  humanDecision: Annotation<string | undefined>,
});

export function createApprovalAgent(llm: BaseChatModel) {
  const llmWithTools = llm.bindTools!(approvalTools);
  const toolNode = new ToolNode(approvalTools);

  // Custom agent node that can flag for human review
  const agentNode = async (state: typeof ApprovalState.State) => {
    const response = await llmWithTools.invoke(state.messages);

    // Check if this needs human review (simulate based on content)
    const content =
      typeof response.content === "string" ? response.content : "";
    const needsHumanReview =
      content.toLowerCase().includes("pending_review") ||
      content.toLowerCase().includes("high risk");

    return {
      messages: [response],
      needsHumanReview,
    };
  };

  // Human review node (simulates waiting for human input)
  const humanReviewNode = async (state: typeof ApprovalState.State) => {
    const decision =
      state.humanDecision ?? process.env.DEMO_APPROVAL_DECISION ?? "approved";
    return {
      messages: [
        {
          role: "system",
          content: `Human reviewer decision: ${decision}`,
        },
      ],
      needsHumanReview: false,
    };
  };

  const workflow = new StateGraph(ApprovalState)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addNode("human_review", humanReviewNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", (state) => {
      // Check for tool calls first
      const lastMessage = state.messages[state.messages.length - 1];
      if (
        lastMessage &&
        "tool_calls" in lastMessage &&
        Array.isArray(lastMessage.tool_calls) &&
        lastMessage.tool_calls.length > 0
      ) {
        return "tools";
      }
      // Then check if human review needed
      if (state.needsHumanReview) {
        return "human_review";
      }
      return END;
    })
    .addEdge("tools", "agent")
    .addEdge("human_review", END);

  const compiledAgent = workflow.compile();

  return {
    name: "approval-agent",
    systemPrompt:
      "You are an approval workflow specialist handling risk assessments.",
    tools: approvalTools,
    async invoke(message: string, humanDecision?: string) {
      const result = await compiledAgent.invoke({
        messages: [["user", message]],
        needsHumanReview: false,
        humanDecision,
      });
      const lastMessage = result.messages[result.messages.length - 1];
      return {
        content:
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content),
        messages: result.messages,
        needsHumanReview: result.needsHumanReview,
      };
    },
  };
}

export type ApprovalAgent = ReturnType<typeof createApprovalAgent>;
