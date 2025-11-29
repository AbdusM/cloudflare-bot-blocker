/**
 * STRICT BLOCKING EXAMPLE
 *
 * Maximum protection - blocks most non-US traffic and all AI scrapers
 * Use this if you primarily serve US customers and want aggressive bot protection
 */

// Block all countries except US, Canada, UK, EU
const ALLOWED_COUNTRIES = ["US", "CA", "GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "DK", "FI"]

// Extensive ASN blocklist
const BLOCKED_ASNS = [
  13220, 132203,  // Tencent
  45090,          // Tencent Cloud
  4134,           // ChinaNet
  4837,           // China Unicom
  9808,           // China Mobile
  24940,          // Hetzner (often used by scrapers)
  16276,          // OVH (often used by scrapers)
]

// Block all AI scrapers
const AI_SCRAPERS = [
  "CCBot", "GPTBot", "ChatGPT-User", "anthropic-ai", "ClaudeBot",
  "Google-Extended", "FacebookBot", "Bytespider", "Amazonbot",
  "Omgilibot", "PetalBot", "Sogou", "Baiduspider", "YandexBot",
  "PerplexityBot", "YouBot", "Diffbot",
]

// Strict rate limiting
const JS_RATE_LIMIT = 30        // Only 30 requests per minute
const JS_RATE_WINDOW = 60000

export default {
  async fetch(request, env, ctx) {
    const cf = request.cf || {}

    // Whitelist approach - only allow specific countries
    if (!ALLOWED_COUNTRIES.includes(cf.country)) {
      return new Response("Access denied", { status: 403 })
    }

    // Block known bot ASNs
    if (BLOCKED_ASNS.includes(cf.asn)) {
      return new Response("Access denied", { status: 403 })
    }

    // Block all AI scrapers
    const userAgent = request.headers.get("user-agent") || ""
    if (AI_SCRAPERS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()))) {
      return new Response("Access denied", { status: 403 })
    }

    return fetch(request)
  }
}
