import { getDb } from "@/db/connection";

export const pairingCodesRepo = {
  insert(codeHash: string, expiresAt: number): void {
    const db = getDb();
    db.prepare("DELETE FROM pairing_codes WHERE expires_at < ?").run(Date.now());
    db.prepare("INSERT INTO pairing_codes (code_hash, expires_at) VALUES (?, ?)").run(
      codeHash,
      expiresAt
    );
  },

  validateAndConsume(codeHash: string): boolean {
    const db = getDb();
    const now = Date.now();

    db.prepare("DELETE FROM pairing_codes WHERE expires_at < ?").run(now);
    const code = db.prepare("SELECT * FROM pairing_codes WHERE code_hash = ?").get(codeHash);

    if (!code) return false;

    db.prepare("DELETE FROM pairing_codes WHERE code_hash = ?").run(codeHash);

    return true;
  },

  deleteExpired(): number {
    const result = getDb()
      .prepare("DELETE FROM pairing_codes WHERE expires_at < ?")
      .run(Date.now());

    return result.changes;
  },
};
