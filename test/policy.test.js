import test from "node:test"
import assert from "node:assert/strict"

import { createPolicyConfig } from "../src/config.js"
import { buildRequestContext, evaluateRequest } from "../src/policy.js"
import { InMemoryRateLimiter, RateLimiterDurableObject } from "../src/rate-limiter.js"

function createRequest(url, { method = "GET", headers = {}, cf = {} } = {}) {
  const request = new Request(url, {
    method,
    headers,
  })

  Object.defineProperty(request, "cf", {
    value: cf,
    configurable: true,
  })

  return request
}

test("default config is monitor mode with balanced preset", () => {
  const config = createPolicyConfig()

  assert.equal(config.mode, "monitor")
  assert.equal(config.presetName, "balanced")
  assert.deepEqual(config.blockedCountries, ["CN"])
  assert.deepEqual(config.monitoredCountries, [])
  assert.equal(config.rateLimit.limit, 100)
  assert.deepEqual(config.throttledCountries, [])
  assert.deepEqual(config.strippedCookies, [])
  assert.deepEqual(config.monitoredAsns, [])
  assert.deepEqual(config.monitoredScrapers, [])
})

test("monitor mode logs blocked countries instead of enforcing them", async () => {
  const request = createRequest("https://example.com/app.js", {
    headers: {
      "cf-connecting-ip": "1.2.3.4",
      "user-agent": "Mozilla/5.0",
    },
    cf: {
      country: "CN",
      asn: 12345,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig(),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "log")
  assert.equal(decision.reason, "blocked_country")
  assert.equal(decision.wouldBlock, true)
  assert.equal(decision.enforced, false)
})

test("enforce mode blocks requests from blocked networks", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      "cf-connecting-ip": "2.2.2.2",
    },
    cf: {
      country: "US",
      asn: 13220,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "block")
  assert.equal(decision.status, 403)
  assert.equal(decision.reason, "blocked_asn")
})

test("enforce mode only logs monitor-only countries", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      "cf-connecting-ip": "2.2.2.2",
    },
    cf: {
      country: "SG",
      asn: 12345,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
      BOT_BLOCKER_MONITORED_COUNTRIES: "SG",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "log")
  assert.equal(decision.reason, "monitored_country")
  assert.equal(decision.monitored, true)
  assert.equal(decision.wouldBlock, false)
})

test("enforce mode only logs monitor-only networks", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      "cf-connecting-ip": "2.2.2.2",
    },
    cf: {
      country: "US",
      asn: 16509,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
      BOT_BLOCKER_MONITORED_ASNS: "16509",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "log")
  assert.equal(decision.reason, "monitored_asn")
  assert.equal(decision.monitored, true)
})

test("enforce mode only logs monitor-only scrapers", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      "cf-connecting-ip": "2.2.2.2",
      "user-agent": "Diffbot/1.0",
    },
    cf: {
      country: "US",
      asn: 12345,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
      BOT_BLOCKER_MONITORED_SCRAPERS: "Diffbot",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "log")
  assert.equal(decision.reason, "monitored_scraper")
  assert.equal(decision.monitored, true)
  assert.equal(decision.metadata.matchedScraper, "Diffbot")
})

test("allowlisted IPs bypass blocking policy", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      "cf-connecting-ip": "7.7.7.7",
    },
    cf: {
      country: "CN",
      asn: 13220,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
      BOT_BLOCKER_ALLOWED_IPS: "7.7.7.7",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "allow")
  assert.equal(decision.reason, "allowlisted_ip")
})

