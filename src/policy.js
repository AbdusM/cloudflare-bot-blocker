function createRequestId(request) {
  const cfRay = request.headers.get("cf-ray")
  if (cfRay) {
    return cfRay
  }

  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `req-${Date.now()}`
}

function matchesPrefix(pathname, prefixes) {
  if (prefixes.length === 0) {
    return true
  }

  return prefixes.some((prefix) => pathname.startsWith(prefix))
}

function matchesConfiguredPrefix(pathname, prefixes) {
  return prefixes.length > 0 && prefixes.some((prefix) => pathname.startsWith(prefix))
}

function matchesSuffix(pathname, suffixes) {
  return suffixes.some((suffix) => pathname.endsWith(suffix))
}

function pathContainsMarker(pathname, markers) {
  if (markers.length === 0) {
    return true
  }

  return markers.some((marker) => pathname.includes(marker))
}

function isSameOriginPageUrl(requestOrigin, candidateUrl) {
  if (!candidateUrl) {
    return false
  }

  try {
    const parsed = new URL(candidateUrl)
    return parsed.origin === requestOrigin && !parsed.pathname.startsWith("/_astro/")
  } catch {
    return false
  }
}

function isLikelySameOriginBrowserAssetRequest(context) {
  const requestOrigin = context.url.origin

  if (isSameOriginPageUrl(requestOrigin, context.referer)) {
    return true
  }

  if (isSameOriginPageUrl(requestOrigin, context.origin)) {
    return true
  }

  return (
    (context.secFetchSite === "same-origin" || context.secFetchSite === "same-site") &&
    context.secFetchDest === "script" &&
    (context.secFetchMode === "cors" || context.secFetchMode === "no-cors")
  )
}

function createDecision({
  action,
  status = 200,
  reason,
  category,
  message,
  metadata = {},
  retryAfter,
  enforced = false,
  wouldBlock = false,
  monitored = false,
}) {
  return {
    action,
    status,
    reason,
    category,
    message,
    metadata,
    retryAfter,
    enforced,
    wouldBlock,
    monitored,
  }
}

function enforcementDecision(config, details) {
  if (config.mode === "monitor") {
    return createDecision({
      ...details,
      action: "log",
      status: 200,
      enforced: false,
      wouldBlock: true,
    })
  }

  return createDecision({
    ...details,
    action: "block",
    enforced: true,
    wouldBlock: true,
  })
}

function monitoringDecision(details) {
  return createDecision({
    ...details,
    action: "log",
    monitored: true,
    enforced: false,
    wouldBlock: false,
  })
}

export function buildRequestContext(request) {
  const url = new URL(request.url)
  const cf = request.cf || {}
  const ip = request.headers.get("cf-connecting-ip") || "unknown"
  const accept = request.headers.get("accept") || ""
  const userAgent = request.headers.get("user-agent") || ""
  const referer = request.headers.get("referer") || ""
  const origin = request.headers.get("origin") || ""
  const secFetchSite = request.headers.get("sec-fetch-site") || ""
  const secFetchDest = request.headers.get("sec-fetch-dest") || ""
  const secFetchMode = request.headers.get("sec-fetch-mode") || ""
  const parsedAsn = Number(cf.asn)

  return {
    requestId: createRequestId(request),
    method: request.method.toUpperCase(),
    url,
    pathname: url.pathname,
    pathnameLower: url.pathname.toLowerCase(),
    ip,
    country: cf.country || "unknown",
    asn: Number.isFinite(parsedAsn) ? parsedAsn : undefined,
    accept,
    userAgent,
    referer,
    origin,
    secFetchSite,
    secFetchDest,
    secFetchMode,
  }
}

