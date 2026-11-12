import nodemailer from "nodemailer";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  isConfigured(): boolean;
  send(input: SendMailInput): Promise<void>;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** True when host, port, user, password, and From are all set. */
export function isMailConfigured(): boolean {
  return Boolean(
    env("EMAIL_SERVER_HOST") &&
      env("EMAIL_SERVER_PORT") &&
      env("EMAIL_SERVER_USER") &&
      env("EMAIL_SERVER_PASSWORD") &&
      env("EMAIL_FROM")
  );
}

/**
 * Send a plain-text message using EMAIL_SERVER_* / EMAIL_FROM.
 * Callers must not log the message body (it may contain a one-time code).
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("MAIL_NOT_CONFIGURED");
  }
  const port = Number(env("EMAIL_SERVER_PORT"));
  const transporter = nodemailer.createTransport({
    host: env("EMAIL_SERVER_HOST"),
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: env("EMAIL_SERVER_USER"),
      pass: env("EMAIL_SERVER_PASSWORD"),
    },
  });
  await transporter.sendMail({
    from: env("EMAIL_FROM"),
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}

export const envMailer: Mailer = {
  isConfigured: isMailConfigured,
  send: sendMail,
};
