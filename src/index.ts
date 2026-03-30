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

const SUPPORTED_CABINS = ["economy", "premium", "business", "first"] as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. Initialize the official MCP Server
    const server = new McpServer({
      name: "seats-aero",
      version: "1.0.0"
    });

    // 2. GET ROUTES TOOL
    server.tool(
      "get_routes",
      "Retrieve a list of route objects from one specific mileage program.",
      {
        source: z.enum(SUPPORTED_SOURCES).describe("The frequent flyer program to search."),
      },
      async ({ source }) => {
        const response = await fetch(`https://seats.aero/api/v1/routes?source=${source}`, {
          headers: {
            "Partner-Authorization": env.SEATS_API_KEY,
            "Accept": "application/json"
          },
        });
        if (!response.ok) return { content: [{ type: "text", text: `Error: ${response.statusText}` }], isError: true };
        const data = await response.json();
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      }
    );

    // 3. GET FLIGHTS TOOL
    server.tool(
      "get_flights",
      "Get a list of specific flights using cached search parameters.",
      {
        source: z.enum(SUPPORTED_SOURCES).describe("The frequent flyer program to search."),
        origin_airport: z.string().describe("3-letter origin airport code (e.g., JFK)"),
        destination_airport: z.string().describe("3-letter destination airport code (e.g., LHR)"),
        cabin: z.enum(SUPPORTED_CABINS).optional().describe("Cabin class"),
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format"),
        direct: z.boolean().optional().describe("Set to true to only show direct flights")
      },
      async (args) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined) params.append(key, String(value));
        }

        const response = await fetch(`https://seats.aero/api/v1/search?${params.toString()}`, {
          headers: {
            "Partner-Authorization": env.SEATS_API_KEY,
            "Accept": "application/json"
          },
        });
        if (!response.ok) return { content: [{ type: "text", text: `Error: ${response.statusText}` }], isError: true };
        const data = await response.json();
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      }
    );

    // 4. GET BULK AVAILABILITY TOOL
    server.tool(
      "get_bulk_avail",
      "Retrieve a large amount of availability objects from one specific mileage program.",
      {
        source: z.enum(SUPPORTED_SOURCES).describe("The frequent flyer program to search."),
        cursor: z.string().optional().describe("Cursor for pagination"),
        take: z.number().optional().describe("Number of results to return (default 1000)")
      },
      async ({ source, cursor, take }) => {
        const params = new URLSearchParams();
        params.append("source", source);
        if (cursor) params.append("cursor", cursor);
        if (take) params.append("take", String(take));

        const response = await fetch(`https://seats.aero/api/v1/availability?${params.toString()}`, {
          headers: {
            "Partner-Authorization": env.SEATS_API_KEY,
            "Accept": "application/json"
          },
        });
        if (!response.ok) return { content: [{ type: "text", text: `Error: ${response.statusText}` }], isError: true };
        const data = await response.json();
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      }
    );

    // 5. Wrap it in Cloudflare's edge handler
    const handler = createMcpHandler(server);
    return handler(request, env, ctx);
  },
};
