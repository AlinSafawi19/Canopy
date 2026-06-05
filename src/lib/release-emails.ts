import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/utils";

interface ReleasePayload {
  version: string;
  title: string;
  notes: string;
}

export async function sendReleaseEmails(release: ReleasePayload): Promise<void> {
  const [owners, admins, clients, contributors] = await Promise.all([
    prisma.platformOwner.findMany({ select: { email: true, displayName: true } }),
    prisma.adminIdentity.findMany({ where: { archivedAt: null }, select: { email: true, displayName: true } }),
    prisma.clientIdentity.findMany({ where: { archivedAt: null }, select: { email: true, displayName: true } }),
    prisma.contributor.findMany({ where: { archivedAt: null }, select: { email: true, displayName: true } }),
  ]);

  const recipients = [...owners, ...admins, ...clients, ...contributors];

  await Promise.all(
    recipients.map((user) =>
      sendMail({
        to: user.email,
        subject: `Canopy ${release.version} — ${release.title}`,
        html: buildHtml(user.displayName, release),
        text: buildText(user.displayName, release),
      }).catch((err) => console.error(`[release-emails] failed for ${user.email}:`, err))
    )
  );
}

function buildHtml(displayName: string, release: ReleasePayload): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">New release · ${escapeHtml(release.version)}</p>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 16px;">${escapeHtml(release.title)}</h2>
      <p style="color:#475569;margin:0 0 24px;">Hi ${escapeHtml(displayName)}, here&rsquo;s what&rsquo;s new in this release.</p>
      <style>
        .rn p { color:#475569; margin:0 0 8px; font-size:14px; }
        .rn ul { color:#475569; margin:0 0 8px; padding-left:20px; }
        .rn ol { color:#475569; margin:0 0 8px; padding-left:20px; }
        .rn li { margin-bottom:4px; font-size:14px; }
        .rn h2 { font-size:16px; font-weight:700; color:#0f172a; margin:16px 0 6px; }
        .rn h3 { font-size:14px; font-weight:600; color:#0f172a; margin:12px 0 4px; }
        .rn strong { font-weight:600; color:#0f172a; }
        .rn blockquote { border-left:3px solid #e2e8f0; padding-left:12px; color:#64748b; margin:0 0 8px; }
        .rn code { background:#f1f5f9; padding:1px 4px; border-radius:3px; font-family:monospace; font-size:12px; }
        .rn hr { border:none; border-top:1px solid #e2e8f0; margin:12px 0; }
      </style>
      <div class="rn" style="margin-bottom:32px;">
        ${release.notes}
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:0;">You&rsquo;re receiving this because you have an active Canopy account.</p>
    </div>
  `;
}

function buildText(displayName: string, release: ReleasePayload): string {
  const plainNotes = release.notes
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${release.title} (${release.version})\n\nHi ${displayName},\n\n${plainNotes}\n\nYou're receiving this because you have an active Canopy account.`;
}
