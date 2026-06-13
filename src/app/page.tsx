export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, ROLE_HOME } from "@/lib/auth";
import { MarketingPage } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Canopy — Content management built for teams",
  description:
    "Canopy gives every team member a structured workspace with role-based access, real-time collaboration, and approval workflows — from first draft to final publish.",
  openGraph: {
    title: "Canopy — Content management built for teams",
    description:
      "Canopy gives every team member a structured workspace with role-based access, real-time collaboration, and approval workflows.",
    type: "website",
  },
  other: {
    "application-name": "Canopy",
    "application-type": "ContentManagement",
  },
};

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_HOME[session.role]);
  }
  return <MarketingPage />;
}
