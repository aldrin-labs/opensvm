import { z } from 'zod';

// Event validation schemas
export const BlockchainEventSchema = z.object({
  type: z.enum(['transaction', 'block', 'account_change']),
  timestamp: z.number().positive(),
  data: z.record(z.any()),
  metadata: z.record(z.any()).optional()
});

export const TransactionEventDataSchema = z.object({
  signature: z.string().min(88, 'Invalid signature length'),
  slot: z.number().positive(),
  logs: z.array(z.string()).optional(),
  err: z.string().nullable(),
  fee: z.number().nullable(),
  preBalances: z.array(z.number()).optional(),
  postBalances: z.array(z.number()).optional(),
  accountKeys: z.array(z.string()).optional(),
  signer: z.string().optional()
});

export const BlockEventDataSchema = z.object({
  slot: z.number().positive(),
  parent: z.number().positive(),
  root: z.number().positive()
});

// Stream API request schemas
export const StreamRequestSchema = z.object({
  action: z.enum(['authenticate', 'subscribe', 'unsubscribe', 'start_monitoring']),
  clientId: z.string().min(1).optional(),
  eventTypes: z.array(z.enum(['transaction', 'block', 'account_change', 'all'])).optional(),
  authToken: z.string().optional()
});

export const AnomalyAnalysisRequestSchema = z.object({
  action: z.enum(['analyze', 'bulk_analyze']),
  event: z.union([
    BlockchainEventSchema,
    z.array(BlockchainEventSchema)
  ])
});

// Validation helper functions
export function validateStreamRequest(data: any): { success: true; data: z.infer<typeof StreamRequestSchema> } | { success: false; errors: string[] } {
  try {
    const validated = StreamRequestSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateBlockchainEvent(data: any): { success: true; data: z.infer<typeof BlockchainEventSchema> } | { success: false; errors: string[] } {
  try {
    const validated = BlockchainEventSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateTransactionEvent(data: any): { success: true; data: z.infer<typeof TransactionEventDataSchema> } | { success: false; errors: string[] } {
  try {
    const validated = TransactionEventDataSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateAnomalyRequest(data: any): { success: true; data: z.infer<typeof AnomalyAnalysisRequestSchema> } | { success: false; errors: string[] } {
  try {
    const validated = AnomalyAnalysisRequestSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}