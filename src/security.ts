const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const MAX_TRACKED_IPS = 10_000;

// Per-isolate sliding window. Cloudflare may run several isolates, so this is best-effort.
const hits = new Map<string, number[]>();

export function isRateLimited(ip: string, now = Date.now()): { limited: boolean; retryAfter: number } {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return { limited: true, retryAfter: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)) };
  }

  recent.push(now);
  hits.delete(ip); // re-insert so the Map stays ordered by recency
  hits.set(ip, recent);

  if (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return { limited: false, retryAfter: 0 };
}

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    // Extra lockdown on top of the required policy: no framing, no <base>, no forms, no plugins.
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none';",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

export function withSecurityHeaders(response: Response): Response {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

/** Parse an integer query parameter; anything non-numeric falls back to `def`. */
export function parseIntParam(value: string | null, def: number, min: number, max: number): number {
  if (value === null || !/^[+-]?\d{1,15}$/.test(value.trim())) return def;
  return Math.min(max, Math.max(min, Number(value.trim())));
}
