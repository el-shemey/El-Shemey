import { PrismaClient } from "@prisma/client";

/**
 * Server-only Prisma singleton.
 *
 * SECURITY BOUNDARY: this module may only be imported from server code
 * (Server Components / Server Actions / route handlers). The `server-only`
 * guard makes any accidental client import a build error. Prisma and the
 * DATABASE_URL are never exposed to the browser bundle.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
