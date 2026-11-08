import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema.js";

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  pool = new Pool({ connectionString: url, max: 10 });
  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "pg pool error", err: String(err) }));
  });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    db = null;
    await p.end();
  }
}

export { schema };
