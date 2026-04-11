# Common Bot ASNs Reference

This is a reference list of ASNs (Autonomous System Numbers) commonly associated with bot traffic. Use this to customize your `BLOCKED_ASNS` configuration.

**⚠️ Warning:** Always verify ASNs in your own analytics before blocking. Some of these may have legitimate traffic depending on your use case.

## High-Risk Bot Networks

### Chinese Networks (Common Bot Sources)

| ASN | Network | Description |
|-----|---------|-------------|
| 13220 | Tencent | Major Chinese tech company, hosting provider |
| 132203 | Tencent | Tencent additional range |
| 45090 | Tencent Cloud | Cloud hosting often used by bots |
| 4134 | ChinaNet | China Telecom backbone |
| 4837 | China Unicom | Major Chinese ISP |
| 9808 | China Mobile | Mobile network provider |
| 17816 | China Unicom | Additional range |
| 58466 | ChinaNet | Additional range |

### Cloud Providers (Often Used by Scrapers)

| ASN | Network | Description |
|-----|---------|-------------|
| 16509 | Amazon AWS | Often used by automated scrapers |
| 14618 | Amazon AWS | Additional AWS range |
| 15169 | Google Cloud | Can be used by scrapers |
| 8075 | Microsoft Azure | Cloud hosting |
| 20473 | Vultr | VPS provider popular with scrapers |
| 24940 | Hetzner | German hosting, popular with bots |
| 16276 | OVH | French hosting, often used by scrapers |
| 14061 | DigitalOcean | VPS provider |

### Data Centers (Scraper-Friendly)

| ASN | Network | Description |
|-----|---------|-------------|
| 63949 | Linode | VPS provider |
| 19531 | Incapsula | CDN sometimes used by scrapers |
| 42926 | Coresite | Data center provider |

### Known Bot Networks

| ASN | Network | Description |
|-----|---------|-------------|
| 30083 | Serverstack | Known scraper network |
| 19531 | Psychz Networks | Often flagged for bot activity |

## Regional Bot Sources

### Russia

| ASN | Network | Description |
|-----|---------|-------------|
| 12389 | Rostelecom | Russian telecom |
| 8359 | MTS | Mobile TeleSystems |
| 31213 | Yandex | Russian search/tech company |

### Other Regions

| ASN | Network | Description |
|-----|---------|-------------|
| 209242 | Cloudflare WARP | May want to allow this |
| 13335 | Cloudflare | Usually legitimate |

## How to Use This List

### Option 1: Start Conservative
Block only the worst offenders:
```javascript
const BLOCKED_ASNS = [
  13220,  // Tencent
  132203, // Tencent additional
  4134,   // ChinaNet
  4837,   // China Unicom
]
```

### Option 2: Aggressive Blocking
Block all high-risk networks:
```javascript
const BLOCKED_ASNS = [
  // Chinese networks
  13220, 132203, 45090, 4134, 4837, 9808, 17816, 58466,

  // Known scraper hosts
  24940, 16276, 20473,
]
```

### Option 3: Allow Lists (Advanced)
Instead of blocking, only allow known good ASNs:
```javascript
const ALLOWED_ASNS = [
  // Major US ISPs
  7922,  // Comcast
  20115, // Charter
  7018,  // AT&T
  // etc.
]

// Then check: if (!ALLOWED_ASNS.includes(asn)) { block }
```

## How to Find ASNs

### Method 1: Cloudflare Analytics
1. Go to Cloudflare Dashboard
2. Analytics & Logs → Traffic
3. Look for unusual ASN patterns

### Method 2: Server Logs
```bash
# Extract IPs from logs
grep "suspicious pattern" /var/log/nginx/access.log | awk '{print $1}'

# Lookup ASN for IP
whois 1.2.3.4 | grep -i "origin"
```

### Method 3: Online Tools
- [Hurricane Electric ASN Lookup](https://bgp.he.net/)
- [UltraTools ASN Info](https://www.ultratools.com/tools/asnInfo)
- [IPInfo ASN Database](https://ipinfo.io/)

## Important Notes

### Be Careful Blocking:
- **Cloud Providers** - Your users may use VPNs or corporate networks on AWS/GCP
- **Mobile Networks** - Legitimate mobile users
- **CDNs** - May break proxied legitimate traffic
- **Your Own ASN** - Don't accidentally block yourself!

### Always Monitor After Blocking:
```bash
wrangler tail your-worker-name --format=json | grep "blocked_asn"
```

### Test First:
1. Add ASN to blocklist
2. Deploy to test worker
3. Monitor for 24-48 hours
4. Check for false positives
5. Deploy to production if clean

## Contributing

Found a bot ASN not listed here? Please submit a PR with:
- ASN number
- Network name
- Why it's a bot source
- Evidence (analytics screenshot, log samples)

## Updates

This list is maintained based on community reports. ASNs may change over time as networks are acquired or reorganized.

**Last Updated:** 2025-11-29
