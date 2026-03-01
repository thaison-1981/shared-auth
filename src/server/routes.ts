import type { Express, RequestHandler } from "express";

/**
 * Register the /api/auth/user route.
 * Kept as a separate function for apps that need to set up auth routes manually
 * (setupAuth already includes this route by default).
 */
export function createAuthRoutes(
  app: Express,
  isAuthenticated: RequestHandler,
  stripFields: string[] = []
): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = { ...req.user };
      for (const field of stripFields) {
        delete user[field];
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
