import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const USER_AGENT = "Wikipedia-MCP/0.1 (+https://github.com/trbirmin/Wikipedia-MCP; contact: GitHub Issues) @modelcontextprotocol/sdk";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple in-memory TTL cache
class TTLCache<V = any> {
  private store = new Map<string, { value: V; expiresAt: number }>();
  get(key: string): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }
  set(key: string, value: V, ttlMs: number) {
    const expiresAt = Date.now() + Math.max(0, ttlMs);
    this.store.set(key, { value, expiresAt });
  }
}

// Simple rate limiter: enforce minimum interval between calls per key
class RateLimiter {
  private nextAvailable = new Map<string, number>();
  async wait(key: string, minIntervalMs: number) {
    if (minIntervalMs <= 0) return;
    const now = Date.now();
    const next = this.nextAvailable.get(key) ?? 0;
    const waitMs = Math.max(0, next - now);
    if (waitMs > 0) await sleep(waitMs);
    this.nextAvailable.set(key, Date.now() + minIntervalMs);
  }
}

const cache = new TTLCache<any>();
const limiter = new RateLimiter();

async function fetchJson(
  url: string,
  opts?: { retries?: number; cacheTtlMs?: number; cacheKey?: string; throttleMs?: number }
) {
  const maxRetries = opts?.retries ?? 3;
  const cacheTtlMs = opts?.cacheTtlMs ?? 0;
  const throttleMs = opts?.throttleMs ?? 150; // be nice; keep requests serial-ish
  const key = opts?.cacheKey ?? url;

  if (cacheTtlMs > 0) {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
  }

  let attempt = 0;
  let delay = 500;
  while (true) {
    // Throttle to avoid overloading servers
    await limiter.wait("wmf", throttleMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Api-User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, br"
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (cacheTtlMs > 0) cache.set(key, data, cacheTtlMs);
      return data;
    }
    const status = res.status;
    if ((status === 429 || status >= 500) && attempt < maxRetries) {
      const retryAfter = res.headers.get("retry-after");
      const retryMs = retryAfter ? Number(retryAfter) * 1000 : delay;
      attempt++;
      await sleep(retryMs);
      delay *= 2;
      continue;
    }
    const text = await res.text();
    throw new Error(`HTTP ${status}: ${text}`);
  }
}

// Fetch text payloads (e.g., REST HTML); supports same caching/throttling
async function fetchText(
  url: string,
  opts?: { retries?: number; cacheTtlMs?: number; cacheKey?: string; throttleMs?: number }
) {
  const maxRetries = opts?.retries ?? 3;
  const cacheTtlMs = opts?.cacheTtlMs ?? 0;
  const throttleMs = opts?.throttleMs ?? 150;
  const key = (opts?.cacheKey ?? url) + "::text";

  if (cacheTtlMs > 0) {
    const cached = cache.get(key);
    if (cached !== undefined) return cached as string;
  }

  let attempt = 0;
  let delay = 500;
  while (true) {
    await limiter.wait("wmf", throttleMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Api-User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, br"
      }
    });
    if (res.ok) {
      const data = await res.text();
      if (cacheTtlMs > 0) cache.set(key, data, cacheTtlMs);
      return data;
    }
    const status = res.status;
    if ((status === 429 || status >= 500) && attempt < maxRetries) {
      const retryAfter = res.headers.get("retry-after");
      const retryMs = retryAfter ? Number(retryAfter) * 1000 : delay;
      attempt++;
      await sleep(retryMs);
      delay *= 2;
      continue;
    }
    const text = await res.text();
    throw new Error(`HTTP ${status}: ${text}`);
  }
}

function langHost(lang?: string) {
  const l = (lang || "en").toLowerCase();
  return `${l}.wikipedia.org`;
}

function buildSearchUrl(query: string, limit = 5, lang?: string) {
  const u = new URL(`https://${langHost(lang)}/w/api.php`);
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("list", "search");
  u.searchParams.set("srsearch", query);
  u.searchParams.set("srlimit", String(Math.max(1, Math.min(limit, 50))));
  u.searchParams.set("utf8", "1");
  // Be polite during high server load windows
  u.searchParams.set("maxlag", "5");
  return u.toString();
}

// REST v1 search endpoint: /w/rest.php/v1/search/page
function buildRestSearchUrl(query: string, limit = 5, lang?: string) {
  const u = new URL(`https://${langHost(lang)}/w/rest.php/v1/search/page`);
  u.searchParams.set("q", query);
  u.searchParams.set("limit", String(Math.max(1, Math.min(limit, 100))));
  return u.toString();
}

function buildExtractUrl(title: string, lang?: string) {
  const u = new URL(`https://${langHost(lang)}/w/api.php`);
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "extracts");
  u.searchParams.set("exintro", "1");
  u.searchParams.set("explaintext", "1");
  u.searchParams.set("titles", title);
  u.searchParams.set("utf8", "1");
  u.searchParams.set("redirects", "1");
  u.searchParams.set("maxlag", "5");
  return u.toString();
}

function buildParseHtmlUrl(title: string, lang?: string) {
  const u = new URL(`https://${langHost(lang)}/w/api.php`);
  u.searchParams.set("action", "parse");
  u.searchParams.set("format", "json");
  u.searchParams.set("page", title);
  u.searchParams.set("redirects", "1");
  u.searchParams.set("maxlag", "5");
  return u.toString();
}

