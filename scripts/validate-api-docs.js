#!/usr/bin/env node

/**
 * API Documentation Validator
 * Validates that documentation matches actual route implementations
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating API Documentation...\n');

// Read API_REFERENCE.md
const apiRefPath = path.join(process.cwd(), 'API_REFERENCE.md');
const apiRefContent = fs.readFileSync(apiRefPath, 'utf-8');

// Parse documented endpoints
const documentedEndpoints = new Map();
const lines = apiRefContent.split('\n');

for (const line of lines) {
  const match = line.match(/^### ((?:GET|POST|PUT|DELETE|PATCH)(?:,\s*(?:GET|POST|PUT|DELETE|PATCH))*)\s+(.+)$/);
  if (match) {
    const methods = match[1].split(',').map(m => m.trim());
    const path = match[2].trim();
    const key = path.replace(/:\w+/g, '[param]'); // Normalize dynamic params
    
    if (!documentedEndpoints.has(key)) {
      documentedEndpoints.set(key, { path, methods: new Set(), source: 'docs' });
    }
    methods.forEach(m => documentedEndpoints.get(key).methods.add(m));
  }
}

// Scan actual route files
const actualEndpoints = new Map();

function scanDirectory(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Handle dynamic routes [param]
      const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']');
      const pathSegment = isDynamic ? ':' + entry.name.slice(1, -1) : entry.name;
      scanDirectory(fullPath, basePath + '/' + pathSegment);
    } else if (entry.name === 'route.ts' || entry.name === 'route.js' || entry.name === 'route.tsx') {
      // Found a route file
      const routePath = '/api' + basePath;
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Detect HTTP methods
      const methods = new Set();
      if (content.match(/export\s+async\s+function\s+GET/)) methods.add('GET');
      if (content.match(/export\s+async\s+function\s+POST/)) methods.add('POST');
      if (content.match(/export\s+async\s+function\s+PUT/)) methods.add('PUT');
      if (content.match(/export\s+async\s+function\s+DELETE/)) methods.add('DELETE');
      if (content.match(/export\s+async\s+function\s+PATCH/)) methods.add('PATCH');
      
      const key = routePath.replace(/:\w+/g, '[param]');
      actualEndpoints.set(key, { path: routePath, methods, source: fullPath });
    }
  }
}

const apiDir = path.join(process.cwd(), 'app', 'api');
scanDirectory(apiDir);

// Validation results
const issues = {
  undocumented: [],
  extraDocs: [],
  methodMismatch: [],
  total: 0
};

// Check for undocumented endpoints
for (const [key, actual] of actualEndpoints) {
  if (!documentedEndpoints.has(key)) {
    issues.undocumented.push({
      path: actual.path,
      methods: Array.from(actual.methods),
      source: actual.source
    });
    issues.total++;
  } else {
    // Check method mismatches
    const doc = documentedEndpoints.get(key);
    const actualMethods = actual.methods;
    const docMethods = doc.methods;
    
    const missingInDocs = Array.from(actualMethods).filter(m => !docMethods.has(m));
    const extraInDocs = Array.from(docMethods).filter(m => !actualMethods.has(m));
    
    if (missingInDocs.length > 0 || extraInDocs.length > 0) {
      issues.methodMismatch.push({
        path: actual.path,
        missingInDocs,
        extraInDocs,
        actualMethods: Array.from(actualMethods),
        docMethods: Array.from(docMethods)
      });
      issues.total++;
    }
  }
}

// Check for documented endpoints that don't exist
for (const [key, doc] of documentedEndpoints) {
  if (!actualEndpoints.has(key)) {
    issues.extraDocs.push({
      path: doc.path,
      methods: Array.from(doc.methods)
    });
    issues.total++;
  }
}

// Report results
console.log('📊 Validation Results:\n');
console.log(`✅ Documented endpoints: ${documentedEndpoints.size}`);
console.log(`✅ Actual endpoints: ${actualEndpoints.size}`);
console.log(`${issues.total === 0 ? '✅' : '⚠️'} Issues found: ${issues.total}\n`);

if (issues.undocumented.length > 0) {
  console.log('❌ Undocumented Endpoints:');
  issues.undocumented.forEach(e => {
    console.log(`   ${e.methods.join(', ')} ${e.path}`);
    console.log(`   Source: ${e.source}`);
  });
  console.log();
}

if (issues.extraDocs.length > 0) {
  console.log('❌ Documented but Missing in Code:');
  issues.extraDocs.forEach(e => {
    console.log(`   ${e.methods.join(', ')} ${e.path}`);
  });
  console.log();
}

if (issues.methodMismatch.length > 0) {
  console.log('⚠️  Method Mismatches:');
  issues.methodMismatch.forEach(e => {
    console.log(`   ${e.path}`);
    console.log(`   Actual: ${e.actualMethods.join(', ')}`);
    console.log(`   Documented: ${e.docMethods.join(', ')}`);
    if (e.missingInDocs.length > 0) {
      console.log(`   Missing in docs: ${e.missingInDocs.join(', ')}`);
    }
    if (e.extraInDocs.length > 0) {
      console.log(`   Extra in docs: ${e.extraInDocs.join(', ')}`);
    }
  });
  console.log();
}

// Summary
if (issues.total === 0) {
  console.log('✅ All endpoints are correctly documented!');
  process.exit(0);
} else {
  console.log(`⚠️  Found ${issues.total} documentation issues that need attention.`);
  console.log('\nRecommendation: Run `node scripts/generate-api-docs.js` to update documentation.');
  process.exit(1);
}
