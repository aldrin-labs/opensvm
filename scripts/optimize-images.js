/**
 * Image Optimization Script
 * 
 * This script optimizes all images in the public directory to improve performance.
 * It uses sharp to resize and compress images.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Configuration
const PUBLIC_DIR = path.join(__dirname, '../public');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const SIZES = [640, 750, 828, 1080, 1200, 1920, 2048];
const QUALITY = 80;

// Function to check if a file is an image
const isImage = (file) => {
  const ext = path.extname(file).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
};

// Function to get all files in a directory recursively
async function getFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(
    subdirs.map(async (subdir) => {
      const res = path.resolve(dir, subdir);
      return (await stat(res)).isDirectory() ? getFiles(res) : res;
    })
  );
  return files.flat();
}

// Function to optimize an image
async function optimizeImage(file) {
  try {
    const ext = path.extname(file).toLowerCase();
    const filename = path.basename(file, ext);
    const dir = path.dirname(file);
    
    // Skip already optimized images
    if (filename.includes('-optimized')) {
      return;
    }
    
    console.log(`Optimizing ${file}...`);
    
    // Create optimized version
    const optimizedPath = path.join(dir, `${filename}-optimized${ext}`);
    
    let sharpInstance = sharp(file);
    
    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    // Determine target size (use original size if smaller than smallest target size)
    const targetWidth = Math.min(metadata.width, 1920);
    
    // Resize and optimize
    await sharpInstance
      .resize(targetWidth, null, { 
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(ext === '.png' ? 'png' : 'jpeg', { 
        quality: QUALITY,
        progressive: true,
        optimizeScans: true
      })
      .toFile(optimizedPath);
    
    // Generate WebP version for better performance
    if (ext !== '.webp' && ext !== '.svg') {
      const webpPath = path.join(dir, `${filename}-optimized.webp`);
      await sharp(file)
        .resize(targetWidth, null, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat('webp', { 
          quality: QUALITY,
          effort: 6
        })
        .toFile(webpPath);
    }
    
    // Generate AVIF version for even better performance
    if (ext !== '.svg') {
      const avifPath = path.join(dir, `${filename}-optimized.avif`);
      await sharp(file)
        .resize(targetWidth, null, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat('avif', { 
          quality: QUALITY,
          effort: 9
        })
        .toFile(avifPath);
    }
    
    console.log(`✅ Optimized ${file}`);
  } catch (error) {
    console.error(`❌ Error optimizing ${file}:`, error.message);
  }
}

// Main function
async function main() {
  try {
    console.log('🔍 Finding images in public directory...');
    const files = await getFiles(PUBLIC_DIR);
    const images = files.filter(isImage);
    
    console.log(`Found ${images.length} images to optimize.`);
    
    // Process images in batches to avoid memory issues
    const BATCH_SIZE = 5;
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(optimizeImage));
    }
    
    console.log('✅ Image optimization complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();