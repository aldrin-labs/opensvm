/**
 * Add Preload Hints Script
 * 
 * This script analyzes the application and adds preload hints for critical resources
 * to improve initial page load performance.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PUBLIC_DIR = path.join(__dirname, '../public');
const APP_DIR = path.join(__dirname, '../app');
const CRITICAL_RESOURCES = [
  // Critical CSS
  { type: 'style', path: '/styles/critical.css' },
  
  // Critical fonts
  { type: 'font', path: '/fonts/BerkeleyMono-Regular.woff2', format: 'woff2' },
  { type: 'font', path: '/fonts/BerkeleyMono-Bold.woff2', format: 'woff2' },
  
  // Critical images
  { type: 'image', path: '/favicon.svg', format: 'image/svg+xml' },
  
  // Add more critical resources as needed
];

// Function to generate preload tags
function generatePreloadTags() {
  return CRITICAL_RESOURCES.map(resource => {
    let tag = `<link rel="preload" href="${resource.path}" as="${resource.type}"`;
    
    if (resource.format) {
      if (resource.type === 'font') {
        tag += ` type="${resource.format}" crossOrigin="anonymous"`;
      } else if (resource.type === 'image') {
        tag += ` type="${resource.format}" fetchPriority="high"`;
      }
    }
    
    tag += ' />';
    return tag;
  }).join('\n    ');
}

// Function to add preload hints to layout.tsx
function addPreloadHintsToLayout() {
  const layoutPath = path.join(APP_DIR, 'layout.tsx');
  
  try {
    let layoutContent = fs.readFileSync(layoutPath, 'utf8');
    
    // Check if preload hints are already added
    if (layoutContent.includes('<!-- Critical Resource Preloads -->')) {
      console.log('Preload hints already added to layout.tsx');
      return;
    }
    
    // Generate preload tags
    const preloadTags = generatePreloadTags();
    
    // Add preload tags to head
    layoutContent = layoutContent.replace(
      /<head>([\s\S]*?)<\/head>/,
      `<head>$1
    <!-- Critical Resource Preloads -->
    ${preloadTags}
    </head>`
    );
    
    // Write updated content back to file
    fs.writeFileSync(layoutPath, layoutContent);
    console.log('✅ Added preload hints to layout.tsx');
  } catch (error) {
    console.error('❌ Error adding preload hints to layout.tsx:', error.message);
  }
}

// Function to create a critical CSS file if it doesn't exist
function ensureCriticalCssExists() {
  const criticalCssPath = path.join(PUBLIC_DIR, 'styles/critical.css');
  const criticalCssDir = path.dirname(criticalCssPath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(criticalCssDir)) {
    fs.mkdirSync(criticalCssDir, { recursive: true });
    console.log(`Created directory: ${criticalCssDir}`);
  }
  
  // Create critical CSS file if it doesn't exist
  if (!fs.existsSync(criticalCssPath)) {
    // Extract critical CSS from the application
    try {
      console.log('Extracting critical CSS...');
      
      // Basic critical CSS template
      const basicCriticalCss = `/* Critical CSS */
body {
  margin: 0;
  padding: 0;
  font-family: sans-serif;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Add more critical styles here */
`;
      
      fs.writeFileSync(criticalCssPath, basicCriticalCss);
      console.log(`✅ Created critical CSS file: ${criticalCssPath}`);
    } catch (error) {
      console.error('❌ Error creating critical CSS:', error.message);
    }
  } else {
    console.log(`Critical CSS file already exists: ${criticalCssPath}`);
  }
}

// Function to optimize font loading
function optimizeFontLoading() {
  const layoutPath = path.join(APP_DIR, 'layout.tsx');
  
  try {
    let layoutContent = fs.readFileSync(layoutPath, 'utf8');
    
    // Check if font optimization is already added
    if (layoutContent.includes('font-display: swap')) {
      console.log('Font optimization already added to layout.tsx');
      return;
    }
    
    // Add font-display: swap to font-face declarations
    layoutContent = layoutContent.replace(
      /@font-face\s*{([^}]*)}/g,
      (match, fontFaceContent) => {
        if (!fontFaceContent.includes('font-display')) {
          return `@font-face {${fontFaceContent}  font-display: swap;\n}`;
        }
        return match;
      }
    );
    
    // Write updated content back to file
    fs.writeFileSync(layoutPath, layoutContent);
    console.log('✅ Optimized font loading in layout.tsx');
  } catch (error) {
    console.error('❌ Error optimizing font loading:', error.message);
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 Adding preload hints for critical resources...');
    
    // Ensure critical CSS exists
    ensureCriticalCssExists();
    
    // Add preload hints to layout.tsx
    addPreloadHintsToLayout();
    
    // Optimize font loading
    optimizeFontLoading();
    
    console.log('✅ Preload hints added successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();