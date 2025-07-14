/**
 * Logout endpoint
 * POST /api/auth/logout
 */

import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth-server';

export async function POST() {
  try {
    // Clear session cookie
    clearSessionCookie();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
