import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
