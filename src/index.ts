import { generateNames } from "./generator";
import { isRateLimited, parseIntParam, withSecurityHeaders } from "./security";
import ui from "./ui.html";
import help from "./help.html";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function handle(request: Request): Response {
  const url = new URL(request.url);

  // TLS is terminated by Cloudflare; send any plain-HTTP request to HTTPS (not for local dev).
  if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith(".localhost")) {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  // Treat "/help/" like "/help".
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;

  if (request.method === "OPTIONS" && path.startsWith("/api/")) {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method Not Allowed" }, 405, { Allow: "GET, HEAD, OPTIONS" });
  }

  if (path === "/" || path === "/help") {
    return new Response(path === "/" ? ui : help, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  if (path === "/favicon.ico") {
    return new Response(null, { status: 204 }); // pages ship an inline icon; avoid 404 noise
  }

  if (path === "/api/generate") {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { limited, retryAfter } = isRateLimited(ip);
    if (limited) {
      return json({ error: "Too Many Requests" }, 429, { ...CORS, "Retry-After": String(retryAfter) });
    }

    const count = parseIntParam(url.searchParams.get("count"), 1, 1, 50);
    const requested = parseIntParam(url.searchParams.get("words"), 3, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const words = requested === 2 ? 2 : 3;

    return json({ count, words, results: generateNames(count, words) }, 200, CORS);
  }

  return json({ error: "Not Found" }, 404);
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const response = handle(request);
      // HEAD responses must not carry a body.
      return withSecurityHeaders(request.method === "HEAD" ? new Response(null, response) : response);
    } catch (err) {
      console.error(err);
      return withSecurityHeaders(json({ error: "Internal Server Error" }, 500));
    }
  },
} satisfies ExportedHandler;
