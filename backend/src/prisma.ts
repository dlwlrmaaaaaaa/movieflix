import { PrismaClient } from '@prisma/client';
import { loadBackendEnvironment } from '../environment.cjs';

loadBackendEnvironment();

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (databaseUrl?.hostname.endsWith('.neon.tech')) {
  // One reusable Prisma client per API process, with a small bounded pool.
  for (const [key, value] of Object.entries({ connection_limit: '5', pool_timeout: '20', connect_timeout: '15' })) {
    if (!databaseUrl.searchParams.has(key)) databaseUrl.searchParams.set(key, value);
  }
}

export const prisma = new PrismaClient({
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl.toString() } } } : {}),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
