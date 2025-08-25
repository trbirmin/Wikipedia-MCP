# Connectors

This folder contains OpenAPI connector definitions for Microsoft Copilot Studio.

## Wikipedia MCP (Streamable HTTP)
- File: `wikipedia-mcp-streamable.yaml`
- Purpose: Exposes the Wikipedia MCP server over HTTPS using the MCP Streamable HTTP protocol.

### When to use
Import this file into Copilot Studio as a custom connector when you want your copilot to call the Wikipedia MCP server hosted on Azure App Service.

### Prerequisites
- The app is deployed and reachable at the hostname set under `host` in the YAML (for example: `tb-wikimcp-wa-gbhzfdgpd9fkasa4.eastus2-01.azurewebsites.net`).
- The server binds to `0.0.0.0` and respects the `PORT` environment variable (App Service requirement).
- App settings for remote build/startup are configured if using Oryx (e.g., `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, `NPM_CONFIG_PRODUCTION=false`, `Startup Command: npm run start:http`).

### How to import in Copilot Studio
1. Open Copilot Studio and go to Tools/Plugins (custom connectors area).
2. Choose to import from an OpenAPI file and select `wikipedia-mcp-streamable.yaml`.
3. Confirm the host matches your deployed site and finish the import.

### Testing
- The MCP endpoint is `POST /mcp` over HTTPS. A plain GET may 404; that is expected.
- You can validate deployment logs at:
  `https://<your-app>.scm.azurewebsites.net/api/deployments/latest/log`

### Troubleshooting
- 404 on GET /mcp: Use POST instead; GET is not implemented by the MCP protocol.
- 502/503 after deploy: Check the Startup Command and that the app is listening on the provided `PORT`.
- TypeScript build failures: Ensure `NPM_CONFIG_PRODUCTION=false` so devDependencies (tsc) are installed by Oryx.
- Resource not found during deploy: Verify `AZURE_WEBAPP_NAME` is the App Service resource name (not the hostname) and your OIDC secrets point to the correct subscription.

### Maintenance tips
- If you rename or recreate the App Service, update the `host` field in the YAML.
- Keep `azure-appservice-oidc.yml` pinned to stable actions and ensure secrets/RBAC are valid.
