// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// The Prisma Client is now imported from the standard location
const prismaBase = globalForPrisma.prisma || new PrismaClient();

// The Accelerate extension is still applied in the same way.
export const prisma = prismaBase.$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase;