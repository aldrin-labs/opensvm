const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const PAGES_TO_TEST = [
  '/',                // Home page
  '/blocks',          // Blocks page
  '/programs',        // Programs page
  '/tokens',          // Tokens page
  '/analytics'        // Analytics page
];

const LIGHTHOUSE_OPTIONS = [
  '--output=json',
  '--output-path=./lighthouse-results.json',
  '--chrome-flags="--headless --no-sandbox --disable-gpu"',
  '--preset=desktop',
  '--throttling-method=provided',
  '--only-categories=performance,accessibility,best-practices,seo'
];

// Create results directory if it doesn't exist
const RESULTS_DIR = path.join(__dirname, '../lighthouse-results');
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR);
}

async function runLighthouse(url) {
  const outputPath = path.join(RESULTS_DIR, `lighthouse-${url.replace(/\//g, '-')}.json`);
  const command = `lighthouse ${url} ${LIGHTHOUSE_OPTIONS.join(' ')} --output-path=${outputPath}`;
  
  console.log(`Running Lighthouse for ${url}...`);
  try {
    const { stdout } = await execPromise(command);
    console.log(`Lighthouse completed for ${url}`);
    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (error) {
    console.error(`Error running Lighthouse for ${url}:`, error);
    return null;
  }
}

async function runAllTests() {
  console.log('Starting Lighthouse benchmarks...');
  
  // Start the Next.js server in production mode
  console.log('Building and starting Next.js in production mode...');
  try {
    await execPromise('npm run build && npm run start');
  } catch (error) {
    console.error('Error building or starting Next.js:', error);
    return;
  }
  
  const baseUrl = 'http://localhost:3000';
  const results = {};
  
  for (const page of PAGES_TO_TEST) {
    const url = `${baseUrl}${page}`;
    const result = await runLighthouse(url);
    if (result) {
      results[page] = {
        performance: result.categories.performance.score * 100,
        accessibility: result.categories.accessibility.score * 100,
        bestPractices: result.categories['best-practices'].score * 100,
        seo: result.categories.seo.score * 100
      };
    }
  }
  
  // Calculate average scores
  const averages = {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0
  };
  
  let pageCount = 0;
  for (const page in results) {
    averages.performance += results[page].performance;
    averages.accessibility += results[page].accessibility;
    averages.bestPractices += results[page].bestPractices;
    averages.seo += results[page].seo;
    pageCount++;
  }
  
  if (pageCount > 0) {
    averages.performance /= pageCount;
    averages.accessibility /= pageCount;
    averages.bestPractices /= pageCount;
    averages.seo /= pageCount;
  }
  
  // Print results
  console.log('\nLighthouse Benchmark Results:');
  console.log('============================');
  
  for (const page in results) {
    console.log(`\n${page}:`);
    console.log(`  Performance: ${results[page].performance.toFixed(1)}`);
    console.log(`  Accessibility: ${results[page].accessibility.toFixed(1)}`);
    console.log(`  Best Practices: ${results[page].bestPractices.toFixed(1)}`);
    console.log(`  SEO: ${results[page].seo.toFixed(1)}`);
  }
  
  console.log('\nAverage Scores:');
  console.log(`  Performance: ${averages.performance.toFixed(1)}`);
  console.log(`  Accessibility: ${averages.accessibility.toFixed(1)}`);
  console.log(`  Best Practices: ${averages.bestPractices.toFixed(1)}`);
  console.log(`  SEO: ${averages.seo.toFixed(1)}`);
  
  // Save results to a file
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'summary.json'),
    JSON.stringify({ results, averages }, null, 2)
  );
  
  console.log(`\nResults saved to ${path.join(RESULTS_DIR, 'summary.json')}`);
}

runAllTests().catch(console.error);