/**
 * Cloudflare Worker: Bot Traffic Blocker
 *
 * A multi-layer bot protection system for Cloudflare Workers
 * Blocks unwanted bot traffic before it reaches your origin server
 *
 * Features:
 * - Geographic blocking (country-level)
 * - ASN blocking (network-level)
 * - AI scraper blocking
 * - Rate limiting for JS files
 */

// ============================================================================
// CONFIGURATION - Customize these to your needs
// ============================================================================

// Countries to block completely (uses ISO 3166-1 alpha-2 codes)
// Example: Block all traffic from China
const BLOCKED_COUNTRIES = [
  "CN", // China
  // Add more country codes as needed
]

// ASNs (Autonomous System Numbers) to block
// Find ASNs causing issues in your Cloudflare Analytics
const BLOCKED_ASNS = [
  13220,  // Tencent
  132203, // Tencent additional range
  // Add more ASNs as needed
]

// AI scraper user agents to block
// These are bots that scrape content for AI training
const AI_SCRAPERS = [
  "CCBot",           // Common Crawl (feeds AI training datasets)
  "GPTBot",          // OpenAI's crawler
  "ChatGPT-User",    // ChatGPT browsing
  "anthropic-ai",    // Anthropic's crawler
  "ClaudeBot",       // Claude's crawler
  "Google-Extended", // Google's AI training crawler
  "FacebookBot",     // Meta's AI crawler
  "Bytespider",      // ByteDance/TikTok crawler
  "Amazonbot",       // Amazon's crawler
  "Omgilibot",       // Omgili crawler
  "PetalBot",        // Huawei's crawler
  "Sogou",           // Chinese search engine
  "Baiduspider",     // Baidu search engine
  "YandexBot",       // Russian search engine
]

// Rate limiting configuration
const JS_RATE_LIMIT = 100        // Requests per minute per IP
const JS_RATE_WINDOW = 60000     // 1 minute in milliseconds

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimits = new Map()

/**
 * Check if request exceeds rate limit
 */
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

/**
 * Clean up old rate limit records (called periodically)
 */
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
  async fetch(request, _env, _ctx) {
    const cf = request.cf || {}
    const country = cf.country
    const asn = cf.asn
    const ip = request.headers.get("cf-connecting-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || ""

    const url = new URL(request.url)
    const path = url.pathname

    // Periodic cleanup (every ~100 requests)
    if (Math.random() < 0.01) {
      cleanupRateLimits()
    }

    // ========================================================================
    // LAYER 1: Geographic Blocking
    // ========================================================================
    if (BLOCKED_COUNTRIES.includes(country)) {
      console.log(
        JSON.stringify({
          action: "BLOCKED",
          reason: "blocked_country",
          country,
          ip,
          path,
          timestamp: new Date().toISOString(),
        })
      )

      return new Response("Access denied", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
          "X-Blocked-Reason": "geographic",
        },
      })
    }

    // ASN blocking (network-level)
    if (BLOCKED_ASNS.includes(asn)) {
      console.log(
        JSON.stringify({
          action: "BLOCKED",
          reason: "blocked_asn",
          asn,
          country,
          ip,
          path,
          timestamp: new Date().toISOString(),
        })
      )

      return new Response("Access denied", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
          "X-Blocked-Reason": "network",
        },
      })
    }

    // ========================================================================
    // LAYER 2: AI Scraper Blocking
    // ========================================================================
    const isAiScraper = AI_SCRAPERS.some((bot) =>
      userAgent.toLowerCase().includes(bot.toLowerCase())
    )

    if (isAiScraper) {
      console.log(
        JSON.stringify({
          action: "BLOCKED",
          reason: "ai_scraper",
          userAgent: userAgent.slice(0, 100),
          ip,
          path,
          timestamp: new Date().toISOString(),
        })
      )

      return new Response("Access denied", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
          "X-Blocked-Reason": "bot",
        },
      })
    }

    // ========================================================================
    // LAYER 3: Rate Limiting (JavaScript files)
    // ========================================================================
    if (path.endsWith(".js")) {
      if (isRateLimited(`js:${ip}`, JS_RATE_LIMIT, JS_RATE_WINDOW)) {
        console.log(
          JSON.stringify({
            action: "RATE_LIMITED",
            reason: "js_rate_limit",
            ip,
            path,
            timestamp: new Date().toISOString(),
          })
        )

        return new Response("Rate limit exceeded", {
          status: 429,
          headers: {
            "Content-Type": "text/plain",
            "Retry-After": "60",
            "X-Blocked-Reason": "rate_limit",
          },
        })
      }
    }

    // ========================================================================
    // ALLOW: Pass through to origin
    // ========================================================================
    return fetch(request)
  },
}
