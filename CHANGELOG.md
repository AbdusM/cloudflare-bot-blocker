# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-09

### Added
- Monitor-first policy mode with explicit `monitor` and `enforce` rollout lanes
- Modular policy engine under `src/`
- Durable Object rate limiter with in-memory fallback for local/dev use
- Browser, API, and plain-text deny responses with request IDs
- Local test suite and GitHub Actions CI
- Configuration templates aligned to the preset system
- Suspicious-country throttling for soft regional suppression
- Cookie sanitization before origin forwarding

### Changed
- Default rollout is now the balanced preset in monitor mode
- Search-engine bots are no longer part of the balanced default blocklist
- Documentation now reflects the actual runtime architecture and rollout contract

### Fixed
- Removed doc drift around CSS rate limiting and example behavior
- Removed example/runtime divergence by making examples variable templates only

## [1.0.0] - 2025-11-29

### Added
- Initial release
- Geographic blocking (country-level)
- ASN blocking (network-level)
- AI scraper blocking (14+ bots)
- Rate limiting for JS files
- JSON logging for all blocks
- Three example configurations (minimal, standard, strict)
- Comprehensive documentation
- Common ASNs reference guide
- MIT License

### Features
- Multi-layer bot protection
- Zero dependencies
- <1ms execution time
- Works on Cloudflare free tier
- Production-ready code
- Real-time monitoring via Wrangler

### Documentation
- Complete setup guide
- Monitoring examples
- Troubleshooting section
- Contributing guidelines
- Issue/PR templates

[1.0.0]: https://github.com/AbdusM/cloudflare-bot-blocker/releases/tag/v1.0.0
