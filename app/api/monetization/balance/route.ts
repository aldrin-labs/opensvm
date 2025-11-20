import { NextRequest, NextResponse } from 'next/server';
import { TokenConsumptionTracker, generateSessionId } from '../../../../lib/monetization/svmai';

export async function GET(req: NextRequest) {
    try {
        const cookies = req.cookies;
        let sessionId = cookies.get('svmai_session')?.value;
        if (!sessionId) {
            sessionId = generateSessionId();
        }
        const data = TokenConsumptionTracker.balance(sessionId);
        const res = NextResponse.json({ ...data, sessionId });
        if (!cookies.get('svmai_session')) {
            res.cookies.set({ name: 'svmai_session', value: sessionId, httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
        }
        return res;
    } catch (e) {
        return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
}
