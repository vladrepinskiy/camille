import { getDb } from "@/db/connection";
import type { NewTelegramUser, TelegramUser } from "@/db/types";

export const telegramUsersRepo = {
  insert(user: NewTelegramUser): number {
    const result = getDb()
      .prepare("INSERT INTO telegram_users (telegram_id, username, paired_at) VALUES (?, ?, ?)")
      .run(user.telegram_id, user.username, user.paired_at);

    return result.lastInsertRowid as number;
  },

  findByTelegramId(telegramId: number): TelegramUser | undefined {
    return getDb().prepare("SELECT * FROM telegram_users WHERE telegram_id = ?").get(telegramId) as
      | TelegramUser
      | undefined;
  },

  isAuthorized(telegramId: number): boolean {
    const user = this.findByTelegramId(telegramId);

    return user !== undefined;
  },

  delete(telegramId: number): boolean {
    const result = getDb()
      .prepare("DELETE FROM telegram_users WHERE telegram_id = ?")
      .run(telegramId);

    return result.changes > 0;
  },
};
