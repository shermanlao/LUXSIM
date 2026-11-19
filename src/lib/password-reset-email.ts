const LINK_RE = /https?:\/\/|\bwww\./i;

/** Throws if a password-reset email body contains a URL or www. link. */
export function assertNoEmailLinks(text: string): void {
  if (LINK_RE.test(text)) {
    throw new Error("Password reset email must not contain links");
  }
}

export const RESET_CODE_SUBJECT = "Your LUXSIM password reset code";

export function resetCodeEmailText(otp: string): string {
  const text = [
    "LUXSIM",
    "",
    "Your password reset code is:",
    "",
    otp,
    "",
    "This code expires in 10 minutes. Enter it on the login or reset screen.",
    "If you did not request this, you can ignore this message.",
  ].join("\n");
  assertNoEmailLinks(text);
  return text;
}

export const PASSWORD_CHANGED_SUBJECT = "Your LUXSIM password was changed";

export function passwordChangedEmailText(): string {
  const text = [
    "LUXSIM",
    "",
    "Your LUXSIM password was changed just now.",
    "If you did not do this, contact a site administrator.",
  ].join("\n");
  assertNoEmailLinks(text);
  return text;
}
