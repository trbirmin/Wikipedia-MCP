import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
  args: ["dist/stdio.js"],
  });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("Tools:", tools.tools.map((t: any) => t.name));

  const result: any = await client.callTool({
    name: "search_wikipedia",
    arguments: { query: "Model Context Protocol", limit: 3 }
  });
  console.log("Search result:", result.content[0]);

  // Spanish search
  const resultEs: any = await client.callTool({
    name: "search_wikipedia",
    arguments: { query: "Inteligencia artificial", limit: 1, lang: "es" }
  });
  console.log("ES Search result:", resultEs.content[0]);

  // Spanish extract
  const extractEs: any = await client.callTool({
    name: "get_page_extract",
    arguments: { title: "Madrid", lang: "es" }
  });
  console.log("ES Extract (first 120):", (extractEs.content?.[0]?.text || "").slice(0, 120));

  // Graceful shutdown
  await (client as any).close?.();
  await (transport as any).close?.();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
