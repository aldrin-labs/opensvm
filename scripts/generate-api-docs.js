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

// Extract parameter descriptions from comments and code
function extractParamDescriptions(content) {
  const params = new Map();
  
  // Extract from JSDoc-style comments
  const jsdocRegex = /@param\s+{([^}]+)}\s+(\w+)\s+-?\s*(.+)/g;
  let match;
  while ((match = jsdocRegex.exec(content)) !== null) {
    params.set(match[2], {
      type: match[1],
      description: match[3].trim()
    });
  }
  
  // Extract from inline comments near searchParams.get
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const paramMatch = line.match(/searchParams\.get\(['"](\w+)['"]\)/);
    if (paramMatch) {
      const paramName = paramMatch[1];
      
      // Look for comment on same line or previous line
      const commentMatch = line.match(/\/\/\s*(.+)/) || 
                          (index > 0 && lines[index - 1].match(/\/\/\s*(.+)/));
      
      if (commentMatch && !params.has(paramName)) {
        params.set(paramName, {
          type: 'string',
          description: commentMatch[1].trim()
        });
      }
      
      // Try to infer type from usage
      if (!params.has(paramName)) {
        let type = 'string';
        const nextLines = lines.slice(index, index + 5).join('\n');
        
        if (/parseInt|Number\(/.test(nextLines)) {
          type = 'number';
        } else if (/=== ['"]true['"]|Boolean\(/.test(nextLines)) {
          type = 'boolean';
        } else if (/\.split\(/.test(nextLines)) {
          type = 'string[]';
        }
        
        params.set(paramName, {
          type,
          description: `${paramName} parameter`
        });
      }
    }
  });
  
  return params;
}

// Extract method descriptions
function extractMethodDescriptions(content) {
  const descriptions = {};
  
  // Look for comments before each HTTP method
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  
  methods.forEach(method => {
    const regex = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/[\\s\\S]*?export\\s+(?:async\\s+)?function\\s+${method}`, 'm');
    const match = content.match(regex);
    
    if (match) {
      // Extract description from JSDoc
      const jsdoc = match[1];
      const descMatch = jsdoc.match(/\*\s*(.+?)(?:\n|$)/);
      if (descMatch) {
        descriptions[method] = descMatch[1].trim();
      }
    }
    
    // Also check for single-line comments
    const singleLineRegex = new RegExp(`\\/\\/\\s*(.+?)\\n[\\s\\S]*?export\\s+(?:async\\s+)?function\\s+${method}`, 'm');
    const singleMatch = content.match(singleLineRegex);
    if (singleMatch && !descriptions[method]) {
      descriptions[method] = singleMatch[1].trim();
    }
  });
  
  return descriptions;
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
  
  // Extract query parameters with descriptions
  const paramDescriptions = extractParamDescriptions(content);
  const queryParams = Array.from(paramDescriptions.entries()).map(([name, info]) => ({
    name,
    ...info
  }));
  
  // Extract method descriptions
  const methodDescriptions = extractMethodDescriptions(content);
  
  // Check for authentication requirement
  const requiresAuth = /Authorization|Bearer|session|auth/i.test(content);
  
  // Extract main description from file-level comments
  let description = '';
  const fileDescMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)(?:\n\s*\*\s*\n|\n\s*\*\/)/);
  if (fileDescMatch) {
    description = fileDescMatch[1].trim();
  }
  
  // Also check for description in first comment block
  const firstCommentMatch = content.match(/^\/\*\*([^*]*(?:\*(?!\/)[^*]*)*)\*\//);
  if (firstCommentMatch && !description) {
    const lines = firstCommentMatch[1].split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l && !l.startsWith('@'));
    description = lines[0] || '';
  }
  
  return {
    methods,
    interfaces,
    queryParams,
    requiresAuth,
    description,
    methodDescriptions
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
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
    markdown += `- [${categoryName}](#${category.toLowerCase()}) (${count} endpoint${count !== 1 ? 's' : ''})\n`;
  });
  
  markdown += '\n---\n\n';
  
  // Document each category
  Object.keys(categories).sort().forEach(category => {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
    markdown += `## ${categoryName}\n\n`;
    
    // Sort endpoints within category
    categories[category].sort((a, b) => a.endpoint.localeCompare(b.endpoint));
    
    categories[category].forEach(route => {
      markdown += `### ${route.methods.join(', ')} ${route.endpoint}\n\n`;
      
      if (route.description) {
        markdown += `**Description**: ${route.description}\n\n`;
      }
      
      markdown += `**Methods**: ${route.methods.join(', ')}\n\n`;
      
      // Add method-specific descriptions
      if (Object.keys(route.methodDescriptions).length > 0) {
        markdown += `**Method Details**:\n`;
        Object.entries(route.methodDescriptions).forEach(([method, desc]) => {
          markdown += `- **${method}**: ${desc}\n`;
        });
        markdown += '\n';
      }
      
      if (route.requiresAuth) {
        markdown += `**Authentication**: Required\n\n`;
      }
      
      if (route.queryParams.length > 0) {
        markdown += `**Query Parameters**:\n\n`;
        markdown += `| Parameter | Type | Description |\n`;
        markdown += `|-----------|------|-------------|\n`;
        route.queryParams.forEach(param => {
          markdown += `| \`${param.name}\` | ${param.type} | ${param.description} |\n`;
        });
        markdown += '\n';
      }
      
      // Extract path parameters
      const pathParams = route.endpoint.match(/:(\w+)/g);
      if (pathParams) {
        markdown += `**Path Parameters**:\n\n`;
        markdown += `| Parameter | Type | Description |\n`;
        markdown += `|-----------|------|-------------|\n`;
        pathParams.forEach(param => {
          const paramName = param.substring(1);
          markdown += `| \`${paramName}\` | string | ${paramName} identifier |\n`;
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
          exampleUrl += '?' + route.queryParams.map(p => `${p.name}=value`).join('&');
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
      
      if (route.methods.includes('PUT')) {
        let exampleUrl = route.endpoint;
        if (pathParams) {
          pathParams.forEach(param => {
            exampleUrl = exampleUrl.replace(param, `{${param.substring(1)}}`);
          });
        }
        markdown += `curl -X PUT "https://opensvm.com${exampleUrl}" \\\n`;
        markdown += `  -H "Content-Type: application/json"`;
        if (route.requiresAuth) {
          markdown += ` \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;
        }
        markdown += ` \\\n  -d '{"key":"value"}'\n`;
      }
      
      if (route.methods.includes('DELETE')) {
        let exampleUrl = route.endpoint;
        if (pathParams) {
          pathParams.forEach(param => {
            exampleUrl = exampleUrl.replace(param, `{${param.substring(1)}}`);
          });
        }
        markdown += `curl -X DELETE "https://opensvm.com${exampleUrl}"`;
        if (route.requiresAuth) {
          markdown += ` \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;
        }
        markdown += '\n';
      }
      
      if (route.methods.includes('PATCH')) {
        let exampleUrl = route.endpoint;
        if (pathParams) {
          pathParams.forEach(param => {
            exampleUrl = exampleUrl.replace(param, `{${param.substring(1)}}`);
          });
        }
        markdown += `curl -X PATCH "https://opensvm.com${exampleUrl}" \\\n`;
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
