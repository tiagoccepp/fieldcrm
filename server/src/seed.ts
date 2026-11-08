// Demo seed: fictional Denver shop "Blue Ridge Window Cleaning".
// Window-cleaning flavor for a window-cleaner CRM founder demo.
// Idempotent + migratory:
//   - fresh DB: inserts org, users, customers, jobs, followups.
//   - existing "Blue Ridge Plumbing" org (v1 seed): renames the org,
//     wipes demo rows (jobs/steps/followups/activities/customers) and
//     reseeds window-cleaning data. USERS ARE NEVER TOUCHED — the
//     demo logins (luis@blueridge.example / Demo1234!) stay valid.
//   - already-seeded v2 (marker customer present): skips.
// Prints demo logins.
import { and, eq } from "drizzle-orm";
import { getDb, closeDb } from "./lib/db.js";
import { hashPassword } from "./lib/password.js";
import {
  activities,
  customers,
  followups,
  jobs,
  jobSteps,
  orgs,
  users,
} from "./schema.js";

const PASSWORD = "Demo1234!";
const ORG_NEW = "Blue Ridge Window Cleaning";
const ORG_OLD = "Blue Ridge Plumbing";
// Marker customer: present only in the v2 (window-cleaning) seed.
const SEED_MARKER = "Sunset Towers HOA";

