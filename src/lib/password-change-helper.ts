import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, type SessionRole } from "@/lib/auth";
import { validatePassword } from "@/lib/validation";
import { addPasswordToHistory, checkPasswordNotInHistory } from "@/lib/password-history";
import { revokeAllUserSessions } from "@/lib/session-management";
import { logSecurityEvent } from "@/lib/enhanced-audit-log";
import { sendSecurityAlertEmail, getUserEmailAndName } from "@/lib/security-alerts";

export async function performPasswordChange(
  userId: string,
  role: SessionRole,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // Validate new password
  const pwErr = validatePassword(newPassword);
  if (pwErr) {
    return { success: false, error: pwErr };
  }

  // Fetch current user
  let user: any = null;
  if (role === "owner") {
    user = await prisma.platformOwner.findUnique({ where: { id: userId } });
  } else if (role === "admin") {
    user = await prisma.adminIdentity.findUnique({ where: { id: userId } });
  } else if (role === "client") {
    user = await prisma.clientIdentity.findUnique({ where: { id: userId } });
  } else if (role === "contributor") {
    user = await prisma.contributor.findUnique({ where: { id: userId } });
  }

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Verify current password
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Check if password matches one of the recent passwords
  const notInHistory = await checkPasswordNotInHistory(role, userId, newPassword);
  if (!notInHistory) {
    return {
      success: false,
      error: "You cannot reuse one of your recent passwords. Please choose a new password.",
    };
  }

  // Hash and save new password
  const newHash = await hashPassword(newPassword);
  if (role === "owner") {
    await prisma.platformOwner.update({ where: { id: userId }, data: { password: newHash } });
  } else if (role === "admin") {
    await prisma.adminIdentity.update({ where: { id: userId }, data: { password: newHash } });
  } else if (role === "client") {
    await prisma.clientIdentity.update({ where: { id: userId }, data: { password: newHash } });
  } else if (role === "contributor") {
    await prisma.contributor.update({ where: { id: userId }, data: { password: newHash } });
  }

  // Add to password history
  await addPasswordToHistory(role, userId, newHash);

  // Invalidate all sessions (force re-authentication)
  await revokeAllUserSessions(role, userId);

  // Log security event
  await logSecurityEvent(
    userId,
    role,
    "password_changed",
    { method: "self_change", timestamp: new Date().toISOString() },
    ipAddress,
    userAgent
  );

  // Send security alert
  try {
    const userInfo = await getUserEmailAndName(userId, role);
    if (userInfo) {
      await sendSecurityAlertEmail(userInfo.email, userInfo.displayName, "password_changed");
    }
  } catch {
    // Don't fail if email notification fails
  }

  return { success: true };
}
