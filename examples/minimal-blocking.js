/**
 * MINIMAL BLOCKING EXAMPLE
 *
 * Light protection - only blocks the worst offenders
 * Use this if you have global customers and want minimal false positives
 */

// Only block the most problematic countries
const BLOCKED_COUNTRIES = [
  "CN",  // China - primary bot source
]

// Only block the most abusive networks
const BLOCKED_ASNS = [
  13220,  // Tencent
  132203, // Tencent additional
]

// Only block AI scrapers that don't respect robots.txt
const AI_SCRAPERS = [
  "CCBot",           // Common Crawl
  "Bytespider",      // ByteDance
  "Baiduspider",     // Baidu
]

// Permissive rate limiting
const JS_RATE_LIMIT = 200       // 200 requests per minute
const JS_RATE_WINDOW = 60000

export default {
  async fetch(request, env, ctx) {
    const cf = request.cf || {}
    const country = cf.country
    const asn = cf.asn
    const userAgent = request.headers.get("user-agent") || ""

    // Block specific countries
    if (BLOCKED_COUNTRIES.includes(country)) {
      return new Response("Access denied", { status: 403 })
    }

    // Block specific ASNs
    if (BLOCKED_ASNS.includes(asn)) {
      return new Response("Access denied", { status: 403 })
    }

    // Block worst AI scrapers
    if (AI_SCRAPERS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()))) {
      return new Response("Access denied", { status: 403 })
    }

    return fetch(request)
  }
}
