import { z } from 'zod';

/**
 * Environment configuration schema for Anthropic Proxy
 */
const ProxyConfigSchema = z.object({
    // OpenRouter Configuration (updated from Anthropic)
    openRouter: z.object({
        apiKeys: z.array(z.string().min(1)).min(1, 'At least one OpenRouter API key is required'),
        baseUrl: z.string().url().default('https://openrouter.ai/api/v1'),
        timeout: z.number().min(1000).default(30000), // 30 seconds
        retries: z.number().min(0).max(5).default(3),
        rateLimitBuffer: z.number().min(0).max(1000).default(100), // requests per minute buffer
    }),

    // Qdrant Database Configuration
    qdrant: z.object({
        url: z.string().url(),
        apiKey: z.string().optional(),
        collections: z.object({
            apiKeys: z.string().default('anthropic_api_keys'),
            balances: z.string().default('svmai_balances'),
            usage: z.string().default('usage_logs'),
            metrics: z.string().default('proxy_metrics'),
        }),
        timeout: z.number().min(1000).default(10000), // 10 seconds
    }),

    // Solana Configuration
    solana: z.object({
        rpcUrl: z.string().url(),
        multisigAddress: z.string().min(32).max(44), // Base58 Solana address
        svmaiTokenMint: z.string().min(32).max(44),
        confirmationLevel: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
        pollInterval: z.number().min(1000).default(5000), // 5 seconds
        maxRetries: z.number().min(1).max(10).default(3),
    }),

    // SVMAI Pricing Configuration
    pricing: z.object({
        svmaiPerInputToken: z.number().min(0).default(0.1), // 0.1 SVMAI per input token
        svmaiPerOutputToken: z.number().min(0).default(0.2), // 0.2 SVMAI per output token
        minimumBalance: z.number().min(0).default(100), // Minimum 100 SVMAI
        reservationMultiplier: z.number().min(1).default(2), // Reserve 2x estimated cost
        modelMultipliers: z.record(z.string(), z.number().min(0)).default({
            'claude-3-haiku': 0.5,
            'claude-3-sonnet': 1.0,
            'claude-3-opus': 2.0,
            'claude-3-sonnet-4': 1.2,
            'claude-3-opus-4': 2.5,
        }),
    }),

    // Rate Limiting Configuration
    rateLimiting: z.object({
        enabled: z.boolean().default(true),
        global: z.object({
            requestsPerMinute: z.number().min(1).default(1000),
            requestsPerHour: z.number().min(1).default(10000),
            requestsPerDay: z.number().min(1).default(100000),
        }),
        perUser: z.object({
            requestsPerMinute: z.number().min(1).default(60),
            requestsPerHour: z.number().min(1).default(1000),
            requestsPerDay: z.number().min(1).default(10000),
        }),
        perApiKey: z.object({
            requestsPerMinute: z.number().min(1).default(30),
            requestsPerHour: z.number().min(1).default(500),
            requestsPerDay: z.number().min(1).default(5000),
        }),
    }),

    // Security Configuration
    security: z.object({
        cors: z.object({
            enabled: z.boolean().default(true),
            origins: z.array(z.string()).default(['*']),
            methods: z.array(z.string()).default(['GET', 'POST', 'OPTIONS']),
            headers: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-Requested-With']),
        }),
        apiKeyValidation: z.object({
            strictFormat: z.boolean().default(true),
            requirePrefix: z.string().default('sk-ant-api03-'),
            minLength: z.number().min(32).default(64),
            maxLength: z.number().min(64).default(128),
        }),
        ipWhitelist: z.array(z.string()).optional(),
        maxRequestSize: z.number().min(1024).default(10 * 1024 * 1024), // 10MB
    }),

    // Monitoring Configuration
    monitoring: z.object({
        enabled: z.boolean().default(true),
        logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        metrics: z.object({
            flushInterval: z.number().min(1000).default(300000), // 5 minutes
            bufferSize: z.number().min(10).default(1000),
            retentionDays: z.number().min(1).default(30),
        }),
        alerts: z.object({
            enabled: z.boolean().default(true),
            errorRateThreshold: z.number().min(0).max(100).default(10), // 10%
            responseTimeThreshold: z.number().min(100).default(5000), // 5 seconds
            memoryThreshold: z.number().min(0).max(100).default(90), // 90%
            notificationChannels: z.array(z.string()).default(['console']),
        }),
    }),

    // Admin Configuration
    admin: z.object({
        userIds: z.array(z.string()).default([]),
        apiKeys: z.array(z.string()).default([]),
        endpoints: z.object({
            enabled: z.boolean().default(true),
            pathPrefix: z.string().default('/api/opensvm'),
        }),
    }),

    // Development Configuration
    development: z.object({
        mockExternalServices: z.boolean().default(false),
        enableTestEndpoints: z.boolean().default(false),
        logSensitiveData: z.boolean().default(false),
        skipAuthentication: z.boolean().default(false),
    }),
});

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

