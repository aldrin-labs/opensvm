import { APIKeyManager } from '../core/APIKeyManager';
import { KeyValidation } from '../types/ProxyTypes';

/**
 * Handles authentication for the Anthropic API proxy
 */
export class ProxyAuth {
  private keyManager: APIKeyManager;

  constructor() {
    this.keyManager = new APIKeyManager();
  }

  /**
   * Initialize the auth system
   */
  async initialize(): Promise<void> {
    await this.keyManager.initialize();
  }

  /**
   * Extract API key from Authorization header
   */
  extractApiKey(authHeader: string | null): string | null {
    if (!authHeader) {
      return null;
    }

    // Expected format: "Bearer sk-ant-api03-..."
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Validate API key and return user information
   */
  async validateApiKey(apiKey: string): Promise<AuthResult> {
    try {
      const validation: KeyValidation = await this.keyManager.validateKey(apiKey);

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'Invalid API key',
          errorType: 'authentication_error'
        };
      }

      return {
        success: true,
        keyId: validation.keyId!,
        userId: validation.userId!
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return {
        success: false,
        error: 'Authentication failed',
        errorType: 'authentication_error'
      };
    }
  }

  /**
   * Authenticate request from headers
   */
  async authenticateRequest(headers: Headers): Promise<AuthResult> {
    const authHeader = headers.get('authorization');
    const apiKey = this.extractApiKey(authHeader);

    if (!apiKey) {
      return {
        success: false,
        error: 'Missing or invalid Authorization header',
        errorType: 'authentication_error'
      };
    }

    return await this.validateApiKey(apiKey);
  }

  /**
   * Create authentication middleware for API routes
   */
  createAuthMiddleware() {
    return async (request: Request): Promise<AuthResult> => {
      return await this.authenticateRequest(request.headers);
    };
  }

  /**
   * Generate authentication error response
   */
  createAuthErrorResponse(authResult: AuthResult): Response {
    const errorResponse = {
      type: 'error',
      error: {
        type: authResult.errorType || 'authentication_error',
        message: authResult.error || 'Authentication failed'
      }
    };

    const status = authResult.errorType === 'authentication_error' ? 401 : 403;

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Check if user has permission for specific action
   */
  async checkPermission(
    userId: string,
    action: string,
    resource?: string
  ): Promise<boolean> {
    try {
      // Log permission check for audit trail
      console.log(`Permission check: User ${userId} attempting ${action}${resource ? ` on ${resource}` : ''}`);

      // Basic permission validation
      if (!userId || !action) {
        console.warn('Invalid permission check: missing userId or action');
        return false;
      }

      // Check for restricted actions
      const restrictedActions = ['delete', 'admin', 'system'];
      if (restrictedActions.includes(action.toLowerCase())) {
        console.warn(`Restricted action ${action} attempted by user ${userId}`);
        // In a real system, check if user has admin role
        return false;
      }

      // Check resource-specific permissions
      if (resource) {
        // Ensure user can only access their own resources
        if (resource.includes('user:') && !resource.includes(`user:${userId}`)) {
          console.warn(`User ${userId} attempted to access resource ${resource} belonging to another user`);
          return false;
        }
      }

      // For now, allow all other authenticated actions
      console.log(`Permission granted: User ${userId} can ${action}${resource ? ` on ${resource}` : ''}`);
      return true;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get user context from API key
   */
  async getUserContext(keyId: string): Promise<UserContext | null> {
    try {
      const key = await this.keyManager.getKey(keyId);

      if (!key) {
        return null;
      }

      return {
        keyId: key.id,
        userId: key.userId,
        keyName: key.name,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        usageStats: key.usageStats
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return null;
    }
  }

  /**
   * Update key last used timestamp
   */
  async updateKeyUsage(keyId: string, tokensConsumed: number, svmaiSpent: number): Promise<void> {
    try {
      await this.keyManager.updateKeyUsage(keyId, tokensConsumed, svmaiSpent);
    } catch (error) {
      console.error('Error updating key usage:', error);
      // Don't throw error as this is not critical for request processing
    }
  }

  /**
   * Validate request rate limiting (placeholder)
   */
  async checkRateLimit(userId: string, keyId: string): Promise<RateLimitResult> {
    try {
      // Create unique rate limit keys for user and API key
      const userRateLimitKey = `user:${userId}:rate_limit`;
      const keyRateLimitKey = `key:${keyId}:rate_limit`;

      // Log rate limit check for monitoring with the specific keys
      console.log(`Rate limit check for user ${userId} with key ${keyId}`);
      console.log(`Using rate limit keys: ${userRateLimitKey}, ${keyRateLimitKey}`);

      // In a real implementation, this would check Redis or similar using these keys
      // For now, simulate rate limiting logic with key-based storage simulation
      const currentTime = Date.now();
      const windowSize = 60000; // 1 minute window
      const maxRequests = 100; // 100 requests per minute

      // Simulate checking current usage using the rate limit keys
      // In production, this would be: await redis.get(userRateLimitKey) or redis.get(keyRateLimitKey)
      const userKeyHash = userRateLimitKey.split(':').join('').length % 50;
      const keyKeyHash = keyRateLimitKey.split(':').join('').length % 30;
      const currentUsage = Math.max(userKeyHash, keyKeyHash); // Simulate usage based on key hashes
      const isAllowed = currentUsage < maxRequests;

      if (!isAllowed) {
        console.warn(`Rate limit exceeded for user ${userId} (key: ${keyId}): ${currentUsage}/${maxRequests}`);
      } else {
        console.log(`Rate limit OK for user ${userId} (key: ${keyId}): ${currentUsage}/${maxRequests}`);
      }

      return {
        allowed: isAllowed,
        remaining: Math.max(0, maxRequests - currentUsage),
        resetTime: new Date(currentTime + windowSize),
        retryAfter: isAllowed ? 0 : Math.ceil(windowSize / 1000) // seconds
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(),
        retryAfter: 60
      };
    }
  }

  /**
   * Create rate limit error response
   */
  createRateLimitErrorResponse(rateLimitResult: RateLimitResult): Response {
    const errorResponse = {
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded'
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': rateLimitResult.retryAfter.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime.getTime() / 1000).toString()
      }
    });
  }
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  keyId?: string;
  userId?: string;
  error?: string;
  errorType?: string;
}

/**
 * User context from API key
 */
export interface UserContext {
  keyId: string;
  userId: string;
  keyName: string;
  createdAt: Date;
  lastUsedAt?: Date;
  usageStats: {
    totalRequests: number;
    totalTokensConsumed: number;
    totalSVMAISpent: number;
    averageTokensPerRequest: number;
  };
}

/**
 * Rate limiting result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter: number; // seconds
}