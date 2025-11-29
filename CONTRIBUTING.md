# Contributing to Cloudflare Bot Blocker

Thanks for your interest in contributing! This project helps thousands of developers protect their sites from bot traffic.

## How to Contribute

### Reporting Issues

Found a bug or have a feature request?

1. Check [existing issues](https://github.com/AbdusM/cloudflare-bot-blocker/issues) first
2. Create a new issue with:
   - Clear description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your Cloudflare/Wrangler version

### Suggesting Enhancements

Have an idea? Great! Please:

1. Open an issue first to discuss
2. Explain the use case
3. Provide examples if possible

### Code Contributions

1. **Fork the repo**
2. **Create a branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**
4. **Test thoroughly**
5. **Commit**: `git commit -m "Add: your feature description"`
6. **Push**: `git push origin feature/your-feature-name`
7. **Open a Pull Request**

## What We're Looking For

### High Priority

- **New AI scraper user agents** - AI landscape changes fast
- **Common bot ASNs** - Networks known for bot traffic
- **Performance improvements** - Faster = better
- **Better documentation** - Examples, guides, troubleshooting

### Welcome Contributions

- Bug fixes
- Code cleanup/refactoring
- Additional blocking strategies
- Test coverage
- Translation of README to other languages

### Out of Scope

- Features specific to individual use cases (use forks for that)
- Breaking changes without discussion
- Overly complex solutions

## Coding Guidelines

### Keep It Simple

This worker needs to:
- Execute in <1ms
- Be easy to understand
- Work on Cloudflare's free tier
- Not break legitimate traffic

### Code Style

```javascript
// Use descriptive variable names
const isBot = checkUserAgent(request)

// Add comments for complex logic
// Block Tencent networks (ASN 13220, 132203)
if (BLOCKED_ASNS.includes(asn)) {
  // ...
}

// Keep functions small and focused
function isRateLimited(key, limit, window) {
  // Single responsibility
}
```

### Testing

Before submitting:

1. Test with `wrangler dev`
2. Deploy to a test worker
3. Verify no false positives
4. Check performance impact
5. Test logging output

### Documentation

Update README.md if you:
- Add new features
- Change configuration
- Add new blocking methods
- Modify behavior

## Adding New AI Scrapers

Found a new AI scraper? Please add it!

**Required info:**
- User agent string
- Company name
- Purpose (training, browsing, etc.)

**Example PR:**

```javascript
const AI_SCRAPERS = [
  // ... existing scrapers
  "NewBotName", // Company Name - AI training
]
```

Update the table in README.md:

```markdown
| NewBotName | Company | AI training |
```

## Adding ASNs

Found a bot ASN? Add it with context:

```javascript
const BLOCKED_ASNS = [
  // ... existing ASNs
  12345, // Network Name - Description of why it's a bot source
]
```

**How to verify an ASN is problematic:**
1. Check your Cloudflare Analytics
2. Look for unusual traffic patterns
3. Verify it's not a legitimate CDN/cloud provider used by real users
4. Test blocking it doesn't break legitimate traffic

## Commit Message Format

Use clear, descriptive commits:

```
Add: New AI scraper "BotName"
Fix: Rate limiting memory leak
Update: README with ASN lookup guide
Refactor: Cleanup blocking logic
```

## Pull Request Process

1. **Title**: Clear and descriptive
2. **Description**:
   - What changed?
   - Why?
   - Any breaking changes?
3. **Testing**: How did you test it?
4. **Screenshots**: If UI-related

We'll review PRs within a few days. Be patient!

## Questions?

- Open a [Discussion](https://github.com/AbdusM/cloudflare-bot-blocker/discussions)
- Comment on related issues
- Tag maintainers if urgent

## Code of Conduct

- Be respectful
- Be constructive
- Be patient
- Help others learn

Thanks for making the web a better place!
