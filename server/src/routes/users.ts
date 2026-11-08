import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { users } from "../schema.js";
import { currentUser, requireAuth } from "../scope.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Org crew list (id + name + role). Powers dashboard crew labels and
// (future) job assignment pickers. Scoped to the session org, no hashes.
usersRouter.get("/", async (req, res) => {
  const me = currentUser(req)!;
  const rows = await getDb()
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.orgId, me.orgId))
    .orderBy(asc(users.name));
  res.json(rows);
});