export async function evaluateRequest({ context, config, rateLimiter }) {
  const protectedPathMatch = matchesConfiguredPrefix(
    context.pathname,
    config.protectedPathPrefixes
  )
  const protectedPathMetadata = protectedPathMatch
    ? {
        protectedPath: true,
      }
    : {}

  if (config.bypassMethods.has(context.method)) {
    return createDecision({
      action: "allow",
      reason: "bypass_method",
      category: "workflow",
      message: "Method bypassed",
    })
  }

  if (config.allowedIps.includes(context.ip)) {
    return createDecision({
      action: "allow",
      reason: "allowlisted_ip",
      category: "workflow",
      message: "IP allowlisted",
    })
  }

  if (
    config.allowedCountries.length > 0 &&
    !config.allowedCountries.includes(context.country)
  ) {
    return enforcementDecision(config, {
      status: 403,
      reason: "country_not_allowed",
      category: "geo",
      message: "Traffic from your region is not currently allowed.",
      metadata: {
        country: context.country,
        ...protectedPathMetadata,
      },
    })
  }

  if (config.blockedCountries.includes(context.country)) {
    return enforcementDecision(config, {
      status: 403,
      reason: "blocked_country",
      category: "geo",
      message: "Traffic from your region is blocked by policy.",
      metadata: {
        country: context.country,
        ...protectedPathMetadata,
      },
    })
  }

  if (config.monitoredCountries.includes(context.country)) {
    return monitoringDecision({
      reason: "monitored_country",
      category: "geo",
      message: "Traffic from this region matched a monitor-only rule.",
      metadata: {
        country: context.country,
        ...protectedPathMetadata,
      },
    })
  }

  if (config.blockedAsns.includes(context.asn)) {
    return enforcementDecision(config, {
      status: 403,
      reason: "blocked_asn",
      category: "network",
      message: "Traffic from your network is blocked by policy.",
      metadata: {
        asn: context.asn,
        ...protectedPathMetadata,
      },
    })
  }

  if (config.monitoredAsns.includes(context.asn)) {
    return monitoringDecision({
      reason: "monitored_asn",
      category: "network",
      message: "Traffic from this network matched a monitor-only rule.",
      metadata: {
        asn: context.asn,
        ...protectedPathMetadata,
      },
    })
  }

  const matchedScraper = config.blockedScrapers.find((scraper) =>
    context.userAgent.toLowerCase().includes(scraper.toLowerCase())
  )

  if (matchedScraper) {
    return enforcementDecision(config, {
      status: 403,
      reason: "blocked_scraper",
      category: "scraper",
      message: "Automated access is blocked by policy.",
      metadata: {
        matchedScraper,
        ...protectedPathMetadata,
      },
    })
  }

  const monitoredScraper = config.monitoredScrapers.find((scraper) =>
    context.userAgent.toLowerCase().includes(scraper.toLowerCase())
  )

  if (monitoredScraper) {
    return monitoringDecision({
      reason: "monitored_scraper",
      category: "scraper",
      message: "Automated access matched a monitor-only rule.",
      metadata: {
        matchedScraper: monitoredScraper,
        ...protectedPathMetadata,
      },
    })
  }

  if (config.throttledCountries.includes(context.country)) {
    if (context.ip === "unknown") {
      return createDecision({
        action: "allow",
        reason: "missing_throttle_key",
        category: "geo_throttle",
        message: "Country throttling skipped because request identity is unavailable.",
      })
    }

    try {
      const result = await rateLimiter.consume({
        key: `country:${context.country}:${context.ip}`,
        limit: config.throttleLimit,
        windowMs: 60_000,
      })

      if (result.limited) {
        return enforcementDecision(config, {
          status: 429,
          reason: "country_throttle_exceeded",
          category: "geo_throttle",
          message: "Traffic from your region is temporarily throttled. Please retry shortly.",
          retryAfter: result.retryAfter,
          metadata: {
            remaining: result.remaining,
            resetAt: result.resetAt,
            country: context.country,
            ...protectedPathMetadata,
          },
        })
      }
    } catch (_error) {
      return createDecision({
        action: "allow",
        reason: "rate_limiter_unavailable",
        category: "geo_throttle",
        message: "Country throttling unavailable; request allowed to protect availability.",
      })
    }
  }

  const sameOriginAssetRequest = isLikelySameOriginBrowserAssetRequest(context)
  const shouldApplyStrictRateLimit =
    config.strictRateLimit.enabled &&
    config.strictRateLimit.limit > 0 &&
    matchesPrefix(context.pathname, config.strictRateLimit.pathPrefixes) &&
    matchesSuffix(context.pathnameLower, config.strictRateLimit.pathSuffixes) &&
    pathContainsMarker(context.pathname, config.strictRateLimit.markers)

  if (shouldApplyStrictRateLimit) {
    if (context.ip === "unknown") {
      return createDecision({
        action: "allow",
        reason: "missing_strict_rate_limit_key",
        category: "strict_rate_limit",
        message: "Strict rate limiting skipped because request identity is unavailable.",
      })
    }

    try {
      const result = await rateLimiter.consume({
        key: `strict-asset:${context.ip}`,
        limit: config.strictRateLimit.limit,
        windowMs: config.strictRateLimit.windowMs,
      })

      if (result.limited) {
        return enforcementDecision(config, {
          status: 429,
          reason: "strict_rate_limit_exceeded",
          category: "strict_rate_limit",
          message: "Too many high-risk asset requests in a short period. Please retry shortly.",
          retryAfter: result.retryAfter,
          metadata: {
            remaining: result.remaining,
            resetAt: result.resetAt,
          },
        })
      }
    } catch (_error) {
      return createDecision({
        action: "allow",
        reason: "strict_rate_limiter_unavailable",
        category: "strict_rate_limit",
        message: "Strict rate limiter unavailable; request allowed to protect availability.",
      })
    }
  }

  const shouldRateLimit =
    config.rateLimit.enabled &&
    config.rateLimit.limit > 0 &&
    matchesPrefix(context.pathname, config.rateLimit.pathPrefixes) &&
    matchesSuffix(context.pathnameLower, config.rateLimit.pathSuffixes) &&
    (!config.rateLimit.bypassSameOriginAssetRequests || !sameOriginAssetRequest)

  if (shouldRateLimit) {
    if (context.ip === "unknown") {
      return createDecision({
        action: "allow",
        reason: "missing_rate_limit_key",
        category: "rate_limit",
        message: "Rate limiting skipped because request identity is unavailable.",
      })
    }

    try {
      const result = await rateLimiter.consume({
        key: `asset:${context.ip}`,
        limit: config.rateLimit.limit,
        windowMs: config.rateLimit.windowMs,
      })

      if (result.limited) {
        return enforcementDecision(config, {
          status: 429,
          reason: "rate_limit_exceeded",
          category: "rate_limit",
          message: "Too many requests in a short period. Please retry shortly.",
          retryAfter: result.retryAfter,
          metadata: {
            remaining: result.remaining,
            resetAt: result.resetAt,
          },
        })
      }

      return createDecision({
        action: "allow",
        reason: "within_rate_limit",
        category: "rate_limit",
        message: "Within rate limit.",
        metadata: {
          remaining: result.remaining,
          resetAt: result.resetAt,
        },
      })
    } catch (_error) {
      return createDecision({
        action: "allow",
        reason: "rate_limiter_unavailable",
        category: "rate_limit",
        message: "Rate limiter unavailable; request allowed to protect availability.",
      })
    }
  }

  return createDecision({
    action: "allow",
    reason: "allowed",
    category: "pass",
    message: "Request allowed.",
  })
}
