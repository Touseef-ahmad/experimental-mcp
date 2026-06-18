/// <reference types="node" />
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { getModelConfig } from "./model.config.js";

/**
 * Creates an approval agent with human-in-the-loop capability.
 * High-risk requests require human approval via the SDK's interruption mechanism.
 */
export function createApprovalAgent() {
  const config = getModelConfig();

  // Approval tool that requires human review for non-low risk
  const requestApprovalTool = tool({
    name: "request_approval",
    description:
      "Requests approval for an action based on context and risk level. High/medium risk requires human review.",
    parameters: z.object({
      context: z.string().describe("Description of what needs approval"),
      riskLevel: z
        .enum(["low", "medium", "high"])
        .describe("Risk level of the action"),
    }),
    // Require approval for medium/high risk actions
    needsApproval: async (_context, { riskLevel }) => {
      return riskLevel !== "low";
    },
    execute: async ({ context, riskLevel }) => {
      const decision = {
        status: "approved",
        reviewer: riskLevel === "low" ? "auto-approver" : "human-reviewer",
        reason:
          riskLevel === "low"
            ? "Low risk - automatically approved"
            : "Approved after human review",
        context,
        riskLevel,
      };
      return JSON.stringify(decision);
    },
  });

  const agent = new Agent({
    name: "Approval Agent",
    model: config.model,
    instructions: `You are an approval workflow specialist handling risk assessments.

When users request approval for actions:
1. Assess the risk level based on the context
2. Use the request_approval tool to process the approval
3. Low risk actions are auto-approved
4. Medium/high risk actions require human review

Always explain the approval decision and reasoning.`,
    tools: [requestApprovalTool],
  });

  return {
    name: "approval-agent",
    agent,
    tools: [requestApprovalTool],

    /**
     * Invoke the approval agent. Returns result with potential interruptions.
     */
    async invoke(message: string) {
      const result = await run(agent, message);

      // Check if there are pending approvals requiring human input
      const hasInterruptions =
        result.interruptions && result.interruptions.length > 0;

      return {
        content: String(result.finalOutput ?? ""),
        needsHumanReview: hasInterruptions,
        interruptions: result.interruptions,
        state: result.state,
      };
    },
  };
}

export type ApprovalAgent = ReturnType<typeof createApprovalAgent>;
