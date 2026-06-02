import nodemailer from "nodemailer";
import { setDefaultResultOrder } from "dns";

// Railway doesn't support IPv6 outbound — prefer A records globally so
// Node.js never picks an AAAA address and gets ENETUNREACH.
setDefaultResultOrder("ipv4first");

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE === "true";

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    // Port 465 = SSL from the start (no STARTTLS needed).
    // Port 587 = STARTTLS — requireTLS forces the upgrade.
    ...(secure ? {} : { requireTLS: true }),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15_000,
    socketTimeout: 20_000,
  });

  return transporter.sendMail({
    from: `"Canopy" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}
