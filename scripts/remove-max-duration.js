#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all route files
const routeFiles = execSync('find app/api -name "route.ts" -o -name "route.tsx"', { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let removedCount = 0;
let skippedCount = 0;

console.log(`Processing ${routeFiles.length} route files...\n`);

routeFiles.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if file has maxDuration export
    if (!content.includes('export const maxDuration')) {
      console.log(`⏭️  No maxDuration: ${filePath}`);
      skippedCount++;
      return;
    }
    
    // Remove the maxDuration export and its comment
    const lines = content.split('\n');
    const newLines = [];
    let skipNext = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip the comment line before maxDuration
      if (line.includes('Route segment config: Set timeout')) {
        skipNext = true;
        continue;
      }
      
      // Skip the maxDuration line
      if (line.includes('export const maxDuration')) {
        skipNext = false;
        continue;
      }
      
      // Skip empty lines after maxDuration if needed
      if (skipNext && line.trim() === '') {
        continue;
      }
      
      skipNext = false;
      newLines.push(line);
    }
    
    // Remove any double blank lines that might have been created
    content = newLines.join('\n').replace(/\n\n\n+/g, '\n\n');
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Removed maxDuration: ${filePath}`);
    removedCount++;
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Removed maxDuration from: ${removedCount} files`);
console.log(`⏭️  Skipped (no maxDuration): ${skippedCount} files`);
console.log('='.repeat(60));
