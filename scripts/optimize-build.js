#!/usr/bin/env node

/**
 * Build optimization script for OpenSVM
 * This script optimizes the build process by:
 * - Cleaning unnecessary files
 * - Pre-building heavy dependencies
 * - Validating environment setup
 * - Providing build performance metrics
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_START_TIME = Date.now();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`${colors.bold}[${step}]${colors.reset} ${message}`, colors.blue);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

// Clean build artifacts and caches
function cleanBuildArtifacts() {
  logStep('CLEAN', 'Removing build artifacts and caches...');
  
  const pathsToClean = [
    '.next',
    'node_modules/.cache',
    '.swc',
    'tsconfig.tsbuildinfo',
    'playwright-report',
    'test-results'
  ];
  
  pathsToClean.forEach(cleanPath => {
    if (fs.existsSync(cleanPath)) {
      try {
        if (fs.statSync(cleanPath).isDirectory()) {
          fs.rmSync(cleanPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(cleanPath);
        }
        logSuccess(`Cleaned ${cleanPath}`);
      } catch (error) {
        logWarning(`Failed to clean ${cleanPath}: ${error.message}`);
      }
    }
  });
}

// Validate environment setup
function validateEnvironment() {
  logStep('VALIDATE', 'Validating environment setup...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    logError(`Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`);
    process.exit(1);
  }
  logSuccess(`Node.js version ${nodeVersion} is supported`);
  
  // Check package.json exists
  if (!fs.existsSync('package.json')) {
    logError('package.json not found');
    process.exit(1);
  }
  logSuccess('package.json found');
  
  // Check for critical dependencies
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const criticalDeps = ['next', 'react', 'react-dom'];
  
  criticalDeps.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      logError(`Critical dependency ${dep} not found in package.json`);
      process.exit(1);
    }
  });
  logSuccess('All critical dependencies found');
  
  // Check environment variables
  if (!fs.existsSync('.env.local')) {
    logWarning('.env.local not found - using default configuration');
  } else {
    logSuccess('.env.local found');
  }
}

// Optimize dependencies
function optimizeDependencies() {
  logStep('OPTIMIZE', 'Optimizing dependencies...');
  
  try {
    // Install dependencies with optimization flags
    log('Installing dependencies...');
    
    // Check if package-lock.json exists
    const hasLockFile = fs.existsSync('package-lock.json');
    
    if (hasLockFile) {
      // Use 'npm ci' for faster, more reliable builds when lock file exists
      execSync('npm ci --prefer-offline --no-audit --no-fund', {
        stdio: 'pipe',
        encoding: 'utf8'
      });
    } else {
      // Use 'npm install' to generate the lock file when it doesn't exist
      logWarning('No package-lock.json found - running npm install to generate it');
      execSync('npm install --prefer-offline --no-audit --no-fund', {
        stdio: 'pipe',
        encoding: 'utf8'
      });
    }
    
    logSuccess('Dependencies installed successfully');
    
    // Clean node_modules cache
    if (fs.existsSync('node_modules/.cache')) {
      fs.rmSync('node_modules/.cache', { recursive: true, force: true });
      logSuccess('Cleaned node_modules cache');
    }
    
  } catch (error) {
    logError(`Dependency optimization failed: ${error.message}`);
    process.exit(1);
  }
}

// Pre-compile TypeScript for better performance
function precompileTypeScript() {
  logStep('PRECOMPILE', 'Pre-compiling TypeScript...');
  
  try {
    execSync('npx tsc --noEmit --skipLibCheck', { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    logSuccess('TypeScript pre-compilation completed');
  } catch (error) {
    logWarning(`TypeScript pre-compilation had warnings: ${error.message}`);
  }
}

// Analyze bundle size (if requested)
function analyzeBundleSize() {
  if (process.argv.includes('--analyze')) {
    logStep('ANALYZE', 'Analyzing bundle size...');
    
    try {
      execSync('ANALYZE=true npm run build', { 
        stdio: 'inherit',
        encoding: 'utf8'
      });
      logSuccess('Bundle analysis completed - check the generated report');
    } catch (error) {
      logError(`Bundle analysis failed: ${error.message}`);
    }
  }
}

// Run the actual build
function runBuild() {
  logStep('BUILD', 'Starting Next.js build...');
  
  const buildStartTime = Date.now();
  
  try {
    execSync('npm run build', { 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    const buildTime = ((Date.now() - buildStartTime) / 1000).toFixed(2);
    logSuccess(`Build completed successfully in ${buildTime}s`);
    
    // Show build statistics
    if (fs.existsSync('.next')) {
      const buildInfo = getBuildStatistics();
      displayBuildStatistics(buildInfo);
    }
    
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  }
}

// Get build statistics
function getBuildStatistics() {
  const stats = {
    totalFiles: 0,
    staticFiles: 0,
    serverFiles: 0,
    totalSize: 0
  };
  
  function countFiles(dir, basePath = '') {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        countFiles(fullPath, path.join(basePath, item));
      } else {
        stats.totalFiles++;
        stats.totalSize += stat.size;
        
        if (basePath.includes('static')) {
          stats.staticFiles++;
        } else if (basePath.includes('server')) {
          stats.serverFiles++;
        }
      }
    });
  }
  
  countFiles('.next');
  return stats;
}

// Display build statistics
function displayBuildStatistics(stats) {
  logStep('STATS', 'Build Statistics:');
  log(`  Total files: ${stats.totalFiles}`);
  log(`  Static files: ${stats.staticFiles}`);
  log(`  Server files: ${stats.serverFiles}`);
  log(`  Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
}

// Main execution
function main() {
  log(`${colors.bold}🚀 OpenSVM Build Optimizer${colors.reset}\n`);
  
  const args = process.argv.slice(2);
  const skipClean = args.includes('--skip-clean');
  const skipOptimize = args.includes('--skip-optimize');
  const skipBuild = args.includes('--skip-build');
  
  try {
    if (!skipClean) {
      cleanBuildArtifacts();
    }
    
    validateEnvironment();
    
    if (!skipOptimize) {
      optimizeDependencies();
    }
    
    precompileTypeScript();
    
    if (!skipBuild) {
      analyzeBundleSize();
      runBuild();
    }
    
    const totalTime = ((Date.now() - BUILD_START_TIME) / 1000).toFixed(2);
    log(`\n${colors.bold}${colors.green}✓ Build optimization completed in ${totalTime}s${colors.reset}\n`);
    
  } catch (error) {
    logError(`Build optimization failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  cleanBuildArtifacts,
  validateEnvironment,
  optimizeDependencies,
  precompileTypeScript,
  runBuild
};