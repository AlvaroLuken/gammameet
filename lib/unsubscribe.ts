import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? process.env.CRON_SECRET ?? "fallback-dev-secret";

export function unsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", SECRET).update(email.toLowerCase()).digest("hex").slice(0, 16);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  // Constant-time compare
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function unsubscribeUrl(email: string): string {
  const base = process.env.APP_URL ?? "https://www.gamma-meet.com";
  const token = unsubscribeToken(email);
  return `${base}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
