# NestJS + LangGraph MCP POC

A simple proof-of-concept MCP server built with NestJS, using LangGraph as the orchestration layer for tool execution and agent workflows.

## Features

- NestJS application context (no HTTP server required)
- MCP server over stdio transport
- LangGraph `StateGraph` workflow with nodes:
  - `route` (model-based tool routing)
  - `executeTool` (executes selected tool)
  - `respond` (final answer generation)
- Model provider switch:
  - OpenAI (`@langchain/openai`)
  - Ollama local model (`@langchain/ollama`, default `qwen2.5:1.5b`)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Build and run:

```bash
npm run build
npm start
```

The MCP server starts on stdio.

## Model Selection

Default provider is read from `MODEL_PROVIDER`.

- Use OpenAI:
  - `MODEL_PROVIDER=openai`
  - set `OPENAI_API_KEY`
  - optional `OPENAI_MODEL` (default `gpt-4o-mini`)

- Use Ollama qwen2.5:1.5b:
  - `MODEL_PROVIDER=ollama`
  - run Ollama locally and pull model:

```bash
ollama pull qwen2.5:1.5b
```

- optional `OLLAMA_BASE_URL` and `OLLAMA_MODEL`

You can override provider/model per MCP tool call (`run_agent`).

## MCP Tools

- `health`: returns server status and default model config
- `run_agent`: runs the LangGraph workflow
  - input:
    - `prompt` (string, required)
    - `provider` (`openai` or `ollama`, optional)
    - `model` (string, optional)

## Example MCP Client Config (Claude Desktop style)

```json
{
  "mcpServers": {
    "nestjs-langgraph": {
      "command": "node",
      "args": ["/absolute/path/to/langraph-mcp/dist/main.js"],
      "env": {
        "MODEL_PROVIDER": "ollama",
        "OLLAMA_BASE_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "qwen2.5:1.5b"
      }
    }
  }
}
```

## LangGraph Demo Suite

This repo includes agents and tools built using proper LangGraph.js patterns:

- **Tools**: Defined using `tool()` from `@langchain/core/tools` with Zod schemas
- **Agents**: Built with `createReactAgent` or custom `StateGraph` with `MessagesAnnotation`
- **Tool Execution**: Uses `ToolNode` and `toolsCondition` from `@langchain/langgraph/prebuilt`
- **LLM Binding**: Tools bound to LLM via `.bindTools(tools)`

### Demo Capabilities

| Demo          | Capability                              |
| ------------- | --------------------------------------- |
| 01-reasoning  | Basic StateGraph workflow               |
| 02-parallel   | Parallel tool calls via ToolNode        |
| 03-handoffs   | Agent-to-agent handoffs via coordinator |
| 04-hitl       | Human-in-the-loop approval workflow     |
| 05-structured | Structured output with Zod validation   |
| 06-tracing    | Execution tracing through graph         |
| 07-discovery  | Tool discovery and registry             |
| 08-planning   | Multi-step planning loop                |
| 09-failure    | Error handling and retry                |
| 10-local      | Local Ollama model integration          |

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
└── model.config.ts
```

### Prerequisites

Ensure Ollama is running with a **tool-capable** model:

```bash
# qwen2.5:1.5b supports tool calling (recommended)
ollama pull qwen2.5:1.5b
ollama serve
```

**Note:** Models like `qwen2.5:1.5b` do not support tool calling. Use `qwen2.5:1.5b`, `llama3.1`, `mistral`, or `qwen2.5` for full demo functionality.

Run all demos:

```bash
npm run demo
```

Run one demo:

```bash
npm run demo:one -- 03
```

Optional HITL switch for demo 04:

```bash
DEMO_REVIEW_DECISION=approved npm run demo:one -- 04
```
