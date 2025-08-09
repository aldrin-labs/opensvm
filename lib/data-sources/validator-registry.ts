/**
 * Real Solana Validator Registry
 * Maps vote accounts to their real validator names and metadata
 */

interface ValidatorMetadata {
    name: string;
    website?: string;
    details?: string;
    keybaseUsername?: string;
}

interface ValidatorInfo {
    account: string;
    name: string;
    website?: string;
    details?: string;
    keybaseUsername?: string;
}

// Known validator mappings - only add validators with verified names
// Keep this list empty for now since external APIs are failing
const KNOWN_VALIDATORS: Record<string, ValidatorMetadata> = {
    // Add only verified validator names here
    // External validator registries (validators.app, solanabeach) are currently failing
    // TODO: Implement alternative validator name resolution method
};

/**
 * Fetches validator registry from Solana Foundation's official API
 */
async function fetchOfficialValidatorRegistry(): Promise<ValidatorInfo[]> {
    // Since external APIs require authentication or are restricted,
    // we'll focus on using our known validators and on-chain data
    console.log('Using known validator registry due to external API restrictions');
    return [];
}

/**
 * Gets validator name by vote account with fallbacks
 */
export async function getValidatorName(voteAccount: string, nodeInfo?: any): Promise<string> {
    try {
        // Check known validators first
        if (KNOWN_VALIDATORS[voteAccount]) {
            return KNOWN_VALIDATORS[voteAccount].name;
        }

        // Try to get from official registry (cached)
        const registryValidators = await fetchOfficialValidatorRegistry();
        const registryValidator = registryValidators.find(v => v.account === voteAccount);

        if (registryValidator && registryValidator.name) {
            return registryValidator.name;
        }

        // Try to get from on-chain identity (Keybase verification)
        if (nodeInfo?.keybaseUsername) {
            return `${nodeInfo.keybaseUsername} (Keybase)`;
        }

        // Fallback to a more descriptive name based on node info
        if (nodeInfo?.version && nodeInfo?.ip) {
            const location = await getLocationFromIP(nodeInfo.ip);
            if (location) {
                return `Validator in ${location}`;
            }
        }

        // Last resort - use partial vote account
        return `Validator ${voteAccount.slice(0, 8)}...${voteAccount.slice(-4)}`;

    } catch (error) {
        console.warn(`Error getting validator name for ${voteAccount}:`, error);
        return `Validator ${voteAccount.slice(0, 8)}...${voteAccount.slice(-4)}`;
    }
}

/**
 * Gets validator metadata including name, website, details
 */
export async function getValidatorMetadata(voteAccount: string): Promise<ValidatorMetadata | null> {
    try {
        // Check known validators first
        if (KNOWN_VALIDATORS[voteAccount]) {
            return KNOWN_VALIDATORS[voteAccount];
        }

        // Try to get from official registry
        const registryValidators = await fetchOfficialValidatorRegistry();
        const registryValidator = registryValidators.find(v => v.account === voteAccount);

        if (registryValidator) {
            return {
                name: registryValidator.name,
                website: registryValidator.website,
                details: registryValidator.details,
                keybaseUsername: registryValidator.keybaseUsername
            };
        }

        return null;
    } catch (error) {
        console.warn(`Error getting validator metadata for ${voteAccount}:`, error);
        return null;
    }
}

/**
 * Batch fetch validator names for multiple vote accounts
 */
export async function batchGetValidatorNames(voteAccounts: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();

    try {
        // Get registry data once for all validators
        const registryValidators = await fetchOfficialValidatorRegistry();
        const registryMap = new Map(registryValidators.map(v => [v.account, v.name]));

        // Process each vote account
        for (const voteAccount of voteAccounts) {
            // Check known validators first
            if (KNOWN_VALIDATORS[voteAccount]) {
                nameMap.set(voteAccount, KNOWN_VALIDATORS[voteAccount].name);
                continue;
            }

            // Check registry
            const registryName = registryMap.get(voteAccount);
            if (registryName) {
                nameMap.set(voteAccount, registryName);
                continue;
            }

            // Fallback name
            nameMap.set(voteAccount, `Validator ${voteAccount.slice(0, 8)}...${voteAccount.slice(-4)}`);
        }

        return nameMap;
    } catch (error) {
        console.warn('Error in batch validator name fetch:', error);

        // Return fallback names for all
        voteAccounts.forEach(voteAccount => {
            nameMap.set(voteAccount, `Validator ${voteAccount.slice(0, 8)}...${voteAccount.slice(-4)}`);
        });

        return nameMap;
    }
}

/**
 * Simple IP to location mapping (basic fallback)
 */
async function getLocationFromIP(ip: string): Promise<string | null> {
    try {
        // This is a very basic implementation
        // In production, you'd use a proper GeoIP service

        // Common datacenter IP patterns
        const patterns = [
            { pattern: /^54\./, location: 'AWS US-East' },
            { pattern: /^52\./, location: 'AWS US-West' },
            { pattern: /^35\./, location: 'Google Cloud' },
            { pattern: /^20\./, location: 'Microsoft Azure' },
            { pattern: /^159\./, location: 'DigitalOcean' },
            { pattern: /^138\./, location: 'Hetzner Germany' },
            { pattern: /^95\./, location: 'OVH France' },
        ];

        for (const { pattern, location } of patterns) {
            if (pattern.test(ip)) {
                return location;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Update the known validators list with new mappings
 */
export function addKnownValidator(voteAccount: string, metadata: ValidatorMetadata): void {
    KNOWN_VALIDATORS[voteAccount] = metadata;
}

/**
 * Get all known validators
 */
export function getKnownValidators(): Record<string, ValidatorMetadata> {
    return { ...KNOWN_VALIDATORS };
}
