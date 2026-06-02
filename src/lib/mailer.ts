import nodemailer from "nodemailer";

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
  // Transporter is created per-call so env vars are always read at request time,
  // not at module-load time (which happens during Next.js build/startup on Railway
  // before runtime env vars are injected into process.env).
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: `"Canopy" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}
