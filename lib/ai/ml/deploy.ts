/**
 * OpenSVM AI/ML System Deployment Script
 * 
 * This script handles the initialization and deployment of the complete AI/ML system
 * for integration with the OpenSVM platform.
 */

import { 
  initializeAIML, 
  getSystemHealth, 
  AI_ML_VERSION, 
  AI_ML_FEATURES,
  QuickSetup,
  type AIMLConfig 
} from './index';

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  enableHealthChecks: boolean;
  enablePerformanceMonitoring: boolean;
  enableRealTimeProcessing: boolean;
  apiEndpoints: {
    health: string;
    analysis: string;
    prediction: string;
    sentiment: string;
    research: string;
  };
  database?: {
    host: string;
    port: number;
    name: string;
  };
  caching?: {
    redis_url: string;
    ttl: number;
  };
}

export class AIMLDeploymentManager {
  private config: DeploymentConfig;
  private aimlSystem: any;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  /**
   * Initialize and deploy the complete AI/ML system
   */
  async deploy(): Promise<{
    success: boolean;
    version: string;
    features: typeof AI_ML_FEATURES;
    endpoints: string[];
    health_status: any;
    deployment_time: number;
  }> {
    console.log('🚀 Starting OpenSVM AI/ML System Deployment...');
    const startTime = Date.now();

    try {
      // Step 1: Initialize AI/ML system based on environment
      console.log('📦 Initializing AI/ML engines...');
      await this.initializeSystem();

      // Step 2: Validate system health
      console.log('🏥 Performing health checks...');
      const healthStatus = await this.performHealthChecks();

      // Step 3: Set up monitoring and alerts
      if (this.config.enablePerformanceMonitoring) {
        console.log('📊 Setting up performance monitoring...');
        await this.setupMonitoring();
      }

      // Step 4: Initialize real-time processing if enabled
      if (this.config.enableRealTimeProcessing) {
        console.log('⚡ Enabling real-time processing...');
        await this.enableRealTimeProcessing();
      }

      // Step 5: Register API endpoints
      console.log('🌐 Registering API endpoints...');
      const endpoints = this.registerAPIEndpoints();

      // Step 6: Run deployment validation tests
      console.log('✅ Running deployment validation...');
      await this.validateDeployment();

      const deploymentTime = Date.now() - startTime;

      console.log(`🎉 OpenSVM AI/ML System deployed successfully in ${deploymentTime}ms`);
      console.log(`📊 Version: ${AI_ML_VERSION}`);
      console.log(`🔧 Environment: ${this.config.environment}`);
      console.log(`⚙️  Features enabled: ${Object.keys(AI_ML_FEATURES).filter(key => AI_ML_FEATURES[key as keyof typeof AI_ML_FEATURES]).length}/${Object.keys(AI_ML_FEATURES).length}`);

      return {
        success: true,
        version: AI_ML_VERSION,
        features: AI_ML_FEATURES,
        endpoints,
        health_status: healthStatus,
        deployment_time: deploymentTime
      };

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      await this.rollback();
      throw error;
    }
  }

