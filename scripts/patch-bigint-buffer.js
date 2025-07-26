#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const bigintBufferPath = path.join(__dirname, '..', 'node_modules', 'bigint-buffer', 'dist', 'node.js');

if (fs.existsSync(bigintBufferPath)) {
  let content = fs.readFileSync(bigintBufferPath, 'utf8');
  
  // Check if already patched
  if (content.includes('Suppressed warning: bigint: Failed to load bindings')) {
    console.log('bigint-buffer already patched');
    return;
  }
  
  // Apply the patch
  const originalWarning = `console.warn('bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)');`;
  const patchedCode = `// Native bindings failed to load, will use pure JS fallback
        // Suppressed warning: bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)`;
  
  if (content.includes(originalWarning)) {
    content = content.replace(originalWarning, patchedCode);
    fs.writeFileSync(bigintBufferPath, content, 'utf8');
    console.log('Successfully patched bigint-buffer to suppress binding warnings');
  } else {
    console.log('bigint-buffer warning pattern not found, may already be different version');
  }
} else {
  console.log('bigint-buffer not found, skipping patch');
}
