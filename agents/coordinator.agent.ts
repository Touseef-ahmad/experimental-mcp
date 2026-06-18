import { Agent, run, handoff } from "@openai/agents";
import { getModelConfig } from "./model.config.js";
import { EmployeeAgent } from "./employee.agent.js";
import { AnalyticsAgent } from "./analytics.agent.js";
import { ReportingAgent } from "./reporting.agent.js";
import { ApprovalAgent } from "./approval.agent.js";

/**
 * Creates a coordinator agent that routes tasks to specialist agents via handoffs.
 */
export function createCoordinatorAgent(
  employeeAgent: EmployeeAgent,
  analyticsAgent: AnalyticsAgent,
  reportingAgent: ReportingAgent,
  approvalAgent: ApprovalAgent,
) {
  const config = getModelConfig();

  // Create handoffs to specialist agents
  const employeeHandoff = handoff(employeeAgent.agent, {
    toolNameOverride: "transfer_to_employee",
    toolDescriptionOverride:
      "Transfer to employee specialist for employee data, team info, and org structure queries.",
  });

  const analyticsHandoff = handoff(analyticsAgent.agent, {
    toolNameOverride: "transfer_to_analytics",
    toolDescriptionOverride:
      "Transfer to analytics specialist for metrics, trends, engagement scores, and project health.",
  });

  const reportingHandoff = handoff(reportingAgent.agent, {
    toolNameOverride: "transfer_to_reporting",
    toolDescriptionOverride:
      "Transfer to reporting specialist for generating reports and summaries.",
  });

  const approvalHandoff = handoff(approvalAgent.agent, {
    toolNameOverride: "transfer_to_approval",
    toolDescriptionOverride:
      "Transfer to approval specialist for approval workflows and risk assessments.",
  });

  const agent = Agent.create({
    name: "Coordinator Agent",
    model: config.model,
    instructions: `You are a coordinator agent. Analyze user requests and route them to the appropriate specialist:

- Employee Agent: For employee data, team info, org structure queries
- Analytics Agent: For metrics, trends, engagement scores, project health
- Reporting Agent: For generating reports and summaries  
- Approval Agent: For approval workflows and risk assessments

Transfer the conversation to the most appropriate specialist based on the user's needs.`,
    handoffs: [
      employeeHandoff,
      analyticsHandoff,
      reportingHandoff,
      approvalHandoff,
    ],
  });

  return {
    name: "coordinator-agent",
    agent,

    async run(request: string) {
      const result = await run(agent, request);

      // Track which agent handled the request
      const handedOffTo = result.lastAgent?.name ?? "coordinator";
      const trace = ["coordinator"];
      if (handedOffTo !== "Coordinator Agent") {
        trace.push(handedOffTo.toLowerCase().replace(" agent", "-agent"));
      }

      return {
        output: String(result.finalOutput ?? ""),
        trace,
      };
    },
  };
}

export type CoordinatorAgent = ReturnType<typeof createCoordinatorAgent>;
