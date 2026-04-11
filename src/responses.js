const REASON_TITLES = {
  blocked_country: "Access restricted",
  country_not_allowed: "Access restricted",
  country_throttle_exceeded: "Too many requests",
  blocked_asn: "Network restricted",
  blocked_scraper: "Automated access blocked",
  rate_limit_exceeded: "Too many requests",
  strict_rate_limit_exceeded: "Too many requests",
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function prefersJson(context) {
  return (
    context.pathname.startsWith("/api") ||
    context.accept.includes("application/json") ||
    context.accept.includes("application/problem+json")
  )
}

function prefersHtml(context) {
  return context.accept.includes("text/html")
}

function buildHtmlBody(context, decision, config) {
  const title = REASON_TITLES[decision.reason] || "Request blocked"
  const supportLine = config.supportUrl
    ? `<p><a href="${escapeHtml(config.supportUrl)}">Contact support</a> if you think this is a mistake.</p>`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe8;
        --panel: #fffaf4;
        --text: #1f2933;
        --muted: #52606d;
        --accent: #8d3b12;
        --border: #e7d7c9;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(141, 59, 18, 0.12), transparent 35%),
          linear-gradient(180deg, var(--bg), #f9f5ef);
        color: var(--text);
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        width: min(32rem, calc(100vw - 2rem));
        padding: 2rem;
        border: 1px solid var(--border);
        border-radius: 1.25rem;
        background: var(--panel);
        box-shadow: 0 24px 80px rgba(31, 41, 51, 0.08);
      }
      h1 {
        margin-top: 0;
        margin-bottom: 0.75rem;
        font-size: clamp(2rem, 4vw, 2.75rem);
      }
      p {
        line-height: 1.6;
      }
      code {
        color: var(--accent);
      }
      .meta {
        margin-top: 1.5rem;
        color: var(--muted);
        font-size: 0.95rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(decision.message)}</p>
      ${supportLine}
      <p class="meta">Request ID: <code>${escapeHtml(context.requestId)}</code></p>
    </main>
  </body>
</html>`
}

function buildStandaloneHtmlBody(context, config) {
  const supportLine = config.supportUrl
    ? `<p><a href="${escapeHtml(config.supportUrl)}">Contact support</a> if you need this worker attached to a production route.</p>`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bot Blocker Ready</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe8;
        --panel: #fffaf4;
        --text: #1f2933;
        --muted: #52606d;
        --accent: #8d3b12;
        --border: #e7d7c9;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(141, 59, 18, 0.12), transparent 35%),
          linear-gradient(180deg, var(--bg), #f9f5ef);
        color: var(--text);
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        width: min(38rem, calc(100vw - 2rem));
        padding: 2rem;
        border: 1px solid var(--border);
        border-radius: 1.25rem;
        background: var(--panel);
        box-shadow: 0 24px 80px rgba(31, 41, 51, 0.08);
      }
      h1 {
        margin-top: 0;
        margin-bottom: 0.75rem;
        font-size: clamp(2rem, 4vw, 2.75rem);
      }
      p, li {
        line-height: 1.6;
      }
      code {
        color: var(--accent);
      }
      .meta {
        margin-top: 1.5rem;
        color: var(--muted);
        font-size: 0.95rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Bot Blocker Ready</h1>
      <p>This worker is deployed and healthy, but it is currently running without an upstream origin.</p>
      <p>Attach a Cloudflare route or set <code>BOT_BLOCKER_UPSTREAM_ORIGIN</code> to proxy allowed traffic to an origin.</p>
      ${supportLine}
      <p class="meta">Request ID: <code>${escapeHtml(context.requestId)}</code></p>
    </main>
  </body>
</html>`
}

export function buildEnforcementResponse(context, decision, config) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Bot-Blocker-Reason": decision.reason,
    "X-Request-Id": context.requestId,
  })

  if (decision.retryAfter) {
    headers.set("Retry-After", String(decision.retryAfter))
  }

  if (prefersJson(context)) {
    headers.set("Content-Type", "application/json; charset=utf-8")

    const body = context.method === "HEAD"
      ? null
      : JSON.stringify({
          error: REASON_TITLES[decision.reason] || "Request blocked",
          code: decision.reason,
          message: decision.message,
          requestId: context.requestId,
          retryAfter: decision.retryAfter ?? null,
        })

    return new Response(body, {
      status: decision.status,
      headers,
    })
  }

  if (prefersHtml(context)) {
    headers.set("Content-Type", "text/html; charset=utf-8")

    return new Response(
      context.method === "HEAD" ? null : buildHtmlBody(context, decision, config),
      {
        status: decision.status,
        headers,
      }
    )
  }

  headers.set("Content-Type", "text/plain; charset=utf-8")
  return new Response(context.method === "HEAD" ? null : decision.message, {
    status: decision.status,
    headers,
  })
}

export function buildOperationalResponse(context, config) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-Id": context.requestId,
  })

  const payload = {
    ok: true,
    service: "cloudflare-bot-blocker",
    mode: config.mode,
    preset: config.presetName,
    upstreamConfigured: Boolean(config.upstreamOrigin),
    requestId: context.requestId,
  }

  if (prefersJson(context) || context.pathname === config.healthPath) {
    headers.set("Content-Type", "application/json; charset=utf-8")
    return new Response(context.method === "HEAD" ? null : JSON.stringify(payload), {
      status: 200,
      headers,
    })
  }

  if (prefersHtml(context)) {
    headers.set("Content-Type", "text/html; charset=utf-8")
    return new Response(
      context.method === "HEAD" ? null : buildStandaloneHtmlBody(context, config),
      {
        status: 200,
        headers,
      }
    )
  }

  headers.set("Content-Type", "text/plain; charset=utf-8")
  return new Response(
    context.method === "HEAD"
      ? null
      : `Bot blocker ready. Upstream configured: ${String(Boolean(config.upstreamOrigin))}`,
    {
      status: 200,
      headers,
    }
  )
}
