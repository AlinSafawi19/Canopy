import { redirect } from "next/navigation";
import { getSession, ROLE_HOME } from "@/lib/auth";

// The walkthrough overlay is now rendered inside the AppShell for each role.
// This page just redirects to the role's home — the overlay activates automatically
// when walkthroughSeenAt is null.
export default async function WalkthroughPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.role]);
}
