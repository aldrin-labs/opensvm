import { NextRequest, NextResponse } from 'next/server';
import { getFixedValidatorAnalytics } from '@/lib/data-sources/fixed-validator-analytics';

export async function GET(request: NextRequest) {
  try {
    const validatorAnalytics = getFixedValidatorAnalytics();
    
    // Initialize with timeout protection
    try {
      await Promise.race([
        validatorAnalytics.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.warn('Validator analytics initialization warning:', error);
      // Continue with fallback data
    }
    
    // Get all validator data with individual timeouts
    const [validatorsResponse, networkStatsResponse, decentralizationResponse] = await Promise.allSettled([
      Promise.race([
        validatorAnalytics.getValidators(),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Validators fetch timeout')), 15000)
        )
      ]),
      Promise.race([
        validatorAnalytics.getNetworkStats(),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Network stats timeout')), 10000)
        )
      ]),
      Promise.race([
        validatorAnalytics.getDecentralizationMetrics(),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Decentralization timeout')), 10000)
        )
      ])
    ]);
    
    const healthStatus = validatorAnalytics.getHealthStatus();
    
    // Check if we have enough data to return a successful response
    const hasValidators = validatorsResponse.status === 'fulfilled' && validatorsResponse.value?.success;
    const hasNetworkStats = networkStatsResponse.status === 'fulfilled' && networkStatsResponse.value?.success;
    const hasDecentralization = decentralizationResponse.status === 'fulfilled' && decentralizationResponse.value?.success;
    
    if (!hasValidators || !hasNetworkStats || !hasDecentralization) {
      // If any critical component failed, return error with details
      const errors = [];
      if (!hasValidators) errors.push('Failed to fetch validators');
      if (!hasNetworkStats) errors.push('Failed to fetch network stats');  
      if (!hasDecentralization) errors.push('Failed to fetch decentralization metrics');
      
      return NextResponse.json({
        success: false,
        error: `Validator data unavailable: ${errors.join(', ')}`,
        details: {
          validators: validatorsResponse.status === 'rejected' ? validatorsResponse.reason?.message : 'Unknown error',
          networkStats: networkStatsResponse.status === 'rejected' ? networkStatsResponse.reason?.message : 'Unknown error',
          decentralization: decentralizationResponse.status === 'rejected' ? decentralizationResponse.reason?.message : 'Unknown error'
        }
      }, { status: 500 });
    }
    
    const responseData = {
      validators: validatorsResponse.value.data || [],
      networkStats: networkStatsResponse.value.data || {},
      decentralization: decentralizationResponse.value.data || {},
      health: healthStatus
    };
    
    return NextResponse.json({
      success: true,
      data: responseData,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Error in validator analytics API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    const validatorAnalytics = getFixedValidatorAnalytics();
    
    switch (action) {
      case 'start_monitoring':
        await Promise.race([
          validatorAnalytics.initialize(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Initialize timeout')), 10000)
          )
        ]);
        await Promise.race([
          validatorAnalytics.startMonitoring(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Start monitoring timeout')), 10000)
          )
        ]);
        return NextResponse.json({
          success: true,
          message: 'Validator monitoring started'
        });
        
      case 'stop_monitoring':
        await validatorAnalytics.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Validator monitoring stopped'
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in validator analytics POST:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}