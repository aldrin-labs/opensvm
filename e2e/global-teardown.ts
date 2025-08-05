import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  // Clean up temporary files and resources
  try {
    // Clean up any temporary test files
    const tempDir = path.join(process.cwd(), 'temp-test-files');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('✅ Cleaned up temporary test files');
    }
    
    // Generate performance summary if in performance mode
    if (process.env.PLAYWRIGHT_PERFORMANCE_MODE === 'true') {
      console.log('📊 Generating performance summary...');
      
      const testResultsDir = path.join(process.cwd(), 'test-results');
      const performanceSummary = {
        timestamp: new Date().toISOString(),
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageTestDuration: 0,
        performanceMetrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        }
      };
      
      // Ensure test-results directory exists
      if (!fs.existsSync(testResultsDir)) {
        fs.mkdirSync(testResultsDir, { recursive: true });
      }
      
      // Write performance summary
      fs.writeFileSync(
        path.join(testResultsDir, 'performance-summary.json'),
        JSON.stringify(performanceSummary, null, 2)
      );
      
      console.log('✅ Performance summary generated');
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('✅ Forced garbage collection');
    }
    
  } catch (error) {
    console.warn('⚠️ Teardown warning:', error.message);
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;