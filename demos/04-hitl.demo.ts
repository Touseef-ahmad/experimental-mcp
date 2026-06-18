/// <reference types="node" />
import * as readline from "readline";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { getModelConfig } from "../agents/model.config.js";
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

export async function runHitlDemo(): Promise<void> {
  await runDemo("04 human-in-the-loop", async () => {
    const config = getModelConfig();

    // Approval tool that requires human review for high risk
    const requestApprovalTool = tool({
      name: "request_approval",
      description:
        "Requests approval for an action. High risk requires human review.",
      parameters: z.object({
        context: z.string().describe("Description of what needs approval"),
        riskLevel: z.enum(["low", "medium", "high"]).describe("Risk level"),
      }),
      needsApproval: async (_context, { riskLevel }) => {
        return riskLevel === "high";
      },
      execute: async ({ context, riskLevel }) => {
        return JSON.stringify({
          status: "approved",
          context,
          riskLevel,
          reviewer: riskLevel === "high" ? "human" : "auto",
        });
      },
    });

    const agent = new Agent({
      name: "Approval Agent",
      model: config.model,
      instructions:
        "You handle approval requests. Use the request_approval tool.",
      tools: [requestApprovalTool],
    });

    step("running agent with HITL...");
    edge("START", "agent");

    let result = await run(
      agent,
      "Request approval for deploying to production with high risk level",
    );

    node("agent", "requested approval");
    toolCall("request_approval", { riskLevel: "high" });

    // Check if we have interruptions (human review needed)
    if (result.interruptions && result.interruptions.length > 0) {
      edge("agent", "human_review");
      node("human_review", "awaiting decision");

      console.log("\n  ⚠️  HUMAN REVIEW REQUIRED");
      console.log("  Request: Deploy to production with HIGH risk level");

      const decision = await promptUser(
        "  Enter decision (approved/rejected): ",
      );
      step(`human reviewer decision: ${decision}`);

      // Approve or reject the interruption
      const state = result.state;
      for (const interruption of result.interruptions) {
        if (decision === "approved" || decision === "y" || decision === "yes") {
          state.approve(interruption);
        } else {
          state.reject(interruption, { message: "Rejected by human reviewer" });
        }
      }

      // Resume execution
      result = await run(agent, state);
      edge("human_review", "agent");
    }

    node("agent", "completed");
    edge("agent", "END");

    toolResult("request_approval", String(result.finalOutput ?? ""));
    step("HITL workflow complete");
  });
}
