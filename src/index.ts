import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface Env {
  SEATS_API_KEY: string;
}

const SUPPORTED_SOURCES = [
  "aeromexico", "aeroplan", "alaska", "american", "delta", 
  "emirates", "etihad", "flyingblue", "lifemiles", "qantas", 
  "smiles", "velocity", "virginatlantic"
] as const;

// 1. Initialize the MCP Server
const server = new McpServer({
  name: "Seats Aero Cloudflare MCP",
  version: "1.0.0",
});

// 2. Export the standard Cloudflare Fetch Handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // createMcpHandler automatically handles the /mcp SSE connections
    const handler = getMcpApiHandler(env);
    return handler(request, env, ctx);
  }
};

// Helper to inject the environment
function getMcpApiHandler(env: Env) {
  return createMcpHandler({
    server,
    // Optionally log requests for debugging
    onConnect: () => console.log("MCP Client connected!"),
  });
}
