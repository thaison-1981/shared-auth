import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "server/index": "src/server/index.ts",
    "client/index": "src/client/index.ts",
    schema: "src/schema.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [
    "express",
    "express-session",
    "passport",
    "passport-google-oauth20",
    "connect-pg-simple",
    "drizzle-orm",
    "drizzle-orm/pg-core",
    "@tanstack/react-query",
    "react",
  ],
});