test("protected path prefixes do not narrow global scraper blocks", async () => {
  const request = createRequest("https://example.com/marketing", {
    headers: {
      "cf-connecting-ip": "4.4.4.4",
      "user-agent": "GPTBot/1.0",
    },
    cf: {
      country: "US",
      asn: 12345,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
      BOT_BLOCKER_PROTECTED_PATH_PREFIXES: "/api,/assets",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "block")
  assert.equal(decision.reason, "blocked_scraper")
  assert.equal(decision.metadata.protectedPath, undefined)
})

test("explicit asset controls still apply outside protected page prefixes", async () => {
  const rateLimiter = new InMemoryRateLimiter()
  let decision

  for (let index = 0; index < 3; index += 1) {
    decision = await evaluateRequest({
      context: buildRequestContext(createRequest("https://example.com/_assets/SensitiveModule.chunk.js", {
        headers: {
          accept: "application/json",
          "cf-connecting-ip": "10.10.10.10",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      })),
      config: createPolicyConfig({
        BOT_BLOCKER_MODE: "enforce",
        BOT_BLOCKER_PROTECTED_PATH_PREFIXES: "/app,/dashboard/",
        BOT_BLOCKER_STRICT_RATE_LIMIT_ENABLED: "true",
        BOT_BLOCKER_STRICT_RATE_LIMIT: "2",
        BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_PREFIXES: "/_assets/",
        BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_SUFFIXES: ".js",
        BOT_BLOCKER_STRICT_RATE_LIMIT_MARKERS: "SensitiveModule",
      }),
      rateLimiter,
    })
  }

  assert.equal(decision.action, "block")
  assert.equal(decision.reason, "strict_rate_limit_exceeded")
})

test("rate limiting fails open when the client key is unavailable", async () => {
  const request = createRequest("https://example.com/app.js", {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
    cf: {
      country: "US",
      asn: 12345,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
    }),
    rateLimiter: new InMemoryRateLimiter(),
  })

  assert.equal(decision.action, "allow")
  assert.equal(decision.reason, "missing_rate_limit_key")
})

test("rate limiter failures fail open to protect availability", async () => {
  const request = createRequest("https://example.com/app.js", {
    headers: {
      "cf-connecting-ip": "8.8.8.8",
    },
    cf: {
      country: "US",
      asn: 12345,
    },
  })

  const decision = await evaluateRequest({
    context: buildRequestContext(request),
    config: createPolicyConfig({
      BOT_BLOCKER_MODE: "enforce",
    }),
    rateLimiter: {
      kind: "broken",
      async consume() {
        throw new Error("unavailable")
      },
    },
  })

  assert.equal(decision.action, "allow")
  assert.equal(decision.reason, "rate_limiter_unavailable")
})

test("suspicious-country throttling blocks after the configured threshold", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      "cf-connecting-ip": "3.3.3.3",
      accept: "application/json",
    },
    cf: {
      country: "VN",
      asn: 12345,
    },
  })

  const config = createPolicyConfig({
    BOT_BLOCKER_MODE: "enforce",
    BOT_BLOCKER_THROTTLED_COUNTRIES: "VN",
    BOT_BLOCKER_THROTTLE_LIMIT: "2",
  })

  const rateLimiter = new InMemoryRateLimiter()

  const first = await evaluateRequest({
    context: buildRequestContext(request),
    config,
    rateLimiter,
  })

  const second = await evaluateRequest({
    context: buildRequestContext(request),
    config,
    rateLimiter,
  })

  const third = await evaluateRequest({
    context: buildRequestContext(request),
    config,
    rateLimiter,
  })

  assert.equal(first.action, "allow")
  assert.equal(second.action, "allow")
  assert.equal(third.action, "block")
  assert.equal(third.reason, "country_throttle_exceeded")
  assert.equal(third.status, 429)
})

test("durable object rate limiter enforces limits and resets windows", async () => {
  const storage = new Map()
  const state = {
    storage: {
      async transaction(callback) {
        return callback({
          async get(key) {
            return storage.get(key)
          },
          async put(key, value) {
            storage.set(key, value)
          },
        })
      },
    },
  }

  const limiter = new RateLimiterDurableObject(state)

  const first = await limiter.fetch(
    new Request("https://internal/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 2,
        windowMs: 60_000,
        now: 100,
      }),
    })
  )

  const second = await limiter.fetch(
    new Request("https://internal/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 2,
        windowMs: 60_000,
        now: 200,
      }),
    })
  )

  const third = await limiter.fetch(
    new Request("https://internal/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 2,
        windowMs: 60_000,
        now: 300,
      }),
    })
  )

  const reset = await limiter.fetch(
    new Request("https://internal/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 2,
        windowMs: 60_000,
        now: 61_000,
      }),
    })
  )

  assert.deepEqual(await first.json(), {
    limited: false,
    remaining: 1,
    resetAt: 60_100,
    retryAfter: 0,
  })

  assert.deepEqual(await second.json(), {
    limited: false,
    remaining: 0,
    resetAt: 60_100,
    retryAfter: 60,
  })

  assert.deepEqual(await third.json(), {
    limited: true,
    remaining: 0,
    resetAt: 60_100,
    retryAfter: 60,
  })

  assert.deepEqual(await reset.json(), {
    limited: false,
    remaining: 1,
    resetAt: 121_000,
    retryAfter: 0,
  })
})
