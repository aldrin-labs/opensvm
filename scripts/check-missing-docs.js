const fs = require('fs');
const path = require('path');

const docCategories = [
  { docs: [
    { slug: 'introduction' },
    { slug: 'README' },
    { slug: 'FEATURES' },
    { slug: 'DEVELOPMENT' },
  ]},
  { docs: [
    { slug: 'ARCHITECTURE' },
    { slug: 'DIAGRAMS' },
    { slug: 'PERFORMANCE_MONITORING' },
  ]},
  { docs: [
    { slug: 'API' },
    { slug: 'API-SCHEMA-REFERENCE' },
    { slug: 'API_REFERENCE' },
    { slug: 'MARKET_DATA_API_GUIDE' },
    { slug: 'swagger' },
    { slug: 'DEX_API_TESTS' },
    { slug: 'TESTING' },
    { slug: 'api/api-health-summary' },
    { slug: 'api/health-check-report' },
    { slug: 'AUTHENTICATION' },
    { slug: 'anthropic-sdk-integration-guide' },
  ]},
  { docs: [
    { slug: 'INTEGRATION_TESTING' },
    { slug: 'SECURITY_IMPROVEMENTS' },
    { slug: 'TOKEN_GATING_TESTING' },
  ]},
  { docs: [
    { slug: 'keyboard-shortcuts' },
    { slug: 'FAQ' },
  ]},
];

const allSlugs = docCategories.flatMap(cat => cat.docs.map(d => d.slug));
const missing = [];
const existing = [];

for (const slug of allSlugs) {
  // Skip special routes
  if (slug === 'swagger' || slug.startsWith('api/')) {
    console.log(`⏭️  Skipping special route: ${slug}`);
    continue;
  }
  
  const filePath = path.join('public', slug + '.md');
  if (!fs.existsSync(filePath)) {
    missing.push(slug);
  } else {
    existing.push(slug);
  }
}

console.log('\n📊 Documentation File Status:\n');
console.log(`✅ Existing files (${existing.length}):`);
existing.forEach(slug => console.log(`   - ${slug}.md`));

console.log(`\n❌ Missing files (${missing.length}):`);
missing.forEach(slug => console.log(`   - ${slug}.md`));

if (missing.length === 0) {
  console.log('\n✅ All documentation files exist!');
} else {
  console.log(`\n⚠️  ${missing.length} documentation file(s) need to be created.`);
}
