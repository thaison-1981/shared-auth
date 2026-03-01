import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { eq } from "drizzle-orm";
import type { IAuthStorage } from "./storage.js";

export interface GoogleLoginInfo {
  profile: passport.Profile;
  accessToken: string;
  refreshToken: string;
  user: any;
}

export interface AuthConfig {
  /** pg Pool instance for session store */
  pool: any;
  /** Drizzle db instance */
  db: any;
  /** Drizzle users table (must have id, email, lastLoginAt columns) */
  usersTable: any;
  /** Auth storage instance (getUser, getUserByEmail, upsertUser) */
  authStorage: IAuthStorage;
  /** Google OAuth scopes (defaults to ["openid", "email", "profile"]) */
  googleScopes?: string[];
  /** Called after successful Google login — for app-specific side effects */
  onGoogleLogin?: (info: GoogleLoginInfo) => Promise<void>;
  /** Fields to strip from /api/auth/user response (e.g., ["passwordHash"]) */
  stripFields?: string[];
  /** If set, enables POST /api/dev-login in non-production when Google OAuth is not configured */
  devLogin?: { id: string; email: string; firstName: string; lastName: string };
  /** Data to pass to authStorage.upsertUser from Google profile. Apps can customize. */
  buildUpsertData?: (profile: passport.Profile) => Record<string, any>;
}

export function getSession(pool: any) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return session({
    secret: sessionSecret || "local-dev-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express, config: AuthConfig) {
  const { pool, db, usersTable, authStorage, stripFields = [] } = config;

  app.use(getSession(pool));
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const scopes = config.googleScopes || ["openid", "email", "profile"];
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL:
            process.env.GOOGLE_REDIRECT_URI ||
            `http://localhost:${process.env.PORT || 3000}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || "";
            const upsertData = config.buildUpsertData
              ? config.buildUpsertData(profile)
              : {
                  id: profile.id,
                  email,
                  firstName: profile.name?.givenName || "",
                  lastName: profile.name?.familyName || "",
                  profileImageUrl: profile.photos?.[0]?.value || "",
                };
            const user = await authStorage.upsertUser(upsertData);

            // Update last login
            await db
              .update(usersTable)
              .set({ lastLoginAt: new Date() })
              .where(eq(usersTable.id, user.id));

            // App-specific callback
            if (config.onGoogleLogin) {
              await config.onGoogleLogin({ profile, accessToken, refreshToken, user });
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );

    // Google OAuth routes
    app.get(
      "/api/auth/google",
      passport.authenticate("google", {
        scope: scopes,
        accessType: "offline",
        prompt: "consent",
      } as any)
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", {
        failureRedirect: "/",
        successRedirect: "/",
      })
    );
  } else {
    console.warn(
      "[shared-auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google Sign-In disabled."
    );
    app.get("/api/auth/google", (_req, res) => {
      res.status(503).json({ message: "Google OAuth not configured" });
    });
  }

  // Dev login (optional)
  if (
    config.devLogin &&
    process.env.NODE_ENV !== "production" &&
    !process.env.GOOGLE_CLIENT_ID
  ) {
    app.post("/api/dev-login", async (req, res) => {
      const user = await authStorage.upsertUser({
        id: config.devLogin!.id,
        email: config.devLogin!.email,
        firstName: config.devLogin!.firstName,
        lastName: config.devLogin!.lastName,
      });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(user);
      });
    });
  }

  // Passport serialize/deserialize
  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user);
    } catch (err) {
      cb(err);
    }
  });

  // Logout routes
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });
  app.post("/api/logout", (req, res) => {
    req.logout(() => res.json({ success: true }));
  });

  // GET /api/auth/user
  app.get("/api/auth/user", (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = { ...req.user };
    for (const field of stripFields) {
      delete user[field];
    }
    res.json(user);
  });
}
