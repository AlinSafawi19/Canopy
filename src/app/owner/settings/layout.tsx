import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/layout/settings-shell";

export default async function OwnerSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const owner = await prisma.platformOwner.findUnique({
    where: { id: session!.id },
    select: { emailVerifiedAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account</p>
      </div>
      <SettingsShell
        basePath="/owner/settings"
        emailVerified={!!owner?.emailVerifiedAt}
        showReleases
      >
        {children}
      </SettingsShell>
    </div>
  );
}
