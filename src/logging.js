export function logDecision({ context, decision, config, rateLimiterKind }) {
  console.log(
    JSON.stringify({
      action: decision.action.toUpperCase(),
      category: decision.category,
      reason: decision.reason,
      enforced: decision.enforced,
      wouldBlock: decision.wouldBlock,
      monitored: decision.monitored,
      mode: config.mode,
      preset: config.presetName,
      method: context.method,
      path: context.pathname,
      ip: context.ip,
      country: context.country,
      asn: context.asn,
      requestId: context.requestId,
      protectedPath: decision.metadata.protectedPath,
      matchedScraper: decision.metadata.matchedScraper,
      strippedCookieNames: decision.metadata.strippedCookieNames,
      rateLimiterKind,
      timestamp: new Date().toISOString(),
    })
  )
}
