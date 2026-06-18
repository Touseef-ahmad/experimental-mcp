import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  Annotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { StructuredToolInterface } from "@langchain/core/tools";

// Tool definitions
const EMPLOYEES = [
  { id: "e-100", name: "Ava", team: "Platform", manager: "Sam" },
  { id: "e-101", name: "Noah", team: "Data", manager: "Lee" },
  { id: "e-102", name: "Mia", team: "Product", manager: "Zoe" },
  { id: "e-103", name: "Liam", team: "Security", manager: "Tia" },
];

// Employee tools
const listEmployees = tool(async () => JSON.stringify(EMPLOYEES), {
  name: "list_employees",
  description: "Lists all employees in the organization.",
  schema: z.object({}),
});

const findEmployeeByName = tool(
  async ({ name }) => {
    const employee = EMPLOYEES.find(
      (e) => e.name.toLowerCase() === name.toLowerCase(),
    );
    return employee
      ? JSON.stringify(employee)
      : `No employee found with name: ${name}`;
  },
  {
    name: "find_employee_by_name",
    description: "Finds an employee by their exact name.",
    schema: z.object({
      name: z.string().describe("The employee name to search for"),
    }),
  },
);

// Analytics tools
const getEngagementScore = tool(
  async ({ teamOrEmployee }) => {
    let score = 0;
    for (const char of teamOrEmployee) {
      score += char.charCodeAt(0);
    }
    const finalScore = 40 + (score % 61);
    return `Engagement score for "${teamOrEmployee}": ${finalScore}/100`;
  },
  {
    name: "get_engagement_score",
    description: "Calculates the engagement score for a team or employee.",
    schema: z.object({
      teamOrEmployee: z.string().describe("Name of the team or employee"),
    }),
  },
);

const getTrendSummary = tool(
  async ({ topic }) => {
    const trends = ["upward", "stable", "slightly down"];
    const index = topic.length % trends.length;
    return `Trend for "${topic}": ${trends[index]} this week`;
  },
  {
    name: "get_trend_summary",
    description: "Gets the trend summary for a given topic or metric.",
    schema: z.object({
      topic: z.string().describe("The topic or metric to analyze"),
    }),
  },
);

const getProjectHealth = tool(
  async ({ projectName }) => {
    const statuses = ["green", "amber", "red"];
    const index = projectName.length % 3;
    return `Project "${projectName}" health status: ${statuses[index]}`;
  },
  {
    name: "get_project_health",
    description: "Gets the health status of a project.",
    schema: z.object({
      projectName: z.string().describe("Name of the project"),
    }),
  },
);

const getCurrentTimestamp = tool(
  async () => `Current timestamp: ${new Date().toISOString()}`,
  {
    name: "get_current_timestamp",
    description: "Gets the current UTC timestamp.",
    schema: z.object({}),
  },
);

// Reporting tools
const buildReport = tool(
  async ({ title, keyPoints }) => {
    const report = {
      title,
      summary: `Report generated from ${keyPoints.length} key point(s).`,
      keyPoints,
      riskLevel: keyPoints.length > 3 ? "medium" : "low",
      generatedAt: new Date().toISOString(),
    };
    return JSON.stringify(report);
  },
  {
    name: "build_report",
    description: "Builds a structured report with title and key points.",
    schema: z.object({
      title: z.string().describe("The report title"),
      keyPoints: z.array(z.string()).describe("Array of key points to include"),
    }),
  },
);

// Approval tools
const requestApproval = tool(
  async ({ context, riskLevel }) => {
    const autoApprove = riskLevel === "low";
    const decision = {
      status: autoApprove ? "approved" : "pending_review",
      reviewer: autoApprove ? "auto-approver" : "human-reviewer",
      reason: autoApprove
        ? "Low risk - automatically approved"
        : "Requires human review due to risk level",
      context,
      riskLevel,
    };
    return JSON.stringify(decision);
  },
  {
    name: "request_approval",
    description:
      "Requests approval for an action based on context and risk level.",
    schema: z.object({
      context: z.string().describe("Description of what needs approval"),
      riskLevel: z
        .enum(["low", "medium", "high"])
        .describe("Risk level of the action"),
    }),
  },
);

