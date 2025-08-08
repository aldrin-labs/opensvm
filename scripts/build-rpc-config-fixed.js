#!/usr/bin/env node

/**
 * Build-time RPC configuration script
 * This script runs during build to inject RPC endpoints from environment variables
 * into a static configuration file, avoiding the need to pass large environment
 * variables to Lambda functions.
 */

const fs = require('fs');
const path = require('path');

function parseRpcList(envVar) {
    if (!envVar) return [];
    try {
        const parsed = JSON.parse(envVar);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(id => `https://solana-mainnet.core.chainstack.com/${id}`);
    } catch (e) {
        console.error('Error parsing RPC list:', e);
        return [];
    }
}

function buildRpcConfig() {
    console.log('Building RPC configuration...');

    // Parse RPC lists from environment variables
    const list1 = parseRpcList(process.env.OPENSVM_RPC_LIST);
    const list2 = parseRpcList(process.env.OPENSVM_RPC_LIST_2);

    // Combine all RPC endpoints
    const endpoints = [...list1, ...list2];

    const config = {
        endpoints: endpoints,
        fallbackEndpoints: ['/api/proxy/rpc'],
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        buildTime: new Date().toISOString(),
        totalEndpoints: endpoints.length,
        // Store original IDs for functions that need them
        originalIds: {
            list1: process.env.OPENSVM_RPC_LIST ? JSON.parse(process.env.OPENSVM_RPC_LIST) : [],
            list2: process.env.OPENSVM_RPC_LIST_2 ? JSON.parse(process.env.OPENSVM_RPC_LIST_2) : []
        }
    };

    // Write configuration to file
    const configPath = path.join(__dirname, '../lib/rpc-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('RPC configuration built successfully:');
    console.log('- Total endpoints:', endpoints.length);
    console.log('- Config written to:', configPath);

    // Create a CommonJS module for Netlify functions
    const functionConfigPath = path.join(__dirname, '../lib/rpc-endpoints.js');
    const functionContent = [
        '// Auto-generated RPC configuration for Netlify Functions - DO NOT EDIT MANUALLY',
        '// Generated at build time: ' + config.buildTime,
        '',
        'const rpcConfig = ' + JSON.stringify(config, null, 2) + ';',
        '',
        'function getRpcEndpoints() {',
        '  return rpcConfig.endpoints.length > 0',
        '    ? rpcConfig.endpoints',
        '    : rpcConfig.fallbackEndpoints;',
        '}',
        '',
        'function getRpcHeaders(_url) {',
        '  return rpcConfig.headers;',
        '}',
        '',
        'function getOriginalRpcIds() {',
        '  return rpcConfig.originalIds;',
        '}',
        '',
        '// For functions that need the original format',
        'function getOpensvmRpcList() {',
        '  return rpcConfig.originalIds.list1;',
        '}',
        '',
        'function getOpensvmRpcList2() {',
        '  return rpcConfig.originalIds.list2;',
        '}',
        '',
        'module.exports = {',
        '  rpcConfig,',
        '  getRpcEndpoints,',
        '  getRpcHeaders,',
        '  getOriginalRpcIds,',
        '  getOpensvmRpcList,',
        '  getOpensvmRpcList2,',
        '  // Legacy compatibility',
        '  OPENSVM_RPC_LIST: rpcConfig.originalIds.list1,',
        '  OPENSVM_RPC_LIST_2: rpcConfig.originalIds.list2',
        '};'
    ].join('\n');

    fs.writeFileSync(functionConfigPath, functionContent);
    console.log('Function config written to:', functionConfigPath);

    // Create TypeScript module
    const tsConfigPath = path.join(__dirname, '../lib/rpc-config.ts');
    const tsContent = [
        '// Auto-generated RPC configuration - DO NOT EDIT MANUALLY',
        '// Generated at build time: ' + config.buildTime,
        '',
        'export const rpcConfig = ' + JSON.stringify(config, null, 2) + ' as const;',
        '',
        'export function getRpcEndpoints() {',
        '  return rpcConfig.endpoints.length > 0',
        '    ? rpcConfig.endpoints',
        '    : rpcConfig.fallbackEndpoints;',
        '}',
        '',
        'export function getRpcHeaders(_url: string) {',
        '  return rpcConfig.headers;',
        '}',
        '',
        'export function getOriginalRpcIds() {',
        '  return rpcConfig.originalIds;',
        '}',
        '',
        '// For components that need the original format',
        'export function getOpensvmRpcList() {',
        '  return rpcConfig.originalIds.list1;',
        '}',
        '',
        'export function getOpensvmRpcList2() {',
        '  return rpcConfig.originalIds.list2;',
        '}'
    ].join('\n');

    fs.writeFileSync(tsConfigPath, tsContent);
    console.log('TypeScript config written to:', tsConfigPath);

    // Show size analysis
    const totalSize = Buffer.byteLength(JSON.stringify(config), 'utf8');
    console.log('\nConfiguration file size:', totalSize, 'bytes');
    if (totalSize > 3000) {
        console.log('⚠️  Warning: Configuration is large, consider optimization');
    } else {
        console.log('✅ Configuration size is reasonable for function inclusion');
    }
}

if (require.main === module) {
    buildRpcConfig();
}

module.exports = { buildRpcConfig };
