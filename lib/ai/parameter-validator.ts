/**
 * Parameter Validation Utilities
 * 
 * Validates and normalizes parameters for AI tools, especially Solana addresses
 * and transaction signatures to prevent analysis of wrong accounts/transactions.
 */

// Solana address validation regex (base58, 32-44 characters)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Solana transaction signature regex (base58, 87-88 characters)  
const SOLANA_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

// Common Solana program IDs for validation
const WELL_KNOWN_PROGRAM_IDS = new Set([
  '11111111111111111111111111111111',  // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Account Program
  'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',  // Solend
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', // Serum DEX v3
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',  // Serum SRM Token
]);

export interface ValidationResult {
  valid: boolean;
  normalized: string;
  type: 'address' | 'signature' | 'unknown';
  confidence: number;
  errors: string[];
}

export interface AccountValidationResult extends ValidationResult {
  type: 'address';
  isWellKnownProgram: boolean;
  programName?: string;
}

export interface SignatureValidationResult extends ValidationResult {
  type: 'signature';
}

/**
 * Validates and normalizes a Solana address
 */
export function validateAccountAddress(input: string): AccountValidationResult {
  const errors: string[] = [];
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      type: 'address',
      confidence: 0,
      errors: ['Address cannot be empty'],
      isWellKnownProgram: false
    };
  }

  // Check format
  if (!SOLANA_ADDRESS_REGEX.test(trimmed)) {
    errors.push('Invalid Solana address format (must be 32-44 base58 characters)');
    return {
      valid: false,
      normalized: trimmed,
      type: 'address',
      confidence: 0,
      errors,
      isWellKnownProgram: false
    };
  }

  // Check if it's a well-known program
  const isWellKnownProgram = WELL_KNOWN_PROGRAM_IDS.has(trimmed);
  let programName: string | undefined;
  
  if (isWellKnownProgram) {
    switch (trimmed) {
      case '11111111111111111111111111111111':
        programName = 'System Program';
        break;
      case 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA':
        programName = 'Token Program';
        break;
      case 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL':
        programName = 'Associated Token Account Program';
        break;
      case 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo':
        programName = 'Solend';
        break;
      case '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin':
        programName = 'Serum DEX v3';
        break;
      case 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX':
        programName = 'Serum SRM Token';
        break;
    }
  }

  return {
    valid: true,
    normalized: trimmed,
    type: 'address',
    confidence: 0.95,
    errors: [],
    isWellKnownProgram,
    programName
  };
}

/**
 * Validates and normalizes a Solana transaction signature
 */
export function validateTransactionSignature(input: string): SignatureValidationResult {
  const errors: string[] = [];
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      type: 'signature',
      confidence: 0,
      errors: ['Signature cannot be empty']
    };
  }

  // Check format
  if (!SOLANA_SIGNATURE_REGEX.test(trimmed)) {
    errors.push('Invalid transaction signature format (must be 87-88 base58 characters)');
    return {
      valid: false,
      normalized: trimmed,
      type: 'signature',
      confidence: 0,
      errors
    };
  }

  return {
    valid: true,
    normalized: trimmed,
    type: 'signature',
    confidence: 0.95,
    errors: []
  };
}

/**
 * Auto-detects and validates Solana data from input string
 */
export function validateSolanaData(input: string): ValidationResult {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      type: 'unknown',
      confidence: 0,
      errors: ['Input cannot be empty']
    };
  }

  // Try signature first (longer)
  if (trimmed.length >= 87 && trimmed.length <= 88) {
    return validateTransactionSignature(trimmed);
  }

  // Try address
  if (trimmed.length >= 32 && trimmed.length <= 44) {
    return validateAccountAddress(trimmed);
  }

  return {
    valid: false,
    normalized: trimmed,
    type: 'unknown',
    confidence: 0,
    errors: ['Input does not match Solana address or signature format']
  };
}

/**
 * Extracts all Solana addresses and signatures from a text string
 */
export function extractSolanaData(text: string): {
  addresses: AccountValidationResult[];
  signatures: SignatureValidationResult[];
} {
  const addresses: AccountValidationResult[] = [];
  const signatures: SignatureValidationResult[] = [];

  // Extract potential addresses (32-44 chars)
  const addressMatches = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) || [];
  
  for (const match of addressMatches) {
    // Check if it's likely a signature first
    if (match.length >= 87) {
      const sigResult = validateTransactionSignature(match);
      if (sigResult.valid) {
        signatures.push(sigResult);
        continue;
      }
    }
    
    // Try as address
    const addrResult = validateAccountAddress(match);
    if (addrResult.valid) {
      addresses.push(addrResult);
    }
  }

  return { addresses, signatures };
}

/**
 * Validates parameters for account analysis tools
 */
export function validateAccountAnalysisParams(params: any): {
  valid: boolean;
  normalized: any;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized: any = { ...params };

  // Validate account address
  if (params.account || params.address || params.accountAddress) {
    const addressField = params.account || params.address || params.accountAddress;
    const validation = validateAccountAddress(String(addressField));
    
    if (!validation.valid) {
      errors.push(`Invalid account address: ${validation.errors.join(', ')}`);
    } else {
      normalized.account = validation.normalized;
      normalized.address = validation.normalized;
      normalized.accountAddress = validation.normalized;
      
      if (validation.isWellKnownProgram && validation.programName) {
        warnings.push(`This appears to be a system program (${validation.programName}). Analysis may show limited data.`);
      }
    }
  }

  // Validate optional transaction limit
  if (params.limit !== undefined) {
    const limit = Number(params.limit);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      errors.push('Limit must be a number between 1 and 1000');
    } else {
      normalized.limit = limit;
    }
  }

  return {
    valid: errors.length === 0,
    normalized,
    errors,
    warnings
  };
}

/**
 * Validates parameters for transaction analysis tools
 */
export function validateTransactionAnalysisParams(params: any): {
  valid: boolean;
  normalized: any;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized: any = { ...params };

  // Validate transaction signature
  if (params.signature || params.txSignature || params.transactionSignature) {
    const sigField = params.signature || params.txSignature || params.transactionSignature;
    const validation = validateTransactionSignature(String(sigField));
    
    if (!validation.valid) {
      errors.push(`Invalid transaction signature: ${validation.errors.join(', ')}`);
    } else {
      normalized.signature = validation.normalized;
      normalized.txSignature = validation.normalized;
      normalized.transactionSignature = validation.normalized;
    }
  }

  return {
    valid: errors.length === 0,
    normalized,
    errors,
    warnings
  };
}

/**
 * Logs parameter validation results for debugging
 */
export function logParameterValidation(
  toolName: string, 
  originalParams: any, 
  validationResult: any
): void {
  console.log(`[ParameterValidator] ${toolName} validation:`, {
    originalParams,
    validationResult,
    timestamp: new Date().toISOString()
  });

  if (validationResult.errors?.length > 0) {
    console.warn(`[ParameterValidator] ${toolName} validation errors:`, validationResult.errors);
  }

  if (validationResult.warnings?.length > 0) {
    console.warn(`[ParameterValidator] ${toolName} validation warnings:`, validationResult.warnings);
  }
}

/**
 * Corrects common parameter issues automatically
 */
export function correctCommonParameterIssues(params: any): {
  corrected: any;
  corrections: string[];
} {
  const corrected: any = { ...params };
  const corrections: string[] = [];

  // Remove extra whitespace from all string parameters
  Object.keys(corrected).forEach(key => {
    if (typeof corrected[key] === 'string') {
      const original = corrected[key];
      corrected[key] = original.trim();
      if (original !== corrected[key]) {
        corrections.push(`Trimmed whitespace from ${key}`);
      }
    }
  });

  // Normalize common address field names
  const addressFields = ['account', 'address', 'accountAddress', 'wallet', 'walletAddress'];
  const foundAddressField = addressFields.find(field => corrected[field]);
  if (foundAddressField && corrected[foundAddressField]) {
    const address = corrected[foundAddressField];
    // Set standard field name
    corrected.account = address;
    corrections.push(`Normalized address field to 'account'`);
  }

  // Normalize signature field names
  const signatureFields = ['signature', 'txSignature', 'transactionSignature', 'tx', 'hash'];
  const foundSigField = signatureFields.find(field => corrected[field]);
  if (foundSigField && corrected[foundSigField]) {
    const signature = corrected[foundSigField];
    // Set standard field name
    corrected.signature = signature;
    corrections.push(`Normalized signature field to 'signature'`);
  }

  return { corrected, corrections };
}