// Tool collections
const employeeTools = [listEmployees, findEmployeeByName];
const analyticsTools = [
  getEngagementScore,
  getTrendSummary,
  getProjectHealth,
  getCurrentTimestamp,
];
const reportingTools = [buildReport];
const approvalTools = [requestApproval];
const allTools = [
  ...employeeTools,
  ...analyticsTools,
  ...reportingTools,
  ...approvalTools,
];

// Main agent state
const MainAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentMode: Annotation<"direct" | "delegated">,
  trace: Annotation<string[]>,
});

export interface MainAgentRunInput {
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface MainAgentRunOutput {
  output: string;
  trace: string[];
  mode: "direct" | "delegated";
}

type ModelProvider = "openai" | "ollama";

@Injectable()
export class MainAgentService implements OnModuleInit {
  private workflow!: ReturnType<typeof this.buildWorkflow>;

  onModuleInit() {
    this.workflow = this.buildWorkflow();
  }

  async run(input: MainAgentRunInput): Promise<MainAgentRunOutput> {
    const result = await this.workflow.invoke({
      messages: [["user", input.prompt]],
      currentMode: "direct",
      trace: [],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    return {
      output:
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content),
      trace: result.trace,
      mode: result.currentMode,
    };
  }

  getAgentInfo() {
    return {
      name: "main-agent",
      description: "Main orchestration agent with access to all tools",
      toolRegistry: {
        employee: employeeTools.map((t) => t.name),
        analytics: analyticsTools.map((t) => t.name),
        reporting: reportingTools.map((t) => t.name),
        approval: approvalTools.map((t) => t.name),
      },
    };
  }

  private buildWorkflow() {
    const llm = this.createModel();

    // List capabilities tool
    const listCapabilities = tool(
      async () => {
        return JSON.stringify({
          agents: ["employee", "analytics", "reporting", "approval"],
          tools: {
            employee: ["list_employees", "find_employee_by_name"],
            analytics: [
              "get_engagement_score",
              "get_trend_summary",
              "get_project_health",
              "get_current_timestamp",
            ],
            reporting: ["build_report"],
            approval: ["request_approval"],
          },
        });
      },
      {
        name: "list_capabilities",
        description: "Lists all available agent capabilities and tools.",
        schema: z.object({}),
      },
    );

    const mainTools: StructuredToolInterface[] = [
      ...allTools,
      listCapabilities,
    ];
    const llmWithTools = llm.bindTools!(mainTools);
    const toolNode = new ToolNode(mainTools);

    const agentNode = async (state: typeof MainAgentState.State) => {
      const systemMessage = {
        role: "system",
        content: `You are the main orchestration agent with access to all organizational tools.

Available tools:
- list_employees, find_employee_by_name: Employee data queries
- get_engagement_score, get_trend_summary, get_project_health, get_current_timestamp: Analytics
- build_report: Report generation
- request_approval: Approval workflows
- list_capabilities: Show all available capabilities

Answer user queries by using the appropriate tools. For complex queries, combine multiple tools.`,
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

    const routeAfterAgent = (state: typeof MainAgentState.State) => {
      const lastMessage = state.messages[state.messages.length - 1];

      if (!lastMessage || !("tool_calls" in lastMessage)) {
        return END;
      }

      const toolCalls = lastMessage.tool_calls as
        | Array<{ name: string }>
        | undefined;
      if (!toolCalls || toolCalls.length === 0) {
        return END;
      }

      return "tools";
    };

    return new StateGraph(MainAgentState)
      .addNode("agent", agentNode)
      .addNode("tools", toolNode)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", routeAfterAgent, {
        tools: "tools",
        [END]: END,
      })
      .addEdge("tools", "agent")
      .compile();
  }

  private createModel(): BaseChatModel {
    const provider = (process.env.MODEL_PROVIDER ?? "ollama") as ModelProvider;

    if (provider === "openai") {
      return new ChatOpenAI({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0,
      });
    }

    return new ChatOllama({
      model: process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      temperature: 0,
    });
  }
}
