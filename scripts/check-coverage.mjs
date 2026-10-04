/**
 * Explain why a postcode is or is not covered.
 *
 * "Nobody covers CH43" is the same message whether there are no operatives at
 * all, the one you added is still pending, they are approved for the wrong
 * trade, or you are pointed at a different database from the live site. This
 * runs the booking page's own coverage query and then shows the parts that
 * feed it, so the answer is visible rather than guessed at.
 *
 *   DATABASE_URL='postgres://...' node scripts/check-coverage.mjs CH43
 */
import { neon } from "@neondatabase/serverless";
import { databaseUrl } from "./lib/env.mjs";

const url = databaseUrl();

const outward = (process.argv[2] ?? "CH43").trim().toUpperCase();
const sql = neon(url);

// Which database is this, actually? The usual cause of a confusing answer is
// being pointed at a different one from the site.
const [{ db, host }] = await sql`SELECT current_database() AS db, inet_server_addr()::text AS host`;
console.log(`\n  Database: ${db}${host ? ` on ${host}` : ""}`);

const tables = await sql`SELECT to_regclass('public.cleaners') IS NOT NULL AS ready`;
if (!tables[0].ready) {
  console.log(`
  The schema does not exist yet. It creates itself on the first request to the
  live site, so load /book once and run this again.
`);
  process.exit(0);
}

const services = await sql`SELECT code, label, active FROM services ORDER BY sort`;
const cleaners = await sql`
  SELECT c.id, c.name, c.status, c.phone,
         coalesce(array_agg(DISTINCT cs.service_code) FILTER (WHERE cs.service_code IS NOT NULL), '{}') AS services,
         coalesce(array_agg(DISTINCT a.outward)      FILTER (WHERE a.outward      IS NOT NULL), '{}') AS areas,
         count(DISTINCT av.weekday) AS days
    FROM cleaners c
    LEFT JOIN cleaner_services cs ON cs.cleaner_id = c.id
    LEFT JOIN cleaner_areas a     ON a.cleaner_id  = c.id
    LEFT JOIN cleaner_availability av ON av.cleaner_id = c.id AND (av.am OR av.pm)
   GROUP BY c.id ORDER BY c.id`;

console.log(`  Services on the price list: ${services.length ? services.map((s) => s.code + (s.active ? "" : " (inactive)")).join(", ") : "NONE — the price list has not seeded"}`);
console.log(`  Operatives on file: ${cleaners.length}\n`);

for (const c of cleaners) {
  console.log(`    #${c.id} ${c.name} — ${c.status}`);
  console.log(`       phone    ${c.phone}`);
  console.log(`       services ${c.services.length ? c.services.join(", ") : "none"}`);
  console.log(`       areas    ${c.areas.length ? c.areas.join(", ") : "none"}`);
  console.log(`       diary    ${c.days} day(s) with any availability`);
}

console.log(`\n  Coverage of ${outward}, by the booking page's own query:\n`);
for (const service of services.filter((s) => s.active)) {
  const [{ n }] = await sql`
    SELECT count(*)::int AS n
      FROM cleaners c
      JOIN cleaner_services cs ON cs.cleaner_id = c.id AND cs.service_code = ${service.code}
     WHERE c.status = 'approved'
       AND EXISTS (SELECT 1 FROM cleaner_areas a WHERE a.cleaner_id = c.id AND a.outward = ${outward})`;
  console.log(`    ${service.code.padEnd(12)} ${n > 0 ? `covered by ${n}` : "NOT COVERED"}`);
}

// Name the single most likely reason, rather than leaving it to be worked out.
const approved = cleaners.filter((c) => c.status === "approved");
const here = approved.filter((c) => c.areas.includes(outward));
console.log("");
if (!cleaners.length) console.log(`  Nobody is on file at all — either the seed script was never run, or it ran against a different database.`);
else if (!approved.length) console.log(`  Everybody on file is still '${cleaners[0].status}'. Approve them in /admin/cleaners.`);
else if (!here.length) console.log(`  Approved operatives exist, but none lists ${outward}. Their areas are shown above.`);
else if (!here.some((c) => c.services.length)) console.log(`  Somebody covers ${outward} but is approved for no trade, so they are offered nothing.`);
else console.log(`  ${outward} is covered. If the site still says otherwise it is reading a different database, or serving an older deployment.`);
console.log("");
