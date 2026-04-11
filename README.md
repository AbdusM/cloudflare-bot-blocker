# Cloudflare Bot Blocker v2.0

A monitor-first Cloudflare Worker for bot policy enforcement, suspicious-country throttling, cookie sanitization, stateful asset rate limiting, and cleaner blocked-request UX.

## What Changed In v2.0

- Monitor mode is now the safe default.
- Policy evaluation is modular and testable.
- Hybrid rule lanes allow known-bad traffic to stay enforced while newer rules stay monitor-only.
- Suspicious-country throttling is supported as a softer alternative to hard geo-blocking.
- Cookie sanitization can strip selected cookies before origin fetch.
- Standalone `workers.dev` deployments now return an operational response unless an upstream origin is configured.
- Rate limiting supports a Durable Object backend instead of relying only on process memory.
- Browser, API, and plain-text clients get different blocked responses.
- CI and a local test suite now validate the decision engine before merges.

## Architecture

Runtime entrypoint:
- `worker.js` wires config, policy evaluation, cookie sanitization, logging, and responses.

Core modules:
- `src/presets.js` defines conservative, balanced, and aggressive presets.
- `src/config.js` parses environment overrides.
- `src/policy.js` builds request context and evaluates policy decisions.
- `src/rate-limiter.js` uses a Durable Object when `RATE_LIMITER` is bound and falls back to in-memory limiting for local/dev use.
- `src/responses.js` builds browser, API, and plain-text deny responses.
- `src/logging.js` emits structured logs for monitor and enforced outcomes.

## Default Behavior

Default preset:
- `balanced`

Default mode:
- `monitor`

That means the worker will log requests that would be blocked, but it will still forward them to origin until you explicitly switch to enforce mode.

Balanced preset defaults:
- Block country: `CN`
- Block ASNs: `13220`, `132203`
- Block known AI/training scrapers, including `GPTBot`, `ClaudeBot`, `anthropic-ai`, `ChatGPT-User`, and similar crawlers
- Leave monitor-only country, ASN, and scraper lanes empty until you configure them
- Rate limit `.js` asset requests at `100` requests per minute per IP
- Bypass `OPTIONS` automatically to avoid breaking preflight traffic
- Leave suspicious-country throttling and cookie stripping disabled until you configure them

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your worker

The repo ships with the Durable Object binding and migration already declared in [wrangler.toml](wrangler.toml).

Add environment variables under `[vars]`:

```toml
[vars]
BOT_BLOCKER_MODE = "monitor"
BOT_BLOCKER_PRESET = "balanced"
BOT_BLOCKER_SUPPORT_URL = "https://yourdomain.com/support"
BOT_BLOCKER_UPSTREAM_ORIGIN = "https://example.com"
BOT_BLOCKER_THROTTLED_COUNTRIES = "VN,SG"
BOT_BLOCKER_THROTTLE_LIMIT = "15"
BOT_BLOCKER_STRIPPED_COOKIES = "session_token,tracking_id"
```

### 3. Run the test suite

```bash
npm test
```

### 4. Deploy in monitor mode first

```bash
npm run deploy
```

### 5. Review logs, then enforce

When the monitor-only decisions look correct, flip:

```toml
BOT_BLOCKER_MODE = "enforce"
```

## Presets

### Conservative

Best when:
- You have global customers.
- You want low false-positive risk.
- You want to start with a smaller ASN and scraper policy.

Defaults:
- No country block
- Tencent-focused ASN block
- Moderate `.js` rate limit at `120/min`

### Balanced

Best when:
- You want a practical default with monitor-first rollout.
- You want AI scraper blocking without broad regional allowlisting.

Defaults:
- `CN` blocked
- Tencent ASN block
- AI/training scraper blocklist
- `.js` rate limit at `100/min`

### Aggressive

Best when:
- You mostly serve a narrow regional market.
- You are willing to trade accessibility for stronger suppression.

Defaults:
- Country allowlist for a defined set of regions
- Expanded ASN blocklist
- Expanded scraper blocklist
- Asset rate limiting on `.js`, `.css`, `.json`, and `.map`
- `30/min` asset rate limit

## Environment Variables

Behavior:
- `BOT_BLOCKER_MODE`: `monitor` or `enforce`
- `BOT_BLOCKER_PRESET`: `conservative`, `balanced`, or `aggressive`
- `BOT_BLOCKER_SUPPORT_URL`: optional support link shown on browser deny pages
- `BOT_BLOCKER_UPSTREAM_ORIGIN`: optional origin to proxy allowed traffic to when the worker runs standalone

Lists:
- `BOT_BLOCKER_BLOCKED_COUNTRIES`
- `BOT_BLOCKER_MONITORED_COUNTRIES`
- `BOT_BLOCKER_ALLOWED_COUNTRIES`
- `BOT_BLOCKER_THROTTLED_COUNTRIES`
- `BOT_BLOCKER_BLOCKED_ASNS`
- `BOT_BLOCKER_MONITORED_ASNS`
- `BOT_BLOCKER_BLOCKED_SCRAPERS`
- `BOT_BLOCKER_MONITORED_SCRAPERS`
- `BOT_BLOCKER_ALLOWED_IPS`
- `BOT_BLOCKER_STRIPPED_COOKIES`
- `BOT_BLOCKER_DELETE_STRIPPED_COOKIES`
- `BOT_BLOCKER_COOKIE_DELETE_DOMAIN`
- `BOT_BLOCKER_PROTECTED_PATH_PREFIXES`
- `BOT_BLOCKER_BYPASS_METHODS`
- `BOT_BLOCKER_RATE_LIMIT_PATH_SUFFIXES`
- `BOT_BLOCKER_RATE_LIMIT_PATH_PREFIXES`
- `BOT_BLOCKER_RATE_LIMIT_BYPASS_SAME_ORIGIN_ASSETS`
- `BOT_BLOCKER_STRICT_RATE_LIMIT_ENABLED`
- `BOT_BLOCKER_STRICT_RATE_LIMIT`
- `BOT_BLOCKER_STRICT_RATE_WINDOW_MS`
- `BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_PREFIXES`
- `BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_SUFFIXES`
- `BOT_BLOCKER_STRICT_RATE_LIMIT_MARKERS`
- `BOT_BLOCKER_HEALTH_PATH`

Rate limiting:
- `BOT_BLOCKER_RATE_LIMIT_ENABLED`
- `BOT_BLOCKER_RATE_LIMIT`
- `BOT_BLOCKER_RATE_WINDOW_MS`

Suspicious-country throttling:
- `BOT_BLOCKER_THROTTLE_LIMIT`

List values are comma-separated. An explicitly empty value clears the preset default for that field.

## Feature Notes

### Suspicious-Country Throttling

Use throttling when you have some legitimate traffic from a region but still need to suppress heavy abuse.

- The key is `country + IP`
- The default window is `60` seconds
- Requests over the configured limit return `429`
- In monitor mode, the worker logs the event but still forwards the request

### Hybrid Enforcement And Monitoring

You can keep proven bad traffic blocked while only monitoring newer rules:

- `BOT_BLOCKER_BLOCKED_COUNTRIES`, `BOT_BLOCKER_BLOCKED_ASNS`, and `BOT_BLOCKER_BLOCKED_SCRAPERS` stay enforceable in `enforce` mode
- `BOT_BLOCKER_MONITORED_COUNTRIES`, `BOT_BLOCKER_MONITORED_ASNS`, and `BOT_BLOCKER_MONITORED_SCRAPERS` always log and allow
- In global `monitor` mode, even blocked rules log instead of enforcing
- `BOT_BLOCKER_PROTECTED_PATH_PREFIXES` does not narrow those global blocklists; use the explicit asset path settings when you want path-scoped rate limits

That gives you a safe rollout pattern for production:

- hard block known bad traffic
- monitor uncertain traffic
- promote monitor-only rules to enforced rules only after log review

### Cookie Sanitization

Use cookie stripping to prevent selected cookies from reaching origin for untrusted requests.

- Configure cookie names with `BOT_BLOCKER_STRIPPED_COOKIES`
- Matching is case-insensitive
- Requests are only rewritten when one of those cookie names is present
- A `SANITIZED` log event is emitted with the stripped cookie names
- If `BOT_BLOCKER_DELETE_STRIPPED_COOKIES` is enabled, matching cookies are also expired in the browser response
- `BOT_BLOCKER_COOKIE_DELETE_DOMAIN` lets you scope those deletions to a specific domain

### Path-Scoped Asset Protection

You can run stricter asset controls without hard-coding tenant-specific app logic:

- `BOT_BLOCKER_RATE_LIMIT_PATH_PREFIXES` scopes the standard asset limiter
- `BOT_BLOCKER_RATE_LIMIT_BYPASS_SAME_ORIGIN_ASSETS` avoids penalizing normal browser script loads
- `BOT_BLOCKER_STRICT_RATE_LIMIT_*` variables define a stricter limiter for high-risk asset paths
- `BOT_BLOCKER_STRICT_RATE_LIMIT_MARKERS` can target specific module names inside bundled asset paths

### Standalone Mode

If the worker is running on `workers.dev` with no upstream origin configured:

- `/_bot-blocker/health` returns a `200` operational response
- Browser requests get an informational page instead of a failed passthrough
- API-style requests get JSON showing whether an upstream origin is configured

If you want allowed traffic proxied onward from `workers.dev`, set `BOT_BLOCKER_UPSTREAM_ORIGIN`.

## Public Repo Boundary

Keep this repository generic.

- Store route bindings, custom domains, upstream origins, cookie names, path heuristics, and rollout decisions in a private deployment repository or secret-managed infrastructure config.
- Do not commit tenant-specific staging hosts, production hosts, or cutover playbooks into the public worker source tree.
- Treat every deployment as data layered onto the worker, not logic merged into it.

## Rollout Recommendation

1. Start with `BOT_BLOCKER_MODE = "monitor"`.
2. Watch logs for `blocked_country`, `blocked_asn`, `blocked_scraper`, `country_throttle_exceeded`, and `rate_limit_exceeded`.
3. Add monitor-only countries, ASNs, and scrapers first for any uncertain traffic.
4. Add allowlisted IPs, protected path prefixes, throttled countries, stripped cookies, or preset overrides where needed.
5. Switch to `enforce` only after the monitor output matches your expectations.

## Response UX

Blocked requests now return:
- HTML for browser traffic with a support link and request ID
- JSON for API-style traffic with `code`, `message`, and `requestId`
- Plain text for everything else

Every enforced response includes:
- `X-Bot-Blocker-Reason`
- `X-Request-Id`
- `Retry-After` for throttled or rate-limited responses

## Testing And CI

Local test command:

```bash
npm test
```

Coverage includes:
- Preset/config parsing
- Monitor vs enforce behavior
- Allowlist and path-scope behavior
- Suspicious-country throttling
- Cookie sanitization
- Durable Object rate limiting
- HTML and JSON response contracts
- Worker-level integration

GitHub Actions runs the same test suite on pushes and pull requests.

## Examples

Config examples live in:
- [examples/README.md](examples/README.md)
- [examples/minimal-blocking.js](examples/minimal-blocking.js)
- [examples/strict-blocking.js](examples/strict-blocking.js)

## Development Notes

- The in-memory rate limiter is only a fallback for local/dev or unbound environments.
- Production rate limiting should use the bundled Durable Object binding.
- `OPTIONS` is bypassed by default to reduce accidental API/CORS regressions.
- Search-engine bots are not blocked by the balanced preset. If you want that behavior, use the aggressive preset or override the scraper list directly.
- Cookie sanitization only affects requests that are allowed to continue to origin.

## License

MIT. See [LICENSE](LICENSE).
