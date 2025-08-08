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

// Check if file already has useSettings import
function hasUseSettings(content) {
  return content.includes("import { useSettings }") || 
         content.includes("useSettings") ||
         content.includes("from '@/app/providers/SettingsProvider'");
}

// Check if file is a client component
function isClientComponent(content) {
  return content.includes("'use client'") || content.includes('"use client"');
}

// Check if file is a server component (async function or no 'use client')
function isServerComponent(content) {
  return !isClientComponent(content) || content.includes('export default async function');
}

// Add useSettings import to a client component
function addUseSettingsToClient(content) {
  const lines = content.split('\n');
  
  // Find the first import line after 'use client'
  let insertIndex = -1;
  let foundUseClient = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes("'use client'") || line.includes('"use client"')) {
      foundUseClient = true;
      continue;
    }
    
    if (foundUseClient && line.startsWith('import ') && !line.includes('useSettings')) {
      insertIndex = i + 1;
      break;
    }
  }
  
  // If no imports found after 'use client', insert after 'use client' line
  if (insertIndex === -1 && foundUseClient) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("'use client'") || lines[i].includes('"use client"')) {
        insertIndex = i + 2; // Add a blank line after 'use client'
        break;
      }
    }
  }
  
  if (insertIndex !== -1) {
    lines.splice(insertIndex, 0, "import { useSettings } from '@/app/providers/SettingsProvider';");
    
    // Add a call to useSettings in the component function
    const functionMatch = content.match(/export default function \w+\([^)]*\)\s*{/);
    if (functionMatch) {
      const funcIndex = lines.findIndex(line => line.includes(functionMatch[0]));
      if (funcIndex !== -1) {
        // Find the opening brace and add useSettings after it
        let braceIndex = funcIndex;
        for (let i = funcIndex; i < lines.length; i++) {
          if (lines[i].includes('{')) {
            braceIndex = i;
            break;
          }
        }
        lines.splice(braceIndex + 1, 0, "  const settings = useSettings();");
      }
    }
  }
  
  return lines.join('\n');
}

// Convert server component to client component and add useSettings
function convertToClientWithSettings(content) {
  const lines = content.split('\n');
  
  // Add 'use client' at the top
  let insertIndex = 0;
  lines.splice(insertIndex, 0, "'use client';", "");
  
  // Add useSettings import
  let importIndex = 2; // After 'use client' and blank line
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      importIndex = i + 1;
      break;
    }
  }
  lines.splice(importIndex, 0, "import { useSettings } from '@/app/providers/SettingsProvider';");
  
  // Convert async function to regular function
  const newContent = lines.join('\n')
    .replace(/export default async function/g, 'export default function')
    .replace(/await\s+/g, '') // Remove await keywords
    .replace(/Promise<[^>]+>/g, '') // Remove Promise return types
    .replace(/: Promise<[^>]+>/g, ''); // Remove Promise parameter types
  
  // Add useSettings call
  const functionMatch = newContent.match(/export default function \w+\([^)]*\)\s*{/);
  if (functionMatch) {
    const lines2 = newContent.split('\n');
    const funcIndex = lines2.findIndex(line => line.includes(functionMatch[0]));
    if (funcIndex !== -1) {
      let braceIndex = funcIndex;
      for (let i = funcIndex; i < lines2.length; i++) {
        if (lines2[i].includes('{')) {
          braceIndex = i;
          break;
        }
      }
      lines2.splice(braceIndex + 1, 0, "  const settings = useSettings();");
      return lines2.join('\n');
    }
  }
  
  return newContent;
}

// Process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if already has useSettings
    if (hasUseSettings(content)) {
      console.log(`✓ ${filePath} - already has useSettings`);
      return;
    }
    
    let newContent;
    
    if (isClientComponent(content)) {
      newContent = addUseSettingsToClient(content);
      console.log(`✓ ${filePath} - added useSettings to client component`);
    } else if (isServerComponent(content)) {
      newContent = convertToClientWithSettings(content);
      console.log(`✓ ${filePath} - converted to client component with useSettings`);
    } else {
      console.log(`? ${filePath} - could not determine component type, skipping`);
      return;
    }
    
    // Write the updated content
    fs.writeFileSync(filePath, newContent, 'utf8');
    
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
  console.log('🔧 Processing files...\n');
  
  pageFiles.forEach(processFile);
  
  console.log('\n✅ Done! All page.tsx files have been processed.');
  console.log('💡 You may need to review and adjust some files manually.');
}

// Run the script
if (require.main === module) {
  main();
}
