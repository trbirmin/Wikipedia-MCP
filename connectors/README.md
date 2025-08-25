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
- App settings for remote build/startup (Oryx) in Azure Portal > Configuration > Application settings:
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
  - `NPM_CONFIG_PRODUCTION=false` (install devDependencies like TypeScript)
  - `NODE_ENV=production`
  - Startup Command: `npm run start:http`

### Application variables and secrets (full list)

Azure App Service (Portal)
- Configuration > Application settings:
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=true` (enable Oryx remote build)
  - `NPM_CONFIG_PRODUCTION=false` (install devDependencies like TypeScript)
  - `NODE_ENV=production`
  - Optional: `ALLOWED_HOSTS=<your-app>.azurewebsites.net` (only if your server enforces host checks)
- Configuration > General settings:
  - Startup Command: `npm run start:http`
  - Platform-provided: `PORT` (don’t set; the app must listen on this)

GitHub repository secrets (for OIDC deploy)
- `AZURE_CLIENT_ID` (App registration used for federated credentials)
- `AZURE_TENANT_ID` (Tenant ID of the subscription that hosts the App Service)
- `AZURE_SUBSCRIPTION_ID` (Subscription ID where the App Service exists)

GitHub Actions workflow environment (in `.github/workflows/azure-appservice-oidc.yml`)
- `AZURE_WEBAPP_NAME=tb-WikiMcp-wa` (App Service resource name, not the hostname)
- `AZURE_RESOURCE_GROUP=<your resource group>` (exact RG name; the workflow can auto-resolve if omitted)
- Node version is set in the workflow (e.g., `NODE_VERSION: '20.x'`)

RBAC requirement
- The identity represented by `AZURE_CLIENT_ID` must have role assignment (Contributor or Website Contributor) on the target Resource Group.

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
