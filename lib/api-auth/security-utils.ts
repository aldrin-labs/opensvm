// Security and privacy utilities for AI integration

// Redact sensitive information from queries before sending to AI
export function redactSensitiveInfo(query: string): string {
  // Redact potential private keys (base58 encoded strings of certain length)
  const privateKeyRegex = /[1-9A-HJ-NP-Za-km-z]{43,44}/g;
  let redactedQuery = query.replace(privateKeyRegex, '[REDACTED_KEY]');
  
  // Redact potential wallet seed phrases (12-24 word sequences)
  const seedPhraseRegex = /\b(\w+\s+){11,23}\w+\b/g;
  redactedQuery = redactedQuery.replace(seedPhraseRegex, '[REDACTED_SEED_PHRASE]');
  
  // Redact email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  redactedQuery = redactedQuery.replace(emailRegex, '[REDACTED_EMAIL]');
  
  // Redact potential API keys
  const apiKeyRegex = /([a-zA-Z0-9_-]+\.){1,2}[a-zA-Z0-9_-]+/g;
  redactedQuery = redactedQuery.replace(apiKeyRegex, (match) => {
    // Only redact if it looks like an API key (not a domain or common pattern)
    if (match.length > 20 && !match.includes('www.') && !match.includes('http')) {
      return '[REDACTED_API_KEY]';
    }
    return match;
  });
  
  return redactedQuery;
}

// Validate API key format before using
export function validateApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  
  // Check if API key has minimum length and proper format
  // This is a generic check - adjust based on Together AI's specific format
  return apiKey.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
}

// Rate limiting utility to prevent abuse
export class RateLimiter {
  private requests: { [ip: string]: number[] } = {};
  private maxRequests: number;
  private timeWindowMs: number;
  
  constructor(maxRequests = 10, timeWindowSeconds = 60) {
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowSeconds * 1000;
  }
  
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    
    // Initialize if first request from this IP
    if (!this.requests[ip]) {
      this.requests[ip] = [];
    }
    
    // Filter out requests outside the time window
    this.requests[ip] = this.requests[ip].filter(time => now - time < this.timeWindowMs);
    
    // Check if rate limited
    if (this.requests[ip].length >= this.maxRequests) {
      return true;
    }
    
    // Add current request
    this.requests[ip].push(now);
    return false;
  }
}

// Content moderation for AI responses
export function moderateContent(text: string): { safe: boolean; filteredText: string } {
  // List of patterns to check for potentially harmful content
  const harmfulPatterns = [
    /how\s+to\s+hack/i,
    /illegal\s+activities/i,
    /exploit\s+vulnerability/i,
    /steal\s+(crypto|tokens|nft)/i,
    /bypass\s+security/i
  ];
  
  let safe = true;
  let filteredText = text;
  
  // Check for harmful patterns
  for (const pattern of harmfulPatterns) {
    if (pattern.test(text)) {
      safe = false;
      filteredText = filteredText.replace(pattern, '[FILTERED]');
    }
  }
  
  return { safe, filteredText };
}

// Secure logging utility that doesn't log sensitive data
export function secureLog(message: string, data?: any): void {
  // Log the message
  console.log(message);
  
  // If data is provided, sanitize it before logging
  if (data) {
    const sanitizedData = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = ['apiKey', 'key', 'secret', 'password', 'token'];
    for (const field of sensitiveFields) {
      if (field in sanitizedData) {
        sanitizedData[field] = '[REDACTED]';
      }
    }
    
    console.log('Data:', sanitizedData);
  }
}
