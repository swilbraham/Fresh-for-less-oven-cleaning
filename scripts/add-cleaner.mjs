/**
 * Add an approved operative straight into the database.
 *
 * The supported route is /pro/register followed by an approval in /admin, and
 * that is what a real contractor should use. This exists for the two cases
 * that route cannot cover: standing a site up before it has anybody on it, and
 * putting a known test operative in so a booking can be watched all the way
 * through to an offer.
 *
 * Usage, from the project root:
 *
 *   DATABASE_URL='postgres://...' node scripts/add-cleaner.mjs \
 *     --name "Mark Reynolds" \
 *     --business "Reynolds Oven Care" \
 *     --email mark@example.com \
 *     --phone 07725646830 \
 *     --areas CH41,CH42,CH43,CH44
 *
 * Omitting --services approves them for every active service. The operative is
 * created approved and available all seven days, so they are offered work from
 * the next booking onward.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is not set. Copy it from the Vercel project's environment variables.");

const name = args.get("name");
const email = (args.get("email") ?? "").trim().toLowerCase();
const rawPhone = args.get("phone") ?? "";
const business = args.get("business") ?? name;
const areas = (args.get("areas") ?? "").split(",").map((a) => a.trim().toUpperCase()).filter(Boolean);
const services = (args.get("services") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const password = args.get("password") ?? randomBytes(9).toString("base64url");

if (!name) fail("--name is required.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("--email must be a real-looking email address.");

/**
 * Same rule as src/lib/marketplace/phone.ts. Checked here rather than left to
 * the database because a malformed number fails silently later: the operative
 * is created, jobs are offered to them, and no text is ever delivered.
 */
function toE164(input) {
  const digits = String(input ?? "").replace(/[\s()\-.]/g, "");
  let national;
  if (digits.startsWith("+44")) national = digits.slice(3);
  else if (digits.startsWith("0044")) national = digits.slice(4);
  else if (digits.startsWith("44") && digits.length >= 12) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else return null;
  return /^[1-9]\d{9}$/.test(national) ? `+44${national}` : null;
}

const phone = toE164(rawPhone);
if (!phone) {
  fail(
    `"${rawPhone}" is not a valid UK number.\n` +
      `  A UK mobile is 11 digits starting 07, or +44 then 10 digits starting 7.\n` +
      `  Count the digits - one short is the usual cause.`
  );
}
if (!phone.startsWith("+447")) {
  console.warn(`  Warning: ${phone} is a landline. Job offers go out by text, so this operative will never see one.`);
}

const sql = neon(url);
const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;

const existing = await sql`SELECT id FROM cleaners WHERE lower(email) = ${email}`;
if (existing.length) fail(`Somebody is already registered with ${email} (id ${existing[0].id}).`);

const [cleaner] = await sql`
  INSERT INTO cleaners (name, business_name, email, phone, password_hash, status, reviewed_at)
  VALUES (${name}, ${business}, ${email}, ${phone}, ${passwordHash}, 'approved', now())
  RETURNING id`;

const active = services.length
  ? await sql`SELECT code FROM services WHERE active AND code = ANY(${services})`
  : await sql`SELECT code FROM services WHERE active`;
if (!active.length) fail("No matching active services - has the site been loaded once to seed the price list?");

for (const { code } of active) {
  await sql`INSERT INTO cleaner_services (cleaner_id, service_code) VALUES (${cleaner.id}, ${code}) ON CONFLICT DO NOTHING`;
}
for (const outward of areas) {
  await sql`INSERT INTO cleaner_areas (cleaner_id, outward) VALUES (${cleaner.id}, ${outward}) ON CONFLICT DO NOTHING`;
}
// All seven days, both halves. Narrow it in /admin once they say when they
// actually work - an operative texted about Sunday work they never do is the
// fastest way to lose one.
for (let weekday = 0; weekday < 7; weekday++) {
  await sql`INSERT INTO cleaner_availability (cleaner_id, weekday, am, pm) VALUES (${cleaner.id}, ${weekday}, true, true) ON CONFLICT DO NOTHING`;
}

console.log(`
  Added ${name} (id ${cleaner.id}), approved and live.

  Phone      ${phone}
  Email      ${email}
  Password   ${password}
  Services   ${active.map((s) => s.code).join(", ")}
  Coverage   ${areas.length ? areas.join(", ") : "NONE - they are offered nothing until you add postcodes in /admin/cleaners"}
  Diary      all seven days, am and pm

  They sign in at /pro. Change the password there.
`);
