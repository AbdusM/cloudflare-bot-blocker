import { DEFAULT_MODE, DEFAULT_PRESET_NAME, PRESETS } from "./presets.js"

function hasEnvValue(env, key) {
  return Object.prototype.hasOwnProperty.call(env, key)
}

function parseList(value, normalize) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value !== "string") {
    return undefined
  }

  if (value.trim() === "") {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalize)
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  const normalized = String(value).trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return undefined
}

function pickList(env, key, fallback, normalize = (value) => value) {
  return hasEnvValue(env, key) ? (parseList(env[key], normalize) ?? fallback) : fallback
}

function pickNumber(env, key, fallback) {
  return hasEnvValue(env, key) ? (parseNumber(env[key]) ?? fallback) : fallback
}

function pickBoolean(env, key, fallback) {
  return hasEnvValue(env, key) ? (parseBoolean(env[key]) ?? fallback) : fallback
}

function normalizeCountry(value) {
  return value.toUpperCase()
}

function normalizeAsn(value) {
  return Number(value)
}

function normalizeSuffix(value) {
  return value.toLowerCase()
}

function normalizeMethod(value) {
  return value.toUpperCase()
}

export function createPolicyConfig(env = {}) {
  const requestedPreset = String(env.BOT_BLOCKER_PRESET || DEFAULT_PRESET_NAME).trim().toLowerCase()
  const presetName = PRESETS[requestedPreset] ? requestedPreset : DEFAULT_PRESET_NAME
  const basePreset = PRESETS[presetName]

  const requestedMode = String(env.BOT_BLOCKER_MODE || DEFAULT_MODE).trim().toLowerCase()
  const mode = requestedMode === "enforce" ? "enforce" : DEFAULT_MODE

  const supportUrl = typeof env.BOT_BLOCKER_SUPPORT_URL === "string"
    ? env.BOT_BLOCKER_SUPPORT_URL.trim()
    : ""

  const upstreamOrigin = typeof env.BOT_BLOCKER_UPSTREAM_ORIGIN === "string"
    ? env.BOT_BLOCKER_UPSTREAM_ORIGIN.trim()
    : ""

  const healthPath = typeof env.BOT_BLOCKER_HEALTH_PATH === "string" && env.BOT_BLOCKER_HEALTH_PATH.trim()
    ? env.BOT_BLOCKER_HEALTH_PATH.trim()
    : "/_bot-blocker/health"

  const blockedCountries = pickList(
    env,
    "BOT_BLOCKER_BLOCKED_COUNTRIES",
    basePreset.blockedCountries,
    normalizeCountry
  )

  const monitoredCountries = pickList(
    env,
    "BOT_BLOCKER_MONITORED_COUNTRIES",
    basePreset.monitoredCountries,
    normalizeCountry
  )

  const allowedCountries = pickList(
    env,
    "BOT_BLOCKER_ALLOWED_COUNTRIES",
    basePreset.allowedCountries,
    normalizeCountry
  )

  const throttledCountries = pickList(
    env,
    "BOT_BLOCKER_THROTTLED_COUNTRIES",
    basePreset.throttledCountries,
    normalizeCountry
  )

  const blockedAsns = pickList(
    env,
    "BOT_BLOCKER_BLOCKED_ASNS",
    basePreset.blockedAsns,
    normalizeAsn
  ).filter(Number.isFinite)

  const monitoredAsns = pickList(
    env,
    "BOT_BLOCKER_MONITORED_ASNS",
    basePreset.monitoredAsns,
    normalizeAsn
  ).filter(Number.isFinite)

  const blockedScrapers = pickList(
    env,
    "BOT_BLOCKER_BLOCKED_SCRAPERS",
    basePreset.blockedScrapers,
    (value) => value
  )

  const monitoredScrapers = pickList(
    env,
    "BOT_BLOCKER_MONITORED_SCRAPERS",
    basePreset.monitoredScrapers,
    (value) => value
  )

  const allowedIps = pickList(
    env,
    "BOT_BLOCKER_ALLOWED_IPS",
    basePreset.allowedIps,
    (value) => value
  )

  const strippedCookies = pickList(
    env,
    "BOT_BLOCKER_STRIPPED_COOKIES",
    basePreset.strippedCookies,
    (value) => value
  )

  const deleteStrippedCookies = pickBoolean(
    env,
    "BOT_BLOCKER_DELETE_STRIPPED_COOKIES",
    false
  )

  const cookieDeleteDomain = typeof env.BOT_BLOCKER_COOKIE_DELETE_DOMAIN === "string"
    ? env.BOT_BLOCKER_COOKIE_DELETE_DOMAIN.trim()
    : ""

  const protectedPathPrefixes = pickList(
    env,
    "BOT_BLOCKER_PROTECTED_PATH_PREFIXES",
    basePreset.protectedPathPrefixes,
    (value) => value
  )

  const bypassMethods = pickList(
    env,
    "BOT_BLOCKER_BYPASS_METHODS",
    basePreset.bypassMethods,
    normalizeMethod
  )

  const rateLimit = {
    enabled: pickBoolean(
      env,
      "BOT_BLOCKER_RATE_LIMIT_ENABLED",
      basePreset.rateLimit.enabled
    ),
    limit: pickNumber(env, "BOT_BLOCKER_RATE_LIMIT", basePreset.rateLimit.limit),
    windowMs: pickNumber(
      env,
      "BOT_BLOCKER_RATE_WINDOW_MS",
      basePreset.rateLimit.windowMs
    ),
    pathSuffixes: pickList(
      env,
      "BOT_BLOCKER_RATE_LIMIT_PATH_SUFFIXES",
      basePreset.rateLimit.pathSuffixes,
      normalizeSuffix
    ),
    pathPrefixes: pickList(
      env,
      "BOT_BLOCKER_RATE_LIMIT_PATH_PREFIXES",
      basePreset.rateLimit.pathPrefixes,
      (value) => value
    ),
    bypassSameOriginAssetRequests: pickBoolean(
      env,
      "BOT_BLOCKER_RATE_LIMIT_BYPASS_SAME_ORIGIN_ASSETS",
      basePreset.rateLimit.bypassSameOriginAssetRequests
    ),
  }

  const strictRateLimit = {
    enabled: pickBoolean(
      env,
      "BOT_BLOCKER_STRICT_RATE_LIMIT_ENABLED",
      basePreset.strictRateLimit.enabled
    ),
    limit: pickNumber(
      env,
      "BOT_BLOCKER_STRICT_RATE_LIMIT",
      basePreset.strictRateLimit.limit
    ),
    windowMs: pickNumber(
      env,
      "BOT_BLOCKER_STRICT_RATE_WINDOW_MS",
      basePreset.strictRateLimit.windowMs
    ),
    pathPrefixes: pickList(
      env,
      "BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_PREFIXES",
      basePreset.strictRateLimit.pathPrefixes,
      (value) => value
    ),
    pathSuffixes: pickList(
      env,
      "BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_SUFFIXES",
      basePreset.strictRateLimit.pathSuffixes,
      normalizeSuffix
    ),
    markers: pickList(
      env,
      "BOT_BLOCKER_STRICT_RATE_LIMIT_MARKERS",
      basePreset.strictRateLimit.markers,
      (value) => value
    ),
  }

  const throttleLimit = pickNumber(
    env,
    "BOT_BLOCKER_THROTTLE_LIMIT",
    basePreset.throttleLimit
  )

  return {
    mode,
    presetName,
    supportUrl,
    upstreamOrigin,
    healthPath,
    blockedCountries,
    monitoredCountries,
    allowedCountries,
    throttledCountries,
    blockedAsns,
    monitoredAsns,
    blockedScrapers,
    monitoredScrapers,
    allowedIps,
    strippedCookies,
    deleteStrippedCookies,
    cookieDeleteDomain,
    protectedPathPrefixes,
    bypassMethods: new Set(bypassMethods),
    rateLimit,
    strictRateLimit,
    throttleLimit,
  }
}
