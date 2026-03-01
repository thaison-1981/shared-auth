// src/server/setup.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq } from "drizzle-orm";
function getSession(pool) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions"
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
      maxAge: sessionTtl
    }
  });
}
async function setupAuth(app, config) {
  const { pool, db, usersTable, authStorage, stripFields = [] } = config;
  app.use(getSession(pool));
  app.use(passport.initialize());
  app.use(passport.session());
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const scopes = config.googleScopes || ["openid", "email", "profile"];
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3e3}/api/auth/google/callback`
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || "";
            const upsertData = config.buildUpsertData ? config.buildUpsertData(profile) : {
              id: profile.id,
              email,
              firstName: profile.name?.givenName || "",
              lastName: profile.name?.familyName || "",
              profileImageUrl: profile.photos?.[0]?.value || ""
            };
            const user = await authStorage.upsertUser(upsertData);
            await db.update(usersTable).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where(eq(usersTable.id, user.id));
            if (config.onGoogleLogin) {
              await config.onGoogleLogin({ profile, accessToken, refreshToken, user });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
    app.get(
      "/api/auth/google",
      passport.authenticate("google", {
        scope: scopes,
        accessType: "offline",
        prompt: "consent"
      })
    );
    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", {
        failureRedirect: "/",
        successRedirect: "/"
      })
    );
  } else {
    console.warn(
      "[shared-auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set \u2014 Google Sign-In disabled."
    );
    app.get("/api/auth/google", (_req, res) => {
      res.status(503).json({ message: "Google OAuth not configured" });
    });
  }
  if (config.devLogin && process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID) {
    app.post("/api/dev-login", async (req, res) => {
      const user = await authStorage.upsertUser({
        id: config.devLogin.id,
        email: config.devLogin.email,
        firstName: config.devLogin.firstName,
        lastName: config.devLogin.lastName
      });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(user);
      });
    });
  }
  passport.serializeUser((user, cb) => cb(null, user.id));
  passport.deserializeUser(async (id, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user);
    } catch (err) {
      cb(err);
    }
  });
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });
  app.post("/api/logout", (req, res) => {
    req.logout(() => res.json({ success: true }));
  });
  app.get("/api/auth/user", (req, res) => {
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

// src/server/middleware.ts
import { eq as eq2 } from "drizzle-orm";
var FIVE_MINUTES_MS = 5 * 60 * 1e3;
function createIsAuthenticated(db, usersTable) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user;
    if (user?.id) {
      const last = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
      if (Date.now() - last > FIVE_MINUTES_MS) {
        db.update(usersTable).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where(eq2(usersTable.id, user.id)).then(() => {
          user.lastLoginAt = /* @__PURE__ */ new Date();
        }).catch(() => {
        });
      }
    }
    next();
  };
}
function createIsAdmin(checkFn) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user;
    if (!checkFn(user)) {
      return res.status(403).json({ message: "Forbidden: admin access required" });
    }
    next();
  };
}

// src/server/storage.ts
import { eq as eq3 } from "drizzle-orm";
function createAuthStorage(db, usersTable) {
  return {
    async getUser(id) {
      const [user] = await db.select().from(usersTable).where(eq3(usersTable.id, id));
      return user;
    },
    async getUserByEmail(email) {
      const [user] = await db.select().from(usersTable).where(eq3(usersTable.email, email));
      return user;
    },
    async upsertUser(userData) {
      const [user] = await db.insert(usersTable).values(userData).onConflictDoUpdate({
        target: usersTable.id,
        set: { ...userData, updatedAt: /* @__PURE__ */ new Date() }
      }).returning();
      return user;
    }
  };
}

// src/server/routes.ts
function createAuthRoutes(app, isAuthenticated, stripFields = []) {
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
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
export {
  createAuthRoutes,
  createAuthStorage,
  createIsAdmin,
  createIsAuthenticated,
  getSession,
  setupAuth
};
