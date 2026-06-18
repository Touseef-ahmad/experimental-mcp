import { Module } from "@nestjs/common";
import { AgentModule } from "./agent/agent.module.js";
import { McpModule } from "./mcp/mcp.module.js";

@Module({
  imports: [AgentModule, McpModule],
})
export class AppModule {}
