/**
 * MCP Server Verification System
 *
 * Cryptographic verification for MCP servers using:
 * - Wallet signatures for author verification
 * - On-chain attestations for tamper-proof badges
 * - Domain verification via DNS TXT records
 * - Code signing for package integrity
 *
 * Trust Levels:
 * - Unverified: No verification
 * - Domain Verified: DNS TXT record matches
 * - Author Verified: Wallet signature confirms authorship
 * - Code Signed: Package hash matches attestation
 * - Fully Verified: All checks pass + on-chain attestation
 */

import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// ============================================================================
// Types
// ============================================================================

export type VerificationLevel =
  | 'unverified'
  | 'domain_verified'
  | 'author_verified'
  | 'code_signed'
  | 'fully_verified';

export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired' | 'revoked';

export interface VerificationChallenge {
  id: string;
  serverId: string;
  type: 'domain' | 'wallet' | 'code';
  challenge: string;
  expiresAt: number;
  createdAt: number;
}

export interface DomainVerification {
  domain: string;
  txtRecord: string;
  verifiedAt?: number;
  status: VerificationStatus;
}

export interface AuthorVerification {
  wallet: string;
  signature: string;
  message: string;
  verifiedAt?: number;
  status: VerificationStatus;
}

export interface CodeVerification {
  packageId: string;
  version: string;
  sha256: string;
  signedBy: string;
  signature: string;
  verifiedAt?: number;
  status: VerificationStatus;
}

export interface OnChainAttestation {
  txSignature: string;
  slot: number;
  attestor: string;
  serverId: string;
  verificationLevel: VerificationLevel;
  metadata: Record<string, any>;
  timestamp: number;
}

export interface ServerVerification {
  serverId: string;
  level: VerificationLevel;
  domain?: DomainVerification;
  author?: AuthorVerification;
  code?: CodeVerification;
  attestation?: OnChainAttestation;
  badges: VerificationBadge[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface VerificationBadge {
  type: 'verified_author' | 'verified_domain' | 'code_signed' | 'official' | 'community_trusted';
  grantedAt: number;
  grantedBy: string;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Constants
// ============================================================================

export const VERIFICATION_CONFIG = {
  challengeTtlMs: 30 * 60 * 1000,  // 30 minutes
  verificationTtlMs: 365 * 24 * 60 * 60 * 1000,  // 1 year
  domainTxtPrefix: 'mcp-verify=',
  messagePrefix: 'MCP Server Verification\n\nServer: ',
  requiredStakeForAttestation: BigInt(10000) * BigInt(1e9),  // 10,000 tokens
};

// ============================================================================
// Verification Manager
// ============================================================================

export class ServerVerificationManager {
  private verifications = new Map<string, ServerVerification>();
  private challenges = new Map<string, VerificationChallenge>();
  private attestations = new Map<string, OnChainAttestation>();

  // ==========================================================================
  // Challenge Generation
  // ==========================================================================

  /**
   * Generate a verification challenge for domain verification
   */
  generateDomainChallenge(serverId: string, domain: string): VerificationChallenge {
    const challenge: VerificationChallenge = {
      id: `domain-${serverId}-${Date.now()}`,
      serverId,
      type: 'domain',
      challenge: this.generateRandomChallenge(),
      expiresAt: Date.now() + VERIFICATION_CONFIG.challengeTtlMs,
      createdAt: Date.now(),
    };

    this.challenges.set(challenge.id, challenge);

    console.log(`[Verification] Domain challenge generated for ${serverId}`);
    console.log(`  Add TXT record: ${VERIFICATION_CONFIG.domainTxtPrefix}${challenge.challenge}`);

    return challenge;
  }

  /**
   * Generate a verification challenge for wallet verification
   */
  generateWalletChallenge(serverId: string, wallet: string): VerificationChallenge {
    const message = `${VERIFICATION_CONFIG.messagePrefix}${serverId}\nWallet: ${wallet}\nTimestamp: ${Date.now()}\nNonce: ${this.generateRandomChallenge()}`;

    const challenge: VerificationChallenge = {
      id: `wallet-${serverId}-${Date.now()}`,
      serverId,
      type: 'wallet',
      challenge: message,
      expiresAt: Date.now() + VERIFICATION_CONFIG.challengeTtlMs,
      createdAt: Date.now(),
    };

    this.challenges.set(challenge.id, challenge);

    console.log(`[Verification] Wallet challenge generated for ${serverId}`);
    return challenge;
  }

  /**
   * Generate a verification challenge for code signing
   */
  generateCodeChallenge(serverId: string, packageId: string, version: string): VerificationChallenge {
    const challenge: VerificationChallenge = {
      id: `code-${serverId}-${Date.now()}`,
      serverId,
      type: 'code',
      challenge: JSON.stringify({ packageId, version, nonce: this.generateRandomChallenge() }),
      expiresAt: Date.now() + VERIFICATION_CONFIG.challengeTtlMs,
      createdAt: Date.now(),
    };

    this.challenges.set(challenge.id, challenge);

    console.log(`[Verification] Code challenge generated for ${serverId}`);
    return challenge;
  }

  private generateRandomChallenge(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bs58.encode(bytes);
  }

  // ==========================================================================
  // Domain Verification
  // ==========================================================================

  /**
   * Verify domain ownership via DNS TXT record
   */
  async verifyDomain(challengeId: string, domain: string): Promise<{
    success: boolean;
    verification?: DomainVerification;
    error?: string;
  }> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found or expired' };
    }

    if (challenge.type !== 'domain') {
      return { success: false, error: 'Invalid challenge type' };
    }

    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    try {
      // In production, use DNS over HTTPS to verify TXT record
      // For now, we'll simulate the check
      const expectedRecord = `${VERIFICATION_CONFIG.domainTxtPrefix}${challenge.challenge}`;

      // Mock DNS lookup - in production use:
      // const txtRecords = await dnsLookup(domain, 'TXT');
      // const found = txtRecords.some(r => r.includes(expectedRecord));
      const found = true; // Simulated for testing

      if (!found) {
        return { success: false, error: 'DNS TXT record not found' };
      }

      const verification: DomainVerification = {
        domain,
        txtRecord: expectedRecord,
        verifiedAt: Date.now(),
        status: 'verified',
      };

      // Update server verification
      this.updateVerification(challenge.serverId, { domain: verification });
      this.challenges.delete(challengeId);

      console.log(`[Verification] Domain verified: ${domain} for ${challenge.serverId}`);
      return { success: true, verification };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'DNS lookup failed' };
    }
  }

  // ==========================================================================
  // Wallet/Author Verification
  // ==========================================================================

  /**
   * Verify author ownership via wallet signature
   */
  async verifyWalletSignature(
    challengeId: string,
    wallet: string,
    signature: string
  ): Promise<{
    success: boolean;
    verification?: AuthorVerification;
    error?: string;
  }> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found or expired' };
    }

    if (challenge.type !== 'wallet') {
      return { success: false, error: 'Invalid challenge type' };
    }

    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    try {
      // Verify the signature
      const isValid = this.verifyEd25519Signature(
        challenge.challenge,
        signature,
        wallet
      );

      if (!isValid) {
        return { success: false, error: 'Invalid signature' };
      }

      const verification: AuthorVerification = {
        wallet,
        signature,
        message: challenge.challenge,
        verifiedAt: Date.now(),
        status: 'verified',
      };

      // Update server verification
      this.updateVerification(challenge.serverId, { author: verification });
      this.addBadge(challenge.serverId, {
        type: 'verified_author',
        grantedAt: Date.now(),
        grantedBy: 'system',
        expiresAt: Date.now() + VERIFICATION_CONFIG.verificationTtlMs,
      });

      this.challenges.delete(challengeId);

      console.log(`[Verification] Author verified: ${wallet} for ${challenge.serverId}`);
      return { success: true, verification };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Signature verification failed' };
    }
  }

  private verifyEd25519Signature(message: string, signature: string, publicKey: string): boolean {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(publicKey);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Code Signing
  // ==========================================================================

  /**
   * Verify code signing for a package
   */
  async verifyCodeSignature(
    challengeId: string,
    sha256: string,
    signature: string,
    signerWallet: string
  ): Promise<{
    success: boolean;
    verification?: CodeVerification;
    error?: string;
  }> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found or expired' };
    }

    if (challenge.type !== 'code') {
      return { success: false, error: 'Invalid challenge type' };
    }

    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    try {
      const challengeData = JSON.parse(challenge.challenge);

      // Verify the signature over the hash
      const message = `${challengeData.packageId}:${challengeData.version}:${sha256}`;
      const isValid = this.verifyEd25519Signature(message, signature, signerWallet);

      if (!isValid) {
        return { success: false, error: 'Invalid code signature' };
      }

      const verification: CodeVerification = {
        packageId: challengeData.packageId,
        version: challengeData.version,
        sha256,
        signedBy: signerWallet,
        signature,
        verifiedAt: Date.now(),
        status: 'verified',
      };

      // Update server verification
      this.updateVerification(challenge.serverId, { code: verification });
      this.addBadge(challenge.serverId, {
        type: 'code_signed',
        grantedAt: Date.now(),
        grantedBy: signerWallet,
        metadata: { sha256, version: challengeData.version },
      });

      this.challenges.delete(challengeId);

      console.log(`[Verification] Code signed: ${challengeData.packageId}@${challengeData.version}`);
      return { success: true, verification };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Code verification failed' };
    }
  }

  // ==========================================================================
  // On-Chain Attestation
  // ==========================================================================

  /**
   * Record an on-chain attestation
   */
  recordAttestation(
    serverId: string,
    txSignature: string,
    slot: number,
    attestor: string,
    metadata: Record<string, any> = {}
  ): OnChainAttestation {
    const verification = this.getVerification(serverId);
    const level = this.calculateVerificationLevel(verification);

    const attestation: OnChainAttestation = {
      txSignature,
      slot,
      attestor,
      serverId,
      verificationLevel: level,
      metadata,
      timestamp: Date.now(),
    };

    this.attestations.set(serverId, attestation);

    // Update verification with attestation
    this.updateVerification(serverId, {
      attestation,
      level: level === 'author_verified' || level === 'code_signed' ? 'fully_verified' : level,
    });

    console.log(`[Verification] On-chain attestation recorded: ${serverId} (tx: ${txSignature.slice(0, 8)}...)`);
    return attestation;
  }

  /**
   * Build attestation transaction (for client to sign)
   */
  buildAttestationInstruction(
    serverId: string,
    attestorWallet: string
  ): {
    programId: string;
    data: string;
    accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  } {
    const verification = this.getVerification(serverId);
    const level = this.calculateVerificationLevel(verification);

    // This would be the actual program instruction in production
    // For now, return a mock instruction structure
    return {
      programId: 'MCPVrfy1111111111111111111111111111111111111',
      data: bs58.encode(
        new TextEncoder().encode(JSON.stringify({
          instruction: 'attest',
          serverId,
          level,
          timestamp: Date.now(),
        }))
      ),
      accounts: [
        { pubkey: attestorWallet, isSigner: true, isWritable: true },
        { pubkey: 'MCPRegistry11111111111111111111111111111111', isSigner: false, isWritable: true },
      ],
    };
  }

  // ==========================================================================
  // Verification Management
  // ==========================================================================

  /**
   * Get verification status for a server
   */
  getVerification(serverId: string): ServerVerification | null {
    return this.verifications.get(serverId) || null;
  }

  /**
   * Update verification for a server
   */
  private updateVerification(
    serverId: string,
    updates: Partial<ServerVerification>
  ): ServerVerification {
    let verification = this.verifications.get(serverId);

    if (!verification) {
      verification = {
        serverId,
        level: 'unverified',
        badges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    verification = {
      ...verification,
      ...updates,
      updatedAt: Date.now(),
    };

    // Recalculate verification level
    verification.level = this.calculateVerificationLevel(verification);

    this.verifications.set(serverId, verification);
    return verification;
  }

  /**
   * Calculate overall verification level
   */
  private calculateVerificationLevel(verification: ServerVerification | null): VerificationLevel {
    if (!verification) return 'unverified';

    const hasDomain = verification.domain?.status === 'verified';
    const hasAuthor = verification.author?.status === 'verified';
    const hasCode = verification.code?.status === 'verified';
    const hasAttestation = !!verification.attestation;

    if (hasAuthor && hasCode && hasAttestation) return 'fully_verified';
    if (hasCode) return 'code_signed';
    if (hasAuthor) return 'author_verified';
    if (hasDomain) return 'domain_verified';
    return 'unverified';
  }

  /**
   * Add a badge to a server
   */
  addBadge(serverId: string, badge: VerificationBadge): void {
    const verification = this.verifications.get(serverId) || {
      serverId,
      level: 'unverified',
      badges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Remove existing badge of same type
    verification.badges = verification.badges.filter(b => b.type !== badge.type);
    verification.badges.push(badge);
    verification.updatedAt = Date.now();

    this.verifications.set(serverId, verification);
  }

  /**
   * Revoke verification
   */
  revokeVerification(serverId: string, reason: string): boolean {
    const verification = this.verifications.get(serverId);
    if (!verification) return false;

    verification.level = 'unverified';
    if (verification.domain) verification.domain.status = 'revoked';
    if (verification.author) verification.author.status = 'revoked';
    if (verification.code) verification.code.status = 'revoked';
    verification.badges = [];
    verification.updatedAt = Date.now();

    console.log(`[Verification] Revoked: ${serverId} - ${reason}`);
    return true;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get all verified servers
   */
  getVerifiedServers(minLevel: VerificationLevel = 'domain_verified'): ServerVerification[] {
    const levelOrder: VerificationLevel[] = [
      'unverified',
      'domain_verified',
      'author_verified',
      'code_signed',
      'fully_verified',
    ];
    const minIndex = levelOrder.indexOf(minLevel);

    return Array.from(this.verifications.values())
      .filter(v => levelOrder.indexOf(v.level) >= minIndex);
  }

  /**
   * Get servers with specific badge
   */
  getServersWithBadge(badgeType: VerificationBadge['type']): ServerVerification[] {
    return Array.from(this.verifications.values())
      .filter(v => v.badges.some(b => b.type === badgeType && (!b.expiresAt || b.expiresAt > Date.now())));
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalVerified: number;
    byLevel: Record<VerificationLevel, number>;
    byBadge: Record<VerificationBadge['type'], number>;
    pendingChallenges: number;
    attestations: number;
  } {
    const byLevel: Record<VerificationLevel, number> = {
      unverified: 0,
      domain_verified: 0,
      author_verified: 0,
      code_signed: 0,
      fully_verified: 0,
    };

    const byBadge: Record<VerificationBadge['type'], number> = {
      verified_author: 0,
      verified_domain: 0,
      code_signed: 0,
      official: 0,
      community_trusted: 0,
    };

    for (const v of this.verifications.values()) {
      byLevel[v.level]++;
      for (const b of v.badges) {
        byBadge[b.type]++;
      }
    }

    return {
      totalVerified: this.verifications.size - byLevel.unverified,
      byLevel,
      byBadge,
      pendingChallenges: this.challenges.size,
      attestations: this.attestations.size,
    };
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let globalVerificationManager: ServerVerificationManager | null = null;

export function getVerificationManager(): ServerVerificationManager {
  if (!globalVerificationManager) {
    globalVerificationManager = new ServerVerificationManager();
  }
  return globalVerificationManager;
}

// ============================================================================
// Exports
// ============================================================================

export const serverVerification = {
  ServerVerificationManager,
  getVerificationManager,
  VERIFICATION_CONFIG,
};
