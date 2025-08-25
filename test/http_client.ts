import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn } from "node:child_process";
import { once } from "node:events";

async function main() {
  // Start server if MCP_URL not provided
  const urlEnv = process.env.MCP_URL;
  let serverProc: any | undefined;
  let baseUrl: URL;
  if (!urlEnv) {
    serverProc = spawn(process.execPath, ["dist/http.js"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: "3101" } });
    // Wait until server prints readiness line
    const ready = new Promise<void>((resolve, reject) => {
      const onData = (data: Buffer) => {
        const s = data.toString();
        if (s.includes("listening on http://")) {
          serverProc?.stdout?.off("data", onData);
          resolve();
        }
      };
      serverProc?.stdout?.on("data", onData);
      serverProc?.on("error", reject);
      serverProc?.on("exit", (code) => reject(new Error(`HTTP server exited with code ${code}`)));
    });
    await ready;
    baseUrl = new URL("http://127.0.0.1:3101/mcp");
  } else {
    baseUrl = new URL(urlEnv);
  }
  const transport = new StreamableHTTPClientTransport(baseUrl);
  const client = new Client({ name: "http-test-client", version: "0.0.1" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("HTTP Tools:", tools.tools.map((t: any) => t.name));

  const result: any = await client.callTool({
    name: "search_wikipedia",
    arguments: { query: "Madrid", limit: 1, lang: "es" }
  });
  console.log("HTTP Search ES result:", result.content[0]);

  await (client as any).close?.();
  await (transport as any).close?.();
  if (serverProc) {
    serverProc.kill();
    await once(serverProc, "exit").catch(() => {});
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
