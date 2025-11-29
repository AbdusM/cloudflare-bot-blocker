# Configuration Examples

These examples show different blocking strategies. Choose one based on your needs, or mix and match.

## Files

### `strict-blocking.js`
**Use when:**
- You primarily serve one region (e.g., US only)
- Bot traffic is a major problem
- You can afford some false positives
- You want maximum protection

**Blocks:**
- All countries except whitelist
- Extensive ASN blocklist
- All AI scrapers
- Strict rate limiting (30 req/min)

**Trade-offs:**
- ✅ Maximum bot protection
- ✅ Clean analytics
- ⚠️ May block legitimate international users
- ⚠️ Requires maintaining country whitelist

---

### `minimal-blocking.js`
**Use when:**
- You have global customers
- You want minimal false positives
- You only want to block the worst offenders
- You're just starting with bot protection

**Blocks:**
- Only China
- Only Tencent networks
- Only worst AI scrapers
- Permissive rate limiting (200 req/min)

**Trade-offs:**
- ✅ Minimal false positives
- ✅ Global customers unaffected
- ⚠️ Some bot traffic will get through
- ⚠️ May need to add more blocks over time

---

### `worker.js` (main file)
**Use when:**
- You want balanced protection
- Mix of domestic and international traffic
- Want to block AI scrapers but keep search engines
- Standard use case

**Blocks:**
- Specific countries (customizable)
- Specific ASNs (customizable)
- 14 AI scrapers
- Balanced rate limiting (100 req/min)

**Trade-offs:**
- ✅ Good balance of protection vs accessibility
- ✅ Easy to customize
- ✅ Works for most use cases

---

## How to Choose

### Start Here
1. Deploy `worker.js` (main file) as-is
2. Monitor for 1 week
3. Check what's getting through
4. Adjust blocking rules

### Then Customize

**If you see lots of bots still:**
→ Move toward `strict-blocking.js`

**If legitimate users are blocked:**
→ Move toward `minimal-blocking.js`

**If it's working well:**
→ Stick with `worker.js`

## Testing Your Configuration

```bash
# Deploy to test worker first
wrangler deploy --name bot-blocker-test

# Monitor blocks
wrangler tail bot-blocker-test

# Check from different locations
curl -I https://yourdomain.com

# When satisfied, deploy to production
wrangler deploy
```

## Quick Comparison

| Feature | Minimal | Standard | Strict |
|---------|---------|----------|--------|
| Countries blocked | 1 (CN) | Customizable | All except whitelist |
| ASNs blocked | 2 | Customizable | 7+ |
| AI scrapers blocked | 3 | 14 | 17+ |
| Rate limit | 200/min | 100/min | 30/min |
| False positive risk | Very Low | Low | Medium |
| Bot protection | Good | Very Good | Maximum |

## Need Help?

- Check the [main README](../README.md)
- Open an [issue](https://github.com/AbdusM/cloudflare-bot-blocker/issues)
- Start a [discussion](https://github.com/AbdusM/cloudflare-bot-blocker/discussions)
