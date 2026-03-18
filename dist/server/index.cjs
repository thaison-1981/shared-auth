"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/index.ts
var server_exports = {};
__export(server_exports, {
  createAuthRoutes: () => createAuthRoutes,
  createAuthStorage: () => createAuthStorage,
  createIsAdmin: () => createIsAdmin,
  createIsAuthenticated: () => createIsAuthenticated,
  getSession: () => getSession,
  setupAuth: () => setupAuth
});
module.exports = __toCommonJS(server_exports);

// src/server/setup.ts
var import_passport = __toESM(require("passport"), 1);
var import_passport_google_oauth20 = require("passport-google-oauth20");
var import_express_session = __toESM(require("express-session"), 1);
var import_connect_pg_simple = __toESM(require("connect-pg-simple"), 1);
var import_drizzle_orm = require("drizzle-orm");
function getSession(pool) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = (0, import_connect_pg_simple.default)(import_express_session.default);
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
  return (0, import_express_session.default)({
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
  app.use(import_passport.default.initialize());
  app.use(import_passport.default.session());
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const scopes = config.googleScopes || ["openid", "email", "profile"];
    import_passport.default.use(
      new import_passport_google_oauth20.Strategy(
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
            await db.update(usersTable).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm.eq)(usersTable.id, user.id));
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
      import_passport.default.authenticate("google", {
        scope: scopes,
        accessType: "offline",
        prompt: "select_account"
      })
    );
    app.get(
      "/api/auth/google/callback",
      import_passport.default.authenticate("google", {
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
  import_passport.default.serializeUser((user, cb) => cb(null, user.id));
  import_passport.default.deserializeUser(async (id, cb) => {
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
var import_drizzle_orm2 = require("drizzle-orm");
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
        db.update(usersTable).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(usersTable.id, user.id)).then(() => {
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
var import_drizzle_orm3 = require("drizzle-orm");
function createAuthStorage(db, usersTable) {
  return {
    async getUser(id) {
      const [user] = await db.select().from(usersTable).where((0, import_drizzle_orm3.eq)(usersTable.id, id));
      return user;
    },
    async getUserByEmail(email) {
      const [user] = await db.select().from(usersTable).where((0, import_drizzle_orm3.eq)(usersTable.email, email));
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createAuthRoutes,
  createAuthStorage,
  createIsAdmin,
  createIsAuthenticated,
  getSession,
  setupAuth
});
