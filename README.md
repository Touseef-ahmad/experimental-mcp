# NestJS + OpenAI Agents SDK MCP POC

A proof-of-concept MCP server built with NestJS, using the **OpenAI Agents SDK** for agent orchestration, tool execution, and multi-agent workflows.

> **Migration Note**: This project was migrated from LangGraph/LangChain to OpenAI Agents SDK (`@openai/agents`).

## Features

- NestJS application context (no HTTP server required)
- MCP server over stdio transport
- **OpenAI Agents SDK** for agent workflows:
  - `Agent` with built-in agent loop
  - `handoff()` for multi-agent delegation
  - `tool()` for function tool definitions
  - `needsApproval` for human-in-the-loop
- OpenAI models (gpt-4o-mini by default)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
# Set OPENAI_API_KEY in .env
```

3. Build and run:

```bash
npm run build
npm start
```

The MCP server starts on stdio.

## Model Configuration

Set your OpenAI API key and optionally configure the model:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # optional, defaults to gpt-4o-mini
```

## MCP Tools

- `health`: returns server status and model config
- `run_agent`: runs the agent workflow
  - input:
    - `prompt` (string, required)

## Example MCP Client Config (Claude Desktop style)

```json
{
  "mcpServers": {
    "nestjs-openai-agents": {
      "command": "node",
      "args": ["/absolute/path/to/langraph-mcp/dist/main.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## OpenAI Agents SDK Demo Suite

This repo includes agents and tools built using OpenAI Agents SDK patterns:

- **Tools**: Defined using `tool()` from `@openai/agents` with Zod schemas
- **Agents**: Built with `new Agent({ name, instructions, tools, handoffs })`
- **Handoffs**: Multi-agent delegation via `handoff()` helper
- **HITL**: Human-in-the-loop via `needsApproval` and `interruptions`

### Demo Capabilities

| Demo          | Capability                              |
| ------------- | --------------------------------------- |
| 01-reasoning  | Basic agent invocation                  |
| 02-parallel   | Parallel tool calls                     |
| 03-handoffs   | Agent-to-agent handoffs                 |
| 04-hitl       | Human-in-the-loop approval workflow     |
| 05-structured | Structured output with Zod validation   |
| 06-tracing    | Execution tracing                       |
| 07-discovery  | Tool discovery and registry             |
| 08-planning   | Multi-step planning with tools          |
| 09-failure    | Error handling and retry                |
| 10-model      | Model configuration demo                |

### Project Layout

```text
demos/
├── demo-runner.ts
├── 01-reasoning.demo.ts
├── 02-parallel.demo.ts
├── 03-handoffs.demo.ts
├── 04-hitl.demo.ts
├── 05-structured-output.demo.ts
├── 06-tracing.demo.ts
├── 07-tool-discovery.demo.ts
├── 08-multi-step-planning.demo.ts
├── 09-failure-handling.demo.ts
├── 10-local-model.demo.ts
└── utils/demo-utils.ts

agents/
├── agent.factory.ts
├── tools.ts
├── coordinator.agent.ts
├── employee.agent.ts
├── analytics.agent.ts
├── reporting.agent.ts
├── approval.agent.ts
├── main.agent.ts
└── model.config.ts
```

### Prerequisites

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=sk-...
```

Run all demos:

```bash
npm run demo
```

Run one demo:

```bash
npm run demo:one -- --demo=03
```

### Key API Patterns

**Tool Definition:**
```typescript
import { tool } from "@openai/agents";
import { z } from "zod";

const myTool = tool({
  name: "my_tool",
  description: "Does something useful",
  parameters: z.object({
    param: z.string().describe("A parameter"),
  }),
  execute: async ({ param }) => {
    return `Result for ${param}`;
  },
});
```

**Agent Creation:**
```typescript
import { Agent, run } from "@openai/agents";

const agent = new Agent({
  name: "My Agent",
  model: "gpt-4o-mini",
  instructions: "You are a helpful assistant.",
  tools: [myTool],
});

const result = await run(agent, "User message");
console.log(result.finalOutput);
```

**Handoffs:**
```typescript
import { Agent, handoff } from "@openai/agents";

const specialist = new Agent({ name: "Specialist", ... });
const mainAgent = Agent.create({
  name: "Main",
  handoffs: [handoff(specialist)],
});
```

**Human-in-the-loop:**
```typescript
const sensitiveTool = tool({
  name: "sensitive_action",
  needsApproval: true,  // or async function
  execute: async () => { ... },
});

const result = await run(agent, message);
if (result.interruptions?.length > 0) {
  // Handle approval
  result.state.approve(result.interruptions[0]);
  const resumed = await run(agent, result.state);
}
```

## Migration from LangGraph

This project was migrated from LangGraph/LangChain to OpenAI Agents SDK:

| LangGraph Pattern | OpenAI Agents SDK |
|-------------------|-------------------|
| `StateGraph` + nodes | `Agent` with built-in loop |
| `createAgent()` | `new Agent({ ... })` |
| `tool()` from @langchain/core | `tool()` from @openai/agents |
| `ToolNode` + routing | Automatic tool handling |
| Manual HITL nodes | `needsApproval` + `interruptions` |
| Custom routing | `handoff()` helper |

> **Note**: OpenAI Agents SDK is optimized for OpenAI models. For local model support (Ollama), consider maintaining a separate LangChain setup or using OpenAI-compatible local servers.
