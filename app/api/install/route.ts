import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Fetch the latest install script from the main branch of the CLI repo
    const response = await fetch('https://raw.githubusercontent.com/openSVM/osvm-cli/main/install.sh');
    
    if (!response.ok) {
      console.error(`Failed to fetch installer: ${response.status} ${response.statusText}`);
      return new NextResponse('Failed to fetch installer script', { status: 502 });
    }
    
    const script = await response.text();
    
    return new NextResponse(script, {
      status: 200,
      headers: {
        'Content-Type': 'text/x-sh; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error serving installer script:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
