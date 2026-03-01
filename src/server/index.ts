export { setupAuth, getSession } from "./setup.js";
export { createIsAuthenticated, createIsAdmin } from "./middleware.js";
export { createAuthStorage, type IAuthStorage } from "./storage.js";
export { createAuthRoutes } from "./routes.js";
export type { AuthConfig, GoogleLoginInfo } from "./setup.js";
