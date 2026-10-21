import nodemailer from "nodemailer";

/**
 * Standalone mail sender for app-triggered notifications (PFMEA action
 * reminders). Separate from next-auth's Nodemailer *provider* (auth.ts),
 * which only handles magic-link sign-in — this uses the same
 * EMAIL_SERVER/EMAIL_FROM env vars and, in dev, the same Maildev catcher
 * at http://localhost:1080.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error("EMAIL_SERVER/EMAIL_FROM are not configured.");
  }

  const transport = nodemailer.createTransport(server);
  await transport.sendMail({ to, from, subject, text });
}
