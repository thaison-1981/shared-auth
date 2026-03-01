import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Creates an isAuthenticated middleware that also updates lastLoginAt every 5 minutes.
 * @param db - Drizzle db instance
 * @param usersTable - Drizzle users table (must have id, lastLoginAt columns)
 */
export function createIsAuthenticated(db: any, usersTable: any): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as any;
    if (user?.id) {
      const last = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
      if (Date.now() - last > FIVE_MINUTES_MS) {
        db.update(usersTable)
          .set({ lastLoginAt: new Date() })
          .where(eq(usersTable.id, user.id))
          .then(() => {
            user.lastLoginAt = new Date();
          })
          .catch(() => {});
      }
    }
    next();
  };
}

/**
 * Creates an isAdmin middleware with a custom admin check function.
 * @param checkFn - Function that returns true if the user is admin
 */
export function createIsAdmin(checkFn: (user: any) => boolean): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as any;
    if (!checkFn(user)) {
      return res.status(403).json({ message: "Forbidden: admin access required" });
    }
    next();
  };
}
