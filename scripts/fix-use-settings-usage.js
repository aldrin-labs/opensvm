#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of all page.tsx files
const pageFiles = [
  'app/tokens/gainers/page.tsx',
  'app/tokens/page.tsx',
  'app/tokens/new/page.tsx',
  'app/slots/page.tsx',
  'app/program/[address]/page.tsx',
  'app/ui-showcase/page.tsx',
  'app/monitoring/page.tsx',
  'app/test/transfers/page.tsx',
  'app/test/page.tsx',
  'app/test/components/page.tsx',
  'app/solana/page.tsx',
  'app/anomaly/[id]/page.tsx',
  'app/[...slug]/page.tsx',
  'app/blocks/page.tsx',
  'app/dex/[name]/page.tsx',
  'app/scan/page.tsx',
  'app/test-transaction-graph/page.tsx',
  'app/networks/page.tsx',
  'app/validators/page.tsx',
  'app/docs/[slug]/page.tsx',
  'app/docs/api/page.tsx',
  'app/docs/page.tsx',
  'app/admin/page.tsx',
  'app/validator/[address]/page.tsx',
  'app/share/[shareCode]/page.tsx',
  'app/token/[mint]/page.tsx',
  'app/user/[walletAddress]/page.tsx',
  'app/account/[address]/page.tsx',
  'app/demo/loading-ui/page.tsx',
  'app/chat/page.tsx',
  'app/page.tsx',
  'app/block/[slot]/page.tsx',
  'app/nfts/trending/page.tsx',
  'app/nfts/page.tsx',
  'app/nfts/new/page.tsx',
  'app/test-search/page.tsx',
  'app/search/page.tsx',
  'app/test-vtable/page.tsx',
  'app/analytics/tokens/page.tsx',
  'app/analytics/page.tsx',
  'app/analytics/defi/page.tsx',
  'app/programs/page.tsx',
  'app/tx/[signature]/instructions/page.tsx',
  'app/tx/[signature]/overview/page.tsx',
  'app/tx/[signature]/[tab]/page.tsx',
  'app/tx/[signature]/metrics/page.tsx',
  'app/tx/[signature]/graph/page.tsx',
  'app/tx/[signature]/related/page.tsx',
  'app/tx/[signature]/ai/page.tsx',
  'app/tx/[signature]/failure/page.tsx',
  'app/tx/[signature]/accounts/page.tsx',
  'app/tx/[signature]/page.tsx',
  'app/tx/[signature]/[...tab]/page.tsx',
  'app/tx/page.tsx',
  'app/defi/[category]/page.tsx'
];

function fixUseSettingsUsage(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file imports useSettings
    if (!content.includes("import { useSettings } from '@/app/providers/SettingsProvider'")) {
      // Add the import
      const lines = content.split('\n');
      let importInsertIndex = -1;
      
      // Find where to insert the import (after other imports)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export const dynamic')) continue;
        if (lines[i].startsWith('import ')) {
          importInsertIndex = i + 1;
        } else if (importInsertIndex > -1 && !lines[i].trim().startsWith('import ')) {
          break;
        }
      }
      
      if (importInsertIndex > -1) {
        lines.splice(importInsertIndex, 0, "import { useSettings } from '@/app/providers/SettingsProvider';");
        console.log(`Added useSettings import to: ${filePath}`);
      }
      
      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf8');
      return fixUseSettingsUsage(filePath); // Recursively fix the updated content
    }
    
    // Check if useSettings is called but not used
    const hasUseSettingsImport = content.includes("useSettings");
    const hasUseSettingsCall = /const\s+settings\s*=\s*useSettings\(\)/.test(content);
    
    if (hasUseSettingsImport && !hasUseSettingsCall) {
      // Add useSettings call in the component
      const lines = content.split('\n');
      let componentStartIndex = -1;
      
      // Find the component function declaration
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export default function') || lines[i].includes('function ') && lines[i].includes('Page')) {
          componentStartIndex = i;
          break;
        }
      }
      
      if (componentStartIndex > -1) {
        // Find the opening brace and add useSettings call after it
        for (let i = componentStartIndex; i < lines.length; i++) {
          if (lines[i].includes('{')) {
            lines.splice(i + 1, 0, '  const settings = useSettings();');
            console.log(`Added useSettings call to: ${filePath}`);
            break;
          }
        }
      }
      
      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf8');
      return fixUseSettingsUsage(filePath); // Recursively fix the updated content
    }
    
    // Check if settings variable is declared but not used
    if (hasUseSettingsCall) {
      const usesSettings = content.includes('settings') && (
        content.includes('{...({ settings } as any)}') ||
        content.includes('settings.') ||
        content.includes('settings[') ||
        content.match(/\bsettings\b(?!\s*=\s*useSettings)/g)?.length > 1
      );
      
      if (!usesSettings) {
        // Add settings usage to components that likely need it
        const lines = content.split('\n');
        
        // Look for component calls that could use settings
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Look for React component calls (starts with capital letter)
          if (line.includes('<') && /[A-Z][a-zA-Z]*/.test(line) && !line.includes('settings') && !line.includes('/>')) {
            // Add settings prop to the component
            const componentMatch = line.match(/<([A-Z][a-zA-Z]*)/);
            if (componentMatch && !line.includes('div') && !line.includes('span') && !line.includes('button')) {
              // Find the closing of this component tag
              let j = i;
              while (j < lines.length && !lines[j].includes('/>') && !lines[j].includes('</')) {
                if (lines[j].includes('>') && !lines[j].includes('</')) {
                  // Add settings prop before the closing >
                  lines[j] = lines[j].replace('>', '\n          {...({ settings } as any)}\n        >');
                  console.log(`Added settings prop to ${componentMatch[1]} in: ${filePath}`);
                  break;
                }
                j++;
              }
              break; // Only fix the first component found
            }
          }
        }
        
        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
    }
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Process all files
pageFiles.forEach(fixUseSettingsUsage);

console.log('Finished fixing useSettings usage in all page.tsx files');
