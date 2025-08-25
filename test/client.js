import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
async function main() {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["dist/server.js"],
    });
    const client = new Client({ name: "test-client", version: "0.0.1" });
    await client.connect(transport);
    const tools = await client.listTools();
    console.log("Tools:", tools.tools.map(t => t.name));
    const result = await client.callTool({
        name: "search_wikipedia",
        arguments: { query: "Model Context Protocol", limit: 3 }
    });
    console.log("Search result:", result.content[0]);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
