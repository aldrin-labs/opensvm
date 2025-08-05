# Webkit Browser Configuration Guide

## Overview
This document outlines webkit-specific configurations and considerations for Playwright testing to ensure Safari/webkit compatibility.

## Fixed Issues

### Problem
Webkit tests were failing with the error:
```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs: Cannot parse arguments: Unknown option --disable-web-security
```

### Root Cause
Chrome-specific browser launch flags were being used for webkit browser configuration:
- `--disable-web-security` (Chrome-only flag)
- `--disable-features=VizDisplayCompositor` (Chrome-specific)

### Solution
Replaced Chrome-specific flags with webkit-compatible alternatives:

```typescript
// ❌ BEFORE (Chrome-specific flags)
{
  name: 'webkit',
  use: {
    ...devices['Desktop Safari'],
    launchOptions: {
      args: [
        '--disable-web-security',        // ❌ Not supported by webkit
        '--disable-features=VizDisplayCompositor', // ❌ Chrome-only
        '--no-sandbox'
      ]
    }
  }
}

// ✅ AFTER (Webkit-compatible flags)
{
  name: 'webkit',
  use: {
    ...devices['Desktop Safari'],
    launchOptions: {
      args: [
        '--no-sandbox',                  // ✅ Cross-browser compatible
        '--disable-setuid-sandbox',      // ✅ Security optimization
        '--disable-dev-shm-usage',       // ✅ Memory optimization
        '--memory-pressure-off'          // ✅ Performance optimization
      ]
    }
  }
}
```

## Webkit-Specific Considerations

### Supported Launch Arguments
**CRITICAL DISCOVERY: Webkit supports NO launch arguments at all!**

**❌ ALL launch arguments are unsupported by webkit:**
- `--no-sandbox` ❌ (Previously thought to be safe)
- `--disable-setuid-sandbox` ❌
- `--disable-dev-shm-usage` ❌
- `--memory-pressure-off` ❌
- `--disable-web-security` ❌
- `--disable-features=*` ❌
- `--disable-extensions` ❌
- `--disable-plugins` ❌
- `--disable-images` ❌
- `--headless=new` ❌

**✅ Webkit configuration must be minimal:**
```typescript
{
  name: 'webkit',
  use: {
    ...devices['Desktop Safari'],
    // NO launchOptions at all!
  }
}
```

### Performance Implications
- Webkit may be slower than Chrome for certain operations
- Memory usage patterns differ from Chrome/Firefox
- Network timing may vary significantly

### Cross-Browser Testing Strategy
1. **Primary browsers:** Chrome/Chromium for development
2. **Compatibility testing:** Firefox for standards compliance
3. **Production validation:** Webkit for Safari user experience

## Testing Commands

### Test webkit specifically:
```bash
npm run test:e2e -- --project=webkit
```

### Test all browsers:
```bash
npm run test:e2e
```

### Test webkit with specific timeout:
```bash
npm run test:e2e -- --project=webkit --timeout=60000
```

## Browser-Specific Configuration Pattern

For future maintainability, each browser project should have its own optimized configuration:

```typescript
projects: [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        args: [
          // Chrome-optimized flags
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox',
          '--disable-extensions',
          '--headless=new'
        ]
      }
    }
  },
  {
    name: 'webkit',
    use: {
      ...devices['Desktop Safari'],
      launchOptions: {
        args: [
          // Webkit-compatible flags only
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--memory-pressure-off'
        ]
      }
    }
  },
  {
    name: 'firefox',
    use: {
      ...devices['Desktop Firefox'],
      launchOptions: {
        firefoxUserPrefs: {
          // Firefox-specific preferences
          'dom.disable_beforeunload': true,
          'browser.tabs.animate': false
        }
      }
    }
  }
]
```

## Troubleshooting

### Common Issues

1. **Browser launch timeout:**
   - Increase timeout in playwright.config.ts
   - Check system resources
   - Verify webkit installation

2. **Test flakiness:**
   - Webkit may require longer wait times
   - Use explicit waits instead of timeouts
   - Consider webkit-specific test timeouts

3. **Memory issues:**
   - Webkit memory management differs from Chrome
   - Monitor memory usage during long test suites
   - Consider running webkit tests separately

### Debug Commands
```bash
# Enable debug logging
DEBUG=pw:browser* npm run test:e2e -- --project=webkit

# Run with UI for debugging
npm run test:e2e:ui -- --project=webkit

# Generate trace for failed tests
npm run test:e2e -- --project=webkit --trace=on
```

## Maintenance

- Review webkit compatibility when updating Playwright
- Test new browser arguments in isolation before deployment
- Monitor webkit test performance trends
- Update documentation when adding new optimizations