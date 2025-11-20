import { NextRequest, NextResponse } from 'next/server';
import { TokenConsumptionTracker, generateSessionId } from '../../../../lib/monetization/svmai';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { sessionId: sid, action, cost, requestId } = body || {};
        const cookieSid = req.cookies.get('svmai_session')?.value;
        const sessionId = typeof sid === 'string' && sid.length > 0 ? sid : (cookieSid ?? generateSessionId());
        const id = typeof requestId === 'string' && requestId.length > 0 ? requestId : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const result = TokenConsumptionTracker.consume(sessionId, { requestId: id, action: String(action ?? 'unknown'), cost: Number(cost ?? 0), timestamp: Date.now() });
        const res = NextResponse.json({ ...result, sessionId });
        if (!cookieSid) {
            res.cookies.set({ name: 'svmai_session', value: sessionId, httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
        }
        return res;
    } catch (e) {
        return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
}
