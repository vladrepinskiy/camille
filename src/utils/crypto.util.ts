import { createHash, randomBytes } from "crypto";

export function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars (0, O, 1, I)
  const bytes = randomBytes(8);
  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i]! % chars.length];
    if (i === 3) code += "-";
  }

  return code;
}

export function hashCode(code: string): string {
  // Remove dashes and uppercase
  const normalized = code.replace(/-/g, "").toUpperCase();

  return createHash("sha256").update(normalized).digest("hex");
}

export function generateSessionId(): string {
  return randomBytes(16).toString("hex");
}
