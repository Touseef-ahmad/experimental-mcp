import { getModelConfig } from "./model.config.js";
import { createEmployeeAgent } from "./employee.agent.js";
import { createAnalyticsAgent } from "./analytics.agent.js";
import { createReportingAgent } from "./reporting.agent.js";
import { createApprovalAgent } from "./approval.agent.js";
import { createCoordinatorAgent } from "./coordinator.agent.js";
import { createMainAgent } from "./main.agent.js";
import { allTools, employeeTools, analyticsTools, reportingTools, approvalTools, } from "./tools.js";
/**
 * Creates all agents in the system using OpenAI Agents SDK.
 * This factory is used by the demos and can be imported separately from the NestJS app.
 */
export function createAgents() {
    // Create specialist agents (no longer need LLM passed in)
    const employee = createEmployeeAgent();
    const analytics = createAnalyticsAgent();
    const reporting = createReportingAgent();
    const approval = createApprovalAgent();
    // Create coordinator with access to specialists
    const coordinator = createCoordinatorAgent(employee, analytics, reporting, approval);
    // Create main agent with access to all other agents and tools
    const main = createMainAgent({
        employeeAgent: employee,
        analyticsAgent: analytics,
        reportingAgent: reporting,
        approvalAgent: approval,
        coordinatorAgent: coordinator,
    });
    // Tool registry for discovery
    const toolRegistry = {
        employee: employeeTools.map((t) => t.name),
        analytics: analyticsTools.map((t) => t.name),
        reporting: reportingTools.map((t) => t.name),
        approval: approvalTools.map((t) => t.name),
        main: ["list_agent_capabilities", ...allTools.map((t) => t.name)],
    };
    return {
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
