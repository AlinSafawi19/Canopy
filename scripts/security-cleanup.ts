#!/usr/bin/env node
/**
 * Security cleanup script for removing expired/old data
 * Run: npx tsx scripts/security-cleanup.ts
 *
 * Recommended: Run daily via cron or similar scheduler
 * Example: 0 2 * * * cd /app && npx tsx scripts/security-cleanup.ts
 */

import { prisma } from "../src/lib/prisma";
import { cleanupOldAuditLogs } from "../src/lib/enhanced-audit-log";
import { cleanupExpiredApiKeys } from "../src/lib/api-key-manager";
import { cleanupExpiredSessions } from "../src/lib/session-management";

async function runCleanup() {
  console.log("[security-cleanup] Starting cleanup tasks...");
  const startTime = Date.now();

  try {
    // Clean up audit logs older than 90 days
    console.log("[security-cleanup] Cleaning up old audit logs...");
    await cleanupOldAuditLogs();
    console.log("[security-cleanup] ✓ Audit logs cleaned");

    // Clean up expired API keys (that are revoked)
    console.log("[security-cleanup] Cleaning up expired API keys...");
    const deletedKeys = await cleanupExpiredApiKeys();
    console.log(`[security-cleanup] ✓ Deleted ${deletedKeys} expired API keys`);

    // Clean up old sessions
    console.log("[security-cleanup] Cleaning up expired sessions...");
    await cleanupExpiredSessions();
    console.log("[security-cleanup] ✓ Sessions cleaned");

    // Clean up expired password reset challenges
    console.log("[security-cleanup] Cleaning up expired password reset challenges...");
    const deletedChallenges = await prisma.passwordResetChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    console.log(`[security-cleanup] ✓ Deleted ${deletedChallenges.count} expired challenges`);

    // Clean up expired email verification challenges
    console.log("[security-cleanup] Cleaning up expired email verification challenges...");
    const deletedVerifications = await prisma.emailVerificationChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    console.log(`[security-cleanup] ✓ Deleted ${deletedVerifications.count} expired verifications`);

    // Clean up expired 2FA pending setups
    console.log("[security-cleanup] Cleaning up expired 2FA setups...");
    const deleted2fa = await prisma.pendingTwoFactorSetup.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    console.log(`[security-cleanup] ✓ Deleted ${deleted2fa.count} expired 2FA setups`);

    const duration = Date.now() - startTime;
    console.log(`[security-cleanup] ✓ All cleanup tasks completed in ${duration}ms`);
  } catch (err) {
    console.error("[security-cleanup] ✗ Cleanup failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCleanup();
