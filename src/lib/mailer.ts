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
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true";

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    // Port 587 uses STARTTLS — requireTLS forces the upgrade (nodemailer v8+)
    ...(secure ? {} : { requireTLS: true }),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transporter.sendMail({
    from: `"Canopy" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}