/**
 * Load and validate proxy configuration from environment variables
 */
export function loadProxyConfig(): ProxyConfig {
    const config = {
        openRouter: {
            apiKeys: parseOpenRouterApiKeys(),
            baseUrl: process.env.OPENROUTER_BASE_URL,
            timeout: parseNumber(process.env.OPENROUTER_TIMEOUT),
            retries: parseNumber(process.env.OPENROUTER_RETRIES),
            rateLimitBuffer: parseNumber(process.env.OPENROUTER_RATE_LIMIT_BUFFER),
        },
        qdrant: {
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY,
            collections: {
                apiKeys: process.env.QDRANT_COLLECTION_API_KEYS,
                balances: process.env.QDRANT_COLLECTION_BALANCES,
                usage: process.env.QDRANT_COLLECTION_USAGE,
                metrics: process.env.QDRANT_COLLECTION_METRICS,
            },
            timeout: parseNumber(process.env.QDRANT_TIMEOUT),
        },
        solana: {
            rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            multisigAddress: process.env.SOLANA_MULTISIG_ADDRESS,
            svmaiTokenMint: process.env.SVMAI_TOKEN_MINT,
            confirmationLevel: process.env.SOLANA_CONFIRMATION_LEVEL as any,
            pollInterval: parseNumber(process.env.SOLANA_POLL_INTERVAL),
            maxRetries: parseNumber(process.env.SOLANA_MAX_RETRIES),
        },
        pricing: {
            svmaiPerInputToken: parseNumber(process.env.SVMAI_PER_INPUT_TOKEN),
            svmaiPerOutputToken: parseNumber(process.env.SVMAI_PER_OUTPUT_TOKEN),
            minimumBalance: parseNumber(process.env.MINIMUM_SVMAI_BALANCE),
            reservationMultiplier: parseNumber(process.env.RESERVATION_MULTIPLIER),
            modelMultipliers: parseModelMultipliers(),
        },
        rateLimiting: {
            enabled: parseBoolean(process.env.RATE_LIMITING_ENABLED),
            global: {
                requestsPerMinute: parseNumber(process.env.GLOBAL_REQUESTS_PER_MINUTE),
                requestsPerHour: parseNumber(process.env.GLOBAL_REQUESTS_PER_HOUR),
                requestsPerDay: parseNumber(process.env.GLOBAL_REQUESTS_PER_DAY),
            },
            perUser: {
                requestsPerMinute: parseNumber(process.env.USER_REQUESTS_PER_MINUTE),
                requestsPerHour: parseNumber(process.env.USER_REQUESTS_PER_HOUR),
                requestsPerDay: parseNumber(process.env.USER_REQUESTS_PER_DAY),
            },
            perApiKey: {
                requestsPerMinute: parseNumber(process.env.API_KEY_REQUESTS_PER_MINUTE),
                requestsPerHour: parseNumber(process.env.API_KEY_REQUESTS_PER_HOUR),
                requestsPerDay: parseNumber(process.env.API_KEY_REQUESTS_PER_DAY),
            },
        },
        security: {
            cors: {
                enabled: parseBoolean(process.env.CORS_ENABLED),
                origins: parseArray(process.env.CORS_ORIGINS),
                methods: parseArray(process.env.CORS_METHODS),
                headers: parseArray(process.env.CORS_HEADERS),
            },
            apiKeyValidation: {
                strictFormat: parseBoolean(process.env.API_KEY_STRICT_FORMAT),
                requirePrefix: process.env.API_KEY_REQUIRE_PREFIX,
                minLength: parseNumber(process.env.API_KEY_MIN_LENGTH),
                maxLength: parseNumber(process.env.API_KEY_MAX_LENGTH),
            },
            ipWhitelist: parseArray(process.env.IP_WHITELIST),
            maxRequestSize: parseNumber(process.env.MAX_REQUEST_SIZE),
        },
        monitoring: {
            enabled: parseBoolean(process.env.MONITORING_ENABLED),
            logLevel: process.env.LOG_LEVEL as any,
            metrics: {
                flushInterval: parseNumber(process.env.METRICS_FLUSH_INTERVAL),
                bufferSize: parseNumber(process.env.METRICS_BUFFER_SIZE),
                retentionDays: parseNumber(process.env.METRICS_RETENTION_DAYS),
            },
            alerts: {
                enabled: parseBoolean(process.env.ALERTS_ENABLED),
                errorRateThreshold: parseNumber(process.env.ERROR_RATE_THRESHOLD),
                responseTimeThreshold: parseNumber(process.env.RESPONSE_TIME_THRESHOLD),
                memoryThreshold: parseNumber(process.env.MEMORY_THRESHOLD),
                notificationChannels: parseArray(process.env.NOTIFICATION_CHANNELS),
            },
        },
        admin: {
            userIds: parseArray(process.env.ADMIN_USER_IDS),
            apiKeys: parseArray(process.env.ADMIN_API_KEYS),
            endpoints: {
                enabled: parseBoolean(process.env.ADMIN_ENDPOINTS_ENABLED),
                pathPrefix: process.env.ADMIN_PATH_PREFIX,
            },
        },
        development: {
            mockExternalServices: parseBoolean(process.env.MOCK_EXTERNAL_SERVICES),
            enableTestEndpoints: parseBoolean(process.env.ENABLE_TEST_ENDPOINTS),
            logSensitiveData: parseBoolean(process.env.LOG_SENSITIVE_DATA),
            skipAuthentication: parseBoolean(process.env.SKIP_AUTHENTICATION),
        },
    };

    // Validate configuration
    try {
        return ProxyConfigSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
            ).join('\n');
            throw new Error(`Invalid proxy configuration:\n${errorMessages}`);
        }
        throw error;
    }
}

/**
 * Parse OpenRouter API keys from environment variable
 */
function parseOpenRouterApiKeys(): string[] {
    const keys = process.env.OPENROUTER_API_KEYS;
    if (!keys) {
        throw new Error('OPENROUTER_API_KEYS environment variable is required');
    }

    return keys.split(',').map(key => key.trim()).filter(key => key.length > 0);
}

/**
 * Parse model multipliers from environment variable
 */
function parseModelMultipliers(): Record<string, number> {
    const multipliers = process.env.MODEL_MULTIPLIERS;
    if (!multipliers) return {};

    try {
        return JSON.parse(multipliers);
    } catch {
        console.warn('Invalid MODEL_MULTIPLIERS format, using defaults');
        return {};
    }
}

/**
 * Parse number from environment variable
 */
function parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined): boolean | undefined {
    if (!value) return undefined;
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse array from environment variable (comma-separated)
 */
function parseArray(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig(): {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
} {
    const env = process.env.NODE_ENV || 'development';

    return {
        isDevelopment: env === 'development',
        isProduction: env === 'production',
        isTest: env === 'test',
    };
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
    const required = [
        'OPENROUTER_API_KEYS',
        'QDRANT_URL',
        'SOLANA_MULTISIG_ADDRESS',
        'SVMAI_TOKEN_MINT',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// Singleton instance
let configInstance: ProxyConfig | null = null;

/**
 * Get proxy configuration (singleton)
 */
export function getProxyConfig(): ProxyConfig {
    if (!configInstance) {
        validateEnvironment();
        configInstance = loadProxyConfig();
    }
    return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetProxyConfig(): void {
    configInstance = null;
} 