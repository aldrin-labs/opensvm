#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
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

// Check if file exports metadata (should stay server component)
function hasMetadataExport(content) {
  return content.includes('export const metadata') || 
         content.includes('export async function generateMetadata');
}

// Check if file has generateStaticParams (should stay server component)
function hasGenerateStaticParams(content) {
  return content.includes('export function generateStaticParams') ||
         content.includes('export async function generateStaticParams');
}

// Check if file should remain a server component
function shouldStayServerComponent(content) {
  return hasMetadataExport(content) || hasGenerateStaticParams(content);
}

// Fix broken Promise types and params
function fixBrokenPromiseTypes(content) {
  return content
    .replace(/params: ;/g, 'params: Promise<{ [key: string]: string }>')
    .replace(/searchParams: ;/g, 'searchParams: Promise<{ [key: string]: string | string[] | undefined }>')
    .replace(/params: Promise<\s*{[^}]*}\s*>/g, (match) => {
      // Keep existing Promise types as-is
      return match;
    });
}

// Convert back to server component and remove useSettings
function convertBackToServerComponent(content) {
  let newContent = content;
  
  // Remove 'use client'
  newContent = newContent.replace(/^'use client';\s*\n*/m, '');
  newContent = newContent.replace(/^"use client";\s*\n*/m, '');
  
  // Remove useSettings import
  newContent = newContent.replace(/import { useSettings } from '@\/app\/providers\/SettingsProvider';\s*\n/g, '');
  
  // Remove useSettings call
  newContent = newContent.replace(/\s*const settings = useSettings\(\);\s*\n/g, '');
  
  // Convert back to async function if it was originally async
  if (content.includes('generateMetadata') || content.includes('generateStaticParams')) {
    newContent = newContent.replace(/export default function/g, 'export default async function');
  }
  
  return newContent;
}

// Add useSettings only to client components that don't have it
function addUseSettingsToClient(content) {
  if (content.includes('useSettings')) {
    return content; // Already has it
  }
  
  const lines = content.split('\n');
  
  // Find insertion point for import
  let importInsertIndex = -1;
  let foundUseClient = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes("'use client'") || line.includes('"use client"')) {
      foundUseClient = true;
      continue;
    }
    
    if (foundUseClient && line.startsWith('import ') && !line.includes('useSettings')) {
      importInsertIndex = i + 1;
      break;
    }
  }
  
  // Insert import
  if (importInsertIndex !== -1) {
    lines.splice(importInsertIndex, 0, "import { useSettings } from '@/app/providers/SettingsProvider';");
  }
  
  // Add useSettings call in component
  const functionMatch = content.match(/export default function \w+\([^)]*\)\s*{/);
  if (functionMatch) {
    const newContent = lines.join('\n');
    const funcLines = newContent.split('\n');
    const funcIndex = funcLines.findIndex(line => line.includes(functionMatch[0]));
    if (funcIndex !== -1) {
      let braceIndex = funcIndex;
      for (let i = funcIndex; i < funcLines.length; i++) {
        if (funcLines[i].includes('{')) {
          braceIndex = i;
          break;
        }
      }
      funcLines.splice(braceIndex + 1, 0, "  const settings = useSettings();");
      return funcLines.join('\n');
    }
  }
  
  return lines.join('\n');
}

// Process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for syntax errors first
    if (content.includes('params: ;') || content.includes('searchParams: ;')) {
      console.log(`🔧 ${filePath} - fixing broken Promise types`);
      let fixedContent = fixBrokenPromiseTypes(content);
      
      // If this should be a server component, convert it back
      if (shouldStayServerComponent(fixedContent)) {
        fixedContent = convertBackToServerComponent(fixedContent);
        console.log(`🔄 ${filePath} - converted back to server component`);
      } else if (fixedContent.includes("'use client'") || fixedContent.includes('"use client"')) {
        // It's a client component, make sure it has useSettings
        fixedContent = addUseSettingsToClient(fixedContent);
        console.log(`✓ ${filePath} - ensured useSettings in client component`);
      }
      
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      return;
    }
    
    // Handle metadata exports that were incorrectly converted to client components
    if (content.includes("'use client'") && shouldStayServerComponent(content)) {
      console.log(`🔄 ${filePath} - converting back to server component (has metadata/generateStaticParams)`);
      const fixedContent = convertBackToServerComponent(content);
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      return;
    }
    
    // If it's a client component without useSettings, add it
    if ((content.includes("'use client'") || content.includes('"use client"')) && !content.includes('useSettings')) {
      console.log(`✓ ${filePath} - adding useSettings to client component`);
      const fixedContent = addUseSettingsToClient(content);
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      return;
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
  console.log('🔧 Fixing issues...\n');
  
  pageFiles.forEach(processFile);
  
  console.log('\n✅ Done! All issues have been fixed.');
}

// Run the script
if (require.main === module) {
  main();
}
