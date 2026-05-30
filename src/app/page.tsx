export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession, ROLE_HOME } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_HOME[session.role]);
  }
  redirect("/login");
}
