const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('public/openapi.json', 'utf8'));

console.log('🔍 Checking endpoint-specific response schemas:\n');

const endpointsToCheck = [
  { path: '/api/account-stats/{address}', expected: 'AccountStatsResponse' },
  { path: '/api/getAnswer', expected: 'AIAnswerResponse' },
  { path: '/api/transaction/batch', expected: 'TransactionListResponse' },
  { path: '/api/blocks/{slot}', expected: 'BlockResponse' },
  { path: '/api/account-portfolio/{address}', expected: 'AccountPortfolioResponse' },
  { path: '/api/nft-collections', expected: 'NFTCollectionsResponse' },
  { path: '/api/search', expected: 'SearchResponse' },
  { path: '/api/token-metadata/batch', expected: 'TokenMetadataResponse' },
  { path: '/api/program-registry/{programId}', expected: 'ProgramInfoResponse' }
];

let allCorrect = true;

endpointsToCheck.forEach(({ path, expected }) => {
  const endpoint = spec.paths[path];
  if (!endpoint) {
    console.log(`❌ ${path} - NOT FOUND`);
    allCorrect = false;
    return;
  }
  
  const method = endpoint.get || endpoint.post;
  const schema = method?.responses?.['200']?.content?.['application/json']?.schema;
  const ref = schema?.$ref;
  
  if (ref === `#/components/schemas/${expected}`) {
    console.log(`✅ ${path}`);
    console.log(`   Response: ${expected}`);
  } else {
    console.log(`❌ ${path}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Got: ${ref || 'No schema'}`);
    allCorrect = false;
  }
  console.log('');
});

// Check that schema definitions exist
console.log('📋 Checking schema definitions:\n');
const requiredSchemas = [
  'AccountStatsResponse',
  'AccountPortfolioResponse',
  'TransactionResponse',
  'TransactionListResponse',
  'BlockResponse',
  'DeFiOverviewResponse',
  'NFTCollectionsResponse',
  'SearchResponse',
  'AIAnswerResponse',
  'MarketDataResponse',
  'TokenMetadataResponse',
  'ProgramInfoResponse'
];

let allSchemasExist = true;
requiredSchemas.forEach(schemaName => {
  if (spec.components?.schemas?.[schemaName]) {
    console.log(`✅ ${schemaName} defined`);
  } else {
    console.log(`❌ ${schemaName} MISSING`);
    allSchemasExist = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allCorrect && allSchemasExist) {
  console.log('✅ All endpoint-specific schemas correctly applied!');
  console.log('✅ All schema definitions exist!');
} else {
  console.log('⚠️  Some schemas need fixing');
  if (!allCorrect) console.log('   - Some endpoints have incorrect schema references');
  if (!allSchemasExist) console.log('   - Some schema definitions are missing');
}