// REST v1 HTML endpoint: /w/rest.php/v1/page/{title}/html
function buildRestHtmlUrl(title: string, lang?: string) {
  return `https://${langHost(lang)}/w/rest.php/v1/page/${encodeURIComponent(title)}/html`;
}

async function getExtract(title: string, lang?: string): Promise<string> {
  // First try Action API extracts
  try {
    const data = await fetchJson(buildExtractUrl(title, lang), {
      cacheTtlMs: 60 * 60 * 1000, // 1 hour for extracts
      throttleMs: 150
    });
    const pages = data?.query?.pages;
    if (pages) {
      const first = Object.values(pages)[0] as any;
      if (first?.extract) return first.extract as string;
    }
  } catch {
    // fall through to REST
  }
  // Fallback: Wikimedia REST summary endpoint
  const restUrl = `https://${langHost(lang)}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const rest = await fetchJson(restUrl, { cacheTtlMs: 60 * 60 * 1000, throttleMs: 150 });
    if (typeof rest?.extract === "string" && rest.extract) return rest.extract as string;
    if (typeof rest?.description === "string" && rest.description) return rest.description as string;
  } catch {}
  return "";
}

async function getHtml(title: string, lang?: string): Promise<string> {
  // Prefer REST HTML when available
  try {
    const htmlRest = await fetchText(buildRestHtmlUrl(title, lang), {
      cacheTtlMs: 10 * 60 * 1000,
      throttleMs: 150
    });
    if (htmlRest && typeof htmlRest === "string") return htmlRest;
  } catch {
    // fallback to Action API
  }
  const data = await fetchJson(buildParseHtmlUrl(title, lang), {
    cacheTtlMs: 10 * 60 * 1000, // 10 minutes for HTML
    throttleMs: 150
  });
  const html = data?.parse?.text?.["*"];
  if (typeof html !== "string") {
    throw new Error("No HTML returned by parse API");
  }
  return html;
}

const LangSchema = z.string().regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i).optional();
type SearchInput = { query: string; limit?: number; lang?: string };
type TitleInput = { title: string; lang?: string };

export async function createServer() {
  const server = new McpServer({ name: "wikipedia", version: "0.1.0" });

  server.registerTool(
    "search_wikipedia",
    {
      title: "Search Wikipedia",
      description: "Search English Wikipedia articles by text query",
      inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional(), lang: LangSchema }
    },
    async ({ query, limit = 5, lang }: SearchInput) => {
      const url = buildSearchUrl(query, limit, lang);
      let items: any[] = [];
      try {
        const data = await fetchJson(url, { cacheTtlMs: 30 * 1000, throttleMs: 150 });
        items = (data?.query?.search ?? []).map((s: any) => ({
          title: s.title as string,
          pageid: s.pageid as number,
          snippet: s.snippet as string,
          wordcount: s.wordcount as number,
          size: s.size as number,
          timestamp: s.timestamp as string
        }));
      } catch {
        // fall through to REST search
      }
      if (!items.length) {
        try {
          const r = await fetchJson(buildRestSearchUrl(query, limit, lang), { cacheTtlMs: 30 * 1000, throttleMs: 150 });
          const pages = r?.pages ?? [];
          items = pages.map((p: any) => ({
            title: p.title as string,
            pageid: p.id as number,
            snippet: p.excerpt as string,
            wordcount: undefined,
            size: undefined,
            timestamp: undefined
          }));
        } catch {}
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(items, null, 2) }
        ]
      };
    }
  );

  server.registerTool(
    "get_page_extract",
    {
      title: "Get Wikipedia Extract",
      description: "Get the plain-text lead section (summary) for a page title",
      inputSchema: { title: z.string().min(1), lang: LangSchema }
    },
    async ({ title, lang }: TitleInput) => {
      const extract = await getExtract(title, lang);
      if (!extract) {
        return { content: [{ type: "text", text: `No extract found for '${title}'.` }], isError: true };
      }
      return { content: [{ type: "text", text: extract }] };
    }
  );

  server.registerTool(
    "get_page_html",
    {
      title: "Get Wikipedia HTML",
      description: "Get full HTML for a page title (may be large)",
      inputSchema: { title: z.string().min(1), lang: LangSchema }
    },
    async ({ title, lang }: TitleInput) => {
      const html = await getHtml(title, lang);
      return { content: [{ type: "text", text: html }] };
    }
  );

  server.registerResource(
    "page",
    new ResourceTemplate("wiki://page/{title}", { list: undefined }),
    {
      title: "Wikipedia Page Extract",
      description: "Plain-text extract for a Wikipedia page title",
      mimeType: "text/plain"
    },
    async (uri, { title }: any) => {
      const t = Array.isArray(title) ? title[0] : title;
      const text = t ? await getExtract(t) : "";
      return {
        contents: [{ uri: uri.href, text }]
      };
    }
  );

  // Language-aware resource: wiki://{lang}/page/{title}
  server.registerResource(
    "page-by-lang",
    new ResourceTemplate("wiki://{lang}/page/{title}", { list: undefined }),
    {
      title: "Wikipedia Page Extract (by language)",
      description: "Plain-text extract for a Wikipedia page title on a given language wiki",
      mimeType: "text/plain"
    },
    async (uri, { lang, title }: any) => {
      const l = Array.isArray(lang) ? lang[0] : lang;
      const t = Array.isArray(title) ? title[0] : title;
      const text = t ? await getExtract(t, l) : "";
      return { contents: [{ uri: uri.href, text }] };
    }
  );

  return server;
}
// Note: no direct bootstrap here. Use dedicated entrypoints (stdio.ts, http.ts)