interface SeedCustomer {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

const CUSTOMERS: SeedCustomer[] = [
  { name: "Harbor Café", phone: "+1 303-555-0121", address: "421 Birch St, Denver CO", notes: "Biweekly storefront route. Service before 08:00." },
  { name: "Mile High Realty", phone: "+1 303-555-0112", address: "88 Colfax Ave, Denver CO", notes: "Property manager: 14 units. Monthly storefront row." },
  { name: "Casa Dominguez", phone: "+1 303-555-0113", address: "9 Larch Ct, Lakewood CO", notes: "Spanish-speaking household. Biannual full-house wash." },
  { name: "Clearview Offices", phone: "+1 303-555-0124", address: "2100 Willow Rd, Denver CO", notes: "Monthly lobby + interior glass. After 18:00 only." },
  { name: "LoDo Lofts HOA", phone: "+1 303-555-0115", address: "1500 Market St, Denver CO", notes: "Common-area glass + skylights. Quarterly." },
  { name: "Sunset Towers HOA", phone: "+1 303-555-0126", address: "1200 Grant St, Denver CO", notes: "Quarterly tower exterior, 84 units. Lift via garage." },
  { name: "Northfield School", phone: "+1 303-555-0114", address: "4500 MLK Blvd, Denver CO", notes: "Gym + classroom windows. Summer deep-clean." },
  { name: "Peak Dental Studio", phone: "+1 303-555-0128", address: "77 Clarkson St, Denver CO", notes: "Monthly interior + mirrors. Vinegar-only products." },
];

type TechKey = "sam" | "joe" | "mia" | null;

interface SeedJob {
  customer: string;
  tech: TechKey;
  title: string;
  status: "scheduled" | "en_route" | "on_site" | "done";
  price: number;
  off: number;
  paid: boolean;
  steps: string[];
}

const JOBS: SeedJob[] = [
  // --- Today: crews out on routes (dashboard "Today" must feel alive) ---
  { customer: "Sunset Towers HOA", tech: "sam", title: "Tower B exterior — quarterly", status: "on_site", price: 185000, off: 0, paid: false, steps: ["Stage lift + cones", "Exterior passes 1–12", "Rinse + squeegee check", "Photo log"] },
  { customer: "Harbor Café", tech: "joe", title: "Storefront glass — biweekly route", status: "en_route", price: 9500, off: 0, paid: false, steps: ["Exterior panes", "Door glass + decals", "Sidewalk rinse"] },
  { customer: "Clearview Offices", tech: "mia", title: "Lobby + interior glass — monthly", status: "en_route", price: 42000, off: 0, paid: false, steps: ["Lobby panes", "Conference rooms", "Elevator glass"] },
  { customer: "Mile High Realty", tech: "joe", title: "Unit 4B move-out wash", status: "on_site", price: 24000, off: 0, paid: false, steps: ["Interior panes + tracks", "Exterior reachable", "Screen wipe-down"] },
  // --- Upcoming visits ---
  { customer: "LoDo Lofts HOA", tech: "sam", title: "Skylight + atrium wash", status: "scheduled", price: 67000, off: 1, paid: false, steps: ["Atrium interior", "Skylight exterior", "Gutter-line rinse"] },
  { customer: "Peak Dental Studio", tech: "mia", title: "Interior glass — monthly route", status: "scheduled", price: 18000, off: 1, paid: false, steps: ["Waiting-room glass", "Operatory mirrors", "Front doors"] },
  { customer: "Casa Dominguez", tech: "joe", title: "Full-house wash + screens", status: "scheduled", price: 39000, off: 2, paid: false, steps: ["Exterior all sides", "Screens + tracks", "Final walkthrough"] },
  { customer: "Northfield School", tech: null, title: "Gym windows deep-clean", status: "scheduled", price: 89000, off: 4, paid: false, steps: ["High panes (pole)", "Lower panes", "Sill wipe-down"] },
  // --- Recently done (collected revenue + one outstanding) ---
  { customer: "Harbor Café", tech: "joe", title: "Storefront glass — biweekly route", status: "done", price: 9500, off: -3, paid: true, steps: ["Exterior panes", "Door glass + decals"] },
  { customer: "Sunset Towers HOA", tech: "sam", title: "Tower A exterior — quarterly", status: "done", price: 185000, off: -6, paid: true, steps: ["Stage lift + cones", "Exterior passes 1–12", "Photo log"] },
  { customer: "Casa Dominguez", tech: "mia", title: "Spring full-house wash", status: "done", price: 35000, off: -9, paid: true, steps: ["Exterior all sides", "Screens + tracks"] },
  { customer: "Mile High Realty", tech: "sam", title: "Storefront row — monthly route", status: "done", price: 52000, off: -13, paid: false, steps: ["6 storefronts", "Transom glass"] },
];

interface SeedFollowup {
  customer: string;
  title: string;
  dueOff: number;
  done: boolean;
}

const FOLLOWUPS: SeedFollowup[] = [
  { customer: "Sunset Towers HOA", title: "Confirm lift permit for Tower C", dueOff: -1, done: false },
  { customer: "Sunset Towers HOA", title: "Send Tower A invoice", dueOff: 1, done: false },
  { customer: "Peak Dental Studio", title: "Pitch quarterly exterior plan", dueOff: 1, done: false },
  { customer: "LoDo Lofts HOA", title: "Reschedule skylights (rain window)", dueOff: 2, done: false },
  { customer: "Casa Dominguez", title: "Quote screen replacements", dueOff: -5, done: true },
];

async function main(): Promise<void> {
  const db = getDb();

  // Find the demo org under either name (orgs table is tiny).
  const orgRows = await db.select({ id: orgs.id, name: orgs.name }).from(orgs);
  const demo = orgRows.find((o) => o.name === ORG_NEW || o.name === ORG_OLD);

  let orgId: string;
  if (!demo) {
    const [org] = await db.insert(orgs).values({ name: ORG_NEW }).returning();
    orgId = org.id;
    const pw = await hashPassword(PASSWORD);
    await db.insert(users).values([
      { orgId, email: "ana@blueridge.example", name: "Ana Ruiz", role: "owner", passwordHash: pw },
      { orgId, email: "luis@blueridge.example", name: "Luis Ferry", role: "dispatcher", passwordHash: pw },
      { orgId, email: "sam@blueridge.example", name: "Sam Carter", role: "tech", passwordHash: pw },
      { orgId, email: "joe@blueridge.example", name: "Joe Park", role: "tech", passwordHash: pw },
      { orgId, email: "mia@blueridge.example", name: "Mia Torres", role: "tech", passwordHash: pw },
    ]);
    console.log("seed: demo users created");
  } else {
    orgId = demo.id;
    // Already on v2? marker customer exists → nothing to do.
    const marker = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.orgId, orgId), eq(customers.name, SEED_MARKER)))
      .limit(1);
    if (demo.name === ORG_NEW && marker.length > 0) {
      console.log("seed: demo org already seeded (v2), skipping");
      return;
    }
    // Migrate v1 → v2: rename + wipe demo rows (users preserved).
    if (demo.name === ORG_OLD) {
      await db.update(orgs).set({ name: ORG_NEW }).where(eq(orgs.id, orgId));
      console.log(`seed: renamed org "${ORG_OLD}" → "${ORG_NEW}"`);
    }
    // Ensure the v2 crew exists (Mia is new in v2).
    const mia = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "mia@blueridge.example"))
      .limit(1);
    if (mia.length === 0) {
      const pw = await hashPassword(PASSWORD);
      await db
        .insert(users)
        .values({ orgId, email: "mia@blueridge.example", name: "Mia Torres", role: "tech", passwordHash: pw });
      console.log("seed: added tech mia@blueridge.example");
    }
    const jobIds = (
      await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.orgId, orgId))
    ).map((r) => r.id);
    for (const jid of jobIds) {
      await db.delete(jobSteps).where(eq(jobSteps.jobId, jid));
    }
    await db.delete(activities).where(eq(activities.orgId, orgId));
    await db.delete(followups).where(eq(followups.orgId, orgId));
    await db.delete(jobs).where(eq(jobs.orgId, orgId));
    await db.delete(customers).where(eq(customers.orgId, orgId));
    console.log("seed: wiped v1 demo rows (users preserved)");
  }

  const techRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.orgId, orgId));
  const techByEmail = Object.fromEntries(techRows.map((u) => [u.email, u.id]));
  const techId = (k: TechKey): string | null =>
    k === null ? null : (techByEmail[`${k}@blueridge.example`] ?? null);

  const custRows = await db
    .insert(customers)
    .values(CUSTOMERS.map((c) => ({ orgId, ...c })))
    .returning();
  const custByName = Object.fromEntries(custRows.map((c) => [c.name, c]));

  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const dispatcher = techRows.find((u) => u.email === "luis@blueridge.example");
  const dispatcherName = "Luis Ferry";
  void dispatcher;
  for (const s of JOBS) {
    const [job] = await db
      .insert(jobs)
      .values({
        orgId,
        customerId: custByName[s.customer].id,
        title: s.title,
        status: s.status,
        priceCents: s.price,
        scheduledFor: new Date(now + s.off * day),
        completedAt: s.status === "done" ? new Date(now + s.off * day) : null,
        assignedTo: techId(s.tech),
        paid: s.paid,
      })
      .returning();
    await db.insert(jobSteps).values(
      s.steps.map((label, i) => ({
        jobId: job.id,
        label,
        done: s.status === "done" ? true : i === 0 && (s.status === "on_site" || s.status === "en_route"),
        position: i,
      })),
    );
    await db.insert(activities).values({
      orgId,
      jobId: job.id,
      kind: "created",
      body: `${dispatcherName} scheduled the job`,
    });
  }

  await db.insert(followups).values(
    FOLLOWUPS.map((f) => ({
      orgId,
      customerId: custByName[f.customer].id,
      title: f.title,
      dueAt: new Date(now + f.dueOff * day),
      done: f.done,
    })),
  );

  console.log("seed: Blue Ridge Window Cleaning ready");
  console.log("  owner      ana@blueridge.example / Demo1234!");
  console.log("  dispatcher luis@blueridge.example / Demo1234!");
  console.log("  tech       sam@blueridge.example / Demo1234!");
}

main()
  .catch((err) => {
    console.error(`seed: FAILED ${String(err).slice(0, 300)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
