import { Agent, run, tool, handoff } from "@openai/agents";
import { z } from "zod";
import { getModelConfig } from "./model.config.js";
import { allTools } from "./tools.js";
/**
 * Creates the main orchestration agent with access to all tools and specialized agents.
 * Uses OpenAI Agents SDK with handoffs for delegation.
 */
export function createMainAgent(config) {
    const modelConfig = getModelConfig();
    const { employeeAgent, analyticsAgent, reportingAgent, approvalAgent, coordinatorAgent, } = config;
    // Tool to list all agent capabilities
    const listAgentCapabilities = tool({
        name: "list_agent_capabilities",
        description: "Lists all available agents and their capabilities, including available tools.",
        parameters: z.object({}),
        execute: async () => {
            return JSON.stringify({
                agents: [
                    {
                        name: "employee",
                        description: "Employee data and org structure specialist",
                        tools: ["list_employees", "find_employee_by_name"],
                    },
                    {
                        name: "analytics",
                        description: "Analytics and metrics specialist",
                        tools: [
                            "get_engagement_score",
                            "get_trend_summary",
                            "get_project_health",
                            "get_current_timestamp",
                        ],
                    },
                    {
                        name: "reporting",
                        description: "Report generation specialist",
                        tools: ["build_report"],
                    },
                    {
                        name: "approval",
                        description: "Approval workflow specialist",
                        tools: ["request_approval"],
                    },
                    {
                        name: "coordinator",
                        description: "Multi-agent orchestration for complex tasks",
                        handoffs: ["employee", "analytics", "reporting", "approval"],
                    },
                ],
                directTools: allTools.map((t) => t.name),
            });
        },
    });
    // Create handoffs to specialist agents
    const employeeHandoff = handoff(employeeAgent.agent, {
        toolNameOverride: "delegate_to_employee",
        toolDescriptionOverride: "Delegate to employee specialist for employee data, team info, and org structure queries.",
    });
    const analyticsHandoff = handoff(analyticsAgent.agent, {
        toolNameOverride: "delegate_to_analytics",
        toolDescriptionOverride: "Delegate to analytics specialist for metrics, trends, engagement scores, and project health.",
    });
    const reportingHandoff = handoff(reportingAgent.agent, {
        toolNameOverride: "delegate_to_reporting",
        toolDescriptionOverride: "Delegate to reporting specialist for generating reports and summaries.",
    });
    const approvalHandoff = handoff(approvalAgent.agent, {
        toolNameOverride: "delegate_to_approval",
        toolDescriptionOverride: "Delegate to approval specialist for approval workflows and risk assessments.",
    });
    const coordinatorHandoff = handoff(coordinatorAgent.agent, {
        toolNameOverride: "delegate_to_coordinator",
        toolDescriptionOverride: "Delegate to coordinator for complex multi-agent orchestration tasks.",
    });
    // Create main agent with all tools and handoffs
    const agent = Agent.create({
        name: "Main Agent",
        model: modelConfig.model,
        instructions: `You are the main orchestration agent with access to all tools and specialized agents.

Your capabilities:
1. DIRECT EXECUTION: Use tools directly for simple, single-domain tasks
2. DELEGATION: Use handoffs for complex tasks requiring domain expertise

Available direct tools:
- list_employees, find_employee_by_name: Employee data queries
- get_engagement_score, get_trend_summary, get_project_health, get_current_timestamp: Analytics
- build_report: Report generation
- request_approval: Approval workflows

Available agents for delegation:
- Employee Agent: Deep employee/org queries
- Analytics Agent: Complex analysis and trends
- Reporting Agent: Comprehensive report generation
- Approval Agent: Risk assessment and approval flows
- Coordinator Agent: Multi-step orchestration across domains

Decision guidelines:
- Simple queries (e.g., "list employees", "get timestamp"): Use tools directly
- Domain-specific complex queries: Delegate to the appropriate specialist
- Multi-domain tasks: Delegate to coordinator
- Use list_agent_capabilities to see full details

Always explain your approach when delegating.`,
        tools: [...allTools, listAgentCapabilities],
        handoffs: [
            employeeHandoff,
            analyticsHandoff,
            reportingHandoff,
            approvalHandoff,
            coordinatorHandoff,
        ],
    });
    return {
        name: "main-agent",
        description: "Main orchestration agent with access to all tools and specialized agents",
        agent,
        tools: [...allTools, listAgentCapabilities],
        async run(request) {
            const result = await run(agent, request);
            // Track delegation
            const delegatedTo = result.lastAgent?.name;
            const trace = ["main-agent"];
            if (delegatedTo && delegatedTo !== "Main Agent") {
                trace.push(delegatedTo.toLowerCase().replace(" agent", "-agent"));
            }
            return {
                output: String(result.finalOutput ?? ""),
                trace,
                delegatedTo,
                mode: delegatedTo && delegatedTo !== "Main Agent" ? "delegated" : "direct",
            };
        },
        async invoke(message) {
            const result = await this.run(message);
            return {
                content: result.output,
            };
        },
    };
}
