#!/usr/bin/env node

/**
 * Demonstration of API Key Activity Logs
 * This shows what the logs would look like with a working Qdrant instance
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

// Sample API key for demonstration
const apiKey = '';

// Sample activity logs (what would be stored in Qdrant)
const sampleActivityLogs = [
  {
    id: 'log_001',
    apiKeyId: 'key_abc123',
    endpoint: '/api/health',
    method: 'GET',
    statusCode: 200,
    responseTime: 45,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    metadata: {
      rateLimited: false,
      ip: '192.168.1.42'
    }
  },
  {
    id: 'log_002',
    apiKeyId: 'key_abc123',
    endpoint: '/api/getAnswer',
    method: 'POST',
    statusCode: 200,
    responseTime: 1247,
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 minutes ago
    metadata: {
      rateLimited: false,
      ip: '192.168.1.42',
      questionLength: 52
    }
  },
  {
    id: 'log_003',
    apiKeyId: 'key_abc123',
    endpoint: '/api/auth/api-keys/metrics',
    method: 'GET',
    statusCode: 200,
    responseTime: 78,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    metadata: {
      rateLimited: false,
      ip: '192.168.1.42'
    }
  },
  {
    id: 'log_004',
    apiKeyId: 'key_abc123',
    endpoint: '/api/getAnswer',
    method: 'POST',
    statusCode: 429,
    responseTime: 12,
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 minute ago
    metadata: {
      rateLimited: true,
      ip: '192.168.1.42',
      reason: 'Rate limit exceeded'
    }
  },
  {
    id: 'log_005',
    apiKeyId: 'key_abc123',
    endpoint: '/api/health',
    method: 'GET',
    statusCode: 200,
    responseTime: 32,
    timestamp: new Date().toISOString(), // Just now
    metadata: {
      rateLimited: false,
      ip: '192.168.1.42'
    }
  }
];

// Calculate metrics from logs
function calculateMetrics(logs) {
  const totalRequests = logs.length;
  const successfulRequests = logs.filter(l => l.statusCode >= 200 && l.statusCode < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const avgResponseTime = Math.round(logs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests);
  
  const requestsByEndpoint = {};
  const requestsByDay = {};
  
  logs.forEach(log => {
    // Count by endpoint
    requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
    
    // Count by day
    const day = new Date(log.timestamp).toISOString().split('T')[0];
    requestsByDay[day] = (requestsByDay[day] || 0) + 1;
  });
  
  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    avgResponseTime,
    requestsByEndpoint,
    requestsByDay,
    lastActivity: logs[logs.length - 1].timestamp
  };
}

// Display functions
function displayHeader() {
  console.log('\n' + colors.bright + colors.cyan + '╔════════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.bright + colors.cyan + '║' + colors.reset + '                  API KEY ACTIVITY LOGS DEMO                    ' + colors.bright + colors.cyan + '║' + colors.reset);
  console.log(colors.bright + colors.cyan + '╚════════════════════════════════════════════════════════════════╝' + colors.reset);
  console.log(colors.gray + 'Note: This is a demonstration of what the logs would show with Qdrant running' + colors.reset);
}

function displayApiKeyInfo() {
  console.log('\n' + colors.bright + '📋 API Key Information' + colors.reset);
  console.log('─'.repeat(60));
  console.log(colors.blue + 'Key ID:' + colors.reset + '     key_abc123');
  console.log(colors.blue + 'Key:' + colors.reset + '        ' + apiKey.substring(0, 20) + '...' + colors.gray + ' (truncated)' + colors.reset);
  console.log(colors.blue + 'Status:' + colors.reset + '     ' + colors.green + '● Active' + colors.reset);
  console.log(colors.blue + 'Created:' + colors.reset + '    2024-11-10 12:00:00');
  console.log(colors.blue + 'Wallet:' + colors.reset + '     ' + colors.yellow + '7xKXtg2CW87d9...4hSf' + colors.reset);
}

function displayMetrics(metrics) {
  console.log('\n' + colors.bright + '📊 Metrics Summary' + colors.reset);
  console.log('─'.repeat(60));
  console.log(colors.blue + 'Total Requests:' + colors.reset + '        ' + colors.bright + metrics.totalRequests + colors.reset);
  console.log(colors.green + 'Successful:' + colors.reset + '            ' + metrics.successfulRequests);
  console.log(colors.red + 'Failed:' + colors.reset + '                ' + metrics.failedRequests);
  console.log(colors.blue + 'Avg Response Time:' + colors.reset + '     ' + metrics.avgResponseTime + ' ms');
  console.log(colors.blue + 'Last Activity:' + colors.reset + '         ' + new Date(metrics.lastActivity).toLocaleString());
  
  console.log('\n' + colors.bright + '📍 Requests by Endpoint:' + colors.reset);
  Object.entries(metrics.requestsByEndpoint).forEach(([endpoint, count]) => {
    const bar = '█'.repeat(Math.min(count * 10, 40));
    console.log(`  ${endpoint.padEnd(30)} ${bar} ${count}`);
  });
}

function displayActivityLogs(logs) {
  console.log('\n' + colors.bright + '📜 Recent Activity (Last 5 requests)' + colors.reset);
  console.log('─'.repeat(60));
  
  logs.forEach((log, index) => {
    const time = new Date(log.timestamp);
    const timeStr = time.toLocaleTimeString();
    const statusColor = log.statusCode >= 200 && log.statusCode < 400 ? colors.green : colors.red;
    const methodColor = log.method === 'GET' ? colors.cyan : colors.yellow;
    
    console.log(`\n${colors.gray}[${timeStr}]${colors.reset} ${methodColor}${log.method}${colors.reset} ${log.endpoint}`);
    console.log(`  ${statusColor}● ${log.statusCode}${colors.reset} | ${log.responseTime}ms | IP: ${log.metadata.ip}`);
    
    if (log.metadata.rateLimited) {
      console.log(`  ${colors.red}⚠ Rate Limited${colors.reset}`);
    }
    
    if (log.metadata.questionLength) {
      console.log(`  ${colors.gray}Question length: ${log.metadata.questionLength} chars${colors.reset}`);
    }
  });
}

function displayUsageExample() {
  console.log('\n' + colors.bright + '💡 How to Use in Code' + colors.reset);
  console.log('─'.repeat(60));
  console.log(colors.gray + `
// Example: Making a request with your API key
const response = await fetch('http://localhost:3000/api/health', {
  headers: {
    'X-API-Key': '${apiKey.substring(0, 30)}...'
  }
});

// The activity is automatically logged via middleware
// View logs at: http://localhost:3000/profile/api-keys
` + colors.reset);
}

function displayArchitecture() {
  console.log('\n' + colors.bright + '🏗️  System Architecture' + colors.reset);
  console.log('─'.repeat(60));
  console.log(`
  ${colors.cyan}Request${colors.reset} → ${colors.yellow}Middleware${colors.reset} → ${colors.green}API Endpoint${colors.reset}
      ↓                                    ↓
  ${colors.blue}Validate Key${colors.reset}                 ${colors.blue}Process Request${colors.reset}
      ↓                                    ↓
  ${colors.yellow}Log Activity${colors.reset} ←─────────────────────────┘
      ↓
  ${colors.red}Qdrant DB${colors.reset}
  
  Files involved:
  • ${colors.cyan}middleware.ts${colors.reset} - Intercepts and logs requests
  • ${colors.cyan}lib/api-auth/service.ts${colors.reset} - Activity logging functions
  • ${colors.cyan}app/api/health/route.ts${colors.reset} - Example endpoint with logging
  • ${colors.cyan}app/profile/api-keys/page.tsx${colors.reset} - UI for viewing logs
`);
}

// Main execution
function main() {
  displayHeader();
  displayApiKeyInfo();
  
  const metrics = calculateMetrics(sampleActivityLogs);
  displayMetrics(metrics);
  displayActivityLogs(sampleActivityLogs);
  displayUsageExample();
  displayArchitecture();
  
  console.log('\n' + colors.bright + colors.red + '⚠️  Current Status:' + colors.reset);
  console.log('─'.repeat(60));
  console.log(colors.yellow + 'Qdrant is having connectivity issues on port 6333.' + colors.reset);
  console.log('The activity logging infrastructure is fully implemented and ready.');
  console.log('Once Qdrant is accessible, activity logs will be:');
  console.log('  • ' + colors.green + 'Automatically captured' + colors.reset + ' via middleware');
  console.log('  • ' + colors.green + 'Stored persistently' + colors.reset + ' in Qdrant vector database');
  console.log('  • ' + colors.green + 'Viewable' + colors.reset + ' at http://localhost:3000/profile/api-keys');
  console.log('\n' + colors.gray + 'To troubleshoot Qdrant, check Docker networking settings.' + colors.reset);
  console.log('─'.repeat(60));
}

main();
