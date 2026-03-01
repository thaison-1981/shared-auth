import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<any | undefined>;
  getUserByEmail(email: string): Promise<any | undefined>;
  upsertUser(userData: any): Promise<any>;
}

/**
 * Creates a basic auth storage with simple upsert-by-id.
 * For apps needing custom upsert logic (e.g., SKO's account linking),
 * implement IAuthStorage directly instead.
 */
export function createAuthStorage(db: any, usersTable: any): IAuthStorage {
  return {
    async getUser(id: string) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      return user;
    },

    async getUserByEmail(email: string) {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      return user;
    },

    async upsertUser(userData: any) {
      const [user] = await db
        .insert(usersTable)
        .values(userData)
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { ...userData, updatedAt: new Date() },
        })
        .returning();
      return user;
    },
  };
}
