import { Resend } from "resend";

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
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject,
    html,
    text,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
