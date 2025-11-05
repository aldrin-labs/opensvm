/**
 * In-memory database for Off-Chain SOL ICO Launchpad
 * 
 * For MVP purposes, we use in-memory storage with persistence to JSON files.
 * In production, this would be replaced with PostgreSQL/MongoDB.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  Referrer,
  ReferralLink,
  Contribution,
  DailyVolumeReport,
  KOLAllocation,
  Sale,
  Dispute,
  AuditLog,
  FraudAlert,
} from '@/types/launchpad';

const DATA_DIR = join(process.cwd(), '.data', 'launchpad');

// In-memory stores
const stores = {
  referrers: new Map<string, Referrer>(),
  referralLinks: new Map<string, ReferralLink>(),
  contributions: new Map<string, Contribution>(),
  dailyVolumeReports: new Map<string, DailyVolumeReport>(),
  kolAllocations: new Map<string, KOLAllocation>(),
  sales: new Map<string, Sale>(),
  disputes: new Map<string, Dispute>(),
  auditLogs: new Map<string, AuditLog>(),
  fraudAlerts: new Map<string, FraudAlert>(),
};

let initialized = false;

/**
 * Initialize database - load from disk if available
 */
export async function initDatabase(): Promise<void> {
  if (initialized) return;

  try {
    // Create data directory if it doesn't exist
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }

    // Load each store from disk
    await Promise.all(
      Object.keys(stores).map(async (storeName) => {
        const filePath = join(DATA_DIR, `${storeName}.json`);
        if (existsSync(filePath)) {
          try {
            const data = await readFile(filePath, 'utf-8');
            const items = JSON.parse(data);
            const store = stores[storeName as keyof typeof stores] as Map<string, any>;
            items.forEach((item: any) => {
              store.set(item.id, item);
            });
          } catch (error) {
            console.error(`Error loading ${storeName}:`, error);
          }
        }
      })
    );

    initialized = true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Persist a store to disk
 */
async function persistStore(storeName: keyof typeof stores): Promise<void> {
  try {
    const store = stores[storeName];
    const items = Array.from(store.values());
    const filePath = join(DATA_DIR, `${storeName}.json`);
    await writeFile(filePath, JSON.stringify(items, null, 2));
  } catch (error) {
    console.error(`Error persisting ${storeName}:`, error);
  }
}

// ============= Referrer Operations =============

export async function createReferrer(referrer: Referrer): Promise<Referrer> {
  await initDatabase();
  stores.referrers.set(referrer.id, referrer);
  await persistStore('referrers');
  return referrer;
}

export async function getReferrer(id: string): Promise<Referrer | undefined> {
  await initDatabase();
  return stores.referrers.get(id);
}

export async function updateReferrer(id: string, updates: Partial<Referrer>): Promise<Referrer | undefined> {
  await initDatabase();
  const referrer = stores.referrers.get(id);
  if (!referrer) return undefined;
  
  const updated = { ...referrer, ...updates, updated_at: new Date().toISOString() };
  stores.referrers.set(id, updated);
  await persistStore('referrers');
  return updated;
}

export async function listReferrers(filters?: { status?: string }): Promise<Referrer[]> {
  await initDatabase();
  let referrers = Array.from(stores.referrers.values());
  
  if (filters?.status) {
    referrers = referrers.filter(r => r.status === filters.status);
  }
  
  return referrers;
}

// ============= Referral Link Operations =============

export async function createReferralLink(link: ReferralLink): Promise<ReferralLink> {
  await initDatabase();
  stores.referralLinks.set(link.id, link);
  await persistStore('referralLinks');
  return link;
}

export async function getReferralLink(id: string): Promise<ReferralLink | undefined> {
  await initDatabase();
  return stores.referralLinks.get(id);
}

export async function getReferralLinkByCode(code: string): Promise<ReferralLink | undefined> {
  await initDatabase();
  return Array.from(stores.referralLinks.values()).find(link => link.code === code);
}

export async function updateReferralLink(id: string, updates: Partial<ReferralLink>): Promise<ReferralLink | undefined> {
  await initDatabase();
  const link = stores.referralLinks.get(id);
  if (!link) return undefined;
  
  const updated = { ...link, ...updates };
  stores.referralLinks.set(id, updated);
  await persistStore('referralLinks');
  return updated;
}

export async function listReferralLinks(filters?: { kol_id?: string; sale_id?: string }): Promise<ReferralLink[]> {
  await initDatabase();
  let links = Array.from(stores.referralLinks.values());
  
  if (filters?.kol_id) {
    links = links.filter(l => l.kol_id === filters.kol_id);
  }
  if (filters?.sale_id) {
    links = links.filter(l => l.sale_id === filters.sale_id);
  }
  
  return links;
}

// ============= Contribution Operations =============

export async function createContribution(contribution: Contribution): Promise<Contribution> {
  await initDatabase();
  stores.contributions.set(contribution.contrib_id, contribution);
  await persistStore('contributions');
  return contribution;
}

export async function getContribution(id: string): Promise<Contribution | undefined> {
  await initDatabase();
  return stores.contributions.get(id);
}

export async function updateContribution(id: string, updates: Partial<Contribution>): Promise<Contribution | undefined> {
  await initDatabase();
  const contribution = stores.contributions.get(id);
  if (!contribution) return undefined;
  
  const updated = { ...contribution, ...updates };
  stores.contributions.set(id, updated);
  await persistStore('contributions');
  return updated;
}

export async function listContributions(filters?: {
  sale_id?: string;
  kol_id?: string;
  status?: string;
}): Promise<Contribution[]> {
  await initDatabase();
  let contributions = Array.from(stores.contributions.values());
  
  if (filters?.sale_id) {
    contributions = contributions.filter(c => c.sale_id === filters.sale_id);
  }
  if (filters?.kol_id) {
    contributions = contributions.filter(c => c.kol_id === filters.kol_id);
  }
  if (filters?.status) {
    contributions = contributions.filter(c => c.status === filters.status);
  }
  
  return contributions;
}

// ============= Daily Volume Report Operations =============

export async function createDailyVolumeReport(report: DailyVolumeReport): Promise<DailyVolumeReport> {
  await initDatabase();
  stores.dailyVolumeReports.set(report.id, report);
  await persistStore('dailyVolumeReports');
  return report;
}

export async function getDailyVolumeReport(id: string): Promise<DailyVolumeReport | undefined> {
  await initDatabase();
  return stores.dailyVolumeReports.get(id);
}

export async function listDailyVolumeReports(filters?: {
  sale_id?: string;
  date?: string;
}): Promise<DailyVolumeReport[]> {
  await initDatabase();
  let reports = Array.from(stores.dailyVolumeReports.values());
  
  if (filters?.sale_id) {
    reports = reports.filter(r => r.sale_id === filters.sale_id);
  }
  if (filters?.date) {
    reports = reports.filter(r => r.date === filters.date);
  }
  
  return reports;
}

// ============= KOL Allocation Operations =============

export async function createKOLAllocation(allocation: KOLAllocation): Promise<KOLAllocation> {
  await initDatabase();
  stores.kolAllocations.set(allocation.id, allocation);
  await persistStore('kolAllocations');
  return allocation;
}

export async function getKOLAllocation(id: string): Promise<KOLAllocation | undefined> {
  await initDatabase();
  return stores.kolAllocations.get(id);
}

export async function updateKOLAllocation(id: string, updates: Partial<KOLAllocation>): Promise<KOLAllocation | undefined> {
  await initDatabase();
  const allocation = stores.kolAllocations.get(id);
  if (!allocation) return undefined;
  
  const updated = { ...allocation, ...updates, updated_at: new Date().toISOString() };
  stores.kolAllocations.set(id, updated);
  await persistStore('kolAllocations');
  return updated;
}

export async function listKOLAllocations(filters?: {
  sale_id?: string;
  kol_id?: string;
}): Promise<KOLAllocation[]> {
  await initDatabase();
  let allocations = Array.from(stores.kolAllocations.values());
  
  if (filters?.sale_id) {
    allocations = allocations.filter(a => a.sale_id === filters.sale_id);
  }
  if (filters?.kol_id) {
    allocations = allocations.filter(a => a.kol_id === filters.kol_id);
  }
  
  return allocations;
}

// ============= Sale Operations =============

export async function createSale(sale: Sale): Promise<Sale> {
  await initDatabase();
  stores.sales.set(sale.id, sale);
  await persistStore('sales');
  return sale;
}

export async function getSale(id: string): Promise<Sale | undefined> {
  await initDatabase();
  return stores.sales.get(id);
}

export async function updateSale(id: string, updates: Partial<Sale>): Promise<Sale | undefined> {
  await initDatabase();
  const sale = stores.sales.get(id);
  if (!sale) return undefined;
  
  const updated = { ...sale, ...updates, updated_at: new Date().toISOString() };
  stores.sales.set(id, updated);
  await persistStore('sales');
  return updated;
}

export async function listSales(filters?: { status?: string }): Promise<Sale[]> {
  await initDatabase();
  let sales = Array.from(stores.sales.values());
  
  if (filters?.status) {
    sales = sales.filter(s => s.status === filters.status);
  }
  
  return sales;
}

// ============= Dispute Operations =============

export async function createDispute(dispute: Dispute): Promise<Dispute> {
  await initDatabase();
  stores.disputes.set(dispute.id, dispute);
  await persistStore('disputes');
  return dispute;
}

export async function getDispute(id: string): Promise<Dispute | undefined> {
  await initDatabase();
  return stores.disputes.get(id);
}

export async function updateDispute(id: string, updates: Partial<Dispute>): Promise<Dispute | undefined> {
  await initDatabase();
  const dispute = stores.disputes.get(id);
  if (!dispute) return undefined;
  
  const updated = { ...dispute, ...updates, updated_at: new Date().toISOString() };
  stores.disputes.set(id, updated);
  await persistStore('disputes');
  return updated;
}

export async function listDisputes(filters?: { status?: string; sale_id?: string }): Promise<Dispute[]> {
  await initDatabase();
  let disputes = Array.from(stores.disputes.values());
  
  if (filters?.status) {
    disputes = disputes.filter(d => d.status === filters.status);
  }
  if (filters?.sale_id) {
    disputes = disputes.filter(d => d.sale_id === filters.sale_id);
  }
  
  return disputes;
}

// ============= Audit Log Operations =============

export async function createAuditLog(log: AuditLog): Promise<AuditLog> {
  await initDatabase();
  stores.auditLogs.set(log.id, log);
  await persistStore('auditLogs');
  return log;
}

export async function listAuditLogs(filters?: {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
}): Promise<AuditLog[]> {
  await initDatabase();
  let logs = Array.from(stores.auditLogs.values());
  
  if (filters?.entity_type) {
    logs = logs.filter(l => l.entity_type === filters.entity_type);
  }
  if (filters?.entity_id) {
    logs = logs.filter(l => l.entity_id === filters.entity_id);
  }
  if (filters?.user_id) {
    logs = logs.filter(l => l.user_id === filters.user_id);
  }
  
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ============= Fraud Alert Operations =============

export async function createFraudAlert(alert: FraudAlert): Promise<FraudAlert> {
  await initDatabase();
  stores.fraudAlerts.set(alert.id, alert);
  await persistStore('fraudAlerts');
  return alert;
}

export async function listFraudAlerts(filters?: { severity?: string; reviewed?: boolean }): Promise<FraudAlert[]> {
  await initDatabase();
  let alerts = Array.from(stores.fraudAlerts.values());
  
  if (filters?.severity) {
    alerts = alerts.filter(a => a.severity === filters.severity);
  }
  if (filters?.reviewed !== undefined) {
    alerts = alerts.filter(a => a.reviewed === filters.reviewed);
  }
  
  return alerts.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function updateFraudAlert(id: string, updates: Partial<FraudAlert>): Promise<FraudAlert | undefined> {
  await initDatabase();
  const alert = stores.fraudAlerts.get(id);
  if (!alert) return undefined;
  
  const updated = { ...alert, ...updates };
  stores.fraudAlerts.set(id, updated);
  await persistStore('fraudAlerts');
  return updated;
}
