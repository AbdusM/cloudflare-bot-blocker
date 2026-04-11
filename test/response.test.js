import test from "node:test"
import assert from "node:assert/strict"

import { buildRequestContext } from "../src/policy.js"
import { buildEnforcementResponse } from "../src/responses.js"

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

test("browser requests receive branded HTML responses with a request id", async () => {
  const request = createRequest("https://example.com/page", {
    headers: {
      accept: "text/html",
      "cf-ray": "ray-123",
    },
  })

  const response = buildEnforcementResponse(
    buildRequestContext(request),
    {
      status: 403,
      reason: "blocked_country",
      message: "Traffic from your region is blocked by policy.",
    },
    {
      supportUrl: "https://example.com/support",
    }
  )

  const body = await response.text()

  assert.equal(response.status, 403)
  assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8")
  assert.match(body, /Request ID: <code>ray-123<\/code>/)
  assert.match(body, /Contact support/)
})

test("API requests receive JSON responses", async () => {
  const request = createRequest("https://example.com/api/data", {
    headers: {
      accept: "application/json",
    },
  })

  const response = buildEnforcementResponse(
    buildRequestContext(request),
    {
      status: 429,
      reason: "rate_limit_exceeded",
      message: "Too many requests in a short period. Please retry shortly.",
      retryAfter: 42,
    },
    {
      supportUrl: "",
    }
  )

  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8")
  assert.equal(response.headers.get("Retry-After"), "42")
  assert.deepEqual(await response.json(), {
    error: "Too many requests",
    code: "rate_limit_exceeded",
    message: "Too many requests in a short period. Please retry shortly.",
    requestId: response.headers.get("X-Request-Id"),
    retryAfter: 42,
  })
})
