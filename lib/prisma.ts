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
//
// LAZY ON PURPOSE. Creating the pool used to run at module scope, so merely
// IMPORTING this file with no DATABASE_URL threw — which is enough to fail
// `next build` in an environment that has no database URL, before any page
// even asks for data. Everything below is now built on first property access,
// so importing is free and a missing/unreachable database fails at the query,
// where lib/menu-data.ts can catch it and degrade. See MENU BUILD RESILIENCE
// there.
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

function createClient(): PrismaClient {
  const pool = globalForPrisma.pool ?? createPool();
  const client = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg(pool) });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
    globalForPrisma.prisma = client;
  }
  return client;
}

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  client ??= createClient();
  return client;
}

/**
 * The shared Prisma client.
 *
 * A Proxy so the real client (and its connection pool) is constructed on the
 * first property access rather than on import — see the note at the top.
 * Callers use it exactly like a PrismaClient.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
});
