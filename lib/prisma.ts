import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prismaBase = globalForPrisma.prisma || new PrismaClient();

export const prisma = prismaBase.$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase;