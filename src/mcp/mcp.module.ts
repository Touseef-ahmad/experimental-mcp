import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module.js";
import { McpServerService } from "./mcp-server.service.js";

@Module({
  imports: [AgentModule],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpModule {}
