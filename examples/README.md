# Configuration Examples

These files are configuration templates, not alternate worker entrypoints. Copy the values you want into `[vars]` in `wrangler.toml`.

## Files

### `minimal-blocking.js`

Use when:
- You want a cautious first rollout.
- You want monitor mode first.
- You serve global traffic and want low false-positive risk.

### `strict-blocking.js`

Use when:
- You mostly serve a narrow set of regions.
- You want aggressive enforcement after monitor validation.
- You are comfortable with a higher false-positive risk.

### `hybrid-monitor.js`

Use when:
- You need a mixed rollout with enforced known-bad traffic and monitored uncertain traffic.
- You want stricter asset controls without embedding product names into the worker.
- You want suspicious-country throttling to stay active while broader country expansion remains cautious.

## Rollout Pattern

1. Start from `minimal-blocking.js`.
2. Deploy in monitor mode.
3. Inspect logs for a few days.
4. Tighten with explicit overrides or move toward the strict template.

## Important

- Keep the runtime source of truth in `src/presets.js`.
- Use these example files as copy-paste variable sets only.
- Do not fork the worker logic into separate examples again; that creates drift.
- Use `BOT_BLOCKER_THROTTLED_COUNTRIES` when a region should be slowed rather than hard-blocked.
- Use `BOT_BLOCKER_STRIPPED_COOKIES` when selected cookies should never reach origin from untrusted traffic.
- Keep tenant-specific domains, routes, upstream origins, and rollout notes out of this public repo.
