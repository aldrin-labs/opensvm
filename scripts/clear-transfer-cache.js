#!/usr/bin/env node

/**
 * SVMAI Token Flow Trace
 * From Mint to Target Address: 5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85
 */

const TARGET = '5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85';
const MINT = 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
const ORIGIN = 'EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC'; // Token Creation Address

console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║                     SVMAI TOKEN DISTRIBUTION TRACE                       ║');
console.log('║                  From Mint to Target Address Flow                        ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

console.log('TOKEN: SVMAI (Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump)');
console.log('TARGET: 5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85\n');

console.log('═══════════════════════════════════════════════════════════════════════════\n');

console.log('📊 COMPLETE TOKEN FLOW DIAGRAM:\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🏦 ORIGIN/MINT (Dec 26, 2024 10:51:22 UTC)');
console.log('   EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC');
console.log('   │');
console.log('   └─→ [31,151,612 SVMAI] ──→ 7q34BaA8vaNnqKMnzF8DtoxtveKSNcgKEUBSy72pgNng');
console.log('                                │');
console.log('                                ├─→ [206,900,000 SVMAI] ──→ 39azUYFWPz3V...');
console.log('                                ├─→ [19,645,001 SVMAI] ──→ C3nLTNMK6Ao1...');
console.log('                                ├─→ [13,096,051 SVMAI] ──→ BDmCUQiWkLjA...');
console.log('                                ├─→ [8,119,790 SVMAI] ──→ EK5U1h7VM2Lt...');
console.log('                                ├─→ [3,709,052 SVMAI] ──→ BoUaRS7YH6vC...');
console.log('                                ├─→ [3,542,108 SVMAI] ──→ GSBVPCkx1Atu...');
console.log('                                └─→ [21,658,962 SVMAI] ──→ BUZZ5JEG9NLQY4RAFt5fLPiYBZVbXtQ3YTSjd5bMsfsf');
console.log('                                       │');
console.log('                                       ├─→ [478,083 SVMAI] ──→ 5Q544fKrFoe6...');
console.log('                                       ├─→ [478,083 SVMAI] ──→ 5Q544fKrFoe6...');
console.log('                                       ├─→ [4,503,222 SVMAI] ──→ 5Q544fKrFoe6...');
console.log('                                       ├─→ Others to various addresses');
console.log('                                       │');
console.log('                                       └─→ [16,000,000 SVMAI] ────────────────────┐');
console.log('                                          (Jan 1, 2025 01:05:19)                   │');
console.log('                                                                                   │');
console.log('🎯 PATH #1: Direct from BUZZ → TARGET                                            │');
console.log('                                                                                   │');
console.log('                                                                                   ▼');
console.log('                                                              5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85');
console.log('                                                                                   ▲');
console.log('                                                                                   │');
console.log('🎯 PATH #2: Via yaoirE                                                            │');
console.log('                                                                                   │');
console.log('   Various sources ──→ yaoirENLXP5Bus1NzqCahqu3izcagpDhbvJ4YQ5z26T              │');
console.log('   │                      │                                                       │');
console.log('   ├─ 6U91aKa... (482,703 + 4,361,357)                                           │');
console.log('   ├─ 4xDsmeT... (999,863 + 2,069,905)                                           │');
console.log('   ├─ 2MFoS3M... (945,740)                                                        │');
console.log('   ├─ CapuXNQ... (584,751)                                                        │');
console.log('   ├─ 9nnLbot... (224,644)                                                        │');
console.log('   └─ 5Q544fK... (105,376 + 304,028)                                             │');
console.log('                      │                                                           │');
console.log('                      └─→ [9,066,991 SVMAI] ────────────────────────────────────┘');
console.log('                         (Jan 5, 2025 05:42:36)');
console.log('                                                                                   ▲');
console.log('🎯 PATH #3: Via CQetL5o                                                           │');
console.log('                                                                                   │');
console.log('   5Q544fKrFoe6... ──→ CQetL5oDJV34dwSzZV3Q4SiE5ZtgrL9msV2QYC7v8oTX            │');
console.log('   (Multiple transfers)    │                                                      │');
console.log('                           └─→ [4,576 SVMAI] ──────────────────────────────────┘');
console.log('                              (Jul 6, 2025 15:44:22)');
console.log('                                                                                   ▲');
console.log('🎯 PATH #4: Via CradPJy4 (Most Recent & Largest)                                 │');
console.log('                                                                                   │');
console.log('   5Q544fKrFoe6... ──→ CradPJy4PK2svXZeU3N4JpNg78bBbQfNZsXToCrcGE77            │');
console.log('   (Multiple Jupiter swaps)   │                                                   │');
console.log('                               ├─→ [25,481,172 SVMAI] ──→ REVXui3vBCcs...');
console.log('                               └─→ [18,452,280 SVMAI] ───────────────────────────┘');
console.log('                                   (Nov 12, 2025 06:55:26) [MOST RECENT]');
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📈 SUMMARY:\n');
console.log('┌─────────────────────────────────────────────────────────────────────────┐');
console.log('│ Origin Address (Mint):                                                  │');
console.log('│   EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC                          │');
console.log('│                                                                         │');
console.log('│ Initial Distribution: Dec 26, 2024 @ 10:51:22 UTC                      │');
console.log('│   Amount: 31,151,612 SVMAI                                             │');
console.log('│                                                                         │');
console.log('│ Primary Distributor:                                                    │');
console.log('│   7q34BaA8vaNnqKMnzF8DtoxtveKSNcgKEUBSy72pgNng                          │');
console.log('│                                                                         │');
console.log('│ Key Hub Addresses:                                                      │');
console.log('│   • BUZZ5JEG9NLQY4RAFt5fLPiYBZVbXtQ3YTSjd5bMsfsf                       │');
console.log('│   • 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 (Major Jupiter hub)   │');
console.log('│   • yaoirENLXP5Bus1NzqCahqu3izcagpDhbvJ4YQ5z26T                       │');
console.log('│   • CradPJy4PK2svXZeU3N4JpNg78bBbQfNZsXToCrcGE77                       │');
console.log('│                                                                         │');
console.log('│ Target Address Received (Total):                                        │');
console.log('│   5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85                          │');
console.log('│                                                                         │');
console.log('│   Incoming Transfers:                                                   │');
console.log('│   ├─ 18,452,280.04 SVMAI from CradPJy4... (Nov 12, 2025)               │');
console.log('│   ├─  9,066,991.20 SVMAI from yaoirE... (Jan 5, 2025)                  │');
console.log('│   ├─ 16,000,000.00 SVMAI from BUZZ5JE... (Jan 1, 2025)                 │');
console.log('│   └─      4,576.27 SVMAI from CQetL5o... (Jul 6, 2025)                 │');
console.log('│                                                                         │');
console.log('│   TOTAL: 43,523,847.51 SVMAI                                           │');
console.log('│                                                                         │');
console.log('│ Token Flow Characteristics:                                             │');
console.log('│   • Single mint event from EQ3iyk... address                            │');
console.log('│   • Distributed through central hub (7q34Ba...)                         │');
console.log('│   • Multiple intermediary addresses for liquidity                       │');
console.log('│   • Heavy Jupiter protocol usage for DEX swaps                          │');
console.log('│   • 4 distinct paths to target address over 10+ months                  │');
console.log('└─────────────────────────────────────────────────────────────────────────┘');

console.log('\n═══════════════════════════════════════════════════════════════════════════\n');

console.log('✅ TRACE COMPLETE!\n');
console.log('The SVMAI token originated from EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC');
console.log('and reached the target address through 4 different distribution paths\n');
console.log('spanning from December 2024 to November 2025.\n');
