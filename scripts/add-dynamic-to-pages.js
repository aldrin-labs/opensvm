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

function addDynamicDirective(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if dynamic directive already exists
    if (content.includes("export const dynamic = 'force-dynamic'")) {
      console.log(`Already has dynamic directive: ${filePath}`);
      return;
    }

    // Find the first 'use client' or import statement and add dynamic after it
    const lines = content.split('\n');
    let insertIndex = -1;
    let hasUseClient = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for 'use client'
      if (line === "'use client';" || line === '"use client";') {
        insertIndex = i + 1;
        hasUseClient = true;
        break;
      }
      
      // If no 'use client', look for first import or significant content
      if (!hasUseClient && (line.startsWith('import ') || line.startsWith('export ') || line.startsWith('const ') || line.startsWith('function '))) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex === -1) {
      console.log(`Could not find insertion point for: ${filePath}`);
      return;
    }

    // Insert the dynamic directive
    const dynamicDirective = "export const dynamic = 'force-dynamic';";
    
    if (hasUseClient) {
      // Add empty line and dynamic directive after 'use client'
      lines.splice(insertIndex, 0, '', dynamicDirective);
    } else {
      // Add dynamic directive and empty line before first significant content
      lines.splice(insertIndex, 0, dynamicDirective, '');
    }

    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Added dynamic directive to: ${filePath}`);
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Process all files
pageFiles.forEach(addDynamicDirective);

console.log('Finished adding dynamic directives to all page.tsx files');
