#!/usr/bin/env node

/**
 * Environment Variable Size Analyzer
 * Analyzes the size of environment variables to help identify which ones
 * are contributing to the 4KB Lambda limit.
 */

function analyzeEnvVars() {
    const envVars = process.env;
    const analysis = [];
    let totalSize = 0;

    // Common Netlify environment variables that might be large
    const commonVars = [
        'OPENSVM_RPC_LIST',
        'OPENSVM_RPC_LIST_2',
        'TOGETHER_API_KEY',
        'NETLIFY_DATABASE_URL',
        'NETLIFY_DATABASE_URL_UNPOOLED',
        'NETLIFY_EMAILS_SECRET',
        'NETLIFY_EMAILS_DIRECTORY'
    ];

    commonVars.forEach(varName => {
        const value = envVars[varName] || '';
        const size = Buffer.byteLength(value, 'utf8');
        totalSize += size;

        analysis.push({
            name: varName,
            size: size,
            sizeFormatted: `${size} bytes`,
            exists: !!envVars[varName],
            preview: value.length > 50 ? value.substring(0, 50) + '...' : value
        });
    });

    console.log('Environment Variable Size Analysis');
    console.log('=====================================');
    console.log('');

    analysis
        .sort((a, b) => b.size - a.size)
        .forEach(item => {
            console.log(`${item.name}:`);
            console.log(`  Size: ${item.sizeFormatted}`);
            console.log(`  Exists: ${item.exists}`);
            if (item.exists && item.preview) {
                console.log(`  Preview: ${item.preview}`);
            }
            console.log('');
        });

    console.log(`Total size of analyzed variables: ${totalSize} bytes`);
    console.log(`AWS Lambda limit: 4096 bytes (4KB)`);
    console.log(`Remaining capacity: ${4096 - totalSize} bytes`);

    if (totalSize > 4096) {
        console.log('⚠️  WARNING: Environment variables exceed 4KB limit!');
        console.log('');
        console.log('Recommendations:');
        console.log('1. Use build-time configuration instead of environment variables');
        console.log('2. Store large configuration in external files or databases');
        console.log('3. Use shorter endpoint IDs or compressed formats');
    } else {
        console.log('✅ Environment variables are within the 4KB limit');
    }
}

if (require.main === module) {
    analyzeEnvVars();
}

module.exports = { analyzeEnvVars };
