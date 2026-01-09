# Cloudflare Bot Blocker v2.0

A multi-layer Cloudflare Worker to protect your site from bots, scrapers, and AI crawlers. Runs on the Cloudflare Free Tier ($0/mo).

## Features
- **Layer 1: Geo & ASN Blocking** - Hard block specific countries (e.g., CN, RU) and networks (e.g., Tencent).
- **Layer 2: AI Scraper Defense** - Blocks GPTBot, ClaudeBot, CCBot, Bytespider, and 10+ others.
- **Layer 3: JS Rate Limiting** - Protects your detailed assets from scraping.
- **Layer 4: Suspicious Country Throttling [NEW]** - Strictly throttle (don't ban) traffic from high-bot regions to prevent false positives.
- **Layer 5: Cookie Sanitization [NEW]** - Security layer to strip sensitive cookies from untrusted requests.

## Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/AbdusM/cloudflare-bot-blocker
   npm install
   ```

2. **Configure `worker.js`**
   - Edit `BLOCKED_COUNTRIES` for hard blocks.
   - Edit `THROTTLED_COUNTRIES` for soft limits (e.g., VPN-heavy regions).
   - Edit `STRIPPED_COOKIES` to remove risky cookies.

3. **Deploy**
   ```bash
   wrangler deploy
   ```

## Configuration Guide

### Suspicious Country Throttling
Use this for countries where you have *some* real users but mostly bots.
```javascript
const THROTTLED_COUNTRIES = ["VN", "SG"] // Example codes
const THROTTLE_LIMIT = 15 // Requests per minute
```

### Cookie Sanitization
Prevents specific cookies from reaching your backend.
```javascript
const STRIPPED_COOKIES = new Set(["session_token", "tracking_id"])
```

## License
MIT
