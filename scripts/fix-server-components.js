#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Find all page.tsx files
function findPageFiles() {
  try {
    const output = execSync('find app -name "page.tsx" -type f', { encoding: 'utf8' });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    console.error('Error finding page files:', error.message);
    return [];
  }
}

// Check if file should be a server component
function shouldBeServerComponent(content) {
  return content.includes('export const metadata') ||
         content.includes('export async function generateMetadata') ||
         content.includes('export function generateStaticParams') ||
         content.includes('export async function generateStaticParams');
}

// Remove useSettings from server components
function removeUseSettingsFromServer(content) {
  let newContent = content;
  
  // Remove 'use client' directive
  newContent = newContent.replace(/^'use client';\s*\n*/m, '');
  newContent = newContent.replace(/^"use client";\s*\n*/m, '');
  
  // Remove useSettings import
  newContent = newContent.replace(/import { useSettings } from '@\/app\/providers\/SettingsProvider';\s*\n/g, '');
  
  // Remove useSettings call
  newContent = newContent.replace(/\s*const settings = useSettings\(\);\s*\n/g, '');
  
  return newContent;
}

// Process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if this should be a server component
    if (shouldBeServerComponent(content)) {
      // Check if it incorrectly has useSettings
      if (content.includes('useSettings')) {
        console.log(`🔄 ${filePath} - removing useSettings from server component`);
        const fixedContent = removeUseSettingsFromServer(content);
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        return;
      }
    }
    
    console.log(`✓ ${filePath} - no changes needed`);
    
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

// Main function
function main() {
  console.log('🔍 Finding all page.tsx files...');
  const pageFiles = findPageFiles();
  
  if (pageFiles.length === 0) {
    console.log('No page.tsx files found.');
    return;
  }
  
  console.log(`📄 Found ${pageFiles.length} page.tsx files`);
  console.log('🔧 Removing useSettings from server components...\n');
  
  pageFiles.forEach(processFile);
  
  console.log('\n✅ Done! Server components have been fixed.');
}

// Run the script
if (require.main === module) {
  main();
}
