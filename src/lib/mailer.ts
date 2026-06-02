import nodemailer from "nodemailer";
import { promises as dns } from "dns";

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
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";

  // Railway doesn't support IPv6 outbound. Node.js prefers AAAA records which
  // fail immediately with ENETUNREACH. Resolve to IPv4 explicitly so the
  // socket never attempts an IPv6 connection.
  let host = smtpHost;
  try {
    const [ipv4] = await dns.resolve4(smtpHost);
    host = ipv4;
  } catch {
    // DNS resolution failed — fall back to hostname and hope for the best
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    // Port 587 uses STARTTLS — requireTLS forces the upgrade (nodemailer v8+)
    ...(secure ? {} : { requireTLS: true }),
    tls: {
      // When connecting by IP, the TLS handshake must still verify against
      // the original hostname so the certificate is accepted.
      servername: smtpHost,
    },
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
