import jwt from 'jsonwebtoken';

export interface JWTPayload {
    userId: string;
    email?: string;
    role?: string;
    permissions?: string[];
    iat?: number;
    exp?: number;
}

export interface AuthResult {
    isValid: boolean;
    userId?: string;
    payload?: JWTPayload;
    error?: string;
}

export class JWTAuth {
    private readonly secret: string;
    private readonly issuer: string;
    private readonly defaultExpiry: string;

    constructor() {
        this.secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.issuer = process.env.JWT_ISSUER || 'opensvm';
        this.defaultExpiry = process.env.JWT_EXPIRY || '24h';
    }

    /**
     * Generate a JWT token for a user
     */
    generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
        return jwt.sign(payload, this.secret, {
            issuer: this.issuer,
            expiresIn: this.defaultExpiry,
            algorithm: 'HS256'
        });
    }

    /**
     * Verify and decode a JWT token
     */
    verifyToken(token: string): AuthResult {
        try {
            const payload = jwt.verify(token, this.secret, {
                issuer: this.issuer,
                algorithms: ['HS256']
            }) as JWTPayload;

            return {
                isValid: true,
                userId: payload.userId,
                payload
            };
        } catch (error) {
            let errorMessage = 'Invalid token';

            if (error instanceof jwt.TokenExpiredError) {
                errorMessage = 'Token has expired';
            } else if (error instanceof jwt.JsonWebTokenError) {
                errorMessage = 'Invalid token format';
            } else if (error instanceof jwt.NotBeforeError) {
                errorMessage = 'Token not yet valid';
            }

            return {
                isValid: false,
                error: errorMessage
            };
        }
    }

    /**
     * Extract user ID from Authorization header
     */
    extractUserFromRequest(authHeader: string | null): AuthResult {
        if (!authHeader) {
            return {
                isValid: false,
                error: 'Missing Authorization header'
            };
        }

        // Support both Bearer token and X-User-ID fallback
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            return this.verifyToken(token);
        }

        return {
            isValid: false,
            error: 'Invalid Authorization header format. Expected: Bearer <token>'
        };
    }

    /**
     * Middleware helper for Next.js API routes
     */
    requireAuth(authHeader: string | null): AuthResult {
        const result = this.extractUserFromRequest(authHeader);

        if (!result.isValid) {
            return result;
        }

        // Additional validation can be added here
        if (!result.userId) {
            return {
                isValid: false,
                error: 'Token missing required user ID'
            };
        }

        return result;
    }

    /**
     * Check if user has specific permission
     */
    hasPermission(payload: JWTPayload | undefined, permission: string): boolean {
        if (!payload || !payload.permissions) {
            return false;
        }

        return payload.permissions.includes(permission) || payload.permissions.includes('*');
    }

    /**
     * Check if user has specific role
     */
    hasRole(payload: JWTPayload | undefined, role: string): boolean {
        if (!payload || !payload.role) {
            return false;
        }

        return payload.role === role || payload.role === 'admin';
    }
} 