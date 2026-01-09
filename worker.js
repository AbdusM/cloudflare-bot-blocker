/**
 * Cloudflare Worker: Bot Traffic Blocker v2.0
 *
 * A multi-layer bot protection system for Cloudflare Workers.
 * Blocks unwanted bot traffic before it reaches your origin server.
 *
 * FEATURES:
 * - Layer 1: Geographic blocking (Hard Block)
 * - Layer 2: ASN blocking (Network-level)
 * - Layer 3: AI scraper blocking (User-Agent)
 * - Layer 4: Rate limiting (JavaScript assets)
 * - Layer 5: Suspicious Country Throttling (Soft Block) [NEW]
 * - Layer 6: Cookie Sanitization [NEW]
 */

// ============================================================================
// CONFIGURATION - Customize these to your needs
// ============================================================================

// Layer 1: Countries to block completely (ISO 3166-1 alpha-2)
const BLOCKED_COUNTRIES = [
  "CN", // China
  "RU", // Russia (Example)
]

// Layer 1: ASNs to block (Network providers)
const BLOCKED_ASNS = [
  13220, // Tencent
  132203, // Tencent additional range
]

// Layer 2: AI Scraper User Agents
const AI_SCRAPERS = [
  "CCBot", // Common Crawl
  "GPTBot", // OpenAI
  "ChatGPT-User", // ChatGPT
  "anthropic-ai", // Anthropic
  "ClaudeBot", // Claude
  "Google-Extended", // Google AI
  "FacebookBot", // Meta AI
  "Bytespider", // ByteDance
  "Amazonbot", // Amazon
  "Omgilibot", // Omgili
]

// Layer 4: JavaScript Rate Limiting (Standard)
const JS_RATE_LIMIT = 100 // Requests per minute
const JS_RATE_WINDOW = 60000 // 1 minute

// Layer 5: Suspicious Country Throttling [NEW]
// Countries here are NOT blocked, but strictly throttled
const THROTTLED_COUNTRIES = [
  "XX", // Placeholder: Add suspicious country codes (e.g., 'VN', 'SG')
  "YY", // Placeholder
]
const THROTTLE_LIMIT = 15 // Strict limit for suspicious countries (req/min)

// Layer 6: Cookie Sanitization [NEW]
// Cookies to strip from incoming requests (security/privacy)
const STRIPPED_COOKIES = new Set([
  "tracking_id", // Example
  "sensitive_token", // Example
])

// ============================================================================
// RATE LIMITING ENGINE
// ============================================================================

const rateLimits = new Map()

function isRateLimited(key, limit, window) {
  const now = Date.now()
  const record = rateLimits.get(key)

  if (!record || now - record.windowStart > window) {
    rateLimits.set(key, { count: 1, windowStart: now })
    return false
  }

  record.count++
  return record.count > limit
}

// Cleanup interval (approx every 100 requests)
function cleanupRateLimits() {
  const now = Date.now()
  const maxWindow = JS_RATE_WINDOW * 2
  for (const [key, record] of rateLimits.entries()) {
    if (now - record.windowStart > maxWindow) {
      rateLimits.delete(key)
    }
  }
}

// ============================================================================
// MAIN WORKER
// ============================================================================

export default {
  async fetch(request, apiEnv, _ctx) {
    const cf = request.cf || {}
    const country = cf.country
    const asn = cf.asn
    const ip = request.headers.get("cf-connecting-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || ""
    const url = new URL(request.url)
    const path = url.pathname

    // Periodic rate limit cleanup
    if (Math.random() < 0.01) cleanupRateLimits()

    // 1. Geographic & ASN Blocking (Hard Block)
    if (BLOCKED_COUNTRIES.includes(country) || BLOCKED_ASNS.includes(asn)) {
      console.log(
        JSON.stringify({
          action: "BLOCKED",
          reason: "geo_asn",
          country,
          asn,
          ip,
        }),
      )
      return new Response("Access denied", { status: 403 })
    }

    // 2. AI Scraper Blocking
    if (
      AI_SCRAPERS.some((bot) =>
        userAgent.toLowerCase().includes(bot.toLowerCase()),
      )
    ) {
      console.log(
        JSON.stringify({ action: "BLOCKED", reason: "ai_bot", userAgent, ip }),
      )
      return new Response("Access denied", { status: 403 })
    }

    // 3. Suspicious Country Throttling (Layer 5 - New)
    if (THROTTLED_COUNTRIES.includes(country)) {
      if (isRateLimited(`throttle:${ip}`, THROTTLE_LIMIT, 60000)) {
        console.log(
          JSON.stringify({
            action: "THROTTLED",
            reason: "suspicious_country",
            country,
            ip,
          }),
        )
        return new Response("Too Many Requests", {
          status: 429,
          headers: { "Retry-After": "60" },
        })
      }
    }

    // 4. JS Asset Rate Limiting
    if (path.endsWith(".js")) {
      if (isRateLimited(`js:${ip}`, JS_RATE_LIMIT, JS_RATE_WINDOW)) {
        return new Response("Rate limit exceeded", { status: 429 })
      }
    }

    // 5. Cookie Sanitization (Layer 6 - New)
    // Strips specific cookies before forwarding to origin
    let reqToForward = request
    const originalCookies = request.headers.get("Cookie")

    if (
      originalCookies &&
      Array.from(STRIPPED_COOKIES).some((c) => originalCookies.includes(c))
    ) {
      const parts = originalCookies.split(/;\s*/)
      const filteredParts = parts.filter((p) => {
        const name = p.split("=")[0]
        return !STRIPPED_COOKIES.has(name)
      })

      const newHeaders = new Headers(request.headers)
      if (filteredParts.length > 0) {
        newHeaders.set("Cookie", filteredParts.join("; "))
      } else {
        newHeaders.delete("Cookie")
      }

      reqToForward = new Request(request, { headers: newHeaders })
    }

    // Forward to origin
    return fetch(reqToForward)
  },
}
