import { NextRequest, NextResponse } from 'next/server';
import { TokenConsumptionTracker, generateSessionId } from '../../../../lib/monetization/svmai';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { sessionId: sid, action } = body || {};
        const cookieSid = req.cookies.get('svmai_session')?.value;
        const sessionId = typeof sid === 'string' && sid.length > 0 ? sid : (cookieSid ?? generateSessionId());
        const result = TokenConsumptionTracker.earn(sessionId, String(action ?? 'bonus'));
        const res = NextResponse.json({ ...result, sessionId });
        if (!cookieSid) {
            res.cookies.set({ name: 'svmai_session', value: sessionId, httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
        }
        return res;
    } catch (e) {
        return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
}
