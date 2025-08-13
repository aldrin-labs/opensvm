export type InvestigationType = 'basic' | 'complex' | 'deep' | 'navigationStep' | 'dataExtraction' | 'patternAnalysis';

export const SVMAITokenPricing: Record<InvestigationType, number> = {
    basic: 10,
    complex: 25,
    deep: 50,
    navigationStep: 2,
    dataExtraction: 1,
    patternAnalysis: 5,
};

export interface ConsumptionItem {
    requestId: string;
    action: string;
    cost: number;
    timestamp: number;
}

interface SessionRecord {
    balance: number;
    usageThisMonth: number;
    tier: 'free' | 'pro' | 'enterprise';
    log: ConsumptionItem[];
}

// In-memory store (MVP). Not for production.
const store = new Map<string, SessionRecord>();

function getOrCreateSession(sessionId: string): SessionRecord {
    let rec = store.get(sessionId);
    if (!rec) {
        rec = { balance: 100, usageThisMonth: 0, tier: 'free', log: [] };
        store.set(sessionId, rec);
    }
    return rec;
}

export function generateSessionId(): string {
    return `sv_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export class TokenConsumptionTracker {
    static balance(sessionId: string) {
        const s = getOrCreateSession(sessionId);
        return { balance: s.balance, usageThisMonth: s.usageThisMonth, tier: s.tier };
    }

    static consume(sessionId: string, item: ConsumptionItem) {
        const s = getOrCreateSession(sessionId);
        // Idempotent by requestId
        if (s.log.some((l) => l.requestId === item.requestId)) {
            return { ok: true, balance: s.balance, usageThisMonth: s.usageThisMonth };
        }
        if (item.cost > s.balance) {
            return { ok: false, reason: 'insufficient', balance: s.balance } as const;
        }
        s.balance -= item.cost;
        s.usageThisMonth += item.cost;
        s.log.push({ ...item, timestamp: Date.now() });
        return { ok: true, balance: s.balance, usageThisMonth: s.usageThisMonth };
    }

    static earn(sessionId: string, action: string) {
        const s = getOrCreateSession(sessionId);
        const bonus = action === 'test_credit' ? 50 : 5;
        s.balance += bonus;
        return { ok: true, balance: s.balance };
    }
}

export class SVMAITokenGate {
    static getUserTokenBalance(sessionId: string) {
        return TokenConsumptionTracker.balance(sessionId);
    }

    static calculateEstimatedCost(investigationType: InvestigationType): number {
        return SVMAITokenPricing[investigationType];
    }

    static validateInvestigationAccess(sessionId: string, required: number) {
        const { balance } = this.getUserTokenBalance(sessionId);
        return { allowed: balance >= required, balance };
    }

    static consumeTokens(sessionId: string, requestId: string, action: string, cost: number) {
        return TokenConsumptionTracker.consume(sessionId, { requestId, action, cost, timestamp: Date.now() });
    }
}
