const STORAGE_KEY_PREFIX = "rate-limit"
const DEFAULT_DO_SHARDS = 16

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

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

export class NativeRateLimiterClient {
  constructor(binding) {
    this.binding = binding
    this.kind = "native-ratelimit"
  }

  async consume({ key, limit = 100, windowMs = 60000 }) {
    const result = await this.binding.limit({ key: String(key) })
    const success = Boolean(result?.success)
    const resetAt = Date.now() + windowMs

    return {
      limited: !success,
      remaining: success ? 1 : 0,
      resetAt,
      retryAfter: success ? 0 : Math.max(Math.ceil(windowMs / 1000), 1),
    }
  }
}

export class DurableObjectRateLimiterClient {
  constructor(namespace, shardCount = DEFAULT_DO_SHARDS) {
    this.namespace = namespace
    this.shardCount = Number.isInteger(shardCount) && shardCount > 0 ? shardCount : DEFAULT_DO_SHARDS
    this.kind = "durable-object"
  }

  async consume({ key, limit, windowMs }) {
    // Bounded sharding prevents creating an unbounded number of Durable Objects for crawler IPs
    const shardKey = this.shardCount > 1
      ? `shard_${Math.abs(hashString(String(key))) % this.shardCount}`
      : String(key)
    const stub = this.namespace.get(this.namespace.idFromName(shardKey))
    const response = await stub.fetch("https://rate-limiter.internal/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
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

export class FallbackRateLimiterClient {
  constructor(fallback) {
    this.fallback = fallback
    this.kind = "in-memory"
  }

  async consume(payload) {
    return this.fallback.consume(payload)
  }
}

export function createRateLimiter(env, fallback = new InMemoryRateLimiter()) {
  const limiterType = env?.BOT_BLOCKER_RATE_LIMITER_TYPE?.toLowerCase()

  // 1. Explicit in-memory configuration (zero DO costs)
  if (limiterType === "in-memory" || limiterType === "memory") {
    return new FallbackRateLimiterClient(fallback)
  }

  // 2. Cloudflare Native Rate Limiting binding (zero DO costs)
  const nativeBinding = env?.RATE_LIMIT || (env?.RATE_LIMITER?.limit ? env.RATE_LIMITER : null)
  if (nativeBinding?.limit || limiterType === "native") {
    if (nativeBinding?.limit) {
      return new NativeRateLimiterClient(nativeBinding)
    }
  }

  // 3. Durable Object with bounded sharding (defaults to 16 fixed shards)
  if (env?.RATE_LIMITER && typeof env.RATE_LIMITER.idFromName === "function" && limiterType !== "none") {
    const shards = Number(env.BOT_BLOCKER_DO_SHARDS) || DEFAULT_DO_SHARDS
    return new DurableObjectRateLimiterClient(env.RATE_LIMITER, shards)
  }

  return new FallbackRateLimiterClient(fallback)
}

export class RateLimiterDurableObject {
  constructor(state) {
    this.state = state
    this.cache = new Map()
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    const { key, limit, windowMs, now } = await request.json()
    const safeLimit = Number(limit)
    const safeWindowMs = Number(windowMs)
    const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now()
    const storageKey = key ? `${STORAGE_KEY_PREFIX}:${key}` : STORAGE_KEY_PREFIX

    const result = await this.state.storage.transaction(async (storage) => {
      const existing = await storage.get(storageKey)

      if (!existing || safeNow - existing.windowStart >= safeWindowMs) {
        const next = {
          count: 1,
          windowStart: safeNow,
        }

        await storage.put(storageKey, next)
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

      await storage.put(storageKey, next)

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
