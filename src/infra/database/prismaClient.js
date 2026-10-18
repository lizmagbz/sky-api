import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.ts';

export function createPrismaClient(databaseUrl) {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  return new PrismaClient({ adapter });
}
