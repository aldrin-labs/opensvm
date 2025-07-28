import { AnthropicClient } from './AnthropicClient';
import { Mutex } from 'async-mutex';

let instance: AnthropicClient | null = null;
const singletonMutex = new Mutex();

/**
 * Get the singleton instance of AnthropicClient
 * This ensures that round-robin state and statistics are preserved across requests
 * Thread-safe initialization prevents race conditions
 */
export async function getAnthropicClient(): Promise<AnthropicClient> {
    if (!instance) {
        const release = await singletonMutex.acquire();
        try {
            // Double-check after acquiring lock
            if (!instance) {
                instance = new AnthropicClient();
            }
        } finally {
            release();
        }
    }
    return instance;
}

/**
 * Get the singleton instance synchronously (only use if already initialized)
 * @throws Error if instance not yet initialized
 */
export function getAnthropicClientSync(): AnthropicClient {
    if (!instance) {
        throw new Error('AnthropicClient not yet initialized. Use getAnthropicClient() instead.');
    }
    return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export async function resetAnthropicClient(): Promise<void> {
    const release = await singletonMutex.acquire();
    try {
        instance = null;
    } finally {
        release();
    }
} 