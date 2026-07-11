import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://times:times@localhost:5432/times";

// Reuse the pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { __pool?: Pool };

const pool = globalForDb.__pool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
export type DB = typeof db;
