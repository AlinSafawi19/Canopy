import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

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
  const notesHtml = release.notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="color:#475569;margin:0 0 8px;">${line}</p>`)
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">New release · ${release.version}</p>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 16px;">${release.title}</h2>
      <p style="color:#475569;margin:0 0 24px;">Hi ${displayName}, here&rsquo;s what&rsquo;s new in this release.</p>
      <div style="border-left:3px solid #e2e8f0;padding-left:16px;margin-bottom:32px;">
        ${notesHtml}
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:0;">You&rsquo;re receiving this because you have an active Canopy account.</p>
    </div>
  `;
}

function buildText(displayName: string, release: ReleasePayload): string {
  return `${release.title} (${release.version})\n\nHi ${displayName},\n\n${release.notes}\n\nYou're receiving this because you have an active Canopy account.`;
}
