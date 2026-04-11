const AI_TRAINING_SCRAPERS = [
  "CCBot",
  "GPTBot",
  "anthropic-ai",
  "ClaudeBot",
  "Google-Extended",
  "FacebookBot",
  "Bytespider",
  "Amazonbot",
  "Omgilibot",
  "PetalBot",
]

const AI_BROWSING_SCRAPERS = [
  "ChatGPT-User",
]

const SEARCH_SCRAPERS = [
  "Sogou",
  "Baiduspider",
  "YandexBot",
]

const AGGRESSIVE_SCRAPERS = [
  "PerplexityBot",
  "YouBot",
  "Diffbot",
]

function dedupe(values) {
  return [...new Set(values)]
}

export const DEFAULT_MODE = "monitor"
export const DEFAULT_PRESET_NAME = "balanced"

export const SCRAPER_GROUPS = {
  aiTraining: AI_TRAINING_SCRAPERS,
  aiBrowsing: AI_BROWSING_SCRAPERS,
  search: SEARCH_SCRAPERS,
  aggressive: AGGRESSIVE_SCRAPERS,
}

export const PRESETS = {
  conservative: {
    blockedCountries: [],
    monitoredCountries: [],
    allowedCountries: [],
    throttledCountries: [],
    throttleLimit: 15,
    blockedAsns: [13220, 132203],
    monitoredAsns: [],
    blockedScrapers: dedupe([
      ...AI_TRAINING_SCRAPERS,
    ]),
    monitoredScrapers: [],
    allowedIps: [],
    strippedCookies: [],
    protectedPathPrefixes: [],
    bypassMethods: ["OPTIONS"],
    rateLimit: {
      enabled: true,
      limit: 120,
      windowMs: 60_000,
      pathPrefixes: [],
      pathSuffixes: [".js"],
      bypassSameOriginAssetRequests: false,
    },
    strictRateLimit: {
      enabled: false,
      limit: 30,
      windowMs: 60_000,
      pathPrefixes: [],
      pathSuffixes: [".js"],
      markers: [],
    },
  },
  balanced: {
    blockedCountries: ["CN"],
    monitoredCountries: [],
    allowedCountries: [],
    throttledCountries: [],
    throttleLimit: 15,
    blockedAsns: [13220, 132203],
    monitoredAsns: [],
    blockedScrapers: dedupe([
      ...AI_TRAINING_SCRAPERS,
      ...AI_BROWSING_SCRAPERS,
    ]),
    monitoredScrapers: [],
    allowedIps: [],
    strippedCookies: [],
    protectedPathPrefixes: [],
    bypassMethods: ["OPTIONS"],
    rateLimit: {
      enabled: true,
      limit: 100,
      windowMs: 60_000,
      pathPrefixes: [],
      pathSuffixes: [".js"],
      bypassSameOriginAssetRequests: false,
    },
    strictRateLimit: {
      enabled: false,
      limit: 30,
      windowMs: 60_000,
      pathPrefixes: [],
      pathSuffixes: [".js"],
      markers: [],
    },
  },
  aggressive: {
    blockedCountries: [],
    monitoredCountries: [],
    allowedCountries: ["US", "CA", "GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "DK", "FI"],
    throttledCountries: [],
    throttleLimit: 15,
    blockedAsns: [13220, 132203, 45090, 4134, 4837, 9808, 24940, 16276],
    monitoredAsns: [],
    blockedScrapers: dedupe([
      ...AI_TRAINING_SCRAPERS,
      ...AI_BROWSING_SCRAPERS,
      ...SEARCH_SCRAPERS,
      ...AGGRESSIVE_SCRAPERS,
    ]),
    monitoredScrapers: [],
    allowedIps: [],
    strippedCookies: [],
    protectedPathPrefixes: [],
    bypassMethods: ["OPTIONS"],
    rateLimit: {
      enabled: true,
      limit: 30,
      windowMs: 60_000,
      pathPrefixes: [],
      pathSuffixes: [".js", ".css", ".json", ".map"],
      bypassSameOriginAssetRequests: false,
    },
    strictRateLimit: {
      enabled: false,
      limit: 15,
      windowMs: 60_000,
      pathPrefixes: [],
      pathSuffixes: [".js"],
      markers: [],
    },
  },
}
