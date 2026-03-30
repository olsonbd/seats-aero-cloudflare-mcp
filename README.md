# Seats.aero Cloudflare MCP Server

A TypeScript-based, stateless Remote MCP server for interacting with the seats.aero API via natural language. This server runs on the edge via Cloudflare Workers, providing lightning-fast, highly scalable access to flight availability, routes, and bulk searches.

❗ **Prerequisites:** You will need a seats.aero Pro API key to use this tool.

---

## 🚀 Get Started: One-Click Deploy

You can deploy this server directly to your Cloudflare account in one click:

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/olsonbd/seats-aero-cloudflare-mcp)

Once deployed, your MCP server will be live at a URL like: `https://seats-aero-cloudflare-mcp.<your-account>.workers.dev/mcp`

### 🔐 Crucial Post-Deploy Step: Add Your Secrets
Because this server acts as a secure proxy to the seats.aero API, you must configure your secrets in the Cloudflare Dashboard before the server will function.

1. Go to your Cloudflare Dashboard > **Workers & Pages** > `seats-aero-cloudflare-mcp`.
2. Navigate to **Settings > Variables and Secrets**.
3. Add the following encrypted variables:
   * **`SEATS_API_KEY`**: Your seats.aero Pro API key.
   * **`MCP_CLIENT_SECRET`**: A secure password/token you invent to prevent unauthorized access to your edge node.
4. Redeploy your worker to inject the new secrets.

---

## 🛠️ Tools Available

The server uses strict JSON Schema enums to prevent LLM hallucinations for mileage programs and cabin classes. 

* **`get_flights`**: Get a list of flights. Maps to the cached search endpoint.
* **`get_bulk_avail`**: Retrieve a large amount of availability objects from one specific mileage program. Maps to the bulk availability endpoint.
* **`get_routes`**: Retrieve a list of route objects from one specific mileage program. Maps to the routes endpoint.

---

## 💻 Manual Deployment (CLI)

If you prefer to deploy via the command line instead of the one-click button:

1. **Clone the repository and install dependencies:**
```bash
   git clone [https://github.com/olsonbd/seats-aero-cloudflare-mcp.git](https://github.com/olsonbd/seats-aero-cloudflare-mcp.git)
   cd seats-aero-cloudflare-mcp
   npm install
```
2. **Securely store your sectrets using Wrangler:**
```bash
   npx wrangler secret put SEATS_API_KEY
   npx wrangler secret put MCP_CLIENT_SECRET
```
3. **Deploy to Cloudflare:**
```bash
   npx wrangler deploy
```
## 🔌 Connecting to MetaMCP

This server is designed to work seamlessly with MetaMCP as a remote `STREAMABLE_HTTP` server. 

Navigate to your MetaMCP Dashboard > **MCP Servers** and add a new server using this configuration:

* **Name:** `seats.aero`
* **Type:** `STREAMABLE_HTTP`
* **URL:** `https://seats-aero-cloudflare-mcp.<your-account>.workers.dev/mcp` *(Replace with your actual Workers URL)*
* **Bearer Token:** *(The exact string you saved as your `MCP_CLIENT_SECRET`)*

---

## 🤖 Connecting to Claude Desktop

You can also connect to your remote MCP server from local MCP clients using the [mcp-remote](https://www.npmjs.com/package/mcp-remote) proxy.

Open your Claude Desktop configuration file and add the following:

```json
{
  "mcpServers": {
    "seats-aero": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://seats-aero-cloudflare-mcp.<your-account>.workers.dev/mcp"
      ],
      "env": {
        "MCP_REMOTE_BEARER_TOKEN": "your_mcp_client_secret_here"
      }
    }
  }
}
