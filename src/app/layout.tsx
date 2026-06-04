import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastContainer } from "@/components/ui/toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Canopy",
    template: "%s | Canopy",
  },
  description: "Manage content across teams with role-based access for owners, admins, clients, and contributors.",
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
  },
  openGraph: {
    siteName: "Canopy",
    title: "Canopy",
    description: "Manage content across teams with role-based access for owners, admins, clients, and contributors.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Canopy",
    description: "Manage content across teams with role-based access for owners, admins, clients, and contributors.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = (cookieStore.get("cms_theme")?.value ?? "auto") as "auto" | "light" | "dark";
  const dataTheme = theme === "dark" ? "dark" : theme === "light" ? "light" : undefined;

  return (
    <html lang="en" className="h-full" {...(dataTheme ? { "data-theme": dataTheme } : {})}>
      <body className="min-h-full">
        <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
