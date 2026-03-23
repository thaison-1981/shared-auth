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
      // Check if a user with this email already exists but with a different ID
      // (e.g., seeded from HubSpot import or manually created, then logs in via Google OAuth).
      // Keep the existing ID to preserve foreign key references.
      if (userData.email) {
        const existing = await this.getUserByEmail(userData.email);
        if (existing && existing.id !== userData.id) {
          const { id, ...profileFields } = userData;
          const [user] = await db
            .update(usersTable)
            .set({ ...profileFields, updatedAt: new Date() })
            .where(eq(usersTable.id, existing.id))
            .returning();
          return user;
        }
      }
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
