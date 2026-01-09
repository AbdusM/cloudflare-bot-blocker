# Changelog

## [v2.0.0] - 2026-01-09

### Added
- **Suspicious Country Throttling (Layer 5):**
  - Added ability to rate-limit specific countries (e.g., those with high bot/VPN traffic) instead of blocking them entirely.
  - Useful for mitigating traffic from regions where you have legitimate users but also high bot volume.
  - Default limit: 15 requests/minute.
- **Cookie Sanitization (Layer 6):**
  - Added logic to strip specific sensitive cookies from incoming requests before they reach the origin.
  - Helps prevent session hijacking and reduces attack surface.

### Changed
- Refactored rate limiting logic to be more modular.
- Updated user-agent matching to be case-insensitive for better accuracy.
