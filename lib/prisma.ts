// Single shared Prisma client for the whole app.
//
// Next.js hot-reloads server modules in dev, which would otherwise create a
// new client (and a new connection pool) on every reload until Postgres runs
// out of connections. Caching both the pool and the client on `globalThis`
// keeps exactly one of each per process.
//
// Prisma 7 requires an explicit driver adapter — `new PrismaClient()` with no
// options throws. We use node-postgres against Neon's POOLED connection
// string, which is what serverless functions must use. Migrations use
// DIRECT_URL instead; see prisma.config.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in the pooled Neon connection string.",
    );
  }

  return new Pool({
    connectionString,
    // Serverless functions are short-lived and numerous; keep each instance's
    // footprint on the pooler small.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

const pool = globalForPrisma.pool ?? createPool();
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg(pool) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}
