---
name: Bug Report
about: Report a bug or issue with the worker
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the Bug
A clear description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Deploy worker with config '...'
2. Send request to '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Configuration
```javascript
// Share relevant parts of your worker.js config
const BLOCKED_COUNTRIES = [...]
const BLOCKED_ASNS = [...]
```

## Environment
- Cloudflare plan: [Free/Pro/Business/Enterprise]
- Wrangler version: [output of `wrangler --version`]
- Browser/Client: [if relevant]

## Logs
```
Paste relevant worker logs here (wrangler tail output)
```

## Additional Context
Any other context about the problem.
