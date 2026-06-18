import "reflect-metadata";
import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { McpServerService } from "./mcp/mcp-server.service.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  const mcpServer = app.get(McpServerService);
  const logger = new Logger("Bootstrap");

  // Check transport mode from environment or CLI args
  const useHttp =
    process.env.MCP_TRANSPORT === "http" || process.argv.includes("--http");
  const port = parseInt(process.env.MCP_PORT ?? "3000", 10);

  if (useHttp) {
    await mcpServer.startHttp(port);
    logger.log(`NestJS MCP server is running on http://localhost:${port}`);
  } else {
    await mcpServer.start();
    logger.log("NestJS MCP server is running on stdio transport");
  }

  const shutdown = async (): Promise<void> => {
    logger.log("Shutting down MCP server...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  logger.error("Failed to start application", error as Error);
  process.exit(1);
});
