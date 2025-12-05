#!/usr/bin/env bun
/**
 * Official MCP Registry Compatibility Tests
 *
 * Validates that our servers conform to the official MCP Registry schema:
 * https://github.com/modelcontextprotocol/registry
 */

import {
  OPENSVM_SERVER,
  DFLOW_SERVER,
  GATEWAY_SERVER,
  validateServer,
  generateServerJson,
  generateWellKnownServers,
  convertToOfficialFormat,
  MCP_SCHEMA_VERSION,
} from '../src/mcp-registry-official.js';

import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('Official MCP Registry Compatibility Tests');
  console.log('Schema Version:', MCP_SCHEMA_VERSION);
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  // Test 1: Validate OpenSVM Server
  try {
    console.log('\n1. Validate OpenSVM Server');
    const result = validateServer(OPENSVM_SERVER);
    if (result.valid) {
      console.log('   ✅ OpenSVM server schema is valid');
      console.log(`      Name: ${OPENSVM_SERVER.name}`);
      console.log(`      Version: ${OPENSVM_SERVER.version}`);
      console.log(`      Packages: ${OPENSVM_SERVER.packages?.length || 0}`);
      console.log(`      Remotes: ${OPENSVM_SERVER.remotes?.length || 0}`);
      passed++;
    } else {
      console.log('   ❌ Validation errors:');
      result.errors.forEach(e => console.log(`      - ${e}`));
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 2: Validate DFlow Server
  try {
    console.log('\n2. Validate DFlow Server');
    const result = validateServer(DFLOW_SERVER);
    if (result.valid) {
      console.log('   ✅ DFlow server schema is valid');
      console.log(`      Name: ${DFLOW_SERVER.name}`);
      console.log(`      Version: ${DFLOW_SERVER.version}`);
      passed++;
    } else {
      console.log('   ❌ Validation errors:');
      result.errors.forEach(e => console.log(`      - ${e}`));
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 3: Validate Gateway Server
  try {
    console.log('\n3. Validate Gateway Server');
    const result = validateServer(GATEWAY_SERVER);
    if (result.valid) {
      console.log('   ✅ Gateway server schema is valid');
      console.log(`      Name: ${GATEWAY_SERVER.name}`);
      console.log(`      Aggregates: ${(GATEWAY_SERVER._meta as any)?.aggregatedServers?.join(', ')}`);
      passed++;
    } else {
      console.log('   ❌ Validation errors:');
      result.errors.forEach(e => console.log(`      - ${e}`));
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 4: Validate server.json files
  try {
    console.log('\n4. Validate server.json Files');
    const files = ['server.json', 'dflow-server.json', 'gateway-server.json'];
    let allValid = true;

    for (const file of files) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const result = validateServer(content);
        if (result.valid) {
          console.log(`   ✅ ${file} is valid`);
        } else {
          console.log(`   ❌ ${file} has errors: ${result.errors.join(', ')}`);
          allValid = false;
        }
      } else {
        console.log(`   ⚠️ ${file} not found`);
      }
    }

    if (allValid) passed++; else failed++;
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 5: Name Format (Reverse-DNS)
  try {
    console.log('\n5. Name Format Validation');
    const servers = [OPENSVM_SERVER, DFLOW_SERVER, GATEWAY_SERVER];
    let allCorrect = true;

    for (const server of servers) {
      const slashCount = (server.name.match(/\//g) || []).length;
      const hasDomain = server.name.includes('.');

      if (slashCount === 1 && hasDomain) {
        console.log(`   ✅ ${server.name} - correct reverse-DNS format`);
      } else {
        console.log(`   ❌ ${server.name} - incorrect format`);
        allCorrect = false;
      }
    }

    if (allCorrect) passed++; else failed++;
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 6: Semver Version
  try {
    console.log('\n6. Semantic Versioning');
    const servers = [OPENSVM_SERVER, DFLOW_SERVER, GATEWAY_SERVER];
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    let allValid = true;

    for (const server of servers) {
      if (semverRegex.test(server.version)) {
        console.log(`   ✅ ${server.name}: v${server.version}`);
      } else {
        console.log(`   ❌ ${server.name}: ${server.version} is not valid semver`);
        allValid = false;
      }
    }

    if (allValid) passed++; else failed++;
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 7: Package Configuration
  try {
    console.log('\n7. Package Configuration');
    const servers = [OPENSVM_SERVER, DFLOW_SERVER, GATEWAY_SERVER];
    let allValid = true;

    for (const server of servers) {
      if (server.packages && server.packages.length > 0) {
        const pkg = server.packages[0];
        const hasRequired = pkg.registryType && pkg.identifier && pkg.transport;
        if (hasRequired) {
          console.log(`   ✅ ${server.name}: ${pkg.registryType}:${pkg.identifier}`);
        } else {
          console.log(`   ❌ ${server.name}: missing required package fields`);
          allValid = false;
        }
      }
    }

    if (allValid) passed++; else failed++;
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 8: Generate JSON
  try {
    console.log('\n8. JSON Generation');
    const json = generateServerJson(OPENSVM_SERVER);
    const parsed = JSON.parse(json);

    if (parsed.$schema === MCP_SCHEMA_VERSION && parsed.name === OPENSVM_SERVER.name) {
      console.log('   ✅ JSON generation works correctly');
      console.log(`      Size: ${json.length} bytes`);
      passed++;
    } else {
      console.log('   ❌ JSON generation failed');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 9: Well-Known Endpoint
  try {
    console.log('\n9. Well-Known Endpoint Generation');
    const wellKnown = generateWellKnownServers();

    if (wellKnown.servers.length === 3 && wellKnown.registry && wellKnown.updated) {
      console.log('   ✅ .well-known/mcp-servers.json generated');
      console.log(`      Servers: ${wellKnown.servers.length}`);
      console.log(`      Registry: ${wellKnown.registry}`);
      passed++;
    } else {
      console.log('   ❌ Well-known generation failed');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 10: Convert Internal Format
  try {
    console.log('\n10. Convert Internal Format');
    const internal = {
      id: 'custom-server',
      name: 'Custom MCP Server',
      version: '1.0.0',
      description: 'A custom server',
      baseUrl: 'https://custom.example.com',
      transport: 'http',
      tags: ['custom', 'test'],
    };

    const official = convertToOfficialFormat(internal);
    const result = validateServer(official);

    if (official.name === 'ai.osvm/custom-server' && result.valid) {
      console.log('   ✅ Conversion to official format works');
      console.log(`      Internal: ${internal.id} → Official: ${official.name}`);
      passed++;
    } else {
      console.log('   ❌ Conversion failed');
      if (!result.valid) {
        result.errors.forEach(e => console.log(`      - ${e}`));
      }
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));

  console.log('\nServer Summary:');
  console.log('┌────────────────────────────┬─────────┬───────┬─────────┐');
  console.log('│ Server                     │ Version │ Tools │ Remote  │');
  console.log('├────────────────────────────┼─────────┼───────┼─────────┤');
  console.log(`│ ${OPENSVM_SERVER.name.padEnd(26)} │ ${OPENSVM_SERVER.version.padEnd(7)} │  34   │ HTTP    │`);
  console.log(`│ ${DFLOW_SERVER.name.padEnd(26)} │ ${DFLOW_SERVER.version.padEnd(7)} │  23   │ HTTP    │`);
  console.log(`│ ${GATEWAY_SERVER.name.padEnd(26)} │ ${GATEWAY_SERVER.version.padEnd(7)} │  62   │ HTTP    │`);
  console.log('└────────────────────────────┴─────────┴───────┴─────────┘');

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

  if (failed === 0) {
    console.log('\n✅ All servers are compatible with official MCP Registry!');
    console.log('\nTo publish to the registry, use:');
    console.log('  mcp-publisher --file server.json');
    process.exit(0);
  } else {
    console.log('\n❌ Some compatibility tests failed');
    process.exit(1);
  }
}

runTests().catch(console.error);
