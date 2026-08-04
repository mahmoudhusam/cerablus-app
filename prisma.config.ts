// Prisma CLI configuration (Prisma 7).
//
// The CLI does not read Next.js env files on its own, so load them here.
// `.env.local` is loaded first and wins: dotenv never overwrites a variable
// that is already set, so local secrets take precedence over anything in
// `.env`. On Vercel the variables are already in the environment, and both
// calls are harmless no-ops.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Lets `prisma db seed` run the same script `npm run seed` does.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // This URL is used ONLY by the Prisma CLI (migrate / studio / db pull), so
    // it must be Neon's DIRECT, unpooled connection: migrations need a real
    // session, which a transaction-mode pooler cannot provide. Prisma 7's
    // config has no separate `directUrl` field — there is one URL, and for the
    // CLI it is the direct one.
    //
    // The running app never reads this; it builds its own pool from the
    // POOLED DATABASE_URL in lib/prisma.ts.
    //
    // Read lazily via process.env (not prisma/config's `env()`, which throws
    // when unset) so `prisma generate` still works during install and build
    // before any database URL exists.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
