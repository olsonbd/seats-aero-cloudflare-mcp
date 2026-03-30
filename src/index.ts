import { createMcpHandler } from "@cloudflare/agents";

export interface Env {
  // This expects the secret to be set via Wrangler
  SEATS_API_KEY: string;
}

// A comprehensive list of seats.aero supported mileage programs to prevent LLM hallucinations
const SUPPORTED_SOURCES = [
  "aeromexico", "aeroplan", "alaska", "american", "delta", 
  "emirates", "etihad", "flyingblue", "lifemiles", "qantas", 
  "smiles", "velocity", "virginatlantic"
];

const SUPPORTED_CABINS = ["economy", "premium", "business", "first"];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const handler = createMcpHandler({
      tools: [
        // 1. GET ROUTES TOOL
        {
          name: "get_routes",
          description: "Retrieve a list of route objects from one specific mileage program (source).",
          parameters: {
            type: "object",
            properties: {
              source: {
                type: "string",
                description: "The frequent flyer program to search.",
                enum: SUPPORTED_SOURCES
              },
            },
            required: ["source"],
          },
          execute: async (args) => {
            const response = await fetch(`https://seats.aero/api/v1/routes?source=${args.source}`, {
              headers: {
                "Partner-Authorization": env.SEATS_API_KEY,
                "Accept": "application/json"
              },
            });

            if (!response.ok) {
              return { content: [{ type: "text", text: `Error: ${response.statusText}` }], isError: true };
            }

            const data = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(data) }] };
          },
        },

        // 2. GET FLIGHTS TOOL (Cached Search)
        {
          name: "get_flights",
          description: "Get a list of specific flights using cached search parameters.",
          parameters: {
            type: "object",
            properties: {
              source: { 
                type: "string", 
                description: "The frequent flyer program to search.",
                enum: SUPPORTED_SOURCES
              },
              origin_airport: { type: "string", description: "3-letter origin airport code (e.g., JFK)" },
              destination_airport: { type: "string", description: "3-letter destination airport code (e.g., LHR)" },
              cabin: { 
                type: "string", 
                description: "Cabin class",
                enum: SUPPORTED_CABINS
              },
              start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
              end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
              direct: { type: "boolean", description: "Set to true to only show direct flights" }
            },
            required: ["source", "origin_airport", "destination_airport"],
          },
          execute: async (args) => {
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

            if (!response.ok) {
              return { content: [{ type: "text", text: `Error: ${response.statusText}` }], isError: true };
            }

            const data = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(data) }] };
          },
        },

        // 3. GET BULK AVAILABILITY TOOL
        {
          name: "get_bulk_avail",
          description: "Retrieve a large amount of availability objects from one specific mileage program.",
          parameters: {
            type: "object",
            properties: {
              source: {
                type: "string",
                description: "The frequent flyer program to search.",
                enum: SUPPORTED_SOURCES
              },
              cursor: { type: "string", description: "Cursor for pagination (optional)" },
              take: { type: "number", description: "Number of results to return (default 1000, max 1000)" }
            },
            required: ["source"],
          },
          execute: async (args) => {
            const params = new URLSearchParams();
            params.append("source", args.source as string);
            if (args.cursor) params.append("cursor", args.cursor as string);
            if (args.take) params.append("take", String(args.take));

            const response = await fetch(`https://seats.aero/api/v1/availability?${params.toString()}`, {
              headers: {
                "Partner-Authorization": env.SEATS_API_KEY,
                "Accept": "application/json"
              },
            });

            if (!response.ok) {
              return { content: [{ type: "text", text: `Error: ${response.statusText}` }], isError: true };
            }

            const data = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(data) }] };
          },
        }
      ],
    });

    return handler(request, env, ctx);
  },
};
