import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  const from = process.env.RESEND_FROM!;
  const fromFormatted = from.includes("<") ? from : `Canopy <${from}>`;

  const { error } = await resend.emails.send({
    from: fromFormatted,
    to,
    subject,
    html,
    text,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
