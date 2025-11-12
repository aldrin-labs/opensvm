#!/usr/bin/env node

/**
 * CLI Script to create an API key and generate auth link
 * Usage: node scripts/create-api-key.js [options]
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function createApiKey(options = {}) {
  const {
    name = 'CLI Tool',
    permissions = ['read:*'],
    expiresInDays,
    generateAuthLink = true,
  } = options;

  try {
    console.log('🔑 Creating API key...\n');

    const response = await fetch(`${API_BASE_URL}/api/auth/api-keys/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        permissions,
        expiresInDays,
        generateAuthLink,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create API key');
    }

    const data = await response.json();

    console.log('✅ API Key Created Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Name:        ${data.apiKey.name}`);
    console.log(`🆔 ID:          ${data.apiKey.id}`);
    console.log(`📅 Created:     ${new Date(data.apiKey.createdAt).toLocaleString()}`);
    if (data.apiKey.expiresAt) {
      console.log(`⏰ Expires:     ${new Date(data.apiKey.expiresAt).toLocaleString()}`);
    }
    console.log(`🔐 Status:      ${data.apiKey.status}`);
    console.log(`🎫 Permissions: ${data.apiKey.permissions.join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔑 API KEY (save this - it will not be shown again):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\x1b[33m${data.rawKey}\x1b[0m`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (data.authLink) {
      console.log('🔗 WALLET BINDING LINK:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`\x1b[36m${data.authLink}\x1b[0m`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('📝 Instructions:');
      console.log('   1. Open the link above in your browser');
      console.log('   2. Connect your Solana wallet');
      console.log('   3. Sign the message to bind your wallet to this API key');
      if (data.authLinkExpiresAt) {
        console.log(`   ⏰ Link expires: ${new Date(data.authLinkExpiresAt).toLocaleString()}\n`);
      }
    }

    console.log('💡 Usage Examples:\n');
    console.log('   # Set as environment variable');
    console.log(`   export OPENSVM_API_KEY="${data.rawKey}"\n`);
    console.log('   # Use in curl');
    console.log(`   curl -H "Authorization: Bearer ${data.rawKey}" ${API_BASE_URL}/api/...\n`);
    console.log('   # Use in Node.js');
    console.log(`   const apiKey = "${data.rawKey}";`);
    console.log(`   fetch('${API_BASE_URL}/api/...', {`);
    console.log(`     headers: { 'Authorization': \`Bearer \${apiKey}\` }`);
    console.log('   });\n');

    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--name' && args[i + 1]) {
    options.name = args[i + 1];
    i++;
  } else if (arg === '--expires' && args[i + 1]) {
    options.expiresInDays = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--no-auth-link') {
    options.generateAuthLink = false;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
OpenSVM API Key Generator

Usage: node scripts/create-api-key.js [options]

Options:
  --name <name>        Name for the API key (default: "CLI Tool")
  --expires <days>     Expiration in days (default: never)
  --no-auth-link       Don't generate wallet binding link
  --help, -h           Show this help message

Examples:
  # Create API key with default settings
  node scripts/create-api-key.js

  # Create API key with custom name
  node scripts/create-api-key.js --name "My Bot"

  # Create API key that expires in 30 days
  node scripts/create-api-key.js --expires 30

  # Create API key without auth link
  node scripts/create-api-key.js --no-auth-link
`);
    process.exit(0);
  }
}

// Run the script
createApiKey(options);
