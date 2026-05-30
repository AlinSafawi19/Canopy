import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/layout/settings-shell";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const admin = await prisma.adminIdentity.findUnique({
    where: { id: session!.id },
    select: { emailVerifiedAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your admin account</p>
      </div>
      <SettingsShell basePath="/admin/settings" emailVerified={!!admin?.emailVerifiedAt}>
        {children}
      </SettingsShell>
    </div>
  );
}
