import * as qs from 'qs';
import * as express_serve_static_core from 'express-serve-static-core';
import passport from 'passport';
import { RequestHandler, Express } from 'express';

interface IAuthStorage {
    getUser(id: string): Promise<any | undefined>;
    getUserByEmail(email: string): Promise<any | undefined>;
    upsertUser(userData: any): Promise<any>;
}
/**
 * Creates a basic auth storage with simple upsert-by-id.
 * For apps needing custom upsert logic (e.g., SKO's account linking),
 * implement IAuthStorage directly instead.
 */
declare function createAuthStorage(db: any, usersTable: any): IAuthStorage;

interface GoogleLoginInfo {
    profile: passport.Profile;
    accessToken: string;
    refreshToken: string;
    user: any;
}
interface AuthConfig {
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
    devLogin?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    };
    /** Data to pass to authStorage.upsertUser from Google profile. Apps can customize. */
    buildUpsertData?: (profile: passport.Profile) => Record<string, any>;
}
declare function getSession(pool: any): RequestHandler<express_serve_static_core.ParamsDictionary, any, any, qs.ParsedQs, Record<string, any>>;
declare function setupAuth(app: Express, config: AuthConfig): Promise<void>;

/**
 * Creates an isAuthenticated middleware that also updates lastLoginAt every 5 minutes.
 * @param db - Drizzle db instance
 * @param usersTable - Drizzle users table (must have id, lastLoginAt columns)
 */
declare function createIsAuthenticated(db: any, usersTable: any): RequestHandler;
/**
 * Creates an isAdmin middleware with a custom admin check function.
 * @param checkFn - Function that returns true if the user is admin
 */
declare function createIsAdmin(checkFn: (user: any) => boolean): RequestHandler;

/**
 * Register the /api/auth/user route.
 * Kept as a separate function for apps that need to set up auth routes manually
 * (setupAuth already includes this route by default).
 */
declare function createAuthRoutes(app: Express, isAuthenticated: RequestHandler, stripFields?: string[]): void;

export { type AuthConfig, type GoogleLoginInfo, type IAuthStorage, createAuthRoutes, createAuthStorage, createIsAdmin, createIsAuthenticated, getSession, setupAuth };
