import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// This is a singleton pattern to ensure we only have one instance of Prisma Client
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prismaBase = globalForPrisma.prisma || new PrismaClient();

// This line enables Prisma Accelerate. It will automatically use the pooled
// connection URL (prisma://...) when it's provided in the environment.
export const prisma = prismaBase.$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase;