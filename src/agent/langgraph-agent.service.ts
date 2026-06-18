import { Injectable } from "@nestjs/common";
import { AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

type ModelProvider = "openai" | "ollama";

type ToolName = "none" | "get_time" | "echo";

interface AgentRunInput {
  prompt: string;
  provider?: ModelProvider;
  model?: string;
}

interface AgentRunOutput {
  provider: ModelProvider;
  model: string;
  response: string;
  selectedTool: ToolName;
  toolResult?: string;
}

const AgentState = Annotation.Root({
  prompt: Annotation<string>,
  provider: Annotation<ModelProvider>,
  model: Annotation<string>,
  selectedTool: Annotation<ToolName>,
  toolResult: Annotation<string | undefined>,
  response: Annotation<string>,
});

@Injectable()
export class LangGraphAgentService {
  private readonly workflow = this.buildWorkflow();

  async run(input: AgentRunInput): Promise<AgentRunOutput> {
    const provider = input.provider ?? this.getDefaultProvider();
    const model = input.model ?? this.getDefaultModel(provider);

    const result = await this.workflow.invoke({
      prompt: input.prompt,
      provider,
      model,
      selectedTool: "none",
      toolResult: undefined,
      response: "",
    });

    return {
      provider,
      model,
      response: result.response,
      selectedTool: result.selectedTool,
      toolResult: result.toolResult,
    };
  }

  private buildWorkflow() {
    return new StateGraph(AgentState)
      .addNode("route", async (state) => {
        const model = this.createModel(state.provider, state.model);
        const routingPrompt = [
          "You are a strict router.",
          "Choose exactly one tool from: none, get_time, echo.",
          "Return only the tool name.",
          `User request: ${state.prompt}`,
        ].join("\n");

        const message = await model.invoke(routingPrompt);
        const selectedTool = this.parseToolSelection(message.content);

        return { selectedTool };
      })
      .addNode("executeTool", async (state) => {
        const toolResult = this.executeTool(state.selectedTool, state.prompt);
        return { toolResult };
      })
      .addNode("respond", async (state) => {
        const model = this.createModel(state.provider, state.model);
        const replyPrompt = [
          "You are a helpful assistant.",
          state.toolResult
            ? `Tool output: ${state.toolResult}`
            : "No tool was used.",
          `User request: ${state.prompt}`,
          "Provide a concise answer.",
        ].join("\n");

        const message = await model.invoke(replyPrompt);
        return { response: this.readMessageContent(message) };
      })
      .addEdge(START, "route")
      .addConditionalEdges("route", (state) =>
        state.selectedTool === "none" ? "respond" : "executeTool",
      )
      .addEdge("executeTool", "respond")
      .addEdge("respond", END)
      .compile();
  }

  private createModel(
    provider: ModelProvider,
    modelName: string,
  ): BaseChatModel {
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required when provider=openai");
      }

      return new ChatOpenAI({
        apiKey,
        model: modelName,
        temperature: 0,
      });
    }

    return new ChatOllama({
      model: modelName,
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      temperature: 0,
    });
  }

  private executeTool(toolName: ToolName, prompt: string): string | undefined {
    if (toolName === "get_time") {
      return new Date().toISOString();
    }

    if (toolName === "echo") {
      return `echo:${prompt}`;
    }

    return undefined;
  }

  private parseToolSelection(content: AIMessage["content"]): ToolName {
    const text = this.contentToText(content).toLowerCase();
    if (text.includes("get_time")) {
      return "get_time";
    }
    if (text.includes("echo")) {
      return "echo";
    }
    return "none";
  }

  private readMessageContent(message: AIMessage): string {
    return this.contentToText(message.content).trim() || "(empty response)";
  }

  private contentToText(content: AIMessage["content"]): string {
    if (typeof content === "string") {
      return content;
    }

    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if ("text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join(" ");
  }

  private getDefaultProvider(): ModelProvider {
    const provider = process.env.MODEL_PROVIDER?.toLowerCase();
    return provider === "openai" ? "openai" : "ollama";
  }

  private getDefaultModel(provider: ModelProvider): string {
    if (provider === "openai") {
      return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    }

    return process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";
  }
}
