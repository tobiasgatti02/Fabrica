import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export function getDb(connectionString: string | undefined) {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is unavailable. Add the pooled Neon connection string to the runtime environment.',
    );
  }

  return drizzle(neon(connectionString), { schema });
}
