import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  Annotation,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { EmployeeAgent } from "./employee.agent.js";
import { AnalyticsAgent } from "./analytics.agent.js";
import { ReportingAgent } from "./reporting.agent.js";
import { ApprovalAgent } from "./approval.agent.js";
import { CoordinatorAgent } from "./coordinator.agent.js";
import { allTools } from "./tools.js";

// Main agent state - tracks routing, delegation, and execution trace
const MainAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentMode: Annotation<"direct" | "delegated">,
  delegatedTo: Annotation<string | undefined>,
  trace: Annotation<string[]>,
  metadata: Annotation<Record<string, unknown>>,
});

export interface MainAgentConfig {
  llm: BaseChatModel;
  employeeAgent: EmployeeAgent;
  analyticsAgent: AnalyticsAgent;
  reportingAgent: ReportingAgent;
  approvalAgent: ApprovalAgent;
  coordinatorAgent: CoordinatorAgent;
}

export function createMainAgent(config: MainAgentConfig) {
  const {
    llm,
    employeeAgent,
    analyticsAgent,
    reportingAgent,
    approvalAgent,
    coordinatorAgent,
  } = config;

  // Tool to delegate to a specialized agent
  const delegateToAgent = tool(
    async ({ targetAgent, task }) => {
      return JSON.stringify({ targetAgent, task });
    },
    {
      name: "delegate_to_agent",
      description: `Delegates a task to a specialized agent. Use this when the task requires domain expertise.
Available agents:
- employee: Employee data, team info, org structure queries
- analytics: Metrics, trends, engagement scores, project health analysis
- reporting: Generate structured reports and summaries
- approval: Approval workflows and risk assessments
- coordinator: Complex multi-agent orchestration tasks`,
      schema: z.object({
        targetAgent: z
          .enum([
            "employee",
            "analytics",
            "reporting",
            "approval",
            "coordinator",
          ])
          .describe("The specialist agent to delegate to"),
        task: z.string().describe("The specific task to perform"),
      }),
    },
  );

  // Tool to get agent capabilities
  const listAgentCapabilities = tool(
    async () => {
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
            tools: ["route_to_agent"],
          },
        ],
        directTools: [
          "list_employees",
          "find_employee_by_name",
          "get_engagement_score",
          "get_trend_summary",
          "get_project_health",
          "get_current_timestamp",
          "build_report",
          "request_approval",
        ],
      });
    },
    {
      name: "list_agent_capabilities",
      description:
        "Lists all available agents and their capabilities, including available tools.",
      schema: z.object({}),
    },
  );

  // Combine all tools: direct tools + delegation tools
  const mainAgentTools = [...allTools, delegateToAgent, listAgentCapabilities];

  const llmWithTools = llm.bindTools!(mainAgentTools);
  const toolNode = new ToolNode(allTools); // Direct tool execution

  // Main agent node - decides whether to use tools directly or delegate
  const mainAgentNode = async (state: typeof MainAgentState.State) => {
    const systemMessage = {
      role: "system",
      content: `You are the main orchestration agent with access to all tools and specialized agents.

Your capabilities:
1. DIRECT EXECUTION: Use tools directly for simple, single-domain tasks
2. DELEGATION: Use delegate_to_agent for complex tasks requiring domain expertise

Available direct tools:
- list_employees, find_employee_by_name: Employee data queries
- get_engagement_score, get_trend_summary, get_project_health, get_current_timestamp: Analytics
- build_report: Report generation
- request_approval: Approval workflows

Available agents for delegation:
- employee: Deep employee/org queries
- analytics: Complex analysis and trends
- reporting: Comprehensive report generation
- approval: Risk assessment and approval flows
- coordinator: Multi-step orchestration across domains

Decision guidelines:
- Simple queries (e.g., "list employees", "get timestamp"): Use tools directly
- Domain-specific complex queries: Delegate to the appropriate specialist
- Multi-domain tasks: Delegate to coordinator
- Always explain your approach when delegating

Use list_agent_capabilities to see full details of available resources.`,
    };

    const response = await llmWithTools.invoke([
      systemMessage,
      ...state.messages,
    ]);

    return {
      messages: [response],
      trace: [...state.trace, "main-agent"],
    };
  };

  // Handle delegation execution
  const delegationNode = async (state: typeof MainAgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (
      !("tool_calls" in lastMessage) ||
      !Array.isArray(lastMessage.tool_calls)
    ) {
      return {
        messages: [{ role: "assistant", content: "No delegation requested." }],
        trace: [...state.trace, "no-delegation"],
      };
    }

    const delegateCall = lastMessage.tool_calls.find(
      (tc: { name: string }) => tc.name === "delegate_to_agent",
    );

    if (!delegateCall) {
      return {
        messages: [{ role: "assistant", content: "No delegation found." }],
        trace: [...state.trace, "no-delegation"],
      };
    }

    const { targetAgent, task } = delegateCall.args as {
      targetAgent: string;
      task: string;
    };

    let result: { content: string };

    switch (targetAgent) {
      case "employee":
        result = await employeeAgent.invoke(task);
        break;
      case "analytics":
        result = await analyticsAgent.invoke(task);
        break;
      case "reporting":
        result = await reportingAgent.invoke(task);
        break;
      case "approval":
        result = await approvalAgent.invoke(task);
        break;
      case "coordinator":
        const coordResult = await coordinatorAgent.run(task);
        result = { content: coordResult.output };
        break;
      default:
        result = { content: `Unknown agent: ${targetAgent}` };
    }

    return {
      messages: [
        {
          role: "tool",
          content: JSON.stringify({
            targetAgent,
            task,
            result: result.content,
          }),
          tool_call_id: delegateCall.id,
        },
        {
          role: "assistant",
          content: `[Delegated to ${targetAgent} agent]\n\n${result.content}`,
        },
      ],
      currentMode: "delegated" as const,
      delegatedTo: targetAgent,
      trace: [...state.trace, `delegated-${targetAgent}`],
    };
  };

  // Routing function to determine next step
  const routeAfterAgent = (state: typeof MainAgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage || !("tool_calls" in lastMessage)) {
      return END;
    }

    const toolCalls = lastMessage.tool_calls as Array<{ name: string }>;
    if (!toolCalls || toolCalls.length === 0) {
      return END;
    }

    // Check if there's a delegation call
    const hasDelegation = toolCalls.some(
      (tc) => tc.name === "delegate_to_agent",
    );
    if (hasDelegation) {
      return "delegation";
    }

    // Check if there are direct tool calls
    const hasDirectTools = toolCalls.some((tc) =>
      allTools.some((t) => t.name === tc.name),
    );
    if (hasDirectTools) {
      return "tools";
    }

    // Handle list_agent_capabilities
    const hasCapabilitiesQuery = toolCalls.some(
      (tc) => tc.name === "list_agent_capabilities",
    );
    if (hasCapabilitiesQuery) {
      return "capabilities";
    }

    return END;
  };

  // Capabilities query node
  const capabilitiesNode = async (state: typeof MainAgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = (
      lastMessage as unknown as {
        tool_calls: Array<{ id: string; name: string }>;
      }
    ).tool_calls;
    const capCall = toolCalls?.find(
      (tc) => tc.name === "list_agent_capabilities",
    );

    if (!capCall) {
      return { messages: [], trace: state.trace };
    }

    const capabilities = await listAgentCapabilities.invoke({});

    return {
      messages: [
        {
          role: "tool",
          content: capabilities,
          tool_call_id: capCall.id,
        },
      ],
      trace: [...state.trace, "capabilities-query"],
    };
  };

  // Build the workflow
  const workflow = new StateGraph(MainAgentState)
    .addNode("main_agent", mainAgentNode)
    .addNode("tools", toolNode)
    .addNode("delegation", delegationNode)
    .addNode("capabilities", capabilitiesNode)
    .addEdge(START, "main_agent")
    .addConditionalEdges("main_agent", routeAfterAgent, {
      tools: "tools",
      delegation: "delegation",
      capabilities: "capabilities",
      [END]: END,
    })
    .addEdge("tools", "main_agent")
    .addEdge("delegation", END)
    .addEdge("capabilities", "main_agent");

  const compiledAgent = workflow.compile();

  return {
    name: "main-agent",
    description:
      "Main orchestration agent with access to all tools and specialized agents",
    tools: mainAgentTools,

    async run(request: string, metadata?: Record<string, unknown>) {
      const result = await compiledAgent.invoke({
        messages: [["user", request]],
        currentMode: "direct",
        delegatedTo: undefined,
        trace: [],
        metadata: metadata ?? {},
      });

      const lastMessage = result.messages[result.messages.length - 1];
      return {
        output:
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content),
        trace: result.trace,
        delegatedTo: result.delegatedTo,
        mode: result.currentMode,
        messages: result.messages,
      };
    },

    async stream(request: string, metadata?: Record<string, unknown>) {
      return compiledAgent.stream({
        messages: [["user", request]],
        currentMode: "direct",
        delegatedTo: undefined,
        trace: [],
        metadata: metadata ?? {},
      });
    },

    async invoke(message: string) {
      const result = await this.run(message);
      return {
        content: result.output,
        messages: result.messages,
      };
    },
  };
}

export type MainAgent = ReturnType<typeof createMainAgent>;
