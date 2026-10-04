# Project Name Generator

Cloudflare Worker that generates random project names (2 or 3 words) using `crypto.getRandomValues`.

Requires Node.js 20+.

```bash
npm install
npm run dev        # local at http://localhost:8787
npm run deploy     # publish to Cloudflare
```

Pages: `/` (generator) and `/help` (how to use).

HTTPS: Cloudflare terminates TLS. The Worker redirects plain HTTP to HTTPS (except on localhost) and sends HSTS.
For a custom domain, see the commented `routes` block in `wrangler.toml`.

API: `GET /api/generate?count=1..50&words=2|3` (invalid values fall back to count=1, words=3).

Name space: ~5.06 million 3-word names and ~67,500 2-word names, all equally likely.
Names are not stored, so repeats are possible; within one batch they are always distinct.
The rate limiter (60 req/min/IP) is in-memory per Cloudflare isolate, so it is best-effort.

## Deploy to Cloudflare

New to this? Read **[START-HER.md](START-HER.md)** (Danish, step by step).

```bash
npm install
npm run check      # typecheck + dry-run build (nothing is published)
npx wrangler login
npm run deploy
```

Commit the generated `package-lock.json` so installs are reproducible.

## Security notes

- Zero runtime dependencies. Dev tools only: wrangler, typescript, workers-types.
- Randomness: `crypto.getRandomValues` with rejection sampling (no modulo bias). Never `Math.random`.
- All page content is inserted with `textContent` (no `innerHTML`). No external scripts, styles or fonts.
- Headers on every response: CSP (the required policy plus `frame-ancestors`, `base-uri`, `form-action`,
  `object-src` set to none), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS,
  Cross-Origin-Opener-Policy.
- API: GET only, no cookies, no credentials, CORS `*` (the data is public), `no-store`.
- The client IP comes from `CF-Connecting-IP` only. `X-Forwarded-For` and similar headers are ignored.
- The in-memory rate limiter is per Cloudflare isolate and therefore approximate. For a hard limit, add a
  Cloudflare WAF rate-limiting rule (Security > WAF > Rate limiting rules) in front of `/api/*`.
- CSP still allows `'unsafe-inline'` for scripts and styles (required by the spec; the pages have inline
  code). To remove it, move the inline code to separate files or add hashes.
- Names are for fun, not secrets. They are random but short, so don't use them as passwords or tokens.
- HSTS is sent with `includeSubDomains; preload`. Only submit the domain to the browser preload list if
  every subdomain will serve HTTPS for the long term.
