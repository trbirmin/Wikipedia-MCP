# MCP Wikipedia Server

This is a Model Context Protocol (MCP) server that exposes Wikipedia search and page content.

Features
- Tools:
  - search_wikipedia(query, limit, lang?) → top page matches (default en)
  - get_page_html(title, lang?) → HTML of a page (default en)
  - get_page_extract(title, lang?) → plain-text summary via TextExtracts (default en)
- Resources:
  - wiki://page/{title} (default en)
  - wiki://{lang}/page/{title}

Notes
- Uses public MediaWiki APIs; no key required.
- Sends a descriptive User-Agent/Api-User-Agent per WMF policy, adds maxlag, retries with exponential backoff on 429/5xx.
- Built-in in-memory cache and polite throttling:
  - search cached ~30s; extracts ~1h; HTML ~10m
  - minimum 150ms gap between requests (serialized effectively)
 - REST v1 endpoints:
   - HTML served via /w/rest.php/v1/page/{title}/html with Action API parse as fallback
   - Search falls back to /w/rest.php/v1/search/page when Action API search fails
   - Extracts already fall back to REST summary: /api/rest_v1/page/summary/{title}

Run
1. Install deps
2. Start in dev (stdio transport)

Client testing
- A tiny client is included to list tools and call a search.
  - Try: search_wikipedia with lang: "es" and verify Spanish results.
  - Try: get_page_extract for the same title twice; second should be cache-hit and faster.
