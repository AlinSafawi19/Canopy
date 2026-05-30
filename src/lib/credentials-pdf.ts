import jsPDF from "jspdf";

export interface CredentialsData {
  role: "Admin" | "Client" | "Contributor";
  displayName: string;
  username: string;
  password: string;
  email: string;
}

// Indigo-600 = #4f46e5, Indigo-800 = #3730a3, Slate shades
const INDIGO = [79, 70, 229] as const;
const INDIGO_DARK = [55, 48, 163] as const;
const INDIGO_LIGHT = [224, 231, 255] as const; // indigo-100
const SLATE_50 = [248, 250, 252] as const;
const SLATE_200 = [226, 232, 240] as const;
const SLATE_400 = [148, 163, 184] as const;
const SLATE_500 = [100, 116, 139] as const;
const SLATE_700 = [51, 65, 85] as const;
const SLATE_900 = [15, 23, 42] as const;
const AMBER_50 = [255, 251, 235] as const;
const AMBER_200 = [253, 230, 138] as const;
const AMBER_700 = [180, 83, 9] as const;
const WHITE = [255, 255, 255] as const;

export function downloadCredentialsPdf(data: CredentialsData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  const contentW = W - margin * 2;

  // ── Header ──────────────────────────────────────────────
  doc.setFillColor(...INDIGO_DARK);
  doc.rect(0, 0, W, 50, "F");

  // Subtle stripe
  doc.setFillColor(...INDIGO);
  doc.rect(0, 35, W, 15, "F");

  // Logo arcs — two stacked canopy arcs centered in header
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.75);
  doc.lines([[4, -5.3, 8, -5.3, 12, 0]], W / 2 - 6, 14, [1, 1], "S");
  doc.setLineWidth(0.55);
  doc.lines([[2.7, -3.3, 5.3, -3.3, 8, 0]], W / 2 - 4, 18, [1, 1], "S");

  // App name
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Canopy", W / 2, 26, { align: "center" });

  // Role badge pill background
  doc.setFillColor(...INDIGO);
  const badgeLabel = `${data.role} Account`;
  doc.setFontSize(10);
  const badgeW = doc.getTextWidth(badgeLabel) + 12;
  doc.roundedRect(W / 2 - badgeW / 2, 29, badgeW, 8, 2, 2, "F");
  doc.setTextColor(...INDIGO_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.text(badgeLabel, W / 2, 34.5, { align: "center" });

  // Subtitle
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Account Credentials", W / 2, 44, { align: "center" });

  // ── Credential Card ──────────────────────────────────────
  const cardY = 60;
  const cardH = 115;
  doc.setFillColor(...SLATE_50);
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, contentW, cardH, 4, 4, "FD");

  // Section header
  doc.setTextColor(...SLATE_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ACCOUNT DETAILS", margin + 8, cardY + 10);

  // Divider
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.3);
  doc.line(margin + 8, cardY + 13, margin + contentW - 8, cardY + 13);

  const rows: Array<[string, string]> = [
    ["Full Name", data.displayName],
    ["Username", data.username],
    ["Password", data.password],
    ["Email", data.email],
    ["Login URL", `${typeof window !== "undefined" ? window.location.origin : ""}/login`],
  ];

  let rowY = cardY + 23;
  for (const [label, value] of rows) {
    // Label
    doc.setTextColor(...SLATE_500);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, margin + 8, rowY);

    // Value
    doc.setTextColor(...SLATE_900);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value, contentW - 65);
    doc.text(lines, margin + 60, rowY);

    rowY += lines.length > 1 ? lines.length * 6 + 8 : 17;
  }

  // ── Security Notice ──────────────────────────────────────
  const noticeY = cardY + cardH + 12;
  doc.setFillColor(...AMBER_50);
  doc.setDrawColor(...AMBER_200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, noticeY, contentW, 32, 3, 3, "FD");

  // Warning label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER_700);
  doc.text("⚠  Security Notice", margin + 8, noticeY + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_700);
  doc.text(
    "You will be prompted to change your password on first login.",
    margin + 8,
    noticeY + 19,
  );
  doc.text(
    "Keep this document confidential — do not share or store it insecurely.",
    margin + 8,
    noticeY + 27,
  );

  // ── Footer ───────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_400);
  doc.text(
    `Generated on ${new Date().toLocaleString()} · Canopy`,
    W / 2,
    284,
    { align: "center" },
  );

  doc.save(`credentials-${data.username}.pdf`);
}
