// Applies drizzle/*.sql in filename order, tracking in __migrations.
// Idempotent: safe to run on every deploy (Render release step).
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate(url = process.env.DATABASE_URL): Promise<string[]> {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const done = new Set(
      (await pool.query("SELECT name FROM __migrations")).rows.map((r) => r.name as string),
    );
    const dir = join(here, "..", "drizzle");
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    } catch {
      files = [];
    }
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(join(dir, f), "utf8");
      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query("INSERT INTO __migrations (name) VALUES ($1)", [f]);
        await pool.query("COMMIT");
        applied.push(f);
      } catch (err) {
        await pool.query("ROLLBACK");
        throw err;
      }
    }
    return applied;
  } finally {
    await pool.end();
  }
}

if (process.env.VITEST !== "true") {
  migrate()
    .then((applied) => {
      // eslint-disable-next-line no-console
      console.log(`migrate: ${applied.length} applied${applied.length ? ` (${applied.join(", ")})` : ""}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`migrate: FAILED ${String(err).slice(0, 300)}`);
      process.exit(1);
    });
}
