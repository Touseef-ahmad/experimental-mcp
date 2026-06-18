import { Injectable, OnModuleInit } from "@nestjs/common";
import { createAgents } from "../../agents/agent.factory.js";

@Injectable()
export class AgentService implements OnModuleInit {
  private mainAgent!: ReturnType<typeof createAgents>["main"];
  private toolRegistry!: ReturnType<typeof createAgents>["toolRegistry"];
  private modelConfig!: ReturnType<typeof createAgents>["modelConfig"];

  onModuleInit() {
    const agents = createAgents();
    this.mainAgent = agents.main;
    this.toolRegistry = agents.toolRegistry;
    this.modelConfig = agents.modelConfig;
  }

  async run(input: { prompt: string }) {
    const result = await this.mainAgent.run(input.prompt);
    return {
      output: result.output,
      trace: result.trace,
      mode: result.mode,
      delegatedTo: result.delegatedTo,
    };
  }

  getAgentInfo() {
    return {
      name: this.mainAgent.name,
      description: this.mainAgent.description,
      model: this.modelConfig.model,
      tools: this.toolRegistry,
    };
  }

  getModelConfig() {
    return this.modelConfig;
  }
}
