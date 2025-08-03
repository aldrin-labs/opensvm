'use client';

// Security utilities for the transaction graph
export class SecurityUtils {
  // Content Security Policy violations tracking
  private static cspViolations = new Set<string>();
  
  // Rate limiting storage
  private static rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  // URL validation patterns
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];
  private static readonly SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  private static readonly TRANSACTION_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{88}$/;
  private static readonly MAX_URL_LENGTH = 2048;
  private static readonly MAX_INPUT_LENGTH = 1000;

  /**
   * Sanitize and validate URLs to prevent open redirect attacks
   */
  static sanitizeUrl(url: string, baseUrl?: string): string {
    try {
      // Check URL length
      if (url.length > this.MAX_URL_LENGTH) {
        throw new Error('URL too long');
      }

      // Create URL object for validation
      const parsedUrl = new URL(url, baseUrl || window.location.origin);
      
      // Validate protocol
      if (!this.ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
      }
      
      // Ensure same origin for internal navigation
      if (baseUrl === undefined || baseUrl === window.location.origin) {
        if (parsedUrl.origin !== window.location.origin) {
          throw new Error('Cross-origin URL not allowed for internal navigation');
        }
      }
      
      // Remove dangerous URL components
      parsedUrl.username = '';
      parsedUrl.password = '';
      
      // Validate path for common attack patterns
      const dangerousPatterns = [
        /\.\./,  // Directory traversal
        /\/\//,  // Double slashes
        /%2e%2e/i, // URL encoded directory traversal
        /javascript:/i, // JavaScript protocol
        /data:/i, // Data URLs
        /vbscript:/i, // VBScript protocol
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(parsedUrl.pathname) || pattern.test(parsedUrl.search)) {
          throw new Error('Potentially dangerous URL pattern detected');
        }
      }
      
      return parsedUrl.href;
    } catch (error) {
      throw new Error(`URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Solana addresses
   */
  static validateSolanaAddress(address: string): string {
    if (!address || typeof address !== 'string') {
      throw new Error('Address must be a non-empty string');
    }
    
    if (address.length > this.MAX_INPUT_LENGTH) {
      throw new Error('Address too long');
    }
    
    const trimmedAddress = address.trim();
    
    if (!this.SOLANA_ADDRESS_PATTERN.test(trimmedAddress)) {
      throw new Error('Invalid Solana address format');
    }
    
    return trimmedAddress;
  }

  /**
   * Validate transaction signatures
   */
  static validateTransactionSignature(signature: string): string {
    if (!signature || typeof signature !== 'string') {
      throw new Error('Signature must be a non-empty string');
    }
    
    if (signature.length > this.MAX_INPUT_LENGTH) {
      throw new Error('Signature too long');
    }
    
    const trimmedSignature = signature.trim();
    
    if (!this.TRANSACTION_SIGNATURE_PATTERN.test(trimmedSignature)) {
      throw new Error('Invalid transaction signature format');
    }
    
    return trimmedSignature;
  }

  /**
   * Sanitize text content to prevent XSS
   */
  static sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    if (text.length > this.MAX_INPUT_LENGTH) {
      throw new Error('Text input too long');
    }
    
    // HTML encode dangerous characters
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/\\/g, '&#x5C;')
      .replace(/`/g, '&#x60;');
  }

  /**
   * Sanitize HTML attributes
   */
  static sanitizeAttribute(attr: string): string {
    if (!attr || typeof attr !== 'string') {
      return '';
    }
    
    // Remove potentially dangerous attribute values
    const dangerousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /on\w+=/i, // Event handlers
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(attr)) {
        throw new Error('Dangerous attribute value detected');
      }
    }
    
    return attr.replace(/[<>"']/g, '');
  }

  /**
   * Rate limiting implementation
   */
  static checkRateLimit(
    identifier: string, 
    maxRequests: number = 10, 
    windowMs: number = 60000
  ): boolean {
    const now = Date.now();
    const key = `rateLimit:${identifier}`;
    
    const existing = this.rateLimits.get(key);
    
    if (!existing) {
      this.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true; // Allow request
    }
    
    // Check if window has expired
    if (now >= existing.resetTime) {
      this.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true; // Allow request
    }
    
    // Check if under limit
    if (existing.count < maxRequests) {
      existing.count++;
      return true; // Allow request
    }
    
    return false; // Rate limited
  }

  /**
   * Generate secure random strings for IDs
   */
  static generateSecureId(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      
      for (let i = 0; i < length; i++) {
        result += charset[array[i] % charset.length];
      }
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < length; i++) {
        result += charset[Math.floor(Math.random() * charset.length)];
      }
    }
    
    return result;
  }

  /**
   * Validate API endpoints
   */
  static validateApiEndpoint(endpoint: string): string {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('Endpoint must be a non-empty string');
    }
    
    // Allowed API patterns
    const allowedPatterns = [
      /^\/api\/transaction\/[1-9A-HJ-NP-Za-km-z]{88}$/,
      /^\/api\/account-transactions\/[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      /^\/api\/account\/[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    ];
    
    const isValidEndpoint = allowedPatterns.some(pattern => pattern.test(endpoint));
    
    if (!isValidEndpoint) {
      throw new Error('Invalid API endpoint pattern');
    }
    
    return endpoint;
  }

  /**
   * Content Security Policy helper
   */
  static reportCSPViolation(violation: string): void {
    this.cspViolations.add(violation);
    
    // Log for monitoring
    console.warn('CSP Violation detected:', violation);
    
    // Report to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'csp_violation', {
        event_category: 'security',
        event_label: violation,
      });
    }
  }

  /**
   * Input validation for graph data
   */
  static validateGraphNode(node: any): boolean {
    try {
      if (!node || typeof node !== 'object') {
        throw new Error('Node must be an object');
      }
      
      if (!node.id || typeof node.id !== 'string') {
        throw new Error('Node must have a valid ID');
      }
      
      if (node.id.length > this.MAX_INPUT_LENGTH) {
        throw new Error('Node ID too long');
      }
      
      // Validate node type
      const allowedTypes = ['transaction', 'account', 'program', 'token'];
      if (node.type && !allowedTypes.includes(node.type)) {
        throw new Error('Invalid node type');
      }
      
      // Sanitize label if present
      if (node.label) {
        node.label = this.sanitizeText(node.label);
      }
      
      return true;
    } catch (error) {
      console.error('Node validation failed:', error);
      return false;
    }
  }

  /**
   * Validate graph edges
   */
  static validateGraphEdge(edge: any): boolean {
    try {
      if (!edge || typeof edge !== 'object') {
        throw new Error('Edge must be an object');
      }
      
      if (!edge.source || !edge.target) {
        throw new Error('Edge must have source and target');
      }
      
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
        throw new Error('Edge source and target must be strings');
      }
      
      if (edge.source.length > this.MAX_INPUT_LENGTH || edge.target.length > this.MAX_INPUT_LENGTH) {
        throw new Error('Edge source/target too long');
      }
      
      return true;
    } catch (error) {
      console.error('Edge validation failed:', error);
      return false;
    }
  }

  /**
   * Secure event handler wrapper
   */
  static secureEventHandler<T extends Event>(
    handler: (event: T) => void,
    identifier?: string
  ): (event: T) => void {
    return (event: T) => {
      try {
        // Rate limiting if identifier provided
        if (identifier && !this.checkRateLimit(identifier, 50, 1000)) {
          console.warn(`Rate limit exceeded for event handler: ${identifier}`);
          return;
        }
        
        // Prevent default for potentially dangerous events
        if (event.type === 'click' || event.type === 'dblclick') {
          const target = event.target as HTMLElement;
          if (target && target.tagName === 'A') {
            const href = target.getAttribute('href');
            if (href && !href.startsWith('/') && !href.startsWith('#')) {
              event.preventDefault();
              console.warn('Blocked potentially dangerous link click:', href);
              return;
            }
          }
        }
        
        handler(event);
      } catch (error) {
        console.error('Error in secure event handler:', error);
        // Don't propagate errors to prevent information leakage
      }
    };
  }

  /**
   * Secure fetch wrapper with validation
   */
  static async secureFetch(
    url: string, 
    options: RequestInit = {},
    timeout: number = 10000
  ): Promise<Response> {
    try {
      // Validate URL
      const validatedUrl = this.validateApiEndpoint(url);
      const sanitizedUrl = this.sanitizeUrl(validatedUrl, window.location.origin);
      
      // Add security headers
      const secureOptions: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers,
        },
      };
      
      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      secureOptions.signal = controller.signal;
      
      try {
        const response = await fetch(sanitizedUrl, secureOptions);
        clearTimeout(timeoutId);
        
        // Validate response
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      throw new Error(`Secure fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up security utilities
   */
  static cleanup(): void {
    this.cspViolations.clear();
    this.rateLimits.clear();
  }

  /**
   * Get security metrics for monitoring
   */
  static getSecurityMetrics(): {
    cspViolations: string[];
    activeLimits: number;
    rateLimitViolations: number;
  } {
    const rateLimitViolations = Array.from(this.rateLimits.values())
      .filter(limit => limit.count >= 10).length;
    
    return {
      cspViolations: Array.from(this.cspViolations),
      activeLimits: this.rateLimits.size,
      rateLimitViolations,
    };
  }
}

// CSP violation reporting
if (typeof window !== 'undefined') {
  document.addEventListener('securitypolicyviolation', (e) => {
    SecurityUtils.reportCSPViolation(
      `${e.violatedDirective}: ${e.blockedURI} in ${e.documentURI}`
    );
  });
}

export default SecurityUtils;