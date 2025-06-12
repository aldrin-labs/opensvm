import { PublicKey } from '@solana/web3.js';
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Validates that a string is a valid Solana public key
 */
export const isValidPublicKey = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Combines class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as a currency string
 * @param value Number to format
 * @param currency Currency code
 * @param minimumFractionDigits Minimum fraction digits
 * @param maximumFractionDigits Maximum fraction digits
 */
export const formatCurrency = (
  value: number,
  currency = 'USD',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};

/**
 * Shortens an address string
 */
export const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 */
export function throttle<Args extends unknown[]>(
  func: (...args: Args) => void, 
  delay: number
): (...args: Args) => void {
  let lastTime = 0;
  return (...args: Args) => {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      func(...args);
    }
  };
}

/**
 * Converts lamports to SOL
 */
export const lamportsToSol = (lamports: number): number => {
  return lamports / 1_000_000_000;
};

/**
 * Formats a timestamp as a locale string
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * Truncates a string in the middle
 */
export const truncateMiddle = (str: string, startChars = 4, endChars = 4): string => {
  if (!str) return '';
  if (str.length <= startChars + endChars) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
};

/**
 * Checks if a string is a valid Solana address
 */
export const isValidSolanaAddress = (address: string): boolean => {
  return isValidPublicKey(address);
};

/**
 * Formats a number with thousands separators
 */
export const formatNumber = (
  num: number | null | undefined, 
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string => {
  if (num === null || num === undefined) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: options?.minimumFractionDigits || 0,
    maximumFractionDigits: options?.maximumFractionDigits || 2
  }).format(num);
};

/**
 * Checks if a string is a valid Solana transaction signature
 */
export const isValidTransactionSignature = (signature: string): boolean => {
  // Base58 check and length check (signatures are 88 characters)
  return /^[1-9A-HJ-NP-Za-km-z]{88}$/.test(signature);
};

/**
 * Sanitizes a search query to prevent injections
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (!query) return '';
  // Remove any potential harmful characters
  return query.replace(/[<>\/\\{}()*%$]/g, '');
};
