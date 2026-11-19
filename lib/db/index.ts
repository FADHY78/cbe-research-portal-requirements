import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { cbePool?: Pool }

export const pool = globalForDb.cbePool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') globalForDb.cbePool = pool

export const db = drizzle(pool, { schema })
