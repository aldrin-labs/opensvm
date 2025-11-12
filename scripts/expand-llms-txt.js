#!/usr/bin/env node

/**
 * LLMs.txt Expander
 * Expands llms.txt with all endpoints from API_REFERENCE.md
 */

const fs = require('fs');
const path = require('path');

// Read API_REFERENCE.md
const apiRefPath = path.join(process.cwd(), 'API_REFERENCE.md');
const apiRefContent = fs.readFileSync(apiRefPath, 'utf-8');

// Read current llms.txt to preserve header
const llmsPath = path.join(process.cwd(), 'llms.txt');
const llmsContent = fs.readFileSync(llmsPath, 'utf-8');

// Extract header (everything before "## API Categories")
const headerEndMarker = '## API Categories';
const headerEndIndex = llmsContent.indexOf(headerEndMarker);
const header = headerEndIndex > 0 ? llmsContent.substring(0, headerEndIndex) : llmsContent.substring(0, 500);

// Parse API_REFERENCE.md to extract endpoints
const lines = apiRefContent.split('\n');
const categories = new Map();
let currentCategory = null;
let currentEndpoint = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Match category headers like "## Account portfolio"
  const categoryMatch = line.match(/^## (.+)$/);
  if (categoryMatch) {
    currentCategory = categoryMatch[1];
    if (!categories.has(currentCategory)) {
      categories.set(currentCategory, []);
    }
    continue;
  }
  
  // Match endpoint headers
  const endpointMatch = line.match(/^### ((?:GET|POST|PUT|DELETE|PATCH)(?:,\s*(?:GET|POST|PUT|DELETE|PATCH))*)\s+(.+)$/);
  if (endpointMatch && currentCategory) {
    const methods = endpointMatch[1].split(',').map(m => m.trim());
    const path = endpointMatch[2].trim();
    
    currentEndpoint = {
      methods,
      path,
      description: '',
      authentication: false,
      queryParams: [],
      pathParams: [],
      example: ''
    };
    continue;
  }
  
  if (!currentEndpoint) continue;
  
  // Extract description
  const descMatch = line.match(/^\*\*Description\*\*:\s*(.+)$/);
  if (descMatch) {
    currentEndpoint.description = descMatch[1];
    continue;
  }
  
  // Extract authentication
  if (line.includes('**Authentication**: Required')) {
    currentEndpoint.authentication = true;
    continue;
  }
  
  // Extract query parameters
  if (line.startsWith('| `') && line.includes('| query |')) {
    const paramMatch = line.match(/\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|/);
    if (paramMatch) {
      currentEndpoint.queryParams.push({
        name: paramMatch[1],
        type: paramMatch[2],
        description: paramMatch[3]
      });
    }
  }
  
  // Extract path parameters
  if (line.startsWith('| `') && line.includes('| path |')) {
    const paramMatch = line.match(/\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|/);
    if (paramMatch) {
      currentEndpoint.pathParams.push({
        name: paramMatch[1],
        type: paramMatch[2],
        description: paramMatch[3]
      });
    }
  }
  
  // Extract example
  if (line.startsWith('curl ')) {
    currentEndpoint.example = line;
  }
  
  // When we hit the next section marker, save current endpoint
  if (line.startsWith('---') && currentEndpoint && currentCategory) {
    categories.get(currentCategory).push(currentEndpoint);
    currentEndpoint = null;
  }
}

// Save last endpoint if exists
if (currentEndpoint && currentCategory) {
  categories.get(currentCategory).push(currentEndpoint);
}

// Generate expanded llms.txt content
let expandedContent = header;
expandedContent += headerEndMarker + '\n\n';

// Add all categories and endpoints
let categoryIndex = 1;
for (const [categoryName, endpoints] of categories) {
  if (endpoints.length === 0) continue;
  
  expandedContent += `### ${categoryIndex}. ${categoryName.toUpperCase()}\n\n`;
  
  for (const endpoint of endpoints) {
    // Add endpoint header
    const methodsList = endpoint.methods.join(', ');
    expandedContent += `- **${methodsList} ${endpoint.path}**`;
    if (endpoint.description) {
      expandedContent += ` - ${endpoint.description}`;
    }
    expandedContent += '\n';
    
    // Add authentication requirement
    if (endpoint.authentication) {
      expandedContent += `  - Authentication: Required\n`;
    }
    
    // Add path parameters
    if (endpoint.pathParams.length > 0) {
      expandedContent += `  - Path Parameters:\n`;
      for (const param of endpoint.pathParams) {
        expandedContent += `    - \`${param.name}\` (${param.type}): ${param.description}\n`;
      }
    }
    
    // Add query parameters (limit to first 5 for brevity)
    if (endpoint.queryParams.length > 0) {
      expandedContent += `  - Query Parameters:\n`;
      const paramsToShow = endpoint.queryParams.slice(0, 5);
      for (const param of paramsToShow) {
        expandedContent += `    - \`${param.name}\` (${param.type}): ${param.description}\n`;
      }
      if (endpoint.queryParams.length > 5) {
        expandedContent += `    - ... and ${endpoint.queryParams.length - 5} more parameters\n`;
      }
    }
    
    // Add example
    if (endpoint.example) {
      expandedContent += `  - Example: \`${endpoint.example.substring(0, 100)}${endpoint.example.length > 100 ? '...' : ''}\`\n`;
    }
    
    expandedContent += '\n';
  }
  
  categoryIndex++;
}

// Add footer
expandedContent += `\n## Response Formats\n\n`;
expandedContent += `### Success Response\n`;
expandedContent += `\`\`\`json\n`;
expandedContent += `{\n`;
expandedContent += `  "success": true,\n`;
expandedContent += `  "data": { ... },\n`;
expandedContent += `  "timestamp": "2024-01-01T00:00:00Z"\n`;
expandedContent += `}\n`;
expandedContent += `\`\`\`\n\n`;

expandedContent += `### Error Response\n`;
expandedContent += `\`\`\`json\n`;
expandedContent += `{\n`;
expandedContent += `  "success": false,\n`;
expandedContent += `  "error": {\n`;
expandedContent += `    "code": "ERROR_CODE",\n`;
expandedContent += `    "message": "Error description",\n`;
expandedContent += `    "details": { ... }\n`;
expandedContent += `  },\n`;
expandedContent += `  "timestamp": "2024-01-01T00:00:00Z"\n`;
expandedContent += `}\n`;
expandedContent += `\`\`\`\n\n`;

expandedContent += `## Support\n`;
expandedContent += `For API support, documentation updates, or to report issues:\n`;
expandedContent += `- GitHub: https://github.com/opensvm\n`;
expandedContent += `- Discord: https://discord.gg/opensvm\n`;
expandedContent += `- Email: api@opensvm.com\n`;

// Write expanded llms.txt
fs.writeFileSync(llmsPath, expandedContent);

console.log(`✅ llms.txt expanded successfully!`);
console.log(`📄 Output: ${llmsPath}`);
console.log(`📊 Total categories: ${categories.size}`);
console.log(`📋 Total endpoints documented: ${Array.from(categories.values()).reduce((sum, eps) => sum + eps.length, 0)}`);
console.log(`📝 File size: ${(expandedContent.length / 1024).toFixed(2)} KB`);
