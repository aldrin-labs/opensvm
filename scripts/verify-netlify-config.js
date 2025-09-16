#!/usr/bin/env node

/**
 * Verification script for Netlify function configuration
 * This script verifies that all required files for the getAnswer function are accessible
 */

const fs = require('fs');
const path = require('path');

function checkFileExists(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const stats = fs.statSync(fullPath);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`✅ Found: ${filePath} (${sizeKB} KB)`);
    return true;
  } catch (error) {
    console.log(`❌ Missing: ${filePath} - ${error.message}`);
    return false;
  }
}

function verifyNetlifyConfig() {
  console.log('🔍 Verifying Netlify function configuration...\n');
  
  // Check netlify.toml exists
  if (!checkFileExists('netlify.toml')) {
    console.log('❌ netlify.toml not found');
    process.exit(1);
  }
  
  // Parse netlify.toml to check included_files
  const netlifyConfig = fs.readFileSync('netlify.toml', 'utf-8');
  console.log('\n📋 Checking included_files configuration:');
  
  const requiredFiles = [
    'config/rpc-config.json',
    'config/rpc-endpoints.js', 
    'public/solana-rpc-llms.md'
  ];
  
  let allFilesFound = true;
  
  requiredFiles.forEach(file => {
    if (netlifyConfig.includes(`"${file}"`)) {
      console.log(`✅ ${file} is configured for inclusion`);
      if (!checkFileExists(file)) {
        allFilesFound = false;
      }
    } else {
      console.log(`❌ ${file} is NOT configured for inclusion in netlify.toml`);
      allFilesFound = false;
    }
  });
  
  // Check the main API route
  console.log('\n📁 Checking API route:');
  checkFileExists('app/api/getAnswer/route.ts');
  
  // Estimate total function size
  console.log('\n📊 Estimating function bundle size:');
  let totalSize = 0;
  requiredFiles.forEach(file => {
    try {
      const stats = fs.statSync(file);
      totalSize += stats.size;
    } catch (e) {
      // File not found, already reported above
    }
  });
  
  const totalSizeKB = Math.round(totalSize / 1024);
  console.log(`📦 Total included files size: ${totalSizeKB} KB`);
  
  if (totalSizeKB > 1000) {
    console.log('⚠️  Warning: Large bundle size may affect cold start performance');
  } else {
    console.log('✅ Bundle size is reasonable for Netlify functions');
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allFilesFound && netlifyConfig.includes('public/solana-rpc-llms.md')) {
    console.log('🎉 Configuration verified! The fix should resolve the ENOENT error.');
    console.log('📝 Next steps:');
    console.log('   1. Commit and push changes to trigger deployment');
    console.log('   2. Monitor function logs for "✅ Successfully loaded" message');
    console.log('   3. Test the /api/getAnswer endpoint');
    process.exit(0);
  } else {
    console.log('❌ Configuration issues detected. Please fix before deploying.');
    process.exit(1);
  }
}

if (require.main === module) {
  verifyNetlifyConfig();
}

module.exports = { verifyNetlifyConfig };
