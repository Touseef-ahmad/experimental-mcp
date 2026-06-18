#!/usr/bin/env npx ts-node --esm
/**
 * Interactive MCP CLI Client for testing agents
 *
 * Usage: npm run client
 *
 * Commands:
 *   list              - List available tools
 *   call <tool> [json] - Call a tool with optional JSON arguments
 *   health            - Quick health check
 *   main <prompt>     - Shortcut for main_agent
 *   help              - Show this help
 *   quit/exit         - Exit the client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as readline from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running from dist-scripts/scripts/, go up 2 levels to project root
const projectRoot = join(__dirname, "..", "..");

interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
}

class McpTestClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];
  private rl: readline.Interface;

  constructor() {
    this.client = new Client(
      { name: "mcp-test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async connect(): Promise<void> {
    console.log("🚀 Starting MCP server...\n");

    this.transport = new StdioClientTransport({
      command: "node",
      args: ["dist/main.js"],
      cwd: projectRoot,
      env: process.env as Record<string, string>,
    });

    await this.client.connect(this.transport);
    console.log("✅ Connected to MCP server\n");

    // Fetch available tools
    await this.refreshTools();
  }

  async refreshTools(): Promise<void> {
    const result = await this.client.listTools();
    this.tools = result.tools as Tool[];
    console.log(`📦 Found ${this.tools.length} tools\n`);
  }

  printTools(): void {
    console.log("\n📋 Available Tools:\n");
    for (const tool of this.tools) {
      console.log(`  ${tool.name}`);
      if (tool.description) {
        const desc = tool.description.split("\n")[0].slice(0, 70);
        console.log(
          `    └─ ${desc}${tool.description.length > 70 ? "..." : ""}`,
        );
      }
      if (tool.inputSchema?.properties) {
        const props = Object.keys(tool.inputSchema.properties);
        if (props.length > 0) {
          const required = tool.inputSchema.required || [];
          const params = props.map((p) => (required.includes(p) ? `${p}*` : p));
          console.log(`    └─ params: ${params.join(", ")}`);
        }
      }
      console.log();
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<void> {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) {
      console.log(
        `❌ Tool '${name}' not found. Use 'list' to see available tools.\n`,
      );
      return;
    }

    console.log(`\n🔧 Calling ${name}...`);
    if (Object.keys(args).length > 0) {
      console.log(`   Args: ${JSON.stringify(args)}`);
    }
    console.log();

    try {
      const start = Date.now();
      const result = await this.client.callTool({ name, arguments: args });
      const elapsed = Date.now() - start;

      console.log(`✅ Response (${elapsed}ms):\n`);

      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === "text") {
            try {
              const parsed = JSON.parse(item.text as string);
              // For main_agent responses, extract and format the output nicely
              if (parsed.output) {
                console.log("─".repeat(60));
                console.log(parsed.output);
                console.log("─".repeat(60));
                if (parsed.trace?.length > 0) {
                  console.log(`\n📍 Trace: ${parsed.trace.join(" → ")}`);
                }
              } else {
                // For other tools, show formatted JSON
                console.log(JSON.stringify(parsed, null, 2));
              }
            } catch {
              console.log(item.text);
            }
          } else {
            console.log(item);
          }
        }
      } else {
        console.log(result);
      }
      console.log();
    } catch (error) {
      console.log(
        `❌ Error: ${error instanceof Error ? error.message : error}\n`,
      );
    }
  }

  printHelp(): void {
    console.log(`
📖 MCP Test Client Commands:

  list                    List available tools
  call <tool> [json]      Call a tool with optional JSON arguments
  health                  Quick health check
  main <prompt>           Shortcut for main_agent
  agents                  List agents and capabilities
  examples                Show example queries
  refresh                 Refresh tool list
  help                    Show this help
  quit, exit              Exit the client

Quick Examples:
  > main List all employees
  > main Get engagement score for the Platform team
  > health
`);
  }

  printExamples(): void {
    console.log(`
📝 Example Queries for main_agent:

Employee Queries:
  > main List all employees
  > main Find employee named Ava
  > main Who is on the Platform team?
  > main Who manages Noah?

Analytics Queries:
  > main Get engagement score for the Data team
  > main What's the trend for productivity?
  > main Check project health for Alpha Project
  > main What time is it?

Reporting Queries:
  > main Create a report titled "Q2 Summary" with key points about sales growth and team expansion

Approval Queries:
  > main Request approval for budget increase with medium risk

Multi-step Queries:
  > main List all employees and get engagement scores for each team
  > main Find Mia and check her team's project health
`);
  }

  async processCommand(input: string): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed) return true;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case "quit":
      case "exit":
        return false;

      case "help":
      case "?":
        this.printHelp();
        break;

      case "examples":
      case "ex":
        this.printExamples();
        break;

      case "list":
      case "ls":
      case "tools":
        this.printTools();
        break;

      case "refresh":
        await this.refreshTools();
        break;

      case "health":
        await this.callTool("health");
        break;

      case "agents":
        await this.callTool("list_agents");
        break;

      case "main": {
        const prompt = parts.slice(1).join(" ");
        if (!prompt) {
          console.log("❌ Usage: main <prompt>\n");
        } else {
          await this.callTool("main_agent", { prompt });
        }
        break;
      }

      case "call": {
        const toolName = parts[1];
        if (!toolName) {
          console.log("❌ Usage: call <tool> [json_args]\n");
          break;
        }

        let args: Record<string, unknown> = {};
        const jsonPart = parts.slice(2).join(" ");
        if (jsonPart) {
          try {
            args = JSON.parse(jsonPart);
          } catch {
            console.log("❌ Invalid JSON arguments\n");
            break;
          }
        }

        await this.callTool(toolName, args);
        break;
      }

      default:
        // Treat unknown commands as prompts to main_agent
        await this.callTool("main_agent", { prompt: trimmed });
        break;
    }

    return true;
  }

  async run(): Promise<void> {
    console.log("\n🤖 MCP Test Client");
    console.log("   Type 'help' for commands, 'quit' to exit\n");

    try {
      await this.connect();
    } catch (error) {
      console.error("❌ Failed to connect to MCP server:", error);
      console.log("\n💡 Make sure to build first: npm run build\n");
      process.exit(1);
    }

    const prompt = (): void => {
      this.rl.question("mcp> ", async (input) => {
        const shouldContinue = await this.processCommand(input);
        if (shouldContinue) {
          prompt();
        } else {
          await this.shutdown();
        }
      });
    };

    prompt();

    // Handle Ctrl+C
    this.rl.on("close", async () => {
      await this.shutdown();
    });
  }

  async shutdown(): Promise<void> {
    console.log("\n👋 Goodbye!\n");
    await this.client.close();
    process.exit(0);
  }
}

// Run the client
const client = new McpTestClient();
client.run().catch(console.error);
