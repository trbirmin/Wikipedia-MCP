import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { createServer } from "./server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "127.0.0.1,localhost").split(",").map(s => s.trim());
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim());
const DNS_REBIND_PROTECT = String(process.env.DNS_REBINDING_PROTECTION || "false").toLowerCase() === "true" || process.env.DNS_REBINDING_PROTECTION === "1";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin: (origin: any, cb: any) => cb(null, true),
  exposedHeaders: ["Mcp-Session-Id"],
  allowedHeaders: ["Content-Type", "mcp-session-id", "mcp-protocol-version"],
}));

// Session map
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.all("/mcp", async (req: any, res: any) => {
  try {
    const sessionId = (req.headers["mcp-session-id"] as string | undefined) || undefined;
    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (req.method === "POST" && isInitializeRequest(req.body)) {
      // Create new session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport!;
        },
        enableDnsRebindingProtection: DNS_REBIND_PROTECT,
        allowedHosts: ALLOWED_HOSTS,
        allowedOrigins: ALLOWED_ORIGINS,
      });
      transport.onclose = () => {
        if (transport?.sessionId) delete transports[transport.sessionId];
      };

      const mcp = await createServer();
      await mcp.connect(transport);
    } else if (req.method === "GET" || req.method === "DELETE") {
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }
      transport = transports[sessionId];
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    // Handle request via transport (POST has body; GET/DELETE do not)
    if (req.method === "POST") {
      await transport!.handleRequest(req as any, res as any, (req as any).body);
    } else {
      await transport!.handleRequest(req as any, res as any);
    }
  } catch (err) {
    console.error("/mcp error", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

app.listen(PORT, () => {
  console.log(`MCP Streamable HTTP listening on http://localhost:${PORT}/mcp`);
});
