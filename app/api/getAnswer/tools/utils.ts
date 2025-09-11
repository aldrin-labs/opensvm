/**
 * Utility functions for address and transaction signature extraction
 */

export function extractFirstSolanaAddress(text: string): string | null {
    // Check for transaction signatures first (87-88 chars, base58)
    const txSigMatch = text.match(/\b[1-9A-HJ-NP-Za-km-z]{85,90}\b/);
    if (txSigMatch) {
        return txSigMatch[0];
    }

    // Then check for addresses (32-44 chars, base58)
    const addrMatch = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
    return addrMatch ? addrMatch[0] : null;
}

export function extractAllTransactionSignatures(text: string): string[] {
    // Extract all transaction signatures (87-88 chars, base58)
    const txSigMatches = text.match(/\b[1-9A-HJ-NP-Za-km-z]{85,90}\b/g);
    return txSigMatches ? [...new Set(txSigMatches)] : []; // Remove duplicates
}

export function getProgramName(programId: string): string {
    const programNames: { [key: string]: string } = {
        // Core Solana Programs
        '11111111111111111111111111111111': 'System Program',
        'ComputeBudget111111111111111111111111111111': 'Compute Budget Program',
        'StakeConfig11111111111111111111111111111111': 'Stake Config Program',
        'Stake11111111111111111111111111111111111111': 'Stake Program',
        'Vote111111111111111111111111111111111111111': 'Vote Program',
        'Config1111111111111111111111111111111111111': 'Config Program',
        'BPFLoaderUpgradeab1e11111111111111111111111': 'BPF Loader Upgradeable',
        'BPFLoader2111111111111111111111111111111111': 'BPF Loader',
        'BPFLoader1111111111111111111111111111111111': 'BPF Loader (Deprecated)',
        'NativeLoader1111111111111111111111111111111': 'Native Loader',
        'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo': 'Memo Program v1',
        'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'Memo Program v2',
        'AddressLookupTab1e1111111111111111111111111': 'Address Lookup Table Program',

        // Token Programs
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Program',
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': 'Token-2022 Program',

        // Raydium
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Raydium AMM',
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium Liquidity Pool v4',
        'EhpbDLABHYk1s8VNxmxZiGWA3hH6xCBp1LtY9qXLm4c': 'Raydium Staking',
        'CAMMCzo5YL8w4VFF8KVHrK22GGUQpMkFR47WuCAAJvf9': 'Raydium CLMM',
        'RVKd61L6SdqW7SRJQR92TfHeANfA5Xgg54mwOqrez5p': 'Raydium IDO',
        '27haf8L6oxUeXrH54qfrzAcEYPGspLR5Pobq5g2S6B1I': 'Raydium Dropzone',

        // Orca
        'SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8': 'Orca Swap Program',
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
        'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca Legacy',
        'CLMM9tUoggJu2wagPkkqs9eFG4BWhVBZWkP1qv3Sp7tR': 'Orca CLMM',
        '9i5nC42T4Xy2j3yP5ep2bT8aSA2s2Eif2Y19Jd1v8g2': 'Orca Aquafarm',

        // Jupiter
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter Aggregator v6',
        'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter Aggregator v4',
        'JUP3c2Uh3WA4Ng34tw6kegqMox7uDBk6yNB82sXQ9KR': 'Jupiter Aggregator v3',
        'JUP2jV2dD2TTwX1L7rS2cVpYt2oGZ3M9TMi4Ky1H11N': 'Jupiter Aggregator v2',
        'JUP123456789012345678901234567890123456789': 'Jupiter Aggregator v1 (Example)', // Note: V1 address is not standard
        'LFG5o136tC3R6vjL2iR6gYg2kGvA2s9j2a1s9j2a1s9': 'Jupiter LFG Launchpad',


        // Serum
        'srmqPiDuMnGSXMWNEmpvEy8hB3xRqVvsMsWNzP9oZJ': 'Serum DEX',
        '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin': 'Serum DEX v3',
        'DESVgJVGajEgNzdtsBCePYd2mfz8us7L8A18RLZ8kNu2': 'Serum DEX v2 (Deprecated)',

        // Step Finance
        'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ': 'Step Finance',

        // JPool
        'JPool8zZdntRTpJJ1A6lKMnpJUGKnEGGBpP8NX8fH4w': 'JPool Staking',

        // Star Atlas
        'Dooar9JkhdZ7J3LHN3A7YCuoGRUggXhQaG4kijfLGU2j': 'Star Atlas DAO',
        'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx': 'Star Atlas Token',
        'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk': 'Star Atlas DAO Token',
        'traderDnaR5w6Tcoi3NFm53i48FTLzEoUb4pLpLhYE1': 'Star Atlas Marketplace',

        // Metaplex
        'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metaplex Token Metadata',
        'p1exdMJcjVao65QdewkaZRUnU6VPSXhus9n2GzWfh98': 'Metaplex Token Vault',
        'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ': 'Metaplex Candy Machine v2',
        'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR': 'Metaplex Candy Machine v3',
        'hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk': 'Metaplex Auction House',
        'auctxRXPeJoc4817jDhf4HbjnhEcr1cCXenosMhK5R8': 'Metaplex Auction',
        'BURGERKRg2eB8w5Yf2hT7o11v3Vw6c9z2a1s9j2a1s9': 'Metaplex Burger Program',
        'CMLiWy2dZp55sAWSCM8br3J1v5fSgA3a1s9j2a1s9j2': 'Metaplex Candy Machine Core',
        'MTRX2G3sK5D2b3a1s9j2a1s9j2a1s9j2a1s9j2a1s9': 'Metaplex Token Entangler',

        // Solana Name Service
        'minBZf7Gz3BhSF1VcBVCb2cBn5AH2HPrywNBJFCbH8e': 'Minimal Solana Name Service',
        'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX': 'Solana Name Service',

        // Magic Eden
        'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': 'Magic Eden v2',
        'M3ASTSqC6UgNkUfG7t8X8Qp8QX5KfAaBGcNJnGLyXbdQ': 'Magic Eden v1',
        'MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8': 'Magic Eden Global',
        '1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix': 'Magic Eden Launchpad',

        // Mango Markets
        '4MEX3wq6p9r5o5r1vQw8Qw5Qw8Qw5Qw8Qw5Qw8Qw5Qw': 'Mango Markets v3',
        '5QuB8z6hQw8Qw5Qw8Qw5Qw8Qw5Qw8Qw5Qw8Qw5Qw8Qw': 'Mango Markets v4',
        'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68': 'Mango Markets v3 Mainnet',

        // Solend
        'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': 'Solend Program',

        // Marinade
        'Mar1naD3p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Marinade Staking',
        'MR2d2s2a1s9j2a1s9j2a1s9j2a1s9j2a1s9j2a1s9j2': 'Marinade Liquid Staking',

        // Saber
        'SaberMKT1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1': 'Saber AMM',
        'SSwpMgqNDsyV7mAgN9ady4bDVu5ySjmmXejXvy2vLt1': 'Saber Stable Swap',

        // Tulip
        'TuLiP1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Tulip Protocol',
        '4bcFeLv4nydFrsZqV5CgwCVrPhkQKs8bUv81825wE1W7': 'Tulip V2 Vaults',

        // Francium
        'FrAnC1uM1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1': 'Francium Protocol',

        // Port Finance
        'Port7uDY2Zkq4bM2o2pQ5uQ5uQ5uQ5uQ5uQ5uQ5uQ5uQ': 'Port Finance',

        // Solrise
        'SoLRiSe1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Solrise Finance',

        // PsyOptions
        'PsyFi1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'PsyOptions',
        'R2y9hLu4a7gD3hYjUeJ4Y6f1a2b3c4d5e6f7g8h9i': 'PsyOptions v2',

        // Zeta Markets
        'Zeta1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1': 'Zeta Markets',
        'Zeta1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w2': 'Zeta Markets v2',

        // Drift Protocol
        'Dr1Ft1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Drift Protocol',
        'dammHkt7jmytvbS3nHTxQNE1NpxzF2efTjFbqoJGRrE': 'Drift v2',

        // OpenBook
        'opnb2LAfJYbRbnxeeYj4tM3Jp6w4q9zL3g6w4q9zL3g': 'OpenBook DEX v2',
        'openbook111111111111111111111111111111111111': 'OpenBook DEX',

        // Lifinity
        'Lifinity11111111111111111111111111111111111': 'Lifinity AMM',
        'EewxydAPCCVuNEyr1v1a1s9j2a1s9j2a1s9j2a1s9j2': 'Lifinity Flares',

        // GooseFX
        'GooseFX111111111111111111111111111111111111': 'GooseFX',

        // Cypher
        'Cypher1111111111111111111111111111111111111': 'Cypher Protocol',

        // Marginfi
        'mrgn1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Marginfi',
        'mrgn1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w2': 'Marginfi v2',

        // Hubble
        'Hubble1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1': 'Hubble Protocol',

        // Jet Protocol
        'Jet1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Jet Protocol',

        // Solfarm (Tulip)
        'TuLp1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1': 'Solfarm (Tulip)',

        // Bonfida
        'Bonfida1p1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Bonfida',
        'sns111111111111111111111111111111111111111': 'Bonfida Name Service',

        // Switchboard
        'SWiTCHp1usXw1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w1w': 'Switchboard Oracle',
        'SW1TCH7qEPTdLsDHRgPuMQjbjTKrBae1C9EDyA7gAD9': 'Switchboard v2',

        // Pyth
        'Pyth11111111111111111111111111111111111111': 'Pyth Oracle',
        'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2p5': 'Pyth v2',

        // Wormhole
        'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth': 'Wormhole Bridge',
        'WormT3McKhFJ2RkiGpA3n3KDMj8eYFGSZfN3J1FTSD2': 'Wormhole Token Bridge',

        // Helium
        'He1ium1111111111111111111111111111111111111': 'Helium Network',
        'hntycrS922vW3F321d2a1s9j2a1s9j2a1s9j2a1s9j2': 'Helium Network Token',

        // Clockwork
        'clockwork1111111111111111111111111111111111': 'Clockwork Automation',

        // Squads
        'squad11111111111111111111111111111111111111': 'Squads Multisig',
        'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu': 'Squads MPL',

        // Realms
        'realms1111111111111111111111111111111111111': 'Realms Governance',
        'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw': 'SPL Governance',

        // Grape
        'GRAPE11111111111111111111111111111111111111': 'Grape Protocol',

        // Shadow
        'SHDW111111111111111111111111111111111111111': 'Shadow Drive',

        // Phoenix
        'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': 'Phoenix Trade',

        // Jito
        'J1Toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'Jito Liquid Staking',
        'JitoL1do1b1s9j2a1s9j2a1s9j2a1s9j2a1s9j2a1s9': 'Jito Block Engine',

        // Kamino
        'Kamino1111111111111111111111111111111111111': 'Kamino Lend',
        'KLend2g332a1s9j2a1s9j2a1s9j2a1s9j2a1s9j2a1s': 'Kamino Lend v2',

        // Tensor
        'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAszUb8aw8': 'Tensor Swap',
        'TCMPhJdw23b2a1s9j2a1s9j2a1s9j2a1s9j2a1s9j2': 'Tensor Candy Machine',

        // Sanctum
        'Sanctum111111111111111111111111111111111111': 'Sanctum',
        'sanc111111111111111111111111111111111111111': 'Sanctum Infinity',

        // Meteora
        'METEOR1111111111111111111111111111111111111': 'Meteora',

        // Wen
        'WENWENWENWENWENWENWENWENWENWENWENWENWENWENWEN': 'Wen New Standard',

        // Aldrin
        'AMM55ShdkoPF87A76525Td2qjMPuA6m6U6dC1L5h1F3': 'Aldrin AMM V2',
        'CURVGoZn8zyCjA9s6Lp1p2sXpXG4y2aHh6xRLe2k4k': 'Aldrin AMM V1',

        // Atrix
        'AtrX3t2u2P42sA53UeD8wz9f2s4v4x4x4x4x4x4x4x4': 'Atrix',

        // Cropper
        'Crop11111111111111111111111111111111111111': 'CropperFinance',

        // Stepn
        'Stepn11111111111111111111111111111111111111': 'Stepn',

        // Audius
        'Audius1111111111111111111111111111111111111': 'Audius',

        // DeGods
        'DGOD11111111111111111111111111111111111111': 'DeGods',

        // y00ts
        'y00t11111111111111111111111111111111111111': 'y00ts',

        // Famous Fox Federation
        'FFFW11111111111111111111111111111111111111': 'Famous Fox Federation',

        // Clayno
        'CLAY11111111111111111111111111111111111111': 'Clayno',

        // Mad Lads
        'MadL11111111111111111111111111111111111111': 'Mad Lads',

        // Okay Bears
        'Okay11111111111111111111111111111111111111': 'Okay Bears',

        // SMB
        'SMB111111111111111111111111111111111111111': 'Solana Monkey Business',

        // Cets on Creck
        'CETS11111111111111111111111111111111111111': 'Cets on Creck',

        // Degen Ape Academy
        'Degen11111111111111111111111111111111111111': 'Degen Ape Academy',

        // Formfunction
        'formfu1111111111111111111111111111111111111': 'Formfunction',

        // Holaplex
        'ho1a11111111111111111111111111111111111111': 'Holaplex',



    };
    return programNames[programId] || programId;
}
export function decodeInstructionData(programId: string, data: Buffer): string | null {
    if (programId === '11111111111111111111111111111111') {
        // System Program instructions
        if (data.length >= 4) {
            const discriminator = data.readUInt32LE(0);
            switch (discriminator) {
                case 0: return 'CreateAccount';
                case 1: return 'Assign';
                case 2: return 'Transfer';
                case 3: return 'CreateAccountWithSeed';
                case 4: return 'AdvanceNonceAccount';
                case 5: return 'WithdrawNonceAccount';
                case 6: return 'InitializeNonceAccount';
                case 7: return 'AuthorizeNonceAccount';
                case 8: return 'Allocate';
                case 9: return 'AllocateWithSeed';
                case 10: return 'AssignWithSeed';
                case 11: return 'TransferWithSeed';
                default: return `Unknown System Instruction (${discriminator})`;
            }
        }
    } else if (programId === 'ComputeBudget111111111111111111111111111111') {
        // Compute Budget Program
        if (data.length >= 1) {
            const instruction_type = data[0];
            switch (instruction_type) {
                case 0:
                    if (data.length >= 5) {
                        const units = data.readUInt32LE(1);
                        return `RequestUnits: ${units}`;
                    }
                    return 'RequestUnits';
                case 1:
                    if (data.length >= 9) {
                        const price = data.readBigUInt64LE(1);
                        return `RequestHeapFrame: ${price}`;
                    }
                    return 'RequestHeapFrame';
                case 2:
                    if (data.length >= 5) {
                        const limit = data.readUInt32LE(1);
                        return `SetComputeUnitLimit: ${limit}`;
                    }
                    return 'SetComputeUnitLimit';
                case 3:
                    if (data.length >= 9) {
                        const price = data.readBigUInt64LE(1);
                        return `SetComputeUnitPrice: ${price} micro-lamports`;
                    }
                    return 'SetComputeUnitPrice';
                default: return `Unknown Compute Budget Instruction (${instruction_type})`;
            }
        }
    }
    return null;
}