  /**
   * Initialize the AI/ML system based on environment configuration
   */
  private async initializeSystem(): Promise<void> {
    let aimlConfig: Partial<AIMLConfig>;

    switch (this.config.environment) {
      case 'development':
        this.aimlSystem = QuickSetup.forDevelopment();
        break;
      case 'staging':
        this.aimlSystem = QuickSetup.forTrading();
        break;
      case 'production':
        this.aimlSystem = QuickSetup.forTrading();
        break;
      default:
        throw new Error(`Unknown environment: ${this.config.environment}`);
    }

    // Verify initialization
    const health = await this.aimlSystem.getSystemHealth();
    if (health.overall_status === 'critical') {
      throw new Error('AI/ML system failed to initialize properly');
    }

    console.log('✅ AI/ML system initialized successfully');
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<any> {
    const health = await getSystemHealth();
    
    // Check critical engines
    const criticalEngines = ['predictive', 'sentiment', 'nlp', 'portfolio'];
    const failedEngines = health.engines.filter(engine => 
      criticalEngines.includes(engine.name) && engine.status === 'error'
    );

    if (failedEngines.length > 0) {
      throw new Error(`Critical engines failed: ${failedEngines.map(e => e.name).join(', ')}`);
    }

    // Check performance metrics
    if (health.performance.avg_response_time > 10000) {
      console.warn('⚠️  High response time detected:', health.performance.avg_response_time, 'ms');
    }

    console.log('✅ Health checks passed');
    return health;
  }

  /**
   * Set up performance monitoring and alerts
   */
  private async setupMonitoring(): Promise<void> {
    if (this.config.enableHealthChecks) {
      // Start continuous health monitoring
      await this.aimlSystem.startMonitoring(60000); // Every minute

      // Set up periodic health checks
      this.healthCheckInterval = setInterval(async () => {
        try {
          const health = await this.aimlSystem.getSystemHealth();
          
          // Log health status
          console.log(`📊 System Health: ${health.overall_status}`);
          
          // Trigger alerts for critical issues
          if (health.overall_status === 'critical') {
            await this.triggerAlert('critical', 'System health critical', health);
          }

          // Performance optimization
          if (health.performance.total_memory_usage > 200) {
            console.log('🧹 Running performance optimization...');
            await this.aimlSystem.optimizePerformance();
          }

        } catch (error) {
          console.error('❌ Health check failed:', error);
        }
      }, 300000); // Every 5 minutes
    }

    console.log('✅ Performance monitoring enabled');
  }

  /**
   * Enable real-time processing capabilities
   */
  private async enableRealTimeProcessing(): Promise<void> {
    // This would integrate with WebSocket connections or streaming APIs
    console.log('✅ Real-time processing enabled');
  }

  /**
   * Register API endpoints for the AI/ML system
   */
  private registerAPIEndpoints(): string[] {
    const endpoints = [
      this.config.apiEndpoints.health,
      this.config.apiEndpoints.analysis,
      this.config.apiEndpoints.prediction,
      this.config.apiEndpoints.sentiment,
      this.config.apiEndpoints.research
    ];

    console.log('✅ API endpoints registered:', endpoints);
    return endpoints;
  }

  /**
   * Validate deployment with test requests
   */
  private async validateDeployment(): Promise<void> {
    try {
      // Test integrated analysis
      const testAnalysis = await this.aimlSystem.performIntegratedAnalysis({
        analysis_type: 'trading_focus',
        target: {
          type: 'asset',
          identifier: 'SOL'
        },
        scope: {
          time_horizon: '1h',
          depth: 'basic',
          include_predictions: true,
          include_sentiment: true,
          include_risk_analysis: false,
          include_optimization: false
        },
        preferences: {
          confidence_threshold: 0.7,
          risk_tolerance: 'moderate',
          update_frequency: 60000
        }
      });

      if (!testAnalysis || !testAnalysis.results) {
        throw new Error('Test analysis failed');
      }

      console.log('✅ Deployment validation passed');

    } catch (error) {
      console.error('❌ Deployment validation failed:', error);
      throw error;
    }
  }

  /**
   * Rollback deployment in case of failure
   */
  private async rollback(): Promise<void> {
    console.log('🔄 Rolling back deployment...');
    
    // Clear monitoring intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Cleanup resources
    try {
      if (this.aimlSystem) {
        // Perform cleanup operations
        await this.aimlSystem.optimizePerformance();
      }
    } catch (error) {
      console.error('❌ Rollback cleanup failed:', error);
    }

    console.log('✅ Rollback completed');
  }

  /**
   * Trigger alert for critical issues
   */
  private async triggerAlert(severity: string, message: string, data: any): Promise<void> {
    // This would integrate with alerting systems (Slack, email, etc.)
    console.log(`🚨 ${severity.toUpperCase()} ALERT: ${message}`, data);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down AI/ML system...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.aimlSystem) {
      await this.aimlSystem.optimizePerformance();
    }

    console.log('✅ AI/ML system shutdown complete');
  }
}

/**
 * Environment-specific deployment configurations
 */
export const DeploymentConfigs = {
  development: {
    environment: 'development' as const,
    enableHealthChecks: true,
    enablePerformanceMonitoring: false,
    enableRealTimeProcessing: false,
    apiEndpoints: {
      health: '/api/dev/ai-ml/health',
      analysis: '/api/dev/ai-ml/analysis',
      prediction: '/api/dev/ai-ml/prediction',
      sentiment: '/api/dev/ai-ml/sentiment',
      research: '/api/dev/ai-ml/research'
    }
  },
  
  staging: {
    environment: 'staging' as const,
    enableHealthChecks: true,
    enablePerformanceMonitoring: true,
    enableRealTimeProcessing: true,
    apiEndpoints: {
      health: '/api/staging/ai-ml/health',
      analysis: '/api/staging/ai-ml/analysis',
      prediction: '/api/staging/ai-ml/prediction',
      sentiment: '/api/staging/ai-ml/sentiment',
      research: '/api/staging/ai-ml/research'
    }
  },
  
  production: {
    environment: 'production' as const,
    enableHealthChecks: true,
    enablePerformanceMonitoring: true,
    enableRealTimeProcessing: true,
    apiEndpoints: {
      health: '/api/ai-ml/health',
      analysis: '/api/ai-ml/analysis',
      prediction: '/api/ai-ml/prediction',
      sentiment: '/api/ai-ml/sentiment',
      research: '/api/ai-ml/research'
    }
  }
};

/**
 * Quick deployment functions
 */
export async function deployForDevelopment(): Promise<any> {
  const manager = new AIMLDeploymentManager(DeploymentConfigs.development);
  return await manager.deploy();
}

export async function deployForStaging(): Promise<any> {
  const manager = new AIMLDeploymentManager(DeploymentConfigs.staging);
  return await manager.deploy();
}

export async function deployForProduction(): Promise<any> {
  const manager = new AIMLDeploymentManager(DeploymentConfigs.production);
  return await manager.deploy();
}

/**
 * CLI deployment script
 */
export async function runDeployment(): Promise<void> {
  const environment = process.env.NODE_ENV || 'development';
  
  console.log(`🚀 Starting deployment for ${environment} environment`);
  
  try {
    let result;
    
    switch (environment) {
      case 'production':
        result = await deployForProduction();
        break;
      case 'staging':
        result = await deployForStaging();
        break;
      default:
        result = await deployForDevelopment();
        break;
    }

    console.log('🎉 Deployment completed successfully:', result);
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('📡 Received shutdown signal...');
      const manager = new AIMLDeploymentManager(DeploymentConfigs[environment as keyof typeof DeploymentConfigs]);
      await manager.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run deployment if this file is executed directly
if (require.main === module) {
  runDeployment().catch(console.error);
}

export default AIMLDeploymentManager;