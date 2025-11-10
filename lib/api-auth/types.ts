/**
 * API Authentication Types
 * Supports API key generation and wallet binding via auth links
 */

export interface ApiKey {
  id: string;
  key: string; // The actual API key (hashed in storage)
  name: string;
  userId?: string; // Bound wallet address
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  permissions: string[];
  metadata?: Record<string, any>;
  status: 'pending' | 'active' | 'revoked';
  [key: string]: any; // Index signature for Qdrant compatibility
}

export interface AuthLink {
  id: string;
  apiKeyId: string;
  token: string; // One-time use token
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
  boundWallet?: string;
  status: 'pending' | 'used' | 'expired';
  [key: string]: any; // Index signature for Qdrant compatibility
}

export interface ApiKeyCreateRequest {
  name: string;
  permissions?: string[];
  expiresInDays?: number;
  metadata?: Record<string, any>;
}

export interface ApiKeyCreateResponse {
  apiKey: ApiKey;
  rawKey: string; // Only returned once during creation
  authLink?: string; // Optional auth link for wallet binding
}

export interface AuthLinkCreateRequest {
  apiKeyId: string;
  expiresInMinutes?: number;
}

export interface AuthLinkCreateResponse {
  authLink: string;
  expiresAt: Date;
  token: string;
}

export interface WalletBindRequest {
  token: string;
  walletAddress: string;
  signature: string;
  message: string;
}

export interface WalletBindResponse {
  success: boolean;
  apiKeyId: string;
  walletAddress: string;
}

export interface ApiKeyActivity {
  id: string;
  apiKeyId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number; // in milliseconds
  userAgent?: string;
  ipAddress?: string;
  errorMessage?: string;
  requestSize?: number; // in bytes
  responseSize?: number; // in bytes
  [key: string]: any; // Index signature for Qdrant compatibility
}

export interface ApiKeyMetrics {
  apiKeyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastActivity?: Date;
  requestsByEndpoint: Record<string, number>;
  requestsByDay: Record<string, number>;
}

export interface ApiKeyActivityListRequest {
  apiKeyId: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ApiKeyActivityListResponse {
  activities: ApiKeyActivity[];
  total: number;
  hasMore: boolean;
}
