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

// Coordinator state extends messages with routing info
const CoordinatorState = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentAgent: Annotation<string>,
  trace: Annotation<string[]>,
});

export function createCoordinatorAgent(
  llm: BaseChatModel,
  employeeAgent: EmployeeAgent,
  analyticsAgent: AnalyticsAgent,
  reportingAgent: ReportingAgent,
  approvalAgent: ApprovalAgent,
) {
  // Router tool - LLM decides which specialist agent to use
  const routeToAgent = tool(
    async ({ targetAgent, task }) => {
      return JSON.stringify({ targetAgent, task });
    },
    {
      name: "route_to_agent",
      description:
        "Routes a task to a specialist agent. Use this to delegate work.",
      schema: z.object({
        targetAgent: z
          .enum(["employee", "analytics", "reporting", "approval"])
          .describe("The specialist agent to route to"),
        task: z.string().describe("The specific task to perform"),
      }),
    },
  );

  const coordinatorTools = [routeToAgent];
  const llmWithTools = llm.bindTools!(coordinatorTools);

  // Main coordinator node - decides routing
  const coordinatorNode = async (state: typeof CoordinatorState.State) => {
    const systemMessage = {
      role: "system",
      content: `You are a coordinator agent. Analyze the user request and route to the appropriate specialist:
- employee: For employee data, team info, org structure
- analytics: For metrics, trends, engagement scores, project health
- reporting: For generating reports and summaries
- approval: For approval workflows and risk assessments

Use the route_to_agent tool to delegate tasks.`,
    };

    const response = await llmWithTools.invoke([
      systemMessage,
      ...state.messages,
    ]);

    return {
      messages: [response],
      trace: [...state.trace, "coordinator"],
    };
  };

  // Process the routing decision and execute specialist agent
  const executeSpecialistNode = async (
    state: typeof CoordinatorState.State,
  ) => {
    const lastMessage = state.messages[state.messages.length - 1];

    // Extract tool call result
    if (
      !("tool_calls" in lastMessage) ||
      !Array.isArray(lastMessage.tool_calls)
    ) {
      return {
        messages: [{ role: "assistant", content: "No routing decision made." }],
        trace: [...state.trace, "no-route"],
      };
    }

    const toolCall = lastMessage.tool_calls[0];
    if (!toolCall || toolCall.name !== "route_to_agent") {
      return {
        messages: [{ role: "assistant", content: "Invalid routing." }],
        trace: [...state.trace, "invalid-route"],
      };
    }

    const { targetAgent, task } = toolCall.args as {
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
      default:
        result = { content: `Unknown agent: ${targetAgent}` };
    }

    return {
      messages: [
        {
          role: "tool",
          content: JSON.stringify({ targetAgent, task }),
          tool_call_id: toolCall.id,
        },
        { role: "assistant", content: result.content },
      ],
      currentAgent: targetAgent,
      trace: [...state.trace, `${targetAgent}-agent`],
    };
  };

  const workflow = new StateGraph(CoordinatorState)
    .addNode("coordinator", coordinatorNode)
    .addNode("execute_specialist", executeSpecialistNode)
    .addEdge(START, "coordinator")
    .addConditionalEdges("coordinator", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (
        lastMessage &&
        "tool_calls" in lastMessage &&
        Array.isArray(lastMessage.tool_calls) &&
        lastMessage.tool_calls.length > 0
      ) {
        return "execute_specialist";
      }
      return END;
    })
    .addEdge("execute_specialist", END);

  const compiledAgent = workflow.compile();

  return {
    name: "coordinator-agent",
    async run(request: string) {
      const result = await compiledAgent.invoke({
        messages: [["user", request]],
        currentAgent: "",
        trace: [],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      return {
        output:
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content),
        trace: result.trace,
        messages: result.messages,
      };
    },
  };
}

export type CoordinatorAgent = ReturnType<typeof createCoordinatorAgent>;
