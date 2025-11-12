#!/usr/bin/env node

/**
 * API Documentation Generator
 * 
 * Automatically generates comprehensive API documentation by analyzing route files.
 * Run: node scripts/generate-api-docs.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_DIR = path.join(process.cwd(), 'app/api');
const OUTPUT_FILE = path.join(process.cwd(), 'API_REFERENCE.md');

// Find all route files
function findRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findRouteFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.tsx') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Extract endpoint path from file path
function getEndpointPath(filePath) {
  const relativePath = path.relative(API_DIR, filePath);
  const dirPath = path.dirname(relativePath);
  
  // Convert file path to API endpoint
  let endpoint = '/' + dirPath.replace(/\\/g, '/');
  
  // Handle dynamic routes [param]
  endpoint = endpoint.replace(/\[([^\]]+)\]/g, ':$1');
  
  // Remove /route from end
  endpoint = endpoint.replace(/\/route$/, '');
  
  return '/api' + endpoint;
}

// Analyze route file to extract methods and schemas
function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const methods = [];
  const hasGET = /export\s+(async\s+)?function\s+GET/m.test(content);
  const hasPOST = /export\s+(async\s+)?function\s+POST/m.test(content);
  const hasPUT = /export\s+(async\s+)?function\s+PUT/m.test(content);
  const hasDELETE = /export\s+(async\s+)?function\s+DELETE/m.test(content);
  const hasPATCH = /export\s+(async\s+)?function\s+PATCH/m.test(content);
  
  if (hasGET) methods.push('GET');
  if (hasPOST) methods.push('POST');
  if (hasPUT) methods.push('PUT');
  if (hasDELETE) methods.push('DELETE');
  if (hasPATCH) methods.push('PATCH');
  
  // Extract interfaces/types for request/response
  const interfaces = [];
  const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;
  let match;
  
  while ((match = interfaceRegex.exec(content)) !== null) {
    interfaces.push({
      name: match[1],
      body: match[2].trim()
    });
  }
  
  // Extract query parameters from searchParams.get
  const queryParams = [];
  const queryRegex = /searchParams\.get\(['"]([^'"]+)['"]\)/g;
  while ((match = queryRegex.exec(content)) !== null) {
    if (!queryParams.includes(match[1])) {
      queryParams.push(match[1]);
    }
  }
  
  // Check for authentication requirement
  const requiresAuth = /Authorization|Bearer|session|auth/i.test(content);
  
  // Extract description from comments
  let description = '';
  const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\n/);
  if (descMatch) {
    description = descMatch[1].trim();
  }
  
  return {
    methods,
    interfaces,
    queryParams,
    requiresAuth,
    description
  };
}

// Generate markdown documentation
function generateDocumentation() {
  console.log('🔍 Finding route files...');
  const routeFiles = findRouteFiles(API_DIR);
  console.log(`📝 Found ${routeFiles.length} route files`);
  
  // Group routes by category
  const categories = {};
  
  routeFiles.forEach(filePath => {
    const endpoint = getEndpointPath(filePath);
    const analysis = analyzeRouteFile(filePath);
    
    // Determine category from path
    const parts = endpoint.split('/').filter(p => p && p !== 'api');
    const category = parts[0] || 'root';
    
    if (!categories[category]) {
      categories[category] = [];
    }
    
    categories[category].push({
      endpoint,
      filePath,
      ...analysis
    });
  });
  
  // Generate markdown
  let markdown = `# OpenSVM API Complete Reference

Auto-generated documentation for all ${routeFiles.length} API endpoints.

**Generated**: ${new Date().toISOString()}

## Table of Contents

`;

  // Add category links
  Object.keys(categories).sort().forEach(category => {
    const count = categories[category].length;
    markdown += `- [${category.charAt(0).toUpperCase() + category.slice(1)}](#${category}) (${count} endpoints)\n`;
  });
  
  markdown += '\n---\n\n';
  
  // Document each category
  Object.keys(categories).sort().forEach(category => {
    markdown += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    
    // Sort endpoints within category
    categories[category].sort((a, b) => a.endpoint.localeCompare(b.endpoint));
    
    categories[category].forEach(route => {
      markdown += `### ${route.methods.join(', ')} ${route.endpoint}\n\n`;
      
      if (route.description) {
        markdown += `${route.description}\n\n`;
      }
      
      markdown += `**Methods**: ${route.methods.join(', ')}\n\n`;
      
      if (route.requiresAuth) {
        markdown += `**Authentication**: Required\n\n`;
      }
      
      if (route.queryParams.length > 0) {
        markdown += `**Query Parameters**:\n`;
        route.queryParams.forEach(param => {
          markdown += `- \`${param}\`\n`;
        });
        markdown += '\n';
      }
      
      // Extract path parameters
      const pathParams = route.endpoint.match(/:(\w+)/g);
      if (pathParams) {
        markdown += `**Path Parameters**:\n`;
        pathParams.forEach(param => {
          markdown += `- \`${param.substring(1)}\`\n`;
        });
        markdown += '\n';
      }
      
      if (route.interfaces.length > 0) {
        markdown += `**Type Definitions**:\n\`\`\`typescript\n`;
        route.interfaces.forEach(iface => {
          markdown += `interface ${iface.name} {\n${iface.body}\n}\n\n`;
        });
        markdown += `\`\`\`\n\n`;
      }
      
      markdown += `**Example Request**:\n\`\`\`bash\n`;
      
      if (route.methods.includes('GET')) {
        let exampleUrl = route.endpoint;
        if (pathParams) {
          pathParams.forEach(param => {
            exampleUrl = exampleUrl.replace(param, `{${param.substring(1)}}`);
          });
        }
        if (route.queryParams.length > 0) {
          exampleUrl += '?' + route.queryParams.map(p => `${p}=value`).join('&');
        }
        markdown += `curl "https://opensvm.com${exampleUrl}"`;
        if (route.requiresAuth) {
          markdown += ` \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;
        }
        markdown += '\n';
      }
      
      if (route.methods.includes('POST')) {
        let exampleUrl = route.endpoint;
        if (pathParams) {
          pathParams.forEach(param => {
            exampleUrl = exampleUrl.replace(param, `{${param.substring(1)}}`);
          });
        }
        markdown += `curl -X POST "https://opensvm.com${exampleUrl}" \\\n`;
        markdown += `  -H "Content-Type: application/json"`;
        if (route.requiresAuth) {
          markdown += ` \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;
        }
        markdown += ` \\\n  -d '{"key":"value"}'\n`;
      }
      
      markdown += `\`\`\`\n\n`;
      markdown += `**Source**: \`${path.relative(process.cwd(), route.filePath)}\`\n\n`;
      markdown += '---\n\n';
    });
  });
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, markdown);
  console.log(`✅ Documentation generated: ${OUTPUT_FILE}`);
  console.log(`📊 Total endpoints documented: ${routeFiles.length}`);
  console.log(`📁 Categories: ${Object.keys(categories).length}`);
}

// Run generator
try {
  generateDocumentation();
} catch (error) {
  console.error('❌ Error generating documentation:', error);
  process.exit(1);
}
