/**
 * Safe localStorage wrapper with fallback for disabled/unavailable storage
 */

class SafeStorage {
  private memoryStorage: Map<string, string> = new Map();
  private isStorageAvailable: boolean = false;

  constructor() {
    this.checkStorageAvailability();
  }

  private checkStorageAvailability(): void {
    try {
      const testKey = '__storage_test__';
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        this.isStorageAvailable = true;
      }
    } catch (e) {
      console.warn('localStorage is not available, using memory storage as fallback');
      this.isStorageAvailable = false;
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.isStorageAvailable) {
        return localStorage.getItem(key);
      }
      return this.memoryStorage.get(key) || null;
    } catch (e) {
      console.error('Error reading from storage:', e);
      return this.memoryStorage.get(key) || null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      if (this.isStorageAvailable) {
        localStorage.setItem(key, value);
      } else {
        this.memoryStorage.set(key, value);
      }
    } catch (e) {
      console.error('Error writing to storage:', e);
      this.memoryStorage.set(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      if (this.isStorageAvailable) {
        localStorage.removeItem(key);
      } else {
        this.memoryStorage.delete(key);
      }
    } catch (e) {
      console.error('Error removing from storage:', e);
      this.memoryStorage.delete(key);
    }
  }

  clear(): void {
    try {
      if (this.isStorageAvailable) {
        localStorage.clear();
      }
      this.memoryStorage.clear();
    } catch (e) {
      console.error('Error clearing storage:', e);
      this.memoryStorage.clear();
    }
  }
}

// Export singleton instance
export const safeStorage = new SafeStorage();

// Debounce utility for reducing storage writes
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Utility to safely parse JSON with fallback
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return fallback;
  }
}

// Utility to check if we're on a mobile device
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  
  return mobileKeywords.some(keyword => userAgent.includes(keyword)) || 
         ('ontouchstart' in window) ||
         (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
}
