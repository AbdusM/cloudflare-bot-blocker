import test from "node:test"
import assert from "node:assert/strict"

import worker from "../worker.js"

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

test("monitor mode forwards requests to origin", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    const response = await worker.fetch(
      createRequest("https://example.com/page", {
        headers: {
          "cf-connecting-ip": "1.1.1.1",
        },
        cf: {
          country: "CN",
          asn: 12345,
        },
      }),
      {}
    )

    assert.equal(fetchCount, 1)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), "origin-ok")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("enforce mode returns JSON for blocked API traffic without calling origin", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    const response = await worker.fetch(
      createRequest("https://example.com/api/data", {
        headers: {
          accept: "application/json",
          "cf-connecting-ip": "1.1.1.1",
          "user-agent": "GPTBot/1.0",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      }),
      {
        BOT_BLOCKER_MODE: "enforce",
      }
    )

    assert.equal(fetchCount, 0)
    assert.equal(response.status, 403)
    assert.equal(response.headers.get("X-Bot-Blocker-Reason"), "blocked_scraper")
    assert.equal((await response.json()).code, "blocked_scraper")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("protected path prefixes do not narrow global scraper blocks at the worker edge", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    const response = await worker.fetch(
      createRequest("https://example.com/marketing", {
        headers: {
          accept: "application/json",
          "cf-connecting-ip": "1.1.1.1",
          "user-agent": "GPTBot/1.0",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      }),
      {
        BOT_BLOCKER_MODE: "enforce",
        BOT_BLOCKER_PROTECTED_PATH_PREFIXES: "/app,/dashboard/",
      }
    )

    assert.equal(fetchCount, 0)
    assert.equal(response.status, 403)
    assert.equal(response.headers.get("X-Bot-Blocker-Reason"), "blocked_scraper")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("enforce mode rate limits configured asset paths", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    let lastResponse

    for (let index = 0; index < 101; index += 1) {
      lastResponse = await worker.fetch(
        createRequest("https://example.com/app.js", {
          headers: {
            accept: "application/json",
            "cf-connecting-ip": "5.5.5.5",
            "user-agent": "Mozilla/5.0",
          },
          cf: {
            country: "US",
            asn: 12345,
          },
        }),
        {
          BOT_BLOCKER_MODE: "enforce",
        }
      )
    }

    assert.equal(fetchCount, 100)
    assert.equal(lastResponse.status, 429)
    assert.equal(lastResponse.headers.get("X-Bot-Blocker-Reason"), "rate_limit_exceeded")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("allowed requests can have selected cookies stripped before origin fetch", async () => {
  const originalFetch = globalThis.fetch
  let forwardedRequest

  globalThis.fetch = async (request) => {
    forwardedRequest = request
    return new Response("origin-ok", { status: 200 })
  }

  try {
    const response = await worker.fetch(
      createRequest("https://example.com/page", {
        headers: {
          cookie: "session_token=secret; theme=dark; tracking_id=abc",
          "cf-connecting-ip": "6.6.6.6",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      }),
      {
        BOT_BLOCKER_STRIPPED_COOKIES: "session_token,tracking_id",
      }
    )

    assert.equal(response.status, 200)
    assert.equal(forwardedRequest.headers.get("cookie"), "theme=dark")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("stripped cookies can also be deleted on the response back to the client", async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => new Response("origin-ok", { status: 200 })

  try {
    const response = await worker.fetch(
      createRequest("https://example.com/page", {
        headers: {
          cookie: "session_proxy=secret; theme=dark",
          "cf-connecting-ip": "6.6.6.6",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      }),
      {
        BOT_BLOCKER_STRIPPED_COOKIES: "session_proxy",
        BOT_BLOCKER_DELETE_STRIPPED_COOKIES: "true",
        BOT_BLOCKER_COOKIE_DELETE_DOMAIN: "example.com",
      }
    )

    const setCookie = response.headers.get("set-cookie")
    assert.match(setCookie, /session_proxy=deleted/)
    assert.match(setCookie, /Domain=example\.com/)
    assert.match(setCookie, /Max-Age=0/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("strict asset rate limits can target high-risk module paths", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    let lastResponse

    for (let index = 0; index < 3; index += 1) {
      lastResponse = await worker.fetch(
        createRequest("https://example.com/_assets/SensitiveModule.chunk.js", {
          headers: {
            accept: "application/json",
            "cf-connecting-ip": "10.0.0.1",
          },
          cf: {
            country: "US",
            asn: 12345,
          },
        }),
        {
          BOT_BLOCKER_MODE: "enforce",
          BOT_BLOCKER_STRICT_RATE_LIMIT_ENABLED: "true",
          BOT_BLOCKER_STRICT_RATE_LIMIT: "2",
          BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_PREFIXES: "/_assets/",
          BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_SUFFIXES: ".js",
          BOT_BLOCKER_STRICT_RATE_LIMIT_MARKERS: "SensitiveModule",
        }
      )
    }

    assert.equal(fetchCount, 2)
    assert.equal(lastResponse.status, 429)
    assert.equal(lastResponse.headers.get("X-Bot-Blocker-Reason"), "strict_rate_limit_exceeded")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("strict asset rate limits still apply when protected page prefixes are narrower than asset paths", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    let lastResponse

    for (let index = 0; index < 3; index += 1) {
      lastResponse = await worker.fetch(
        createRequest("https://example.com/_assets/SensitiveModule.chunk.js", {
          headers: {
            accept: "application/json",
            "cf-connecting-ip": "10.0.0.3",
          },
          cf: {
            country: "US",
            asn: 12345,
          },
        }),
        {
          BOT_BLOCKER_MODE: "enforce",
          BOT_BLOCKER_PROTECTED_PATH_PREFIXES: "/app,/dashboard/",
          BOT_BLOCKER_STRICT_RATE_LIMIT_ENABLED: "true",
          BOT_BLOCKER_STRICT_RATE_LIMIT: "2",
          BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_PREFIXES: "/_assets/",
          BOT_BLOCKER_STRICT_RATE_LIMIT_PATH_SUFFIXES: ".js",
          BOT_BLOCKER_STRICT_RATE_LIMIT_MARKERS: "SensitiveModule",
        }
      )
    }

    assert.equal(fetchCount, 2)
    assert.equal(lastResponse.status, 429)
    assert.equal(lastResponse.headers.get("X-Bot-Blocker-Reason"), "strict_rate_limit_exceeded")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("same-origin browser asset requests can bypass standard asset rate limits", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    let lastResponse

    for (let index = 0; index < 5; index += 1) {
      lastResponse = await worker.fetch(
        createRequest("https://example.com/_assets/app.js", {
          headers: {
            accept: "application/json",
            referer: "https://example.com/dashboard/",
            "sec-fetch-site": "same-origin",
            "sec-fetch-dest": "script",
            "sec-fetch-mode": "cors",
            "cf-connecting-ip": "10.0.0.2",
          },
          cf: {
            country: "US",
            asn: 12345,
          },
        }),
        {
          BOT_BLOCKER_MODE: "enforce",
          BOT_BLOCKER_RATE_LIMIT: "2",
          BOT_BLOCKER_RATE_LIMIT_PATH_PREFIXES: "/_assets/",
          BOT_BLOCKER_RATE_LIMIT_PATH_SUFFIXES: ".js",
          BOT_BLOCKER_RATE_LIMIT_BYPASS_SAME_ORIGIN_ASSETS: "true",
        }
      )
    }

    assert.equal(fetchCount, 5)
    assert.equal(lastResponse.status, 200)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("enforce mode throttles configured suspicious countries", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    let lastResponse

    for (let index = 0; index < 3; index += 1) {
      lastResponse = await worker.fetch(
        createRequest("https://example.com/page", {
          headers: {
            accept: "application/json",
            "cf-connecting-ip": "7.7.7.7",
          },
          cf: {
            country: "VN",
            asn: 12345,
          },
        }),
        {
          BOT_BLOCKER_MODE: "enforce",
          BOT_BLOCKER_THROTTLED_COUNTRIES: "VN",
          BOT_BLOCKER_THROTTLE_LIMIT: "2",
        }
      )
    }

    assert.equal(fetchCount, 2)
    assert.equal(lastResponse.status, 429)
    assert.equal(lastResponse.headers.get("X-Bot-Blocker-Reason"), "country_throttle_exceeded")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("workers.dev requests without an upstream return an operational response", async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response("origin-ok", { status: 200 })
  }

  try {
    const response = await worker.fetch(
      createRequest("https://bot-blocker.example.workers.dev/", {
        headers: {
          accept: "application/json",
          "cf-connecting-ip": "8.8.4.4",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      }),
      {}
    )

    assert.equal(fetchCount, 0)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "cloudflare-bot-blocker",
      mode: "monitor",
      preset: "balanced",
      upstreamConfigured: false,
      requestId: response.headers.get("X-Request-Id"),
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("allowed requests can be forwarded to an explicit upstream origin", async () => {
  const originalFetch = globalThis.fetch
  let forwardedRequest

  globalThis.fetch = async (request) => {
    forwardedRequest = request
    return new Response("origin-ok", { status: 200 })
  }

  try {
    const response = await worker.fetch(
      createRequest("https://bot-blocker.example.workers.dev/products?id=42", {
        headers: {
          "cf-connecting-ip": "9.9.9.9",
        },
        cf: {
          country: "US",
          asn: 12345,
        },
      }),
      {
        BOT_BLOCKER_UPSTREAM_ORIGIN: "https://example.com",
      }
    )

    assert.equal(response.status, 200)
    assert.equal(forwardedRequest.url, "https://example.com/products?id=42")
  } finally {
    globalThis.fetch = originalFetch
  }
})
