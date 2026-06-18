import { Module } from "@nestjs/common";
import { LangGraphAgentService } from "./langgraph-agent.service.js";
import { MainAgentService } from "./main-agent.service.js";

@Module({
  providers: [LangGraphAgentService, MainAgentService],
  exports: [LangGraphAgentService, MainAgentService],
})
export class AgentModule {}
