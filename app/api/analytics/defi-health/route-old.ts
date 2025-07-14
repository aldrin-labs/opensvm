import { NextRequest, NextResponse } from 'next/server';
import { getFastDeFiHealthMonitor } from '@/lib/data-sources/fast-defi-health-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol') || undefined;
    
    const monitor = getFastDeFiHealthMonitor();
    
    // Initialize with timeout protection
    try {
      await Promise.race([
        monitor.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.warn('DeFi health monitor initialization warning:', error);
      // Continue with fallback data
    }

    const [protocolHealth, exploitAlerts, protocolRankings, ecosystemHealth] = await Promise.allSettled([
      monitor.getProtocolHealth(protocol),
      monitor.getExploitAlerts(),
      monitor.getProtocolRankings(),
      monitor.getEcosystemHealth()
    ]);
    
    const healthStatus = monitor.getHealthStatus();

    return NextResponse.json({
      success: true,
      data: {
        protocols: protocolHealth.status === 'fulfilled' && protocolHealth.value.success 
          ? protocolHealth.value.data 
          : [],
        alerts: exploitAlerts.status === 'fulfilled' && exploitAlerts.value.success 
          ? exploitAlerts.value.data 
          : [],
        rankings: protocolRankings.status === 'fulfilled' && protocolRankings.value.success 
          ? protocolRankings.value.data 
          : [],
        ecosystem: ecosystemHealth.status === 'fulfilled' && ecosystemHealth.value.success 
          ? ecosystemHealth.value.data 
          : {
              totalTvl: 0,
              avgHealthScore: 0,
              avgRiskScore: 0,
              criticalAlerts: 0,
              protocolCount: 0
            },
        health: healthStatus
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error in DeFi health monitor API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const monitor = getFastDeFiHealthMonitor();
    
    // Initialize with timeout protection
    try {
      await Promise.race([
        monitor.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 5000)
        )
      ]);
    } catch (error) {
      console.warn('DeFi health monitor initialization warning:', error);
      // Continue anyway
    }

    switch (action) {
      case 'start_monitoring':
        await Promise.race([
          monitor.startMonitoring(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Start monitoring timeout')), 10000)
          )
        ]);
        return NextResponse.json({
          success: true,
          message: 'DeFi health monitoring started',
          timestamp: Date.now()
        });

      case 'stop_monitoring':
        await monitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: 'DeFi health monitoring stopped',
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
            timestamp: Date.now()
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in DeFi health monitor POST API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}