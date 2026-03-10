import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient instance.
 * Prevents multiple connections during hot-reloading in development.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
