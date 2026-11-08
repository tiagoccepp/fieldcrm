// Demo seed: fictional Denver shop "Blue Ridge Plumbing".
// Idempotent: skips when the org already exists. Prints demo logins.
import { eq } from "drizzle-orm";
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

async function main(): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.name, "Blue Ridge Plumbing"))
    .limit(1);
  if (existing.length > 0) {
    console.log("seed: demo org already exists, skipping");
    return;
  }
  const [org] = await db.insert(orgs).values({ name: "Blue Ridge Plumbing" }).returning();
  const pw = await hashPassword(PASSWORD);
  const [owner, dispatcher, sam, joe] = await db
    .insert(users)
    .values([
      { orgId: org.id, email: "ana@blueridge.example", name: "Ana Ruiz", role: "owner", passwordHash: pw },
      { orgId: org.id, email: "luis@blueridge.example", name: "Luis Ferry", role: "dispatcher", passwordHash: pw },
      { orgId: org.id, email: "sam@blueridge.example", name: "Sam Carter", role: "tech", passwordHash: pw },
      { orgId: org.id, email: "joe@blueridge.example", name: "Joe Park", role: "tech", passwordHash: pw },
    ])
    .returning();

  const custRows = await db
    .insert(customers)
    .values([
      { orgId: org.id, name: "Harper House", phone: "+1 303-555-0111", address: "421 Birch St, Denver CO", notes: "Gate code 4410. Two water heaters." },
      { orgId: org.id, name: "Mile High Realty", phone: "+1 303-555-0112", address: "88 Colfax Ave, Denver CO", notes: "Property manager: 14 units." },
      { orgId: org.id, name: "Casa Dominguez", phone: "+1 303-555-0113", address: "9 Larch Ct, Lakewood CO", notes: "Spanish-speaking household." },
      { orgId: org.id, name: "Northfield School", phone: "+1 303-555-0114", address: "2100 Willow Rd, Denver CO", notes: "Work only after 15:00." },
      { orgId: org.id, name: "LoDo Lofts HOA", phone: "+1 303-555-0115", address: "1500 Market St, Denver CO", notes: "Common-area drains." },
    ])
    .returning();
  const [harper, realty, dominguez, school, hoa] = custRows;

  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const jobSeeds = [
    { customer: harper, tech: sam, title: "Water heater replacement", status: "done" as const, price: 145000, off: -6, paid: true, steps: ["Shut off water + gas", "Drain and remove old unit", "Install 50-gal unit", "Test + haul away"] },
    { customer: realty, tech: sam, title: "Unit 4B drain stack clog", status: "on_site" as const, price: 32000, off: 0, paid: false, steps: ["Camera inspection", "Hydro-jet stack", "Verify flow on 3 floors"] },
    { customer: dominguez, tech: joe, title: "Kitchen repipe estimate", status: "en_route" as const, price: 0, off: 0, paid: false, steps: ["Measure runs", "Photo under-sink", "Write estimate"] },
    { customer: school, tech: joe, title: "Boiler room annual service", status: "scheduled" as const, price: 89000, off: 2, paid: false, steps: ["Flush + descale", "Replace anode", "Pressure test"] },
    { customer: hoa, tech: sam, title: "Garage sump pump failure", status: "scheduled" as const, price: 67000, off: 1, paid: false, steps: ["Diagnose float switch", "Replace pump", "Flood test pit"] },
    { customer: harper, tech: sam, title: "Guest bath faucet leak", status: "done" as const, price: 18000, off: -3, paid: false, steps: ["Replace cartridge", "Check shutoffs"] },
    { customer: realty, tech: joe, title: "Unit 9A no hot water", status: "on_site" as const, price: 24000, off: 0, paid: false, steps: ["Check pilot + thermocouple", "Flush sediment"] },
    { customer: dominguez, tech: null, title: "Sewer line camera (quote)", status: "scheduled" as const, price: 0, off: 4, paid: false, steps: ["Camera 100ft", "Mark line", "Send video link"] },
  ];
  for (const s of jobSeeds) {
    const [job] = await db
      .insert(jobs)
      .values({
        orgId: org.id,
        customerId: s.customer.id,
        title: s.title,
        status: s.status,
        priceCents: s.price,
        scheduledFor: new Date(now + s.off * day),
        completedAt: s.status === "done" ? new Date(now + s.off * day) : null,
        assignedTo: s.tech ? s.tech.id : null,
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
      orgId: org.id,
      jobId: job.id,
      kind: "created",
      body: `${dispatcher.name} scheduled the job`,
    });
  }

  await db.insert(followups).values([
    { orgId: org.id, customerId: harper.id, title: "Ask about the new heater", dueAt: new Date(now - 1 * day), done: false },
    { orgId: org.id, customerId: realty.id, title: "Send stack jetting invoice", dueAt: new Date(now + 1 * day), done: false },
    { orgId: org.id, customerId: school.id, title: "Confirm after-hours access", dueAt: new Date(now + 1 * day), done: false },
    { orgId: org.id, customerId: hoa.id, title: "Quote sump maintenance plan", dueAt: new Date(now - 5 * day), done: true },
  ]);

  console.log("seed: Blue Ridge Plumbing ready");
  console.log("  owner      ana@blueridge.example / Demo1234!");
  console.log("  dispatcher luis@blueridge.example / Demo1234!");
  console.log("  tech       sam@blueridge.example / Demo1234!");
  void owner;
}

main()
  .catch((err) => {
    console.error(`seed: FAILED ${String(err).slice(0, 300)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
