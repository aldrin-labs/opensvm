/**
 * JavaScript Optimization Script
 * 
 * This script optimizes JavaScript files after the build process by:
 * 1. Minifying JavaScript files further
 * 2. Removing comments and console logs
 * 3. Compressing files with Brotli and Gzip
 * 4. Generating size reports
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const zlib = require('zlib');
const { execSync } = require('child_process');

// Promisify functions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

// Configuration
const BUILD_DIR = path.join(__dirname, '../.next');
const STATIC_DIR = path.join(BUILD_DIR, 'static');
const REPORT_PATH = path.join(__dirname, '../js-optimization-report.json');
const GZIP_OPTIONS = { level: 9 }; // Maximum compression
const BROTLI_OPTIONS = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11, // Maximum quality
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0, // Auto size hint
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT, // Optimize for text
  }
};

// Check if terser is installed
let hasTerser = false;
try {
  execSync('npx terser --version', { stdio: 'ignore' });
  hasTerser = true;
} catch (e) {
  console.warn('Terser not found. Will skip additional minification.');
}

// Function to get all JS files recursively
async function getJsFiles(dir) {
  const files = await readdir(dir);
  const jsFiles = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      const subDirFiles = await getJsFiles(filePath);
      jsFiles.push(...subDirFiles);
    } else if (file.endsWith('.js')) {
      jsFiles.push(filePath);
    }
  }

  return jsFiles;
}

// Function to minify JS with terser
async function minifyJs(filePath, content) {
  if (!hasTerser) return content;

  try {
    const result = execSync(`npx terser "${filePath}" --compress passes=2,drop_console=true,pure_funcs=['console.log','console.info','console.debug','console.warn'] --mangle toplevel=true --format comments=false`, {
      encoding: 'utf8'
    });
    return result;
  } catch (e) {
    console.error(`Error minifying ${filePath}:`, e.message);
    return content;
  }
}

// Function to compress file with Gzip
async function compressWithGzip(content) {
  return gzip(content, GZIP_OPTIONS);
}

// Function to compress file with Brotli
async function compressWithBrotli(content) {
  return brotliCompress(content, BROTLI_OPTIONS);
}

// Function to format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Main function
async function optimizeJs() {
  console.log('🚀 Starting JavaScript optimization...');

  // Check if build directory exists
  if (!fs.existsSync(STATIC_DIR)) {
    console.error(`❌ Build directory not found: ${STATIC_DIR}`);
    console.error('Please run "next build" first.');
    process.exit(1);
  }

  // Get all JS files
  console.log('📂 Finding JavaScript files...');
  const jsFiles = await getJsFiles(STATIC_DIR);
  console.log(`Found ${jsFiles.length} JavaScript files.`);

  // Optimization report
  const report = {
    totalFiles: jsFiles.length,
    totalOriginalSize: 0,
    totalMinifiedSize: 0,
    totalGzipSize: 0,
    totalBrotliSize: 0,
    files: []
  };

  // Process each file
  for (const [index, filePath] of jsFiles.entries()) {
    const relativePath = path.relative(BUILD_DIR, filePath);
    console.log(`[${index + 1}/${jsFiles.length}] Processing ${relativePath}...`);

    // Read file content
    const content = await readFile(filePath, 'utf8');
    const originalSize = Buffer.byteLength(content, 'utf8');
    report.totalOriginalSize += originalSize;

    // Minify JS
    const minified = await minifyJs(filePath, content);
    const minifiedSize = Buffer.byteLength(minified, 'utf8');
    report.totalMinifiedSize += minifiedSize;

    // Write minified content back to file
    await writeFile(filePath, minified);

    // Compress with Gzip
    const gzipped = await compressWithGzip(minified);
    const gzipPath = `${filePath}.gz`;
    await writeFile(gzipPath, gzipped);
    const gzipSize = gzipped.length;
    report.totalGzipSize += gzipSize;

    // Compress with Brotli
    const brotlied = await compressWithBrotli(minified);
    const brotliPath = `${filePath}.br`;
    await writeFile(brotliPath, brotlied);
    const brotliSize = brotlied.length;
    report.totalBrotliSize += brotliSize;

    // Add to report
    report.files.push({
      file: relativePath,
      originalSize,
      minifiedSize,
      gzipSize,
      brotliSize,
      minifiedReduction: ((originalSize - minifiedSize) / originalSize * 100).toFixed(2) + '%',
      gzipReduction: ((originalSize - gzipSize) / originalSize * 100).toFixed(2) + '%',
      brotliReduction: ((originalSize - brotliSize) / originalSize * 100).toFixed(2) + '%'
    });
  }

  // Sort files by size (largest first)
  report.files.sort((a, b) => b.originalSize - a.originalSize);

  // Write report
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n📊 Optimization Summary:');
  console.log(`Total Files: ${report.totalFiles}`);
  console.log(`Original Size: ${formatBytes(report.totalOriginalSize)}`);
  console.log(`Minified Size: ${formatBytes(report.totalMinifiedSize)} (${((report.totalOriginalSize - report.totalMinifiedSize) / report.totalOriginalSize * 100).toFixed(2)}% reduction)`);
  console.log(`Gzip Size: ${formatBytes(report.totalGzipSize)} (${((report.totalOriginalSize - report.totalGzipSize) / report.totalOriginalSize * 100).toFixed(2)}% reduction)`);
  console.log(`Brotli Size: ${formatBytes(report.totalBrotliSize)} (${((report.totalOriginalSize - report.totalBrotliSize) / report.totalOriginalSize * 100).toFixed(2)}% reduction)`);
  console.log(`\nDetailed report written to: ${REPORT_PATH}`);
  console.log('\n✅ JavaScript optimization complete!');
}

// Run the optimization
optimizeJs().catch(err => {
  console.error('❌ Error during optimization:', err);
  process.exit(1);
});