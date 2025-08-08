#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Find specific problematic files
const problematicFiles = [
  'app/defi/[category]/page.tsx',
  'app/docs/[slug]/page.tsx', 
  'app/token/[mint]/page.tsx'
];

function fixFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    let fixed = content;
    
    // Fix generateMetadata return type
    fixed = fixed.replace(
      /export async function generateMetadata\([^)]+\):\s*{/g,
      'export async function generateMetadata($&): Promise<Metadata> {'
    );
    
    // Fix the syntax by properly reconstructing the function signature
    fixed = fixed.replace(
      /export async function generateMetadata\(([^)]+)\):\s*Promise<Metadata>\s*{\s*Promise<Metadata>\s*{/g,
      'export async function generateMetadata($1): Promise<Metadata> {'
    );
    
    // More specific fix for the actual broken pattern
    fixed = fixed.replace(
      /export async function generateMetadata\(([^)]+)\):\s+{/g,
      'export async function generateMetadata($1): Promise<Metadata> {'
    );
    
    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✓ Fixed ${filePath}`);
    } else {
      console.log(`- ${filePath} no changes needed`);
    }
    
  } catch (error) {
    console.error(`✗ Error fixing ${filePath}:`, error.message);
  }
}

// Add missing imports if needed
function addMetadataImport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('Promise<Metadata>') && !content.includes("import { Metadata }")) {
      const lines = content.split('\n');
      
      // Find where to insert the import
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          insertIndex = i + 1;
        }
      }
      
      lines.splice(insertIndex, 0, "import { Metadata } from 'next';");
      
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log(`✓ Added Metadata import to ${filePath}`);
    }
  } catch (error) {
    console.error(`✗ Error adding import to ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing return type syntax errors...\n');

problematicFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fixFile(file);
    addMetadataImport(file);
  } else {
    console.log(`- ${file} does not exist`);
  }
});

console.log('\n✅ Done!');
