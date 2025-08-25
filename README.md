# Wikipedia MCP Server

This server exposes Wikipedia search and page tools over MCP. It supports:
- stdio transport (for local tools and testing)
- Streamable HTTP transport (for Copilot Studio/custom connectors)

Features
- Tools:
  - search_wikipedia(query, limit, lang?) → top page matches (default en)
  - get_page_html(title, lang?) → HTML of a page (default en)
  - get_page_extract(title, lang?) → plain-text summary (default en)
- Resources (not surfaced in Copilot Studio):
  - wiki://page/{title}
  - wiki://{lang}/page/{title}

Notes
- Uses public MediaWiki APIs; no key required.
- Descriptive User-Agent; adds maxlag; exponential backoff on 429/5xx.
- In-memory cache and polite throttling:
  - search ~30s; extracts ~1h; HTML ~10m
  - min 150ms between requests
- REST v1 endpoints used when available (HTML primary; search fallback; summary fallback).

## Run locally (stdio)
- Install deps: npm ci
- Build: npm run build
- Start: npm start
- Test client: npm test

## Run HTTP (Streamable)
- Build: npm run build
- Start HTTP: npm run start:http
- Endpoint: http://localhost:3000/mcp

Environment
- PORT: HTTP port (default 3000)
- ALLOWED_HOSTS: for DNS rebinding protection (default 127.0.0.1,localhost)
- ALLOWED_ORIGINS: CORS origins (default *)

## Copilot Studio connector
Use `connectors/wikipedia-mcp-streamable.yaml`.
- Replace `YOUR_PUBLIC_HOSTNAME` with your public host.
- Import OpenAPI in a Custom Connector and attach to your agent.

Copilot Studio supports MCP tools only; resources won’t appear there.
