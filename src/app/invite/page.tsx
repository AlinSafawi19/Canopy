import { getInviteByToken } from "@/lib/invite-tokens";
import { InviteForm } from "./invite-form";
import { LogoMark } from "@/components/ui/logo-mark";
import { XCircle } from "lucide-react";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InviteError message="No invite token provided." />;
  }

  const invite = await getInviteByToken(token);

  if (!invite) {
    return <InviteError message="This invite link is invalid." />;
  }
  if (invite.status === "used") {
    return <InviteError message="This invite link has already been used. Please contact your admin to generate a new one." />;
  }
  if (invite.status === "expired") {
    return <InviteError message="This invite link has expired. Please contact your admin to generate a new one." />;
  }

  // Fetch display name
  const { prisma } = await import("@/lib/prisma");
  let displayName = "";
  if (invite.targetKind === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id: invite.targetId }, select: { displayName: true } });
    displayName = u?.displayName ?? "";
  } else if (invite.targetKind === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id: invite.targetId }, select: { displayName: true } });
    displayName = u?.displayName ?? "";
  } else {
    const u = await prisma.contributor.findUnique({ where: { id: invite.targetId }, select: { displayName: true } });
    displayName = u?.displayName ?? "";
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <LogoMark className="w-10 h-10" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Set up your account</h1>
            <p className="text-sm text-slate-500 mt-1">
              Welcome{displayName ? `, ${displayName}` : ""}. Choose a password to activate your account.
            </p>
          </div>
          <InviteForm token={token} />
        </div>
      </div>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <LogoMark className="w-10 h-10" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="flex justify-center">
            <XCircle size={40} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Invalid invite link</h1>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
