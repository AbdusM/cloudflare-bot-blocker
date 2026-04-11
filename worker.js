import { createPolicyConfig } from "./src/config.js"
import { logDecision } from "./src/logging.js"
import { buildRequestContext, evaluateRequest } from "./src/policy.js"
import { buildEnforcementResponse, buildOperationalResponse } from "./src/responses.js"
import { createRateLimiter, InMemoryRateLimiter, RateLimiterDurableObject } from "./src/rate-limiter.js"

const fallbackRateLimiter = new InMemoryRateLimiter()

function shouldLogDecision(decision) {
  return decision.action !== "allow" || decision.reason === "rate_limiter_unavailable"
}

function sanitizeRequestCookies(request, strippedCookies) {
  if (strippedCookies.length === 0) {
    return { request, strippedCookieNames: [] }
  }

  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) {
    return { request, strippedCookieNames: [] }
  }

  const blockedNames = new Set(strippedCookies.map((value) => value.toLowerCase()))
  const keptParts = []
  const strippedCookieNames = []

  for (const part of cookieHeader.split(/;\s*/)) {
    const [rawName] = part.split("=")
    const name = rawName?.trim()

    if (!name) {
      continue
    }

    if (blockedNames.has(name.toLowerCase())) {
      strippedCookieNames.push(name)
      continue
    }

    keptParts.push(part)
  }

  if (strippedCookieNames.length === 0) {
    return { request, strippedCookieNames }
  }

  const headers = new Headers(request.headers)
  if (keptParts.length > 0) {
    headers.set("cookie", keptParts.join("; "))
  } else {
    headers.delete("cookie")
  }

  return {
    request: new Request(request, { headers }),
    strippedCookieNames,
  }
}

function applyCookieDeletionsToResponse(response, strippedCookieNames, config) {
  if (!config.deleteStrippedCookies || strippedCookieNames.length === 0) {
    return response
  }

  const headers = new Headers(response.headers)

  for (const cookieName of strippedCookieNames) {
    const attrs = [
      `${cookieName}=deleted`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
    ]

    if (config.cookieDeleteDomain) {
      attrs.splice(1, 0, `Domain=${config.cookieDeleteDomain}`)
    }

    headers.append("Set-Cookie", attrs.join("; "))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function shouldServeOperationalResponse(context, config) {
  return context.pathname === config.healthPath || (
    context.url.hostname.endsWith(".workers.dev") &&
    !config.upstreamOrigin
  )
}

function buildUpstreamRequest(request, upstreamOrigin) {
  if (!upstreamOrigin) {
    return request
  }

  const originalUrl = new URL(request.url)
  const targetOrigin = new URL(upstreamOrigin)
  targetOrigin.pathname = originalUrl.pathname
  targetOrigin.search = originalUrl.search

  return new Request(targetOrigin.toString(), request)
}

export default {
  async fetch(request, env) {
    const config = createPolicyConfig(env)
    const context = buildRequestContext(request)
    const rateLimiter = createRateLimiter(env, fallbackRateLimiter)
    const decision = await evaluateRequest({
      context,
      config,
      rateLimiter,
    })

    if (shouldLogDecision(decision)) {
      logDecision({
        context,
        decision,
        config,
        rateLimiterKind: rateLimiter.kind,
      })
    }

    if (decision.action === "block") {
      return buildEnforcementResponse(context, decision, config)
    }

    if (shouldServeOperationalResponse(context, config)) {
      return buildOperationalResponse(context, config)
    }

    const { request: sanitizedRequest, strippedCookieNames } = sanitizeRequestCookies(
      request,
      config.strippedCookies
    )

    if (strippedCookieNames.length > 0) {
      console.log(
        JSON.stringify({
          action: "SANITIZED",
          reason: "stripped_cookies",
          path: context.pathname,
          ip: context.ip,
          requestId: context.requestId,
          strippedCookieNames,
          timestamp: new Date().toISOString(),
        })
      )
    }

    const originResponse = await fetch(buildUpstreamRequest(sanitizedRequest, config.upstreamOrigin))
    return applyCookieDeletionsToResponse(originResponse, strippedCookieNames, config)
  },
}

export { RateLimiterDurableObject }
