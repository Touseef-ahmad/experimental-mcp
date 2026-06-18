import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LangGraphAgentService } from "../agent/langgraph-agent.service.js";
import { MainAgentService } from "../agent/main-agent.service.js";

@Injectable()
export class McpServerService implements OnModuleDestroy {
  private readonly logger = new Logger(McpServerService.name);
  private readonly mcpServer = new McpServer({
    name: "nestjs-langgraph-mcp",
    version: "0.1.0",
  });
  private transport?: StdioServerTransport;

  constructor(
    private readonly agent: LangGraphAgentService,
    private readonly mainAgent: MainAgentService,
  ) {
    this.registerTools();
  }

  async start(): Promise<void> {
    if (this.transport) {
      return;
    }

    this.transport = new StdioServerTransport();
    await this.mcpServer.connect(this.transport);
    this.logger.log("MCP server connected via stdio");
  }

  async onModuleDestroy(): Promise<void> {
    await this.mcpServer.close();
  }

  private registerTools(): void {
    // Main agent - the primary entry point for clients
    this.mcpServer.registerTool(
      "main_agent",
      {
        title: "Main Agent",
        description: `The main orchestration agent that can handle any request by leveraging all available tools.

Capabilities:
- Direct tool execution for queries
- Employee data: list employees, find by name
- Analytics: engagement scores, trends, project health, timestamps
- Reporting: structured report generation
- Approval: risk assessment and approval workflows

Use this as the primary interface for all requests.`,
        inputSchema: {
          prompt: z.string().describe("The user request to process"),
        },
      },
      async (args) => {
        const result = await this.mainAgent.run({ prompt: args.prompt });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  output: result.output,
                  trace: result.trace,
                  mode: result.mode,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // List available agents and their capabilities
    this.mcpServer.registerTool(
      "list_agents",
      {
        title: "List Available Agents",
        description:
          "Returns information about all available agents and their tools.",
      },
      async () => {
        const info = this.mainAgent.getAgentInfo();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  mainAgent: info,
                  availableTools: {
                    main_agent: "Primary entry point for all requests",
                    list_agents: "List agent capabilities",
                    run_agent: "Legacy agent with provider selection",
                    health: "Health check endpoint",
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // Legacy run_agent tool for backward compatibility
    this.mcpServer.registerTool(
      "run_agent",
      {
        title: "Run LangGraph Agent",
        description:
          "Runs a LangGraph-orchestrated NestJS agent with optional provider/model selection.",
        inputSchema: {
          prompt: z.string().describe("User request to process"),
          provider: z
            .enum(["openai", "ollama"])
            .optional()
            .describe("Model provider"),
          model: z.string().optional().describe("Model name override"),
        },
      },
      async (args) => {
        const result = await this.agent.run({
          prompt: args.prompt,
          provider: args.provider,
          model: args.model,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.registerTool(
      "health",
      {
        title: "Health Check",
        description:
          "Returns basic server status and default model configuration.",
      },
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                service: "nestjs-langgraph-mcp",
                defaultProvider: process.env.MODEL_PROVIDER ?? "ollama",
                defaultOpenAIModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
                defaultOllamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b",
                availableTools: [
                  "main_agent",
                  "list_agents",
                  "run_agent",
                  "health",
                ],
              },
              null,
              2,
            ),
          },
        ],
      }),
    );
  }
}
