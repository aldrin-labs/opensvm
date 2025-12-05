/**
 * Prediction Markets Price Alerts System
 *
 * Features:
 * - Create alerts for price thresholds (above/below)
 * - Volume spike alerts
 * - Browser notifications
 * - localStorage persistence
 * - Real-time monitoring with SSE
 */

export type AlertType = 'price_above' | 'price_below' | 'volume_spike' | 'price_change';
export type AlertStatus = 'active' | 'triggered' | 'dismissed';

export interface PriceAlert {
  id: string;
  marketId: string;
  platform: string;
  marketTitle: string;
  type: AlertType;
  threshold: number;
  currentValue?: number;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  notified: boolean;
}

export interface AlertConfig {
  enableBrowserNotifications: boolean;
  enableSound: boolean;
  checkIntervalMs: number;
}

const STORAGE_KEY = 'opensvm_prediction_alerts';
const CONFIG_KEY = 'opensvm_prediction_alerts_config';

// Default config
const defaultConfig: AlertConfig = {
  enableBrowserNotifications: true,
  enableSound: false,
  checkIntervalMs: 30000,
};

/**
 * AlertsManager - Client-side price alerts management
 */
export class AlertsManager {
  private alerts: Map<string, PriceAlert> = new Map();
  private config: AlertConfig = defaultConfig;
  private listeners: Set<(alerts: PriceAlert[]) => void> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
      this.loadConfig();
    }
  }

  // Load alerts from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const alerts = JSON.parse(stored) as PriceAlert[];
        alerts.forEach(alert => this.alerts.set(alert.id, alert));
      }
    } catch (e) {
      console.error('[Alerts] Failed to load from storage:', e);
    }
  }

  // Save alerts to localStorage
  private saveToStorage(): void {
    try {
      const alerts = Array.from(this.alerts.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {
      console.error('[Alerts] Failed to save to storage:', e);
    }
  }

  // Load config
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        this.config = { ...defaultConfig, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('[Alerts] Failed to load config:', e);
    }
  }

  // Save config
  saveConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error('[Alerts] Failed to save config:', e);
    }
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }

  // Generate unique ID
  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // Create a new alert
  createAlert(params: {
    marketId: string;
    platform: string;
    marketTitle: string;
    type: AlertType;
    threshold: number;
  }): PriceAlert {
    const alert: PriceAlert = {
      id: this.generateId(),
      marketId: params.marketId,
      platform: params.platform,
      marketTitle: params.marketTitle,
      type: params.type,
      threshold: params.threshold,
      status: 'active',
      createdAt: Date.now(),
      notified: false,
    };

    this.alerts.set(alert.id, alert);
    this.saveToStorage();
    this.notifyListeners();

    return alert;
  }

  // Delete an alert
  deleteAlert(id: string): boolean {
    const deleted = this.alerts.delete(id);
    if (deleted) {
      this.saveToStorage();
      this.notifyListeners();
    }
    return deleted;
  }

  // Dismiss a triggered alert
  dismissAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert && alert.status === 'triggered') {
      alert.status = 'dismissed';
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Get all alerts
  getAlerts(): PriceAlert[] {
    return Array.from(this.alerts.values());
  }

  // Get active alerts
  getActiveAlerts(): PriceAlert[] {
    return this.getAlerts().filter(a => a.status === 'active');
  }

  // Get triggered alerts
  getTriggeredAlerts(): PriceAlert[] {
    return this.getAlerts().filter(a => a.status === 'triggered');
  }

  // Check alerts against current market data
  checkAlerts(markets: Array<{
    id: string;
    platform: string;
    yesPrice: number;
    volume24h: number;
  }>): PriceAlert[] {
    const triggered: PriceAlert[] = [];
    const marketMap = new Map(markets.map(m => [`${m.platform}:${m.id}`, m]));

    this.alerts.forEach(alert => {
      if (alert.status !== 'active') return;

      const market = marketMap.get(`${alert.platform}:${alert.marketId}`);
      if (!market) return;

      let shouldTrigger = false;
      let currentValue = 0;

      switch (alert.type) {
        case 'price_above':
          currentValue = market.yesPrice;
          shouldTrigger = market.yesPrice >= alert.threshold;
          break;
        case 'price_below':
          currentValue = market.yesPrice;
          shouldTrigger = market.yesPrice <= alert.threshold;
          break;
        case 'volume_spike':
          currentValue = market.volume24h;
          shouldTrigger = market.volume24h >= alert.threshold;
          break;
      }

      if (shouldTrigger) {
        alert.status = 'triggered';
        alert.triggeredAt = Date.now();
        alert.currentValue = currentValue;
        triggered.push(alert);
      }
    });

    if (triggered.length > 0) {
      this.saveToStorage();
      this.notifyListeners();
      this.sendNotifications(triggered);
    }

    return triggered;
  }

  // Send browser notifications
  private async sendNotifications(alerts: PriceAlert[]): Promise<void> {
    if (!this.config.enableBrowserNotifications) return;
    if (typeof window === 'undefined') return;

    // Request permission if needed
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return;

    alerts.forEach(alert => {
      if (alert.notified) return;

      const typeLabels = {
        price_above: 'Price Above',
        price_below: 'Price Below',
        volume_spike: 'Volume Spike',
        price_change: 'Price Change',
      };

      const notification = new Notification('Prediction Market Alert', {
        body: `${alert.marketTitle}\n${typeLabels[alert.type]}: ${alert.type.includes('price') ? `${(alert.currentValue! * 100).toFixed(1)}%` : `$${alert.currentValue?.toLocaleString()}`}`,
        icon: '/icon.png',
        tag: alert.id,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      alert.notified = true;
    });

    this.saveToStorage();
  }

  // Subscribe to alert changes
  subscribe(callback: (alerts: PriceAlert[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  private notifyListeners(): void {
    const alerts = this.getAlerts();
    this.listeners.forEach(cb => cb(alerts));
  }

  // Clear all alerts
  clearAll(): void {
    this.alerts.clear();
    this.saveToStorage();
    this.notifyListeners();
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined') return 'denied';
    if (!('Notification' in window)) return 'denied';

    if (Notification.permission === 'default') {
      return Notification.requestPermission();
    }

    return Notification.permission;
  }
}

// Singleton instance
let alertsManager: AlertsManager | null = null;

export function getAlertsManager(): AlertsManager {
  if (!alertsManager) {
    alertsManager = new AlertsManager();
  }
  return alertsManager;
}

export default {
  AlertsManager,
  getAlertsManager,
};
