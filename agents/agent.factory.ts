import { createModel, getModelConfig } from "./model.config.js";
import { createEmployeeAgent } from "./employee.agent.js";
import { createAnalyticsAgent } from "./analytics.agent.js";
import { createReportingAgent } from "./reporting.agent.js";
import { createApprovalAgent } from "./approval.agent.js";
import { createCoordinatorAgent } from "./coordinator.agent.js";
import { createMainAgent } from "./main.agent.js";
import {
  allTools,
  employeeTools,
  analyticsTools,
  reportingTools,
  approvalTools,
} from "./tools.js";

/**
 * Creates all agents in the system including the main orchestration agent.
 * This factory is used by the demos and can be imported separately from the NestJS app.
 */
export function createAgents() {
  const llm = createModel();

  const employee = createEmployeeAgent(llm);
  const analytics = createAnalyticsAgent(llm);
  const reporting = createReportingAgent(llm);
  const approval = createApprovalAgent(llm);
  const coordinator = createCoordinatorAgent(
    llm,
    employee,
    analytics,
    reporting,
    approval,
  );

  // Main agent with access to all other agents and tools
  const main = createMainAgent({
    llm,
    employeeAgent: employee,
    analyticsAgent: analytics,
    reportingAgent: reporting,
    approvalAgent: approval,
    coordinatorAgent: coordinator,
  });

  const toolRegistry = {
    employee: employeeTools.map((t) => t.name),
    analytics: analyticsTools.map((t) => t.name),
    reporting: reportingTools.map((t) => t.name),
    approval: approvalTools.map((t) => t.name),
    main: [
      "delegate_to_agent",
      "list_agent_capabilities",
      ...allTools.map((t) => t.name),
    ],
  };

  return {
    llm,
    employee,
    analytics,
    reporting,
    approval,
    coordinator,
    main,
    tools: allTools,
    toolRegistry,
    modelConfig: getModelConfig(),
  };
}
