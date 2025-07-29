/**
 * Comprehensive Block Data Types for OpenSVM Block Explorer Enhancements
 * 
 * This module defines all TypeScript interfaces and types for the enhanced block explorer,
 * including analytics, social features, and performance metrics.
 */

// Re-export existing block types from solana.ts for compatibility
export type { BlockDetails as LegacyBlockDetails, Transaction } from '../solana';

// ============================================================================
// Core Block Data Models
// ============================================================================

export interface BlockData {
  slot: number;
  blockhash: string;
  parentSlot: number;
  blockTime: number | null;
  blockHeight: number;
  previousBlockhash: string;
  timestamp: number;
  transactions: Transaction[];
  rewards: Reward[];
  validator: ValidatorInfo;
  metrics: BlockMetrics;
  programStats: ProgramStats[];
  accountActivity: AccountActivity;
  transfers: SimpleTransfer[];
  visitStats: VisitStatistics;
}

export interface BlockMetrics {
  transactionCount: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalFees: number;
  computeUnitsConsumed: number;
  averageTransactionSize: number;
  blockProcessingTime: number;
  networkEfficiency: number;
  successRate: number;
  averageFeePerTransaction: number;
  computeUnitsPerTransaction: number;
  blockTimeDelta?: number;
}

export interface ValidatorInfo {
  address: string;
  name?: string;
  commission: number;
  activatedStake: number;
  performance: ValidatorPerformance;
  identity?: ValidatorIdentity;
}

export interface ValidatorPerformance {
  uptime: number;
  skipRate: number;
  averageBlockTime: number;
  rank: number;
  blocksProduced: number;
  expectedBlocks: number;
  voteAccuracy: number;
  performanceScore: number;
}

export interface ValidatorIdentity {
  name?: string;
  website?: string;
  keybaseUsername?: string;
  details?: string;
}

export interface Reward {
  pubkey: string;
  lamports: number;
  postBalance: number;
  rewardType: string;
  commission?: number;
}

// ============================================================================
// Program Analytics Data Models
// ============================================================================

export interface ProgramStats {
  programId: string;
  programName?: string;
  transactionCount: number;
  solVolume: number;
  splTokenVolumes: TokenVolume[];
  computeUnitsUsed: number;
  successRate: number;
  uniqueUsers: number;
  averageComputePerTx: number;
  category?: string;
  verified: boolean;
}

export interface TokenVolume {
  mint: string;
  symbol: string;
  amount: number;
  usdValue?: number;
  decimals: number;
  percentage: number;
}

export interface ProgramAnalytics {
  programId: string;
  metadata: ProgramMetadata;
  blockActivity: ProgramBlockActivity;
  historicalTrends: ProgramTrend[];
}

export interface ProgramMetadata {
  name?: string;
  description?: string;
  category: string;
  website?: string;
  verified: boolean;
  deployedAt?: number;
  upgradeAuthority?: string;
}

export interface ProgramBlockActivity {
  transactionCount: number;
  uniqueUsers: number;
  solVolume: number;
  splTokenVolumes: Map<string, number>;
  computeUnitsConsumed: number;
  averageComputePerTx: number;
  successRate: number;
  failureReasons: string[];
}

export interface ProgramTrend {
  timestamp: number;
  transactionCount: number;
  volume: number;
  users: number;
  successRate: number;
}

// ============================================================================
// Account Activity Data Models
// ============================================================================

export interface AccountActivity {
  address: string;
  rank: number;
  volume: number;
  pnl?: number;
  transactionCount: number;
  tokens: TokenActivity[];
  riskScore: number;
  labels: string[];
  accountType: 'wallet' | 'program' | 'token_account' | 'system';
}

export interface TokenActivity {
  mint: string;
  symbol: string;
  netChange: number;
  usdValue?: number;
  transactionCount: number;
  volumeIn: number;
  volumeOut: number;
  firstSeen: number;
  lastSeen: number;
}

export interface AccountAnalytics {
  address: string;
  blockActivity: AccountBlockActivity;
  riskScore: number;
  labels: string[];
  classification: AccountClassification;
}

export interface AccountBlockActivity {
  transactionCount: number;
  totalVolume: number;
  pnl: number;
  tokenActivities: TokenActivity[];
  programInteractions: string[];
  uniqueCounterparties: number;
  averageTransactionSize: number;
}

export interface AccountClassification {
  type: 'individual' | 'exchange' | 'defi_protocol' | 'bot' | 'unknown';
  confidence: number;
  indicators: string[];
}

// ============================================================================
// Transfer Analysis Data Models
// ============================================================================

export interface SimpleTransfer {
  rank: number;
  fromAddress: string;
  toAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  usdValue?: number;
  signature: string;
  timestamp: number;
  transferType: 'direct' | 'program_mediated';
  verified: boolean;
}

export interface TransferAnalysis {
  totalTransfers: number;
  totalVolume: number;
  totalUsdVolume: number;
  topTransfers: SimpleTransfer[];
  transfersByToken: Map<string, TransferSummary>;
  transferPatterns: TransferPattern[];
}

export interface TransferSummary {
  mint: string;
  symbol: string;
  transferCount: number;
  totalAmount: number;
  usdValue: number;
  averageAmount: number;
  uniqueAddresses: number;
}

export interface TransferPattern {
  type: 'high_frequency' | 'large_amount' | 'circular' | 'suspicious';
  description: string;
  addresses: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Visit Analytics and Social Features
// ============================================================================

export interface VisitStatistics {
  blockSlot: number;
  totalVisits: number;
  uniqueVisitors: number;
  visitHistory: VisitRecord[];
  geographicDistribution: GeographicData[];
  referrerSources: ReferrerData[];
  lastUpdated: number;
}

export interface VisitRecord {
  id: string;
  walletAddress?: string;
  ipHash: string;
  visitTime: number;
  sessionDuration: number;
  userAgent: string;
  referrer?: string;
  actions: UserAction[];
  country?: string;
  region?: string;
}

export interface UserAction {
  type: 'view' | 'click' | 'share' | 'bookmark' | 'export' | 'compare';
  target: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface GeographicData {
  country: string;
  region?: string;
  visitorCount: number;
  percentage: number;
}

export interface ReferrerData {
  source: string;
  type: 'direct' | 'social' | 'search' | 'referral';
  visitorCount: number;
  percentage: number;
}

// ============================================================================
// Block Comparison and Analysis
// ============================================================================

export interface BlockComparison {
  primaryBlock: BlockData;
  comparisonBlocks: BlockData[];
  metrics: ComparisonMetrics[];
  analysis: ComparisonAnalysis;
}

export interface ComparisonMetrics {
  metric: string;
  primaryValue: number;
  comparisonValues: number[];
  trend: 'higher' | 'lower' | 'similar';
  significance: 'low' | 'medium' | 'high';
  percentageDifference: number[];
}

export interface ComparisonAnalysis {
  summary: string;
  keyDifferences: string[];
  anomalies: AnomalyDetection[];
  recommendations: string[];
}

export interface AnomalyDetection {
  type: 'statistical' | 'pattern' | 'performance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedMetrics: string[];
  confidence: number;
  recommendation?: string;
}

// ============================================================================
// Bookmarking and User Preferences
// ============================================================================

export interface BookmarkData {
  blockSlot: number;
  note?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  userId?: string;
  isPublic: boolean;
  category?: string;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  bookmarks: BookmarkData[];
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  tags: string[];
}

export interface UserPreferences {
  defaultView: 'overview' | 'analytics' | 'transactions';
  autoRefresh: boolean;
  refreshInterval: number;
  notifications: NotificationSettings;
  displaySettings: DisplaySettings;
  privacySettings: PrivacySettings;
}

export interface NotificationSettings {
  enabled: boolean;
  email: boolean;
  browser: boolean;
  webhook?: string;
  alertTypes: AlertType[];
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  density: 'compact' | 'comfortable' | 'spacious';
  showAdvancedMetrics: boolean;
  defaultCurrency: 'USD' | 'SOL' | 'EUR' | 'BTC';
  numberFormat: 'standard' | 'scientific' | 'compact';
}

export interface PrivacySettings {
  trackVisits: boolean;
  shareAnalytics: boolean;
  publicBookmarks: boolean;
  showInLeaderboards: boolean;
}

// ============================================================================
// Alert System
// ============================================================================

export interface AlertConfiguration {
  id: string;
  name: string;
  description?: string;
  condition: AlertCondition;
  threshold: number;
  enabled: boolean;
  notificationMethods: NotificationMethod[];
  createdAt: number;
  updatedAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface AlertCondition {
  type: 'high_fees' | 'low_success_rate' | 'specific_validator' | 'transaction_count' | 'compute_units' | 'custom';
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'between';
  value: number | number[];
  timeWindow?: number; // in seconds
}

export interface NotificationMethod {
  type: 'email' | 'browser' | 'webhook' | 'sms';
  target: string;
  enabled: boolean;
  settings?: Record<string, any>;
}

export interface AlertType {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'security' | 'network' | 'validator';
  defaultThreshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// ============================================================================
// API Response Types
// ============================================================================

export interface BlockListResponse {
  blocks: BlockData[];
  hasMore: boolean;
  cursor?: number;
  totalCount?: number;
  filters?: BlockFilters;
}

export interface BlockFilters {
  dateRange?: {
    start: number;
    end: number;
  };
  validator?: string;
  transactionCountRange?: {
    min: number;
    max: number;
  };
  feeRange?: {
    min: number;
    max: number;
  };
  status?: 'confirmed' | 'finalized';
  hasAnomalies?: boolean;
}

export interface BlockAnalyticsResponse {
  programStats: ProgramStats[];
  accountActivity: AccountActivity[];
  transfers: SimpleTransfer[];
  metrics: BlockMetrics;
  anomalies: AnomalyDetection[];
  processingTime: number;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export enum BlockExplorerErrorType {
  INVALID_SLOT = 'INVALID_SLOT',
  BLOCK_NOT_FOUND = 'BLOCK_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ANALYTICS_ERROR = 'ANALYTICS_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

export interface BlockExplorerError {
  type: BlockExplorerErrorType;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;
  code?: string;
  timestamp: number;
}

// ============================================================================
// Performance and Monitoring Types
// ============================================================================

export interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTime: number;
  analyticsProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  userEngagement: EngagementMetrics;
}

export interface EngagementMetrics {
  averageSessionDuration: number;
  pagesPerSession: number;
  bounceRate: number;
  featureUsage: Record<string, number>;
  conversionRate: number;
}

// ============================================================================
// Cache Configuration Types
// ============================================================================

export interface CacheConfig {
  blockData: {
    ttl: number;
    strategy: 'immutable' | 'stale-while-revalidate' | 'background-refresh';
  };
  blockList: {
    ttl: number;
    strategy: 'stale-while-revalidate';
  };
  analytics: {
    ttl: number;
    strategy: 'background-refresh';
  };
  visitStats: {
    ttl: number;
    strategy: 'real-time-update';
  };
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  hits: number;
  lastAccessed: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type SortDirection = 'asc' | 'desc';
export type SortField = keyof BlockData | keyof BlockMetrics | 'timestamp' | 'validator';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface PaginationConfig {
  page: number;
  limit: number;
  offset: number;
  total?: number;
}

export interface SearchConfig {
  query: string;
  filters: BlockFilters;
  sort: SortConfig;
  pagination: PaginationConfig;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface BlockDetailsPageProps {
  slot: number;
  initialData?: BlockData;
}

export interface BlockListPageProps {
  initialBlocks?: BlockData[];
  filters?: BlockFilters;
}

export interface ProgramStatsDisplayProps {
  programStats: ProgramStats[];
  onProgramClick: (programId: string) => void;
  loading?: boolean;
  error?: BlockExplorerError | null;
}

export interface AccountActivityDisplayProps {
  topAccountsByVolume: AccountActivity[];
  topAccountsByPnL: AccountActivity[];
  onAccountClick: (address: string) => void;
  loading?: boolean;
  error?: BlockExplorerError | null;
}

export interface TransferAnalysisDisplayProps {
  transfers: SimpleTransfer[];
  onAddressClick: (address: string) => void;
  loading?: boolean;
  error?: BlockExplorerError | null;
}

export interface VisitStatisticsProps {
  blockSlot: number;
  visitCount: number;
  onExpand: () => void;
  expanded: boolean;
  loading?: boolean;
}

export interface BlockComparisonProps {
  primaryBlock: BlockData;
  comparisonBlocks: BlockData[];
  onAddComparison: () => void;
  onRemoveComparison: (slot: number) => void;
  loading?: boolean;
}

export interface BookmarkManagerProps {
  blockSlot: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onAddNote: (note: string) => void;
  onAddTags: (tags: string[]) => void;
  loading?: boolean;
}