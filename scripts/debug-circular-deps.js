// Diagnostic script to detect circular dependencies
// Run with: node debug-circular-deps.js

const fs = require('fs');
const path = require('path');

const files = [
  'lib/caching/index.tsx',
  'lib/error-handling/index.tsx', 
  'lib/performance/index.tsx',
  'lib/voice/index.tsx',
  'lib/white-label/index.tsx'
];

function analyzeFile(filePath) {
  console.log(`\n=== Analyzing ${filePath} ===`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // 1. Check for cross-module imports
    console.log('\n1. Cross-module imports:');
    lines.forEach((line, index) => {
      if (line.includes('import') && line.includes('@/lib/')) {
        console.log(`  Line ${index + 1}: ${line.trim()}`);
      }
    });
    
    // 2. Check for inline function definitions in components
    console.log('\n2. Inline function definitions:');
    lines.forEach((line, index) => {
      if (line.includes('const ') && line.includes(' = ') && 
          (line.includes('(') || line.includes('=>')) &&
          index > 100) { // Likely inside component
        console.log(`  Line ${index + 1}: ${line.trim()}`);
      }
    });
    
    // 3. Check for useCallback with problematic dependencies
    console.log('\n3. useCallback with dependencies:');
    let inUseCallback = false;
    lines.forEach((line, index) => {
      if (line.includes('useCallback(')) {
        inUseCallback = true;
        console.log(`  Line ${index + 1}: ${line.trim()}`);
      }
      if (inUseCallback && line.includes('], [')) {
        console.log(`  Dependencies Line ${index + 1}: ${line.trim()}`);
        inUseCallback = false;
      }
    });
    
    // 4. Check for mutual function calls
    console.log('\n4. Function calls that might be circular:');
    const functionNames = [];
    lines.forEach((line, index) => {
      const match = line.match(/const\s+(\w+)\s*=/);
      if (match) functionNames.push(match[1]);
    });
    
    lines.forEach((line, index) => {
      functionNames.forEach(fnName => {
        if (line.includes(fnName + '(') && !line.includes('const ' + fnName)) {
          console.log(`  Line ${index + 1}: calls ${fnName} - ${line.trim()}`);
        }
      });
    });
    
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
  }
}

// Analyze each file
files.forEach(analyzeFile);

console.log('\n=== SUMMARY ===');
console.log('1. Look for cross-module import cycles');
console.log('2. Functions recreated on every render'); 
console.log('3. useCallback dependencies that reference themselves');
console.log('4. Functions that call each other mutually');