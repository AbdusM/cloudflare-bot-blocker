const STORAGE_KEY = "rate-limit"

export class InMemoryRateLimiter {
  constructor() {
    this.records = new Map()
    this.operationCount = 0
  }

  cleanup(now, windowMs) {
    const cutoff = now - (windowMs * 2)

    for (const [key, value] of this.records.entries()) {
      if (value.windowStart < cutoff) {
        this.records.delete(key)
      }
    }
  }

  consume({ key, limit, windowMs, now = Date.now() }) {
    this.operationCount += 1

    if (this.operationCount % 100 === 0) {
      this.cleanup(now, windowMs)
    }

    const existing = this.records.get(key)

    if (!existing || now - existing.windowStart >= windowMs) {
      const next = {
        count: 1,
        windowStart: now,
      }
      this.records.set(key, next)
      return {
        limited: false,
        remaining: Math.max(limit - next.count, 0),
        resetAt: now + windowMs,
        retryAfter: 0,
      }
    }

    existing.count += 1
    const resetAt = existing.windowStart + windowMs
    return {
      limited: existing.count > limit,
      remaining: Math.max(limit - existing.count, 0),
      resetAt,
      retryAfter: Math.max(Math.ceil((resetAt - now) / 1000), 1),
    }
  }
}

class DurableObjectRateLimiterClient {
  constructor(namespace) {
    this.namespace = namespace
    this.kind = "durable-object"
  }

  async consume({ key, limit, windowMs }) {
    const stub = this.namespace.get(this.namespace.idFromName(key))
    const response = await stub.fetch("https://rate-limiter.internal/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit,
        windowMs,
        now: Date.now(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Rate limiter request failed with ${response.status}`)
    }

    return response.json()
  }
}

class FallbackRateLimiterClient {
  constructor(fallback) {
    this.fallback = fallback
    this.kind = "in-memory"
  }

  async consume(payload) {
    return this.fallback.consume(payload)
  }
}

export function createRateLimiter(env, fallback = new InMemoryRateLimiter()) {
  if (env?.RATE_LIMITER) {
    return new DurableObjectRateLimiterClient(env.RATE_LIMITER)
  }

  return new FallbackRateLimiterClient(fallback)
}

export class RateLimiterDurableObject {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    const { limit, windowMs, now } = await request.json()
    const safeLimit = Number(limit)
    const safeWindowMs = Number(windowMs)
    const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now()

    const result = await this.state.storage.transaction(async (storage) => {
      const existing = await storage.get(STORAGE_KEY)

      if (!existing || safeNow - existing.windowStart >= safeWindowMs) {
        const next = {
          count: 1,
          windowStart: safeNow,
        }

        await storage.put(STORAGE_KEY, next)
        return {
          limited: false,
          remaining: Math.max(safeLimit - next.count, 0),
          resetAt: safeNow + safeWindowMs,
          retryAfter: 0,
        }
      }

      const next = {
        count: existing.count + 1,
        windowStart: existing.windowStart,
      }

      await storage.put(STORAGE_KEY, next)

      const resetAt = existing.windowStart + safeWindowMs
      return {
        limited: next.count > safeLimit,
        remaining: Math.max(safeLimit - next.count, 0),
        resetAt,
        retryAfter: Math.max(Math.ceil((resetAt - safeNow) / 1000), 1),
      }
    })

    return Response.json(result)
  }
}
