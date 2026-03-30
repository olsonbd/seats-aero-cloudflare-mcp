import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface Env {
  SEATS_API_KEY: string;
  // Cloudflare Access and the OAuth handle security.
}

const SUPPORTED_SOURCES = [
  "aeromexico", "aeroplan", "alaska", "american", "delta", 
  "emirates", "etihad", "flyingblue", "lifemiles", "qantas", 
  "smiles", "velocity", "virginatlantic"
] as const;

const SUPPORTED_CABINS = ["economy", "premium", "business", "first"] as const;

// 1. Wraps the server in a function so it can access environment variables
function getMcpApiHandler(env: Env) {
  const server = new McpServer({
    name: "seats-aero",
    version: "1.0.0"
  });

  server.tool(
    "get_routes",
    "Retrieve a list of route objects from one specific mileage program.",
    { source: z.enum(SUPPORTED_SOURCES).describe("The frequent flyer program to search.") },
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

  return createMcpHandler(server);
}

// 2. Exports the OAuth Provider as the default fetch handler
export default new OAuthProvider({
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  
  // Must be an object with a fetch method
  apiHandler: {
    fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
      const handler = getMcpApiHandler(env);
      return handler(request, env, ctx);
    }
  },

defaultHandler: {
    fetch: async (request: Request, env: any, ctx: ExecutionContext) => {
      const url = new URL(request.url);

      if (url.pathname === "/authorize") {
        // 1. Check for the definitive proof that Cloudflare Access allowed this request
        const accessJwt = request.headers.get("Cf-Access-Jwt-Assertion");
        
        if (!accessJwt) {
          return new Response("Unauthorized: Cloudflare Access evaluation failed or missing.", { status: 401 });
        }

        // 2. Extract an identity (Email for humans, Client ID for Service Tokens)
        const userEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
        const serviceTokenId = request.headers.get("CF-Access-Client-Id");
        
        // Fallback logically based on what policy triggered the success
        const identity = userEmail || serviceTokenId || "automated-policy-user";

        // 3. Parse the OAuth request
        const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);

        // 4. Generate the token tied to whatever identity passed the policy
        const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
          request: oauthReqInfo,
          userId: identity, 
        });

        // 5. Bounce back to the client!
        return Response.redirect(redirectTo);
      }

      return new Response("Not Found", { status: 404 });
    }
  }
});
