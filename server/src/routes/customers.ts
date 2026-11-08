import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { customers } from "../schema.js";
import { currentUser, requireAuth, requireRole } from "../scope.js";

export const customersRouter = Router();
customersRouter.use(requireAuth);

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

customersRouter.get("/", async (req, res) => {
  const me = currentUser(req)!;
  const rows = await getDb()
    .select()
    .from(customers)
    .where(eq(customers.orgId, me.orgId))
    .orderBy(asc(customers.name))
    .limit(200);
  res.json(rows);
});

customersRouter.post("/", requireRole("owner", "dispatcher"), async (req, res) => {
  const me = currentUser(req)!;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = clean(b.name, 120);
  if (!name) {
    res.status(400).json({ error: "Customer name required" });
    return;
  }
  const [row] = await getDb()
    .insert(customers)
    .values({
      orgId: me.orgId,
      name,
      phone: clean(b.phone, 40),
      email: clean(b.email, 254),
      address: clean(b.address, 240),
      notes: clean(b.notes, 2000),
    })
    .returning();
  res.status(201).json(row);
});

customersRouter.get("/:id", async (req, res) => {
  const me = currentUser(req)!;
  const rows = await getDb()
    .select()
    .from(customers)
    .where(and(eq(customers.orgId, me.orgId), eq(customers.id, req.params.id as string)))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(rows[0]);
});

customersRouter.patch("/:id", requireRole("owner", "dispatcher"), async (req, res) => {
  const me = currentUser(req)!;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<typeof customers.$inferInsert> = {};
  for (const k of ["name", "phone", "email", "address", "notes"] as const) {
    if (b[k] !== undefined) {
      const max = k === "notes" ? 2000 : k === "email" ? 254 : k === "address" ? 240 : 120;
      const v = clean(b[k], max);
      if (k === "name" && !v) {
        res.status(400).json({ error: "Customer name cannot be empty" });
        return;
      }
      (patch as Record<string, unknown>)[k] = v;
    }
  }
  const rows = await getDb()
    .update(customers)
    .set(patch)
    .where(and(eq(customers.orgId, me.orgId), eq(customers.id, req.params.id as string)))
    .returning();
  if (rows.length === 0) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(rows[0]);
});
