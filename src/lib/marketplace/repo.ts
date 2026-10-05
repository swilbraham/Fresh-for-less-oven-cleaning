import "server-only";
import { query, queryOne } from "./db";
import { buildQuote, type Basket, type ProtectionChoice } from "./pricing";
import { gbpShort } from "./money";
import { outwardOf, normalisePostcode } from "./postcode";
import { isMobile, toE164 } from "./phone";
import { bookingUrl } from "./auth";
import { COMMISSION_ENFORCEMENT, COMMISSION_TERMS_SHORT } from "./terms";
import { firstName } from "./names";
import {
  BRAND,
  CONTACT,
  IS_SOLO,
  V,
  siteUrl as configuredSiteUrl,
} from "@/config";
import type {
  Booking,
  Cleaner,
  Job,
  PriceBundle,
  PriceItem,
  Quote,
  Service,
  ServiceQuote,
  Settings,
  SlotWindow,
} from "./types";

/**
 * Date and timestamp columns are always selected as text via to_char so the two
 * drivers (Neon over HTTP, PGlite locally) hand back the same shapes.
 */
const JOB_COLUMNS = `
  j.id, j.ref, j.booking_id, j.service_code,
  (SELECT bk.source FROM bookings bk WHERE bk.id = j.booking_id) AS source,
  (SELECT sv.label FROM services sv WHERE sv.code = j.service_code) AS service_label,
  j.customer_name, j.customer_email, j.customer_phone,
  j.address_line, j.town, j.postcode, j.outward,
  to_char(j.slot_date, 'YYYY-MM-DD')            AS slot_date,
  j.slot_window, j.items, j.notes,
  j.subtotal_pence, j.total_pence, j.commission_pct, j.commission_pence,
  j.status, j.cleaner_id,
  j.cancelled_by, j.late_cancellation, j.rescheduled_count,
  to_char(j.created_at,   'YYYY-MM-DD HH24:MI') AS created_at,
  to_char(j.accepted_at,  'YYYY-MM-DD HH24:MI') AS accepted_at,
  to_char(j.completed_at, 'YYYY-MM-DD HH24:MI') AS completed_at,
  -- Hours until the slot opens, in UK local time so BST is handled correctly.
  EXTRACT(EPOCH FROM (
    ((j.slot_date + CASE WHEN j.slot_window = 'am' THEN time '08:00' ELSE time '12:00' END)
       AT TIME ZONE 'Europe/London') - now()
  )) / 3600 AS hours_until_slot
`;

/**
 * What a cleaner may see about a job they have NOT accepted.
 *
 * Deliberately excludes the customer's name, phone, email and street address —
 * a job is broadcast to everyone covering the postcode, so before someone
 * commits, those details would be handed to cleaners who never take the work.
 * Enforced in the query rather than the template: hiding a field in JSX leaves
 * it one careless edit from being rendered, whereas never selecting it makes
 * that edit a compile error.
 */
const OFFER_COLUMNS = `
  j.id, j.ref, j.service_code,
  (SELECT sv.label FROM services sv WHERE sv.code = j.service_code) AS service_label,
  j.outward, j.town,
  to_char(j.slot_date, 'YYYY-MM-DD') AS slot_date,
  j.slot_window, j.items, j.notes,
  j.total_pence, j.commission_pct, j.commission_pence, j.status
`;

const CLEANER_COLUMNS = `
  c.id, c.name, c.business_name, c.email, c.phone, c.status,
  c.insurance_provider,
  to_char(c.insurance_expiry, 'YYYY-MM-DD') AS insurance_expiry,
  c.years_experience, c.equipment, c.dbs_checked, c.admin_notes,
  c.notify_sms, c.notify_email,
  to_char(c.created_at,  'YYYY-MM-DD HH24:MI') AS created_at,
  to_char(c.reviewed_at, 'YYYY-MM-DD HH24:MI') AS reviewed_at
`;

// ---------------------------------------------------------------- settings --

export async function getSettings(): Promise<Settings> {
  const row = await queryOne<Settings>(
    `SELECT commission_pct, min_notice_days, booking_email,
            cancellation_notice_hours,
            payee_name, payee_account, payee_sort_code, payee_address,
            payment_terms_days, legal_footer,
            admin_mobile, admin_sms_enabled
       FROM settings WHERE id = 1`
  );
  if (!row) throw new Error("Marketplace settings row is missing.");
  return row;
}

export async function updateSettings(input: {
  commissionPct: number;
  minNoticeDays: number;
  bookingEmail: string;
  cancellationNoticeHours: number;
  payeeName: string;
  payeeAccount: string;
  payeeSortCode: string;
  payeeAddress: string;
  paymentTermsDays: number;
  legalFooter: string;
  adminMobile: string;
  adminSmsEnabled: boolean;
}): Promise<void> {
  await query(
    `UPDATE settings
        SET commission_pct = $1,
            min_notice_days = $2, booking_email = $3,
            cancellation_notice_hours = $4,
            payee_name = $5, payee_account = $6, payee_sort_code = $7,
            payee_address = $8, payment_terms_days = $9,
            legal_footer = $10,
            admin_mobile = $11, admin_sms_enabled = $12,
            updated_at = now()
      WHERE id = 1`,
    [
      input.commissionPct,
      input.minNoticeDays,
      input.bookingEmail,
      input.cancellationNoticeHours,
      input.payeeName,
      input.payeeAccount,
      input.payeeSortCode,
      input.payeeAddress,
      input.paymentTermsDays,
      input.legalFooter,
      input.adminMobile,
      input.adminSmsEnabled,
    ]
  );
}

// ---------------------------------------------------------------- services --

export async function getServices(activeOnly = false): Promise<Service[]> {
  return query<Service>(
    `SELECT * FROM services ${activeOnly ? "WHERE active" : ""} ORDER BY sort, label`
  );
}

export async function getService(code: string): Promise<Service | null> {
  return queryOne<Service>(`SELECT * FROM services WHERE code = $1`, [code]);
}

export async function upsertService(input: {
  code: string;
  label: string;
  hint: string;
  blurb: string;
  minimumChargePence: number;
  protectionPct: number;
  protectionLabel: string;
  protectionHint: string;
  sort: number;
  active: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO services
       (code, label, hint, blurb, minimum_charge_pence,
        protection_pct, protection_label, protection_hint, sort, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (code) DO UPDATE SET
       label = EXCLUDED.label, hint = EXCLUDED.hint, blurb = EXCLUDED.blurb,
       minimum_charge_pence = EXCLUDED.minimum_charge_pence,
       protection_pct = EXCLUDED.protection_pct,
       protection_label = EXCLUDED.protection_label,
       protection_hint = EXCLUDED.protection_hint,
       sort = EXCLUDED.sort, active = EXCLUDED.active`,
    [
      input.code,
      input.label,
      input.hint,
      input.blurb,
      input.minimumChargePence,
      input.protectionPct,
      input.protectionLabel,
      input.protectionHint,
      input.sort,
      input.active,
    ]
  );
}

// ------------------------------------------------------------- price list --

export async function getPriceItems(activeOnly = false): Promise<PriceItem[]> {
  return query<PriceItem>(
    `SELECT * FROM price_items ${activeOnly ? "WHERE active" : ""}
      ORDER BY service_code, sort, label`
  );
}

export async function getBundles(activeOnly = false): Promise<PriceBundle[]> {
  return query<PriceBundle>(
    `SELECT * FROM price_bundles ${activeOnly ? "WHERE active" : ""} ORDER BY item_code, qty`
  );
}

export async function upsertPriceItem(input: {
  code: string;
  serviceCode: string;
  label: string;
  hint: string;
  kind: string;
  unitPricePence: number;
  maxQty: number;
  sort: number;
  active: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO price_items
       (code, service_code, label, hint, kind, unit_price_pence, max_qty, sort, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (code) DO UPDATE SET
       service_code = EXCLUDED.service_code,
       label = EXCLUDED.label, hint = EXCLUDED.hint, kind = EXCLUDED.kind,
       unit_price_pence = EXCLUDED.unit_price_pence, max_qty = EXCLUDED.max_qty,
       sort = EXCLUDED.sort, active = EXCLUDED.active`,
    [
      input.code,
      input.serviceCode,
      input.label,
      input.hint,
      input.kind,
      input.unitPricePence,
      input.maxQty,
      input.sort,
      input.active,
    ]
  );
}

export async function deletePriceItem(code: string): Promise<void> {
  await query(`DELETE FROM price_items WHERE code = $1`, [code]);
}

export async function upsertBundle(input: {
  itemCode: string;
  qty: number;
  pricePence: number;
  label: string;
}): Promise<void> {
  await query(
    `INSERT INTO price_bundles (item_code, qty, price_pence, label)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (item_code, qty) DO UPDATE SET
       price_pence = EXCLUDED.price_pence, label = EXCLUDED.label, active = true`,
    [input.itemCode, input.qty, input.pricePence, input.label]
  );
}

export async function deleteBundle(id: number): Promise<void> {
  await query(`DELETE FROM price_bundles WHERE id = $1`, [id]);
}

// ----------------------------------------------------------------- quoting --

/**
 * The instant fixed price for a basket, always computed from live admin prices.
 * The result is split by service — one entry per job the booking will create.
 */
export async function quoteBasket(
  basket: Basket,
  protection: ProtectionChoice = {}
): Promise<Quote> {
  const [settings, services, items, bundles] = await Promise.all([
    getSettings(),
    getServices(true),
    getPriceItems(true),
    getBundles(true),
  ]);
  return buildQuote(basket, services, items, bundles, {
    // The settings row is editable in /admin/prices, so reading it blindly
    // would let a figure left in there have a solo operator charging
    // themselves commission on their own work.
    commissionPct: IS_SOLO ? 0 : Number(settings.commission_pct),
    protection,
  });
}

// ---------------------------------------------------------------- cleaners --

export async function findCleanerByEmail(email: string): Promise<
  (Cleaner & { password_hash: string }) | null
> {
  return queryOne<Cleaner & { password_hash: string }>(
    `SELECT ${CLEANER_COLUMNS}, c.password_hash
       FROM cleaners c WHERE lower(c.email) = lower($1)`,
    [email]
  );
}

export async function getCleaner(id: number): Promise<Cleaner | null> {
  return queryOne<Cleaner>(
    `SELECT ${CLEANER_COLUMNS} FROM cleaners c WHERE c.id = $1`,
    [id]
  );
}

/** The trades this cleaner may be offered work in. */
export async function getCleanerServices(cleanerId: number): Promise<string[]> {
  const rows = await query<{ service_code: string }>(
    `SELECT service_code FROM cleaner_services WHERE cleaner_id = $1`,
    [cleanerId]
  );
  return rows.map((r) => r.service_code);
}

/**
 * Replace a cleaner's trades. Batched insert-then-prune for the same reason as
 * coverage: one round trip per operation rather than one per row.
 */
export async function setCleanerServices(
  cleanerId: number,
  codes: string[]
): Promise<void> {
  if (codes.length > 0) {
    await query(
      `INSERT INTO cleaner_services (cleaner_id, service_code)
       SELECT $1, code FROM services WHERE code = ANY($2::text[])
       ON CONFLICT DO NOTHING`,
      [cleanerId, codes]
    );
  }
  await query(
    `DELETE FROM cleaner_services
      WHERE cleaner_id = $1 AND NOT (service_code = ANY($2::text[]))`,
    [cleanerId, codes]
  );
}

/** Trades per cleaner for a list of cleaners, as one query rather than N. */
export async function servicesForCleaners(
  cleanerIds: number[]
): Promise<Record<number, string[]>> {
  if (cleanerIds.length === 0) return {};
  const rows = await query<{ cleaner_id: number; service_code: string }>(
    `SELECT cs.cleaner_id, cs.service_code
       FROM cleaner_services cs
       JOIN services s ON s.code = cs.service_code
      WHERE cs.cleaner_id = ANY($1::int[])
      ORDER BY s.sort`,
    [cleanerIds]
  );
  const out: Record<number, string[]> = {};
  for (const row of rows) {
    (out[row.cleaner_id] ??= []).push(row.service_code);
  }
  return out;
}

export async function createCleaner(input: {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  passwordHash: string;
  insuranceProvider: string;
  insuranceExpiry: string | null;
  yearsExperience: number;
  equipment: string;
}): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO cleaners
       (name, business_name, email, phone, password_hash,
        insurance_provider, insurance_expiry, years_experience, equipment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      input.name,
      input.businessName,
      input.email,
      input.phone,
      input.passwordHash,
      input.insuranceProvider,
      input.insuranceExpiry,
      input.yearsExperience,
      input.equipment,
    ]
  );
  return row!.id;
}

export async function listCleaners(status?: string): Promise<
  (Cleaner & { areas: number; services: number; jobs_done: number })[]
> {
  return query(
    `SELECT ${CLEANER_COLUMNS},
            (SELECT count(*)::int FROM cleaner_areas a WHERE a.cleaner_id = c.id) AS areas,
            (SELECT count(*)::int FROM cleaner_services cs WHERE cs.cleaner_id = c.id) AS services,
            (SELECT count(*)::int FROM jobs j
               WHERE j.cleaner_id = c.id AND j.status = 'completed')             AS jobs_done
       FROM cleaners c
      ${status ? "WHERE c.status = $1" : ""}
      ORDER BY
        CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        c.created_at DESC`,
    status ? [status] : []
  );
}

export async function setCleanerStatus(
  id: number,
  status: string,
  adminNotes?: string
): Promise<void> {
  await query(
    `UPDATE cleaners
        SET status = $2,
            admin_notes = COALESCE($3, admin_notes),
            reviewed_at = now()
      WHERE id = $1`,
    [id, status, adminNotes ?? null]
  );
}

// ------------------------------------------------- coverage & availability --

export async function getCleanerAreas(cleanerId: number): Promise<string[]> {
  const rows = await query<{ outward: string }>(
    `SELECT outward FROM cleaner_areas WHERE cleaner_id = $1 ORDER BY outward`,
    [cleanerId]
  );
  return rows.map((r) => r.outward);
}

/**
 * Replace a cleaner's coverage in two round trips rather than one per postcode.
 *
 * The previous version deleted then inserted row by row: 136 sequential HTTP
 * queries for a realistic patch, which is instant against the embedded local
 * database and slow enough on Neon to hit the serverless timeout. Insert first,
 * then prune, so a failure mid-way can never leave a cleaner covering nothing.
 */
export async function setCleanerAreas(
  cleanerId: number,
  outwards: string[]
): Promise<void> {
  if (outwards.length > 0) {
    await query(
      `INSERT INTO cleaner_areas (cleaner_id, outward)
       SELECT $1, unnest($2::text[])
       ON CONFLICT DO NOTHING`,
      [cleanerId, outwards]
    );
  }
  await query(
    `DELETE FROM cleaner_areas
      WHERE cleaner_id = $1 AND NOT (outward = ANY($2::text[]))`,
    [cleanerId, outwards]
  );
}

export type Availability = { weekday: number; am: boolean; pm: boolean };

export async function getAvailability(
  cleanerId: number
): Promise<Availability[]> {
  return query<Availability>(
    `SELECT weekday, am, pm FROM cleaner_availability
      WHERE cleaner_id = $1 ORDER BY weekday`,
    [cleanerId]
  );
}

export async function setAvailability(
  cleanerId: number,
  rows: Availability[]
): Promise<void> {
  const working = rows.filter((row) => row.am || row.pm);

  // Same batching as coverage — one query per operation, not one per weekday.
  if (working.length > 0) {
    await query(
      `INSERT INTO cleaner_availability (cleaner_id, weekday, am, pm)
       SELECT $1, w.weekday, w.am, w.pm
         FROM unnest($2::int[], $3::boolean[], $4::boolean[])
              AS w(weekday, am, pm)
       ON CONFLICT (cleaner_id, weekday) DO UPDATE
         SET am = EXCLUDED.am, pm = EXCLUDED.pm`,
      [
        cleanerId,
        working.map((row) => row.weekday),
        working.map((row) => row.am),
        working.map((row) => row.pm),
      ]
    );
  }
  await query(
    `DELETE FROM cleaner_availability
      WHERE cleaner_id = $1 AND NOT (weekday = ANY($2::int[]))`,
    [cleanerId, working.map((row) => row.weekday)]
  );
}

export type Blackout = { day: string; am: boolean; pm: boolean };

export async function getBlackouts(cleanerId: number): Promise<Blackout[]> {
  return query<Blackout>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, am, pm
       FROM cleaner_blackouts
      WHERE cleaner_id = $1 AND day >= CURRENT_DATE
      ORDER BY day`,
    [cleanerId]
  );
}

/** Block a half-day, a whole day, or a run of days in one go. */
export async function addBlackout(
  cleanerId: number,
  from: string,
  to: string,
  am: boolean,
  pm: boolean
): Promise<number> {
  if (!am && !pm) return 0;

  const rows = await query<{ day: string }>(
    `INSERT INTO cleaner_blackouts (cleaner_id, day, am, pm)
     SELECT $1, d::date, $4, $5
       FROM generate_series($2::date, $3::date, interval '1 day') AS d
     ON CONFLICT (cleaner_id, day) DO UPDATE
       SET am = cleaner_blackouts.am OR EXCLUDED.am,
           pm = cleaner_blackouts.pm OR EXCLUDED.pm
     RETURNING to_char(day, 'YYYY-MM-DD') AS day`,
    [cleanerId, from, to, am, pm]
  );
  return rows.length;
}

export async function removeBlackout(
  cleanerId: number,
  day: string
): Promise<void> {
  await query(
    `DELETE FROM cleaner_blackouts WHERE cleaner_id = $1 AND day = $2::date`,
    [cleanerId, day]
  );
}

// -------------------------------------------------------------- allocation --

/**
 * SQL predicate: does the operative aliased `c` cover this outward code?
 *
 * Network mode keeps the strict reading and must — a contractor is only ever
 * texted about postcodes they registered for, and loosening it here would
 * offer a Wirral job to somebody in Cornwall.
 *
 * A solo operator has no sign-up form to fill in and nobody to lose the work
 * to, so an empty coverage list reads as "wherever I'm asked" rather than
 * "nowhere": seeding every UK outward code isn't viable, and a brand-new solo
 * site that refused every postcode would take no bookings at all. List areas
 * in admin and they are back on the strict rule, so "I only do CH and L"
 * still works.
 */
function coversOutward(outward: string): string {
  const listed = `EXISTS (
    SELECT 1 FROM cleaner_areas a
     WHERE a.cleaner_id = c.id AND a.outward = ${outward}
  )`;
  if (!IS_SOLO) return listed;
  return `(${listed} OR NOT EXISTS (
    SELECT 1 FROM cleaner_areas a WHERE a.cleaner_id = c.id
  ))`;
}

/**
 * Approved cleaners who work this trade, cover the postcode, work that
 * weekday/half-day, have no blackout on the date and aren't already booked into
 * that same slot.
 *
 * The trade join is what keeps a multi-service marketplace usable: a gutter
 * specialist texted about an oven clean stops reading the texts, and then
 * misses the gutter jobs too.
 */
export async function findMatchingCleaners(
  outward: string,
  slotDate: string,
  slotWindow: SlotWindow,
  serviceCode: string
): Promise<Cleaner[]> {
  return query<Cleaner>(
    `SELECT ${CLEANER_COLUMNS}
       FROM cleaners c
       JOIN cleaner_services cs
         ON cs.cleaner_id = c.id AND cs.service_code = $4
       JOIN cleaner_availability av
         ON av.cleaner_id = c.id
        AND av.weekday = EXTRACT(DOW FROM $2::date)
        AND ((av.am AND $3 = 'am') OR (av.pm AND $3 = 'pm'))
      WHERE c.status = 'approved'
        AND ${coversOutward("$1")}
        AND NOT EXISTS (
          SELECT 1 FROM cleaner_blackouts b
           WHERE b.cleaner_id = c.id AND b.day = $2::date
             AND ((b.am AND $3 = 'am') OR (b.pm AND $3 = 'pm'))
        )
        AND NOT EXISTS (
          SELECT 1 FROM jobs j
           WHERE j.cleaner_id = c.id
             AND j.slot_date = $2::date
             AND j.slot_window = $3
             AND j.status IN ('accepted','completed')
        )
      ORDER BY c.id`,
    [outward, slotDate, slotWindow, serviceCode]
  );
}

/**
 * Does anyone do this trade in this postcode? Used before taking a booking.
 * Coverage is per trade, so "we clean windows in CH43" says nothing about
 * whether anyone there does gutters.
 */
export async function hasCoverage(
  outward: string,
  serviceCode: string
): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM cleaners c
       JOIN cleaner_services cs
         ON cs.cleaner_id = c.id AND cs.service_code = $2
      WHERE c.status = 'approved' AND ${coversOutward("$1")}`,
    [outward, serviceCode]
  );
  return (row?.n ?? 0) > 0;
}

/** Which of these trades are covered in this postcode, as one query. */
export async function coveredServices(outward: string): Promise<string[]> {
  const rows = await query<{ service_code: string }>(
    `SELECT DISTINCT cs.service_code
       FROM cleaners c
       JOIN cleaner_services cs ON cs.cleaner_id = c.id
      WHERE c.status = 'approved' AND ${coversOutward("$1")}`,
    [outward]
  );
  return rows.map((r) => r.service_code);
}

const REF_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY3479";

/**
 * Prefix on every booking reference. A customer reading "FFL-K3PQ7X" back over
 * the phone is quoting it to this business, not to the platform that built the
 * site, so it is derived from the brand rather than fixed.
 */
const REF_PREFIX: string = (() => {
  const initials = BRAND.shortName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
  if (initials.length >= 2) return initials.slice(0, 4);
  return (
    BRAND.shortName.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() ||
    "JOB"
  );
})();

function makeRef(prefix: string): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `${prefix}-${out}`;
}

export type BookingInput = {
  basket: Basket;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine: string;
  town: string;
  postcode: string;
  /** One chosen slot per service in the basket, keyed by service code. */
  slots: Record<string, { date: string; window: SlotWindow }>;
  notes: string;
  /** Service code -> whether the customer took that service's add-on. */
  protection?: ProtectionChoice;
  /** Referring site, e.g. the Fresh For Less Cleaning Services front door. */
  source?: string;
};

export type BookingResult = {
  booking: Booking;
  jobs: Job[];
  quote: Quote;
  /** Total cleaner offers sent across every job in the booking. */
  offered: number;
};

const SLOT_LABEL: Record<SlotWindow, string> = {
  am: "Morning 8am-12pm",
  pm: "Afternoon 12pm-5pm",
};

/**
 * Take one basket and turn it into a booking plus one job per service.
 *
 * The split is the whole point of the multi-service marketplace: a carpet clean
 * and a gutter clear are two visits by two different people, so they get two
 * slots, two allocations and two commission lines. What they share — the
 * customer, the address, the manage-my-booking link — lives on the booking.
 *
 * Prices are recomputed here from the live price list; the browser's figure is
 * only ever a display value.
 */
export async function createBooking(
  input: BookingInput
): Promise<BookingResult> {
  const postcode = normalisePostcode(input.postcode);
  if (!postcode) throw new Error("That postcode doesn't look right.");
  const outward = outwardOf(postcode)!;

  const quote = await quoteBasket(input.basket, input.protection ?? {});
  if (quote.services.length === 0 || quote.total_pence <= 0) {
    throw new Error(`Choose at least one thing to ${V.verb}.`);
  }

  for (const service of quote.services) {
    const slot = input.slots[service.service_code];
    if (!slot?.date || (slot.window !== "am" && slot.window !== "pm")) {
      throw new Error(`Choose a date and time for ${service.service_label.toLowerCase()}.`);
    }
  }

  const booking = await insertBooking({
    ...input,
    postcode,
    outward,
    totalPence: quote.total_pence,
  });

  const created: { job: Job; service: ServiceQuote; covered: boolean; offered: number }[] = [];

  for (const [index, service] of quote.services.entries()) {
    const slot = input.slots[service.service_code];

    // No cleaner does this trade here yet. Take the booking anyway — a job with
    // a date, an address and a price is far better than a name on a list, both
    // for the customer and as something to recruit against — but hold it as
    // provisional rather than confirming a slot nobody can work. Each service
    // is judged on its own: windows being covered says nothing about ovens.
    const covered = await hasCoverage(outward, service.service_code);

    const job = await queryOne<{ id: number }>(
      `INSERT INTO jobs
         (ref, booking_id, service_code,
          customer_name, customer_email, customer_phone, address_line, town,
          postcode, outward, slot_date, slot_window, items, notes,
          subtotal_pence, total_pence, commission_pct, commission_pence, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13::jsonb,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        `${booking.ref}-${index + 1}`,
        booking.id,
        service.service_code,
        input.customerName,
        input.customerEmail,
        input.customerPhone,
        input.addressLine,
        input.town,
        postcode,
        outward,
        slot.date,
        slot.window,
        JSON.stringify(service.lines),
        input.notes,
        service.subtotal_pence,
        service.total_pence,
        service.commission_pct,
        service.commission_pence,
        covered ? "offered" : "provisional",
      ]
    );

    // The booking confirmation below already tells a solo customer the work is
    // booked in, so the separate confirmation is suppressed here.
    const offered = covered ? await broadcastJob(job!.id, false) : 0;
    created.push({ job: (await getJob(job!.id))!, service, covered, offered });
  }

  const jobs = created.map((c) => c.job);
  const offered = created.reduce((sum, c) => sum + c.offered, 0);
  const uncovered = created.filter((c) => !c.covered);

  if (uncovered.length > 0) {
    const settings = await getSettings();
    await notify({
      recipient: settings.booking_email,
      subject: `Provisional work in ${outward} — booking ${booking.ref}`,
      body:
        `${booking.customer_name} has booked in ${booking.postcode}, where ` +
        `nobody covers ${uncovered.length === 1 ? "one of the services" : "some of the services"} ordered.\n\n` +
        uncovered
          .map(
            (c) =>
              `${c.service.service_label}: ${c.job.slot_date} ` +
              `(${c.job.slot_window.toUpperCase()}), ${gbpShort(c.job.total_pence)} — ref ${c.job.ref}`
          )
          .join("\n") +
        `\n\nPhone: ${booking.customer_phone}\n\n` +
        `They were promised confirmation within 24 hours. ` +
        (IS_SOLO
          ? `${outward} is outside the areas set in /admin/cleaners — widen it `
          : `Recruit for ${outward} `) +
        `or call them back — ${siteUrl()}/admin/jobs?status=provisional`,
      jobId: uncovered[0].job.id,
    });
  }

  const summary = created
    .map((c) => `${c.service.service_label} ${gbpShort(c.job.total_pence)}`)
    .join(", ");

  await notifyAdmin({
    subject: `New booking ${booking.ref} — ${booking.postcode}`,
    smsBody:
      `NEW BOOKING ${booking.ref}: ${booking.postcode}, ` +
      `${gbpShort(quote.total_pence)} across ${created.length} ` +
      `job${created.length === 1 ? "" : "s"} (${summary}). ` +
      (uncovered.length > 0
        ? `${uncovered.length} with NO COVER — promised confirmation within 24h.`
        : IS_SOLO
          ? `All in your diary.`
          : `Offered to ${offered} ${offered === 1 ? V.one : V.many}.`),
    jobId: jobs[0].id,
  });

  const manageLink = bookingUrl(booking.ref, siteUrl());
  const jobLines = created
    .map(
      (c) =>
        `${c.service.service_label} — ${c.job.slot_date}, ` +
        `${SLOT_LABEL[c.job.slot_window]}, ${gbpShort(c.job.total_pence)}` +
        (c.covered ? "" : " (awaiting confirmation)")
    )
    .join("\n");

  await notifyCustomer(booking, {
    subject:
      uncovered.length === created.length
        ? `Booking requested — ${booking.ref}`
        : `Booking received — ${booking.ref}`,
    body:
      `Thanks ${booking.customer_name}, here's what you've booked.\n\n` +
      `Reference: ${booking.ref}\n` +
      `Address: ${booking.address_line}, ${booking.postcode}\n\n` +
      `${jobLines}\n\n` +
      `Total: ${gbpShort(quote.total_pence)}, ` +
      (IS_SOLO
        ? `payable on the day the work is done.\n\n`
        : `payable to each ${V.one} on the day they do the work.\n\n`) +
      (uncovered.length === 0
        ? IS_SOLO
          ? `That's booked in. Call ${CONTACT.phone} if you need anything ` +
            `before then.\n\n`
          : `We're matching you with vetted ${V.many} now and will confirm ` +
            `their details as soon as each job is claimed.\n\n`
        : `We don't have everyone we need in ${outward} yet, so the jobs marked ` +
          `above are requests rather than confirmed bookings. We'll confirm ` +
          `within 24 hours, or call you to sort something out. You owe nothing ` +
          `either way.\n\n`) +
      `Need to change or cancel? Use this link any time:\n${manageLink}`,
    smsBody:
      `Booking ${booking.ref} received — ${created.length} ` +
      `job${created.length === 1 ? "" : "s"}, ${gbpShort(quote.total_pence)}. ` +
      `Details, changes and cancellation: ${manageLink}`,
    jobId: jobs[0].id,
  });

  return { booking, jobs, quote, offered };
}

/** Insert the booking row, retrying on the vanishingly rare reference clash. */
async function insertBooking(input: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine: string;
  town: string;
  postcode: string;
  outward: string;
  notes: string;
  totalPence: number;
  source?: string;
}): Promise<Booking> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const row = await queryOne<{ id: number }>(
        `INSERT INTO bookings
           (ref, customer_name, customer_email, customer_phone,
            address_line, town, postcode, outward, notes, total_pence, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          makeRef(REF_PREFIX),
          input.customerName,
          input.customerEmail,
          input.customerPhone,
          input.addressLine,
          input.town,
          input.postcode,
          input.outward,
          input.notes,
          input.totalPence,
          input.source ?? "",
        ]
      );
      return (await getBooking(row!.id))!;
    } catch (error) {
      const message = String((error as Error)?.message ?? "");
      if (!message.includes("bookings_ref_key") && !message.includes("duplicate")) {
        throw error;
      }
    }
  }
  throw new Error("Could not create the booking. Please try again.");
}

const BOOKING_COLUMNS = `
  b.id, b.ref, b.customer_name, b.customer_email, b.customer_phone,
  b.address_line, b.town, b.postcode, b.outward, b.notes, b.total_pence,
  b.source,
  to_char(b.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
`;

export async function getBooking(id: number): Promise<Booking | null> {
  return queryOne<Booking>(
    `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.id = $1`,
    [id]
  );
}

export async function getBookingByRef(ref: string): Promise<Booking | null> {
  return queryOne<Booking>(
    `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.ref = $1`,
    [String(ref ?? "").trim().toUpperCase()]
  );
}

/** Every job in a booking, in the order they were created. */
export async function getBookingJobs(bookingId: number): Promise<Job[]> {
  return query<Job>(
    `SELECT ${JOB_COLUMNS} FROM jobs j WHERE j.booking_id = $1 ORDER BY j.id`,
    [bookingId]
  );
}

/**
 * The owner's own operative row on a solo site.
 *
 * Matched on the configured contact email first — the key the seed writes it
 * under — then falling back to the first approved row, so changing that email
 * in /admin/cleaners doesn't orphan every booking taken afterwards.
 */
export async function getOwnerOperative(): Promise<Cleaner | null> {
  return queryOne<Cleaner>(
    `SELECT ${CLEANER_COLUMNS}
       FROM cleaners c
      WHERE c.status = 'approved'
      ORDER BY (lower(c.email) = lower($1)) DESC, c.id
      LIMIT 1`,
    [CONTACT.email]
  );
}

/**
 * Put the job straight in the owner's diary — the whole of solo allocation.
 *
 * Solo mode is a network of one, so every table, query and diary rule stays
 * exactly as it is and only the race disappears: there is no second person to
 * offer the work to, and texting the owner about a job that is already theirs
 * is noise they pay for. The job_offers row is still written, so job history,
 * the offer counts on /admin/jobs and acceptJob's "was this offered to you"
 * check all read identically in both modes.
 *
 * Commission is zeroed here as well as in the quote: these two are the only
 * writers of the column, and an operator invoicing themselves is the one
 * failure mode of solo mode that would show up on their books.
 */
async function assignToOwner(
  jobId: number,
  confirmToCustomer: boolean
): Promise<number> {
  const owner = await getOwnerOperative();
  if (!owner) {
    // Nothing seeded means nobody to give it to. Mark it unfilled rather than
    // leaving it sitting 'offered', which on a solo site nobody would ever see.
    await query(
      `UPDATE jobs SET status = 'unfilled' WHERE id = $1 AND status = 'offered'`,
      [jobId]
    );
    return 0;
  }

  await query(
    `UPDATE jobs
        SET status = 'accepted', cleaner_id = $2, accepted_at = now(),
            commission_pct = 0, commission_pence = 0
      WHERE id = $1 AND status IN ('provisional', 'offered')`,
    [jobId, owner.id]
  );
  await query(
    `INSERT INTO job_offers (job_id, cleaner_id, response, responded_at)
     VALUES ($1,$2,'accepted', now())
     ON CONFLICT (job_id, cleaner_id)
     DO UPDATE SET response = 'accepted', responded_at = now()`,
    [jobId, owner.id]
  );

  if (confirmToCustomer) {
    const job = await getJob(jobId);
    if (job) await confirmCleanerToCustomer(job, owner);
  }

  return 1;
}

/** Offer the job to every matching cleaner at once — first to accept wins. */
export async function broadcastJob(
  jobId: number,
  /**
   * Solo mode only: whether to send a separate "here's who's coming" message.
   * Callers that already tell the customer the job is booked pass false — on a
   * solo site those are the same event, and both means two texts per booking.
   */
  confirmToCustomer = true
): Promise<number> {
  if (IS_SOLO) return assignToOwner(jobId, confirmToCustomer);

  const job = await getJob(jobId);
  if (!job) return 0;
  const matches = await findMatchingCleaners(
    job.outward,
    job.slot_date,
    job.slot_window,
    job.service_code
  );

  for (const cleaner of matches) {
    await query(
      `INSERT INTO job_offers (job_id, cleaner_id) VALUES ($1,$2)
       ON CONFLICT (job_id, cleaner_id) DO NOTHING`,
      [jobId, cleaner.id]
    );
    const items = job.items.map((line) => `${line.qty}x ${line.label}`).join(", ");
    const youKeep = gbpShort(job.total_pence - job.commission_pence);

    // The trade leads every message. A cleaner signed up for two of them needs
    // to know which one this is before deciding whether to drop what they're
    // doing — and in a lock-screen preview, only the first few words survive.
    await notifyCleaner(cleaner, {
      subject: `New ${job.service_label.toLowerCase()} job — ${job.postcode} on ${job.slot_date} (${gbpShort(job.total_pence)})`,
      body:
        `${cleaner.name}, a new ${job.service_label.toLowerCase()} job is up ` +
        `for grabs in ${job.outward}.\n\n` +
        `Date: ${job.slot_date} (${job.slot_window.toUpperCase()})\n` +
        `Job: ${items}\n` +
        `Job value: ${gbpShort(job.total_pence)}\n` +
        `Commission: ${gbpShort(job.commission_pence)} — you keep ${youKeep}\n` +
        `${COMMISSION_TERMS_SHORT}\n\n` +
        `First to accept gets it — open your dashboard at ${siteUrl()}/pro/dashboard.`,
      smsBody:
        `${job.service_label.toUpperCase()} ${job.outward}, ${job.slot_date} ` +
        `${job.slot_window.toUpperCase()}. ` +
        `${gbpShort(job.total_pence)}, you keep ${youKeep}. ` +
        `First to accept wins: ${siteUrl()}/pro/dashboard`,
      jobId,
    });
  }

  if (matches.length === 0) {
    await query(
      `UPDATE jobs SET status = 'unfilled' WHERE id = $1 AND status = 'offered'`,
      [jobId]
    );
  }

  return matches.length;
}

/**
 * First-to-accept-wins. The conditional UPDATE is the whole race: only one
 * concurrent request can move the job out of 'offered', so a second acceptance
 * updates zero rows and is told the job has gone.
 */
export async function acceptJob(
  jobId: number,
  cleanerId: number
): Promise<{ ok: boolean; reason?: string }> {
  const offer = await queryOne<{ id: number }>(
    `SELECT id FROM job_offers WHERE job_id = $1 AND cleaner_id = $2`,
    [jobId, cleanerId]
  );
  if (!offer) return { ok: false, reason: "This job wasn't offered to you." };

  const won = await query<{ id: number }>(
    `UPDATE jobs
        SET status = 'accepted', cleaner_id = $2, accepted_at = now()
      WHERE id = $1 AND status = 'offered' AND cleaner_id IS NULL
      RETURNING id`,
    [jobId, cleanerId]
  );

  if (won.length === 0) {
    // The update lost the race — but not necessarily to someone else. A double
    // click, or a retry after the dashboard refreshed, lands here too, so work
    // out what actually happened before blaming another cleaner.
    const current = await getJob(jobId);
    if (current?.cleaner_id === cleanerId) {
      return { ok: true };
    }
    if (current?.status === "cancelled") {
      return { ok: false, reason: "That booking has been cancelled." };
    }
    return { ok: false, reason: `Another ${V.one} accepted this job first.` };
  }

  await query(
    `UPDATE job_offers SET response = 'accepted', responded_at = now()
      WHERE job_id = $1 AND cleaner_id = $2`,
    [jobId, cleanerId]
  );

  const job = await getJob(jobId);
  const cleaner = await getCleaner(cleanerId);
  if (job && cleaner) await confirmCleanerToCustomer(job, cleaner);

  return { ok: true };
}

/** Tell the customer who is coming. Shared by acceptance and assignment. */
async function confirmCleanerToCustomer(
  job: Job,
  cleaner: Cleaner
): Promise<void> {
  // First name only: to the customer this is the brand sending someone, not
  // an introduction to a stranger's business. Phrased around the job rather
  // than the person so it reads the same when the person is the owner.
  const who = firstName(cleaner.name);
  await notifyCustomer(job, {
    subject: `Your ${job.service_label.toLowerCase()} is confirmed — ${job.ref}`,
    body:
      `Good news ${job.customer_name}, your ${job.service_label.toLowerCase()} ` +
      `is confirmed for ${job.slot_date} (${job.slot_window.toUpperCase()}).\n\n` +
      `Your ${V.one}: ${who}\n` +
      `Their number: ${cleaner.phone}\n` +
      `Fixed price: ${gbpShort(job.total_pence)}, payable to them on the day.\n\n` +
      `Need to change or cancel? ${bookingUrl(job.ref, siteUrl())}`,
    smsBody:
      `${job.ref} confirmed: ${who} (${cleaner.phone}) on ${job.slot_date} ` +
      `${job.slot_window.toUpperCase()}. ` +
      `${gbpShort(job.total_pence)} on the day. Changes: ${bookingUrl(job.ref, siteUrl())}`,
    jobId: job.id,
  });
}

/**
 * Give a job straight to a named cleaner — the "I've just got off the phone
 * with someone who'll take it" case, and how a provisional booking becomes a
 * real one. Deliberately skips the coverage and availability checks: the office
 * has spoken to them and knows better than the rota does.
 */
/**
 * Drop the commission on one job — a free first job for a new cleaner, or
 * making good after something went wrong.
 *
 * Refused once the job is on an invoice: the invoice total is already fixed and
 * the cleaner may have paid it, so zeroing the job behind it would leave the
 * books disagreeing with themselves.
 */
export async function waiveCommission(
  jobId: number
): Promise<{ ok: boolean; reason?: string }> {
  const invoiced = await queryOne<{ id: number }>(
    `SELECT invoice_id AS id FROM commission_invoice_lines WHERE job_id = $1`,
    [jobId]
  );
  if (invoiced) {
    return {
      ok: false,
      reason: "That job is already on an invoice, so its commission can't be changed.",
    };
  }

  const done = await query<{ id: number }>(
    `UPDATE jobs SET commission_pct = 0, commission_pence = 0
      WHERE id = $1 AND status <> 'cancelled'
      RETURNING id`,
    [jobId]
  );
  return done.length > 0
    ? { ok: true }
    : { ok: false, reason: "That job can't be changed." };
}

export async function assignJob(
  jobId: number,
  cleanerId: number,
  waive = false
): Promise<{ ok: boolean; reason?: string }> {
  const job = await getJob(jobId);
  const cleaner = await getCleaner(cleanerId);
  if (!job) return { ok: false, reason: "Job not found." };
  if (!cleaner) return { ok: false, reason: `${V.One} not found.` };
  if (cleaner.status !== "approved") {
    return { ok: false, reason: `${cleaner.name} isn't approved yet.` };
  }
  // Checked here as well as in the admin dropdown: a hand-assignment is a
  // server action, and the customer finds out about a trade mismatch on the
  // doorstep rather than in a form.
  const trades = await getCleanerServices(cleanerId);
  if (!trades.includes(job.service_code)) {
    return {
      ok: false,
      reason: `${cleaner.name} isn't set up for ${job.service_label.toLowerCase()}.`,
    };
  }
  if (job.status === "completed" || job.status === "cancelled") {
    return { ok: false, reason: "That job is already closed." };
  }

  await query(
    `UPDATE jobs
        SET status = 'accepted', cleaner_id = $2, accepted_at = now()
      WHERE id = $1`,
    [jobId, cleanerId]
  );
  // Logged as an offer they took, so job history reads consistently.
  await query(
    `INSERT INTO job_offers (job_id, cleaner_id, response, responded_at)
     VALUES ($1,$2,'accepted', now())
     ON CONFLICT (job_id, cleaner_id)
     DO UPDATE SET response = 'accepted', responded_at = now()`,
    [jobId, cleanerId]
  );

  if (waive) await waiveCommission(jobId);

  const assigned = (await getJob(jobId))!;
  await confirmCleanerToCustomer(assigned, cleaner);

  // On a solo site this message goes to whoever just pressed Assign, at their
  // own SMS expense, and points at /pro/dashboard, which doesn't exist here.
  // Customer-initiated changes still notify them — those are news.
  if (!IS_SOLO) {
    await notifyCleaner(cleaner, {
      subject: `Job assigned to you — ${job.ref} on ${job.slot_date}`,
      body:
        `${cleaner.name}, we've put ${job.ref} in your diary as agreed.\n\n` +
        `Date: ${job.slot_date} (${job.slot_window.toUpperCase()})\n` +
        `Address: ${job.address_line}${job.town ? `, ${job.town}` : ""}, ${job.postcode}\n` +
        `Customer: ${job.customer_name}, ${job.customer_phone}\n` +
        `Collect: ${gbpShort(assigned.total_pence)} — you keep ` +
        `${gbpShort(assigned.total_pence - assigned.commission_pence)}\n\n` +
        `${assigned.commission_pence === 0
          ? "No commission on this one — the full amount is yours."
          : COMMISSION_TERMS_SHORT}`,
      smsBody:
        `Job ${assigned.ref} is in your diary: ${assigned.slot_date} ` +
        `${assigned.slot_window.toUpperCase()}, ${assigned.postcode}. Collect ` +
        `${gbpShort(assigned.total_pence)}, you keep ` +
        `${gbpShort(assigned.total_pence - assigned.commission_pence)}` +
        `${assigned.commission_pence === 0 ? " (no commission)" : ""}. ` +
        `${siteUrl()}/pro/dashboard`,
      jobId,
    });
  }

  return { ok: true };
}

export async function declineJob(
  jobId: number,
  cleanerId: number
): Promise<void> {
  await query(
    `UPDATE job_offers SET response = 'declined', responded_at = now()
      WHERE job_id = $1 AND cleaner_id = $2 AND response IS NULL`,
    [jobId, cleanerId]
  );

  // If every cleaner it went to has now declined, flag it for admin.
  const outstanding = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM job_offers
      WHERE job_id = $1 AND response IS NULL`,
    [jobId]
  );
  if ((outstanding?.n ?? 0) === 0) {
    await query(
      `UPDATE jobs SET status = 'unfilled' WHERE id = $1 AND status = 'offered'`,
      [jobId]
    );
  }
}

export async function completeJob(
  jobId: number,
  cleanerId: number
): Promise<{ ok: boolean; reason?: string }> {
  const done = await query<{ id: number }>(
    `UPDATE jobs
        SET status = 'completed', completed_at = now()
      WHERE id = $1 AND cleaner_id = $2 AND status = 'accepted'
      RETURNING id`,
    [jobId, cleanerId]
  );
  if (done.length === 0) {
    const current = await getJob(jobId);
    // Already completed by this cleaner — treat a repeat click as success.
    if (current?.cleaner_id === cleanerId && current.status === "completed") {
      return { ok: true };
    }
    return { ok: false, reason: "That job isn't yours to complete." };
  }
  return { ok: true };
}

/**
 * Cancel from the office. Both sides are told — a customer who hears nothing
 * still expects a cleaner at their door, and a cleaner who hears nothing turns
 * up to one that isn't expecting them.
 */
export async function cancelJob(
  jobId: number,
  reason: string
): Promise<void> {
  const job = await getJob(jobId);
  const cancelled = await query<{ id: number }>(
    `UPDATE jobs
        SET status = 'cancelled', cancelled_at = now(), cancel_reason = $2,
            cancelled_by = 'admin'
      WHERE id = $1 AND status IN ('offered','accepted','unfilled')
      RETURNING id`,
    [jobId, reason]
  );
  if (!job || cancelled.length === 0) return;

  const when = `${job.slot_date} (${job.slot_window.toUpperCase()})`;

  await notifyCustomer(job, {
    subject: `Your booking ${job.ref} has been cancelled`,
    body:
      `${job.customer_name}, we've cancelled your ${job.service_label.toLowerCase()} ` +
      `booking for ${when}.\n\n` +
      `${reason ? `Reason: ${reason}\n\n` : ""}` +
      `There's nothing to pay. Call ${CONTACT.phone} and we'll rebook you, or ` +
      `book again at ${siteUrl()}/book.`,
    smsBody:
      `Your ${BRAND.shortName} booking ${job.ref} for ${when} has been ` +
      `cancelled. Nothing to pay. Call ${CONTACT.phone} to rebook.`,
    jobId,
  });

  // Suppressed in solo mode for the same reason as assignJob: the office and
  // the operative are the same person, and they are the one cancelling.
  if (job.cleaner_id && !IS_SOLO) {
    const cleaner = await getCleaner(job.cleaner_id);
    if (cleaner) {
      await notifyCleaner(cleaner, {
        subject: `Cancelled by the office — ${job.ref} on ${job.slot_date}`,
        body:
          `${cleaner.name}, the office has cancelled ${job.ref} for ${when}.\n\n` +
          `${reason ? `Reason: ${reason}\n\n` : ""}` +
          `No commission is due. Your diary has been freed up.`,
        smsBody: `CANCELLED by office: ${job.ref}, ${when}. Slot is free again.`,
        jobId,
      });
    }
  }
}

/**
 * Put an unfilled or cancelled job back out to the market — or, on a solo
 * site, straight back into the owner's diary.
 */
export async function rebroadcastJob(jobId: number): Promise<number> {
  const job = await getJob(jobId);
  if (!job) return 0;
  await query(
    `UPDATE jobs
        SET status = 'offered', cleaner_id = NULL, accepted_at = NULL,
            cancelled_at = NULL, cancel_reason = ''
      WHERE id = $1`,
    [jobId]
  );
  await query(`DELETE FROM job_offers WHERE job_id = $1`, [jobId]);
  return broadcastJob(jobId);
}

// -------------------------------------------------------------------- jobs --

export async function getJob(id: number): Promise<Job | null> {
  return queryOne<Job>(`SELECT ${JOB_COLUMNS} FROM jobs j WHERE j.id = $1`, [id]);
}

export async function getJobByRef(ref: string): Promise<Job | null> {
  return queryOne<Job>(`SELECT ${JOB_COLUMNS} FROM jobs j WHERE j.ref = $1`, [
    ref,
  ]);
}

/** Live offers a cleaner can still accept. */
/** A job as it appears to a cleaner deciding whether to accept it. */
export type JobOffer = Pick<
  Job,
  | "id"
  | "ref"
  | "service_code"
  | "service_label"
  | "outward"
  | "town"
  | "slot_date"
  | "slot_window"
  | "items"
  | "notes"
  | "total_pence"
  | "commission_pct"
  | "commission_pence"
  | "status"
>;

export async function listOffersForCleaner(
  cleanerId: number
): Promise<JobOffer[]> {
  return query<JobOffer>(
    `SELECT ${OFFER_COLUMNS}
       FROM jobs j
       JOIN job_offers o ON o.job_id = j.id AND o.cleaner_id = $1
      WHERE j.status = 'offered'
        AND o.response IS NULL
        AND j.slot_date >= CURRENT_DATE
      ORDER BY j.slot_date, j.slot_window`,
    [cleanerId]
  );
}

export async function listJobsForCleaner(
  cleanerId: number,
  statuses: string[]
): Promise<Job[]> {
  return query<Job>(
    `SELECT ${JOB_COLUMNS}
       FROM jobs j
      WHERE j.cleaner_id = $1 AND j.status = ANY($2)
      ORDER BY j.slot_date DESC, j.slot_window`,
    [cleanerId, statuses]
  );
}

export type JobFilters = {
  status?: string;
  /** Restrict to one trade. */
  service?: string;
  /** Inclusive slot-date bounds, YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Matches reference, customer name, postcode, town or cleaner name. */
  q?: string;
  /** Restrict to one cleaner. Always forced server-side, never from input. */
  cleanerId?: number;
  /**
   * Coarser than status: "outstanding" is anything not finished, "attention"
   * is anything whose slot has passed without being completed or cancelled —
   * the jobs that quietly go wrong because nobody marked them done.
   */
  group?: "outstanding" | "attention";
  /**
   * "soonest"/"latest" order by the slot; "newest" orders by when the booking
   * was taken, which is a different question and the one you ask when
   * something has just come in.
   */
  sort?: "soonest" | "latest" | "newest";
  limit?: number;
};

export type JobRow = Job & { cleaner_name: string | null; offers: number };

/** Build the WHERE clause shared by the list and its totals. */
function jobFilterClause(filters: JobFilters): {
  where: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    clauses.push(`j.status = $${params.length}`);
  }
  if (filters.service) {
    params.push(filters.service);
    clauses.push(`j.service_code = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`j.slot_date >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`j.slot_date <= $${params.length}::date`);
  }
  if (filters.group === "outstanding") {
    clauses.push(`j.status NOT IN ('completed', 'cancelled')`);
  }
  if (filters.group === "attention") {
    clauses.push(
      `j.status NOT IN ('completed', 'cancelled') AND j.slot_date < CURRENT_DATE`
    );
  }
  if (filters.cleanerId) {
    params.push(filters.cleanerId);
    clauses.push(`j.cleaner_id = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    const n = params.length;
    clauses.push(
      `(lower(j.ref) LIKE $${n} OR lower(j.customer_name) LIKE $${n}
        OR lower(j.postcode) LIKE $${n} OR lower(j.town) LIKE $${n}
        OR EXISTS (SELECT 1 FROM cleaners cf
                    WHERE cf.id = j.cleaner_id
                      AND (lower(cf.name) LIKE $${n}
                        OR lower(cf.business_name) LIKE $${n})))`
    );
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function listJobs(filters: JobFilters = {}): Promise<JobRow[]> {
  const { where, params } = jobFilterClause(filters);
  params.push(Math.min(filters.limit ?? 300, 1000));

  return query<JobRow>(
    `SELECT ${JOB_COLUMNS},
            c.name AS cleaner_name,
            (SELECT count(*)::int FROM job_offers o WHERE o.job_id = j.id) AS offers
       FROM jobs j
       LEFT JOIN cleaners c ON c.id = j.cleaner_id
      ${where}
      ORDER BY ${
        filters.sort === "newest"
          ? "j.created_at DESC"
          : `j.slot_date ${filters.sort === "soonest" ? "ASC" : "DESC"}, j.created_at DESC`
      }
      LIMIT $${params.length}`,
    params
  );
}

/** Totals for whatever the current filter selects. */
export async function jobTotals(
  filters: JobFilters = {}
): Promise<{ jobs: number; value_pence: number; commission_pence: number }> {
  const { where, params } = jobFilterClause(filters);
  const row = await queryOne<{
    jobs: number;
    value_pence: number;
    commission_pence: number;
  }>(
    // Cancelled and unfilled jobs are real history but not real money, and
    // commission is only ever earned on completed work — summing everything
    // showed income that will never arrive.
    `SELECT count(*)::int AS jobs,
            COALESCE(sum(j.total_pence)
              FILTER (WHERE j.status NOT IN ('cancelled', 'unfilled')), 0)::int
              AS value_pence,
            COALESCE(sum(j.commission_pence)
              FILTER (WHERE j.status = 'completed'), 0)::int
              AS commission_pence
       FROM jobs j ${where}`,
    params
  );
  return row ?? { jobs: 0, value_pence: 0, commission_pence: 0 };
}

/** Counts per status for the filter tabs, respecting date and search. */
export async function jobStatusCounts(
  filters: JobFilters = {}
): Promise<Record<string, number>> {
  // Counts ignore status and group so the tabs always show what's behind them,
  // not what's left after the tab you're already on.
  const { where, params } = jobFilterClause({
    ...filters,
    status: undefined,
    group: undefined,
  });
  const rows = await query<{
    status: string;
    n: number;
    overdue: number;
  }>(
    `SELECT j.status, count(*)::int AS n,
            count(*) FILTER (
              WHERE j.status NOT IN ('completed','cancelled')
                AND j.slot_date < CURRENT_DATE
            )::int AS overdue
       FROM jobs j ${where} GROUP BY j.status`,
    params
  );

  const counts = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  counts.__outstanding = rows
    .filter((r) => !["completed", "cancelled"].includes(r.status))
    .reduce((sum, r) => sum + r.n, 0);
  counts.__attention = rows.reduce((sum, r) => sum + r.overdue, 0);
  counts.__all = rows.reduce((sum, r) => sum + r.n, 0);
  return counts;
}

// ------------------------------------------------------------- commissions --

/** Completed jobs not yet on any commission invoice. */
export async function listUninvoicedCommission(): Promise<
  { cleaner_id: number; cleaner_name: string; jobs: number; total_pence: number }[]
> {
  return query(
    `SELECT j.cleaner_id,
            c.name AS cleaner_name,
            count(*)::int AS jobs,
            sum(j.commission_pence)::int AS total_pence
       FROM jobs j
       JOIN cleaners c ON c.id = j.cleaner_id
      WHERE j.status = 'completed'
        AND j.commission_pence > 0
        AND NOT EXISTS (
          SELECT 1 FROM commission_invoice_lines l WHERE l.job_id = j.id
        )
      GROUP BY j.cleaner_id, c.name
      ORDER BY sum(j.commission_pence) DESC`
  );
}

/**
 * Raise one commission invoice per cleaner covering every completed job that
 * isn't already invoiced. The unique index on lines.job_id makes double-billing
 * impossible even if this is run twice.
 */
export type RaisedInvoice = {
  id: number;
  ref: string;
  cleanerId: number;
  totalPence: number;
  jobs: number;
};

export async function generateCommissionInvoices(
  periodStart: string,
  periodEnd: string
): Promise<RaisedInvoice[]> {
  const pending = await listUninvoicedCommission();
  const created: RaisedInvoice[] = [];

  for (const group of pending) {
    // Three queries per cleaner regardless of how many jobs they completed.
    // This previously inserted one line at a time, so a busy week meant a
    // query per job and the weekly run grew with volume until it would
    // eventually outlast the serverless timeout.
    const invoice = await queryOne<{ id: number }>(
      `INSERT INTO commission_invoices
         (ref, cleaner_id, period_start, period_end, total_pence)
       VALUES ($1,$2,$3::date,$4::date,0) RETURNING id`,
      [makeRef("CI"), group.cleaner_id, periodStart, periodEnd]
    );
    if (!invoice) continue;

    // Selected straight from jobs rather than round-tripped through the app.
    // The unique index on job_id means a job can never land on two invoices,
    // even if this runs twice.
    const lines = await query<{ amount_pence: number }>(
      `INSERT INTO commission_invoice_lines (invoice_id, job_id, amount_pence)
       SELECT $1, j.id, j.commission_pence
         FROM jobs j
        WHERE j.status = 'completed'
          AND j.cleaner_id = $2
          AND j.commission_pence > 0
          AND NOT EXISTS (
            SELECT 1 FROM commission_invoice_lines l WHERE l.job_id = j.id
          )
       ON CONFLICT (job_id) DO NOTHING
       RETURNING amount_pence`,
      [invoice.id, group.cleaner_id]
    );

    // Another run may have claimed the jobs in between — don't leave an empty
    // invoice behind.
    if (lines.length === 0) {
      await query(`DELETE FROM commission_invoices WHERE id = $1`, [invoice.id]);
      continue;
    }

    const total = lines.reduce((sum, line) => sum + line.amount_pence, 0);
    const saved = await queryOne<{ ref: string }>(
      `UPDATE commission_invoices SET total_pence = $2 WHERE id = $1
       RETURNING ref`,
      [invoice.id, total]
    );

    created.push({
      id: invoice.id,
      ref: saved!.ref,
      cleanerId: group.cleaner_id,
      totalPence: total,
      jobs: lines.length,
    });
  }

  return created;
}

/** Tell a cleaner their commission invoice has been raised. */
export async function notifyInvoiceRaised(
  invoice: RaisedInvoice,
  dayLabel: string
): Promise<void> {
  const cleaner = await getCleaner(invoice.cleanerId);
  if (!cleaner) return;

  // The consequence goes in the message itself, not only in the terms page.
  // A sanction somebody can honestly say they never saw is not a sanction.
  await notifyCleaner(cleaner, {
    subject: `Commission for ${dayLabel} — ${gbpShort(invoice.totalPence)} (${invoice.ref})`,
    body:
      `${cleaner.name}, here is your commission for ${dayLabel}.\n\n` +
      `Invoice: ${invoice.ref}\n` +
      `Jobs completed: ${invoice.jobs}\n` +
      `Commission due: ${gbpShort(invoice.totalPence)}\n\n` +
      `Pay it here:\n${siteUrl()}/pro/invoices/${invoice.ref}\n\n` +
      `${COMMISSION_ENFORCEMENT}`,
    smsBody:
      `${BRAND.shortName}: ${gbpShort(invoice.totalPence)} commission for ` +
      `${invoice.jobs} job${invoice.jobs === 1 ? "" : "s"} today. Pay now: ` +
      `${siteUrl()}/pro/invoices/${invoice.ref} — unpaid means suspension.`,
  });
}

export type InvoiceRow = {
  id: number;
  ref: string;
  cleaner_id: number;
  cleaner_name: string;
  period_start: string;
  period_end: string;
  total_pence: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  jobs: number;
};

export async function listInvoices(cleanerId?: number): Promise<InvoiceRow[]> {
  return query<InvoiceRow>(
    `SELECT i.id, i.ref, i.cleaner_id, c.name AS cleaner_name,
            to_char(i.period_start, 'YYYY-MM-DD') AS period_start,
            to_char(i.period_end,   'YYYY-MM-DD') AS period_end,
            i.total_pence, i.status,
            to_char(i.issued_at, 'YYYY-MM-DD') AS issued_at,
            to_char(i.paid_at,   'YYYY-MM-DD') AS paid_at,
            (SELECT count(*)::int FROM commission_invoice_lines l
              WHERE l.invoice_id = i.id) AS jobs
       FROM commission_invoices i
       JOIN cleaners c ON c.id = i.cleaner_id
      ${cleanerId ? "WHERE i.cleaner_id = $1" : ""}
      ORDER BY i.issued_at DESC`,
    cleanerId ? [cleanerId] : []
  );
}

export async function setInvoiceStatus(
  id: number,
  status: "issued" | "paid"
): Promise<void> {
  await query(
    `UPDATE commission_invoices
        SET status = $2, paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE NULL END
      WHERE id = $1`,
    [id, status]
  );
}

// ----------------------------------------------------------- notifications --

/** Public base URL, used to build tappable links inside SMS. */
/**
 * The base every outgoing link is built from.
 *
 * VERCEL_URL is deliberately only consulted off production. It is set on every
 * Vercel deployment, including production, where it holds the one-off
 * deployment hostname rather than the custom domain — so preferring it builds
 * customer links on a *.vercel.app address, and would break the signature
 * check on any webhook that hashes its own URL.
 *
 * So production uses the configured domain unless MARKETPLACE_BASE_URL
 * overrides it, and only a preview build falls back to its own hostname —
 * which is what previews need, or testers would be sent to the live site.
 */
export function siteUrl(): string {
  const explicit = process.env.MARKETPLACE_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const configured = configuredSiteUrl().replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production") return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return configured;
}

/**
 * Every message the platform sends is written here first, then delivered if the
 * relevant provider is configured. With no provider it's still a complete audit
 * trail in /admin, so nothing is silently lost.
 */
export async function notify(input: {
  recipient: string;
  subject: string;
  body: string;
  jobId?: number;
  channel?: "email" | "sms";
}): Promise<void> {
  const channel = input.channel ?? "email";
  const row = await queryOne<{ id: number }>(
    `INSERT INTO notifications (channel, recipient, subject, body, job_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [channel, input.recipient, input.subject, input.body, input.jobId ?? null]
  );
  if (!row) return;

  try {
    const delivered =
      channel === "sms"
        ? await sendSms(input.recipient, input.body)
        : await sendEmail(input.recipient, input.subject, input.body);
    if (delivered) {
      await query(`UPDATE notifications SET sent_at = now() WHERE id = $1`, [
        row.id,
      ]);
    }
  } catch (error) {
    await query(`UPDATE notifications SET error = $2 WHERE id = $1`, [
      row.id,
      String((error as Error)?.message ?? error).slice(0, 500),
    ]);
  }
}

/** Returns false (not an error) when no mail provider is configured. */
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  // RESEND_FROM is the name used elsewhere in Simon's projects — accept either
  // so existing credentials can be copied across without renaming.
  const from = process.env.MARKETPLACE_FROM_EMAIL ?? process.env.RESEND_FROM;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text: body }),
  });
  if (!response.ok) throw new Error(await response.text());
  return true;
}

/** Returns false (not an error) when Twilio isn't configured. */
async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  // TWILIO_SMS_FROM / TWILIO_PHONE_NUMBER are the names used elsewhere in
  // Simon's projects — accept any of them.
  const from =
    process.env.TWILIO_FROM_NUMBER ??
    process.env.TWILIO_SMS_FROM ??
    process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return true;
}

/**
 * Send to one cleaner across whichever channels they've opted into. SMS is the
 * channel that matters for job offers — first-to-accept means delivery speed
 * decides who gets the work — so it goes first and email backs it up.
 */
export async function notifyCleaner(
  cleaner: Pick<Cleaner, "id" | "email" | "phone" | "notify_sms" | "notify_email">,
  input: { subject: string; body: string; smsBody?: string; jobId?: number }
): Promise<void> {
  const mobile = toE164(cleaner.phone);
  if (cleaner.notify_sms && mobile && isMobile(cleaner.phone)) {
    await notify({
      channel: "sms",
      recipient: mobile,
      subject: input.subject,
      body: input.smsBody ?? input.body,
      jobId: input.jobId,
    });
  }
  if (cleaner.notify_email) {
    await notify({
      channel: "email",
      recipient: cleaner.email,
      subject: input.subject,
      body: input.body,
      jobId: input.jobId,
    });
  }
}

/**
 * Transactional messages to a customer about their own booking. Always sent —
 * these are the receipt and the manage link, not marketing.
 */
export async function notifyCustomer(
  job: Pick<Job, "customer_email" | "customer_phone">,
  input: { subject: string; body: string; smsBody?: string; jobId?: number }
): Promise<void> {
  const mobile = toE164(job.customer_phone);
  if (mobile && isMobile(job.customer_phone) && input.smsBody) {
    await notify({
      channel: "sms",
      recipient: mobile,
      subject: input.subject,
      body: input.smsBody,
      jobId: input.jobId,
    });
  }
  await notify({
    channel: "email",
    recipient: job.customer_email,
    subject: input.subject,
    body: input.body,
    jobId: input.jobId,
  });
}

/**
 * Text the office. Separate from the cleaner broadcast on purpose: the office
 * wants to know a booking landed and whether anyone can take it, which is a
 * different question from "do you want this job".
 */
export async function notifyAdmin(input: {
  subject: string;
  smsBody: string;
  jobId?: number;
}): Promise<void> {
  const settings = await getSettings();
  const mobile = toE164(settings.admin_mobile);
  if (!settings.admin_sms_enabled || !mobile) return;

  await notify({
    channel: "sms",
    recipient: mobile,
    subject: input.subject,
    body: input.smsBody,
    jobId: input.jobId,
  });
}

export async function setNotificationPrefs(
  cleanerId: number,
  prefs: { sms: boolean; email: boolean }
): Promise<void> {
  await query(
    `UPDATE cleaners SET notify_sms = $2, notify_email = $3 WHERE id = $1`,
    [cleanerId, prefs.sms, prefs.email]
  );
}

export async function listNotifications(limit = 50) {
  return query<{
    id: number;
    channel: string;
    recipient: string;
    subject: string;
    created_at: string;
    sent_at: string | null;
    error: string | null;
  }>(
    `SELECT id, channel, recipient, subject,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
            to_char(sent_at,    'YYYY-MM-DD HH24:MI') AS sent_at,
            error
       FROM notifications ORDER BY id DESC LIMIT $1`,
    [limit]
  );
}

// -------------------------------------------------------------- open slots --

export type OpenSlot = { day: string; am: boolean; pm: boolean };

/**
 * Which half-days in the booking window actually have a cleaner free in this
 * postcode. One query over generate_series rather than a request per date, so
 * the customer is never offered a slot nobody can fill.
 */
export async function getOpenSlots(
  outward: string,
  serviceCode: string,
  fromDays: number,
  toDays: number,
  excludeJobId?: number
): Promise<OpenSlot[]> {
  const available = (window: "am" | "pm") => `
    EXISTS (
      SELECT 1
        FROM cleaners c
        JOIN cleaner_services cs
          ON cs.cleaner_id = c.id AND cs.service_code = $5
        JOIN cleaner_availability av
          ON av.cleaner_id = c.id
         AND av.weekday = EXTRACT(DOW FROM d.day)
         AND av.${window}
       WHERE c.status = 'approved'
         AND ${coversOutward("$1")}
         AND NOT EXISTS (
           SELECT 1 FROM cleaner_blackouts b
            WHERE b.cleaner_id = c.id AND b.day = d.day AND b.${window}
         )
         AND NOT EXISTS (
           SELECT 1 FROM jobs j
            WHERE j.cleaner_id = c.id AND j.slot_date = d.day
              AND j.slot_window = '${window}'
              AND j.status IN ('accepted','completed')
              AND ($4::int IS NULL OR j.id <> $4::int)
         )
    ) AS ${window}`;

  return query<OpenSlot>(
    `WITH days AS (
       SELECT generate_series(
         CURRENT_DATE + ($2::int),
         CURRENT_DATE + ($3::int),
         interval '1 day'
       )::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            ${available("am")},
            ${available("pm")}
       FROM days d
      ORDER BY d.day`,
    [outward, fromDays, toDays, excludeJobId ?? null, serviceCode]
  );
}

// ------------------------------------------------------------ admin stats --

export type AdminStats = {
  cleaners_pending: number;
  cleaners_approved: number;
  jobs_live: number;
  jobs_unfilled: number;
  jobs_completed: number;
  gmv_pence: number;
  commission_pence: number;
  commission_unpaid_pence: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const row = await queryOne<AdminStats>(
    `SELECT
       (SELECT count(*)::int FROM cleaners WHERE status = 'pending')   AS cleaners_pending,
       (SELECT count(*)::int FROM cleaners WHERE status = 'approved')  AS cleaners_approved,
       (SELECT count(*)::int FROM jobs WHERE status IN ('offered','accepted')) AS jobs_live,
       (SELECT count(*)::int FROM jobs WHERE status = 'unfilled')      AS jobs_unfilled,
       (SELECT count(*)::int FROM jobs WHERE status = 'completed')     AS jobs_completed,
       (SELECT COALESCE(sum(total_pence),0)::int      FROM jobs WHERE status = 'completed') AS gmv_pence,
       (SELECT COALESCE(sum(commission_pence),0)::int FROM jobs WHERE status = 'completed') AS commission_pence,
       (SELECT COALESCE(sum(total_pence),0)::int      FROM commission_invoices WHERE status = 'issued') AS commission_unpaid_pence`
  );
  return row!;
}

// -------------------------------------------- customer self-service --------

/** Is this cleaner free to take that half-day, ignoring one job if given? */
export async function isCleanerFreeAt(
  cleanerId: number,
  slotDate: string,
  slotWindow: SlotWindow,
  excludeJobId?: number
): Promise<boolean> {
  const row = await queryOne<{ free: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM cleaners c
         JOIN cleaner_availability av
           ON av.cleaner_id = c.id
          AND av.weekday = EXTRACT(DOW FROM $2::date)
          AND ((av.am AND $3 = 'am') OR (av.pm AND $3 = 'pm'))
        WHERE c.id = $1
          AND c.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM cleaner_blackouts b
             WHERE b.cleaner_id = c.id AND b.day = $2::date
               AND ((b.am AND $3 = 'am') OR (b.pm AND $3 = 'pm'))
          )
          AND NOT EXISTS (
            SELECT 1 FROM jobs j
             WHERE j.cleaner_id = c.id
               AND j.slot_date = $2::date
               AND j.slot_window = $3
               AND j.status IN ('accepted','completed')
               AND ($4::int IS NULL OR j.id <> $4::int)
          )
     ) AS free`,
    [cleanerId, slotDate, slotWindow, excludeJobId ?? null]
  );
  return row?.free ?? false;
}

/**
 * Does this operative work that half-day at all — weekly rota and days off,
 * ignoring whether the slot already holds a job?
 *
 * Deliberately narrower than `isCleanerFreeAt`. A solo operator doing two
 * services for one customer in a single morning is one visit, not a double
 * booking, so the slot-taken clause would break a two-service basket; a day
 * they have blacked out is a different matter entirely. Used by the admin
 * allocation paths, where solo mode has no broadcast filter downstream to
 * catch it.
 */
export async function worksThatHalfDay(
  cleanerId: number,
  slotDate: string,
  slotWindow: SlotWindow
): Promise<boolean> {
  const row = await queryOne<{ works: boolean }>(
    `SELECT (
       EXISTS (
         SELECT 1 FROM cleaner_availability av
          WHERE av.cleaner_id = $1
            AND av.weekday = EXTRACT(DOW FROM $2::date)
            AND ((av.am AND $3 = 'am') OR (av.pm AND $3 = 'pm'))
       )
       AND NOT EXISTS (
         SELECT 1 FROM cleaner_blackouts b
          WHERE b.cleaner_id = $1 AND b.day = $2::date
            AND ((b.am AND $3 = 'am') OR (b.pm AND $3 = 'pm'))
       )
     ) AS works`,
    [cleanerId, slotDate, slotWindow]
  );
  return row?.works ?? false;
}

export type RescheduleResult = {
  ok: boolean;
  reason?: string;
  keptCleaner: boolean;
  /**
   * Whether a cleaner was assigned before the move. A job still out on
   * broadcast has nobody to lose, and telling the customer their cleaner
   * couldn't make it invents a cleaner they never had.
   */
  hadCleaner: boolean;
  offered: number;
};

/**
 * Move a booking to a new half-day.
 *
 * The assigned cleaner keeps the job when they're free at the new time —
 * continuity is better for both sides. If they can't make it, the job is
 * released back to the market and re-broadcast rather than silently dropped.
 */
export async function rescheduleJob(
  jobId: number,
  slotDate: string,
  slotWindow: SlotWindow
): Promise<RescheduleResult> {
  const job = await getJob(jobId);
  if (!job) return { ok: false, reason: "Booking not found.", keptCleaner: false, hadCleaner: false, offered: 0 };
  if (job.status === "completed" || job.status === "cancelled") {
    return {
      ok: false,
      reason: "This booking can no longer be changed.",
      keptCleaner: false,
      hadCleaner: false,
      offered: 0,
    };
  }
  if (job.slot_date === slotDate && job.slot_window === slotWindow) {
    return { ok: false, reason: "That's already your slot.", keptCleaner: false, hadCleaner: false, offered: 0 };
  }

  const previousCleanerId = job.cleaner_id;
  const keepCleaner =
    previousCleanerId !== null &&
    (await isCleanerFreeAt(previousCleanerId, slotDate, slotWindow, jobId));

  await query(
    `UPDATE jobs
        SET slot_date = $2::date,
            slot_window = $3,
            rescheduled_count = rescheduled_count + 1
      WHERE id = $1`,
    [jobId, slotDate, slotWindow]
  );

  const moved = (await getJob(jobId))!;
  const when = `${moved.slot_date} (${slotWindow.toUpperCase()})`;

  if (keepCleaner && previousCleanerId !== null) {
    const cleaner = await getCleaner(previousCleanerId);
    if (cleaner) {
      await notifyCleaner(cleaner, {
        subject: `Job moved — ${moved.ref} is now ${when}`,
        body:
          `${cleaner.name}, ${moved.customer_name} has moved booking ${moved.ref}.\n\n` +
          `New date: ${when}\n` +
          `Address: ${moved.address_line}, ${moved.postcode}\n` +
          `Value: ${gbpShort(moved.total_pence)}\n\n` +
          `You were free, so the job is still yours. Your diary is already updated.`,
        smsBody: `Job ${moved.ref} moved to ${when}. Still yours — diary updated.`,
        jobId,
      });
    }
    return { ok: true, keptCleaner: true, hadCleaner: true, offered: 0 };
  }

  // The assigned cleaner can't make the new slot — release and re-broadcast.
  if (previousCleanerId !== null) {
    const cleaner = await getCleaner(previousCleanerId);
    if (cleaner) {
      await notifyCleaner(cleaner, {
        subject: `Job released — ${moved.ref} moved to a time you're not free`,
        body:
          `${cleaner.name}, ${moved.customer_name} has moved booking ${moved.ref} to ${when}.\n\n` +
          `You're not available then, so the job has gone back out to other ` +
          `${V.many} and has been removed from your diary.`,
        smsBody: `Job ${moved.ref} moved to ${when} — you're not free, so it's back out to other ${V.many}.`,
        jobId,
      });
    }
  }

  await query(
    `UPDATE jobs
        SET status = 'offered', cleaner_id = NULL, accepted_at = NULL
      WHERE id = $1`,
    [jobId]
  );
  await query(`DELETE FROM job_offers WHERE job_id = $1`, [jobId]);

  const offered = await broadcastJob(jobId);
  return {
    ok: true,
    keptCleaner: false,
    hadCleaner: previousCleanerId !== null,
    offered,
  };
}

/**
 * Customer-initiated cancellation. Always allowed — refusing to let someone
 * cancel online just moves the call to the office — but anything inside the
 * admin-set notice period is flagged as late so it can be seen and dealt with.
 */
export async function cancelJobByCustomer(
  jobId: number,
  reason: string
): Promise<{ ok: boolean; reason?: string; late: boolean }> {
  const job = await getJob(jobId);
  if (!job) return { ok: false, reason: "Booking not found.", late: false };
  if (job.status === "completed") {
    return { ok: false, reason: "This job has already been done.", late: false };
  }
  if (job.status === "cancelled") {
    return { ok: false, reason: "This booking is already cancelled.", late: false };
  }

  const settings = await getSettings();
  const late = Number(job.hours_until_slot) < settings.cancellation_notice_hours;

  await query(
    `UPDATE jobs
        SET status = 'cancelled', cancelled_at = now(),
            cancel_reason = $2, cancelled_by = 'customer',
            late_cancellation = $3
      WHERE id = $1`,
    [jobId, reason.slice(0, 200) || "Cancelled by customer", late]
  );

  if (job.cleaner_id) {
    const cleaner = await getCleaner(job.cleaner_id);
    if (cleaner) {
      const notice = late
        ? `This is short notice — under ${settings.cancellation_notice_hours} hours before the slot.`
        : `You have the slot back with plenty of notice.`;
      await notifyCleaner(cleaner, {
        subject: `Cancelled — ${job.ref} on ${job.slot_date} (${job.slot_window.toUpperCase()})`,
        body:
          `${cleaner.name}, ${job.customer_name} has cancelled booking ${job.ref} ` +
          `for ${job.slot_date} (${job.slot_window.toUpperCase()}).\n\n` +
          `${notice}\n` +
          `${reason ? `Reason given: ${reason}\n` : ""}` +
          `\nNo commission is due on a cancelled job. Your diary is already updated.`,
        smsBody:
          `CANCELLED: ${job.ref}, ${job.slot_date} ${job.slot_window.toUpperCase()}. ` +
          `${late ? "Short notice. " : ""}Slot is free again.`,
        jobId,
      });
    }
  }

  return { ok: true, late };
}

// -------------------------------------------------- demand in dead zones --

/**
 * Someone wanted work somewhere we don't cover. Keep the lead and the
 * postcode: it's a customer to call back and a recruitment target.
 */
export async function recordCoverageRequest(input: {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  /** Which trade they wanted, when they got that far. */
  serviceCode?: string;
}): Promise<void> {
  const postcode = normalisePostcode(input.postcode) ?? input.postcode.toUpperCase();
  const outward = outwardOf(postcode);
  if (!outward) throw new Error("That postcode doesn't look right.");
  const serviceCode = input.serviceCode ?? "";

  await query(
    `INSERT INTO coverage_requests (name, email, phone, postcode, outward, service_code)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.name, input.email, input.phone, postcode, outward, serviceCode]
  );

  const service = serviceCode ? await getService(serviceCode) : null;
  const wanted = service ? service.label.toLowerCase() : `a ${V.one}`;

  const settings = await getSettings();
  await notify({
    recipient: settings.booking_email,
    subject: `Wanted: ${wanted} in ${outward}`,
    body:
      `${input.name || "Someone"} tried to book ${wanted} in ${postcode} but ` +
      `nobody covers ${outward}${service ? ` for ${service.label.toLowerCase()}` : ""}.\n\n` +
      `Email: ${input.email}\nPhone: ${input.phone || "not given"}\n\n` +
      `Either recruit in ${outward} or call them back and cover it yourself.`,
  });
}

export type CoverageDemand = {
  outward: string;
  service_code: string;
  service_label: string;
  requests: number;
  latest: string;
};

/**
 * Uncovered demand ranked by how many customers asked for it, split by trade —
 * "six people want gutters in CH43" is a recruitment advert, where "six people
 * want something in CH43" is only a shrug.
 */
export async function listCoverageDemand(limit = 20): Promise<CoverageDemand[]> {
  return query<CoverageDemand>(
    `SELECT r.outward,
            r.service_code,
            COALESCE(s.label, 'Any service') AS service_label,
            count(*)::int AS requests,
            to_char(max(r.created_at), 'YYYY-MM-DD') AS latest
       FROM coverage_requests r
       LEFT JOIN services s ON s.code = r.service_code
      WHERE NOT EXISTS (
        SELECT 1 FROM cleaners c
          JOIN cleaner_services cs ON cs.cleaner_id = c.id
         WHERE c.status = 'approved'
           AND ${coversOutward("r.outward")}
           AND (r.service_code = '' OR cs.service_code = r.service_code)
      )
      GROUP BY r.outward, r.service_code, s.label
      ORDER BY count(*) DESC, max(r.created_at) DESC
      LIMIT $1`,
    [limit]
  );
}

// ------------------------------------------------- cleaner profile edits --

/** The stored password hash — needed to sign and verify reset links. */
export async function getCleanerPasswordHash(
  id: number
): Promise<string | null> {
  const row = await queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM cleaners WHERE id = $1`,
    [id]
  );
  return row?.password_hash ?? null;
}

export async function setCleanerPassword(
  id: number,
  passwordHash: string
): Promise<void> {
  await query(`UPDATE cleaners SET password_hash = $2 WHERE id = $1`, [
    id,
    passwordHash,
  ]);
}

export type CleanerProfileInput = {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  insuranceProvider?: string;
  insuranceExpiry?: string | null;
  yearsExperience?: number;
  equipment?: string;
};

/**
 * Update a cleaner's own details. Vetting fields are optional so the cleaner
 * can edit their contact details without being able to rewrite their own
 * insurance record — only admin passes those.
 */
export async function updateCleanerProfile(
  id: number,
  input: CleanerProfileInput
): Promise<{ ok: boolean; reason?: string }> {
  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM cleaners WHERE lower(email) = lower($1) AND id <> $2`,
    [input.email, id]
  );
  if (clash) {
    return { ok: false, reason: `Another ${V.one} already uses that email.` };
  }

  await query(
    `UPDATE cleaners
        SET name = $2, business_name = $3, email = $4, phone = $5,
            insurance_provider = COALESCE($6, insurance_provider),
            insurance_expiry   = COALESCE($7::date, insurance_expiry),
            years_experience   = COALESCE($8, years_experience),
            equipment          = COALESCE($9, equipment)
      WHERE id = $1`,
    [
      id,
      input.name,
      input.businessName,
      input.email,
      input.phone,
      input.insuranceProvider ?? null,
      input.insuranceExpiry ?? null,
      input.yearsExperience ?? null,
      input.equipment ?? null,
    ]
  );
  return { ok: true };
}

/** How many messages went to this recipient recently — cheap abuse guard. */
export async function countRecentNotifications(
  recipient: string,
  minutes: number,
  subjectLike: string
): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM notifications
      WHERE recipient = $1
        AND subject LIKE $3
        AND created_at > now() - ($2 || ' minutes')::interval`,
    [recipient, String(minutes), subjectLike]
  );
  return row?.n ?? 0;
}

// ------------------------------------------------------- dropped jobs -----

/** Notice below this counts as a late drop when judging reliability. */
export const LATE_DROP_HOURS = 24;
/** Late drops inside this window before a cleaner is flagged for review. */
export const DROP_REVIEW_DAYS = 90;
export const DROP_REVIEW_LIMIT = 3;

export type ReleaseResult = {
  ok: boolean;
  reason?: string;
  offered: number;
  late: boolean;
};

/**
 * Take an accepted job off a cleaner and put it straight back to the market.
 *
 * Deliberately available to the cleaner as well as the office: a cleaner who
 * releases the night before is far better than one who no-shows on the day,
 * because the job goes back out while there's still time to fill it. Every
 * release is recorded against them either way.
 */
export async function releaseJob(input: {
  jobId: number;
  by: "cleaner" | "admin";
  reason: string;
  expectCleanerId?: number;
}): Promise<ReleaseResult> {
  // There is no market to put it back to on a solo site: the job would be
  // handed straight back to the same person, after telling the customer their
  // booking had fallen through. Cancelling or rescheduling is what's meant.
  if (IS_SOLO) {
    return {
      ok: false,
      reason: "There's nobody else to pass this to — cancel or reschedule it.",
      offered: 0,
      late: false,
    };
  }

  const job = await getJob(input.jobId);
  if (!job || job.cleaner_id === null) {
    return { ok: false, reason: "That job isn't assigned to anyone.", offered: 0, late: false };
  }
  if (job.status !== "accepted") {
    return { ok: false, reason: "Only an accepted job can be reassigned.", offered: 0, late: false };
  }
  if (input.expectCleanerId && job.cleaner_id !== input.expectCleanerId) {
    return { ok: false, reason: "That job isn't yours.", offered: 0, late: false };
  }

  const hoursNotice = Math.max(0, Number(job.hours_until_slot));
  const late = hoursNotice < LATE_DROP_HOURS;
  const droppedBy = job.cleaner_id;

  await query(
    `INSERT INTO job_drops (job_id, cleaner_id, dropped_by, hours_notice, reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [input.jobId, droppedBy, input.by, hoursNotice, input.reason.slice(0, 300)]
  );

  await query(
    `UPDATE jobs SET status = 'offered', cleaner_id = NULL, accepted_at = NULL
      WHERE id = $1`,
    [input.jobId]
  );
  await query(`DELETE FROM job_offers WHERE job_id = $1`, [input.jobId]);

  const offered = await broadcastJob(input.jobId);

  const when = `${job.slot_date} (${job.slot_window.toUpperCase()})`;

  // The customer is not being cancelled on — their slot and price stand.
  await notifyCustomer(job, {
    subject: `We're arranging another ${V.one} for ${job.ref}`,
    body:
      `${job.customer_name}, the ${V.one} booked for ${when} can no longer ` +
      `make it, so we're arranging someone else.\n\n` +
      `Your time slot and your ${gbpShort(job.total_pence)} price are unchanged` +
      `${offered > 0 ? `, and we'll confirm your new ${V.one} shortly` : ""}.\n\n` +
      `${offered === 0 ? "Our team will call you to confirm.\n\n" : ""}` +
      `Anything you need: ${CONTACT.phone}.`,
    smsBody:
      `${job.ref}: your ${V.one} for ${when} can't make it, so we're arranging ` +
      `another. Same slot, same ${gbpShort(job.total_pence)} price` +
      `${offered === 0 ? " — we'll call you to confirm." : "."}`,
    jobId: input.jobId,
  });

  const cleaner = await getCleaner(droppedBy);
  if (cleaner) {
    await notifyCleaner(cleaner, {
      subject: `Released — ${job.ref} on ${job.slot_date}`,
      body:
        `${cleaner.name}, ${job.ref} for ${when} has been taken off your diary ` +
        `and offered to other ${V.many}. No commission is due.\n\n` +
        (late
          ? `This was inside ${LATE_DROP_HOURS} hours of the slot, so it's ` +
            `recorded as a late drop. Repeated late drops are reviewed.`
          : `Thanks for letting us know in good time.`),
      smsBody:
        `${job.ref} (${when}) released from your diary${late ? " — logged as a late drop." : "."}`,
      jobId: input.jobId,
    });
  }

  return { ok: true, offered, late };
}

export type CleanerReliability = {
  completed: number;
  drops: number;
  late_drops: number;
  recent_late_drops: number;
};

export async function cleanerReliability(
  cleanerId: number
): Promise<CleanerReliability> {
  const row = await queryOne<CleanerReliability>(
    `SELECT
       (SELECT count(*)::int FROM jobs j
         WHERE j.cleaner_id = $1 AND j.status = 'completed')        AS completed,
       (SELECT count(*)::int FROM job_drops d WHERE d.cleaner_id = $1) AS drops,
       (SELECT count(*)::int FROM job_drops d
         WHERE d.cleaner_id = $1 AND d.hours_notice < $2)           AS late_drops,
       (SELECT count(*)::int FROM job_drops d
         WHERE d.cleaner_id = $1 AND d.hours_notice < $2
           AND d.dropped_at > now() - ($3 || ' days')::interval)    AS recent_late_drops`,
    [cleanerId, LATE_DROP_HOURS, String(DROP_REVIEW_DAYS)]
  );
  return row ?? { completed: 0, drops: 0, late_drops: 0, recent_late_drops: 0 };
}


// ------------------------------------------------------ invoice detail ----

export type InvoiceLine = {
  ref: string;
  slot_date: string;
  postcode: string;
  customer_name: string;
  total_pence: number;
  commission_pct: string | number;
  amount_pence: number;
};

/** One invoice with the jobs behind it, for the printable version. */
export async function getInvoice(
  ref: string
): Promise<{ invoice: InvoiceRow; lines: InvoiceLine[] } | null> {
  const invoice = await queryOne<InvoiceRow>(
    `SELECT i.id, i.ref, i.cleaner_id, c.name AS cleaner_name,
            to_char(i.period_start, 'YYYY-MM-DD') AS period_start,
            to_char(i.period_end,   'YYYY-MM-DD') AS period_end,
            i.total_pence, i.status,
            to_char(i.issued_at, 'YYYY-MM-DD') AS issued_at,
            to_char(i.paid_at,   'YYYY-MM-DD') AS paid_at,
            (SELECT count(*)::int FROM commission_invoice_lines l
              WHERE l.invoice_id = i.id) AS jobs
       FROM commission_invoices i
       JOIN cleaners c ON c.id = i.cleaner_id
      WHERE i.ref = $1`,
    [ref]
  );
  if (!invoice) return null;

  const lines = await query<InvoiceLine>(
    `SELECT j.ref,
            to_char(j.slot_date, 'YYYY-MM-DD') AS slot_date,
            j.postcode, j.customer_name, j.total_pence, j.commission_pct,
            l.amount_pence
       FROM commission_invoice_lines l
       JOIN jobs j ON j.id = l.job_id
      WHERE l.invoice_id = $1
      ORDER BY j.slot_date`,
    [invoice.id]
  );

  return { invoice, lines };
}

// -------------------------------------- activating provisional bookings ---

/**
 * Release provisional bookings that a newly-covered area can now service.
 *
 * A provisional booking carries a promise to confirm within 24 hours. Approving
 * a cleaner, or a cleaner widening their patch, is exactly the moment that
 * promise becomes keepable — leaving those jobs sitting in the queue until
 * someone notices is how the promise gets broken.
 */
export async function activateProvisionalJobs(
  cleanerId: number
): Promise<number> {
  const [areas, services] = await Promise.all([
    getCleanerAreas(cleanerId),
    getCleanerServices(cleanerId),
  ]);
  // An empty patch means "everywhere" for a solo operator, so it must not
  // short-circuit here the way it does for a contractor who registered nothing
  // and should be offered nothing.
  const anywhere = IS_SOLO && areas.length === 0;
  if (services.length === 0) return 0;
  if (areas.length === 0 && !anywhere) return 0;

  const waiting = await query<Job>(
    `SELECT ${JOB_COLUMNS}
       FROM jobs j
      WHERE j.status = 'provisional'
        AND ($1::text[] IS NULL OR j.outward = ANY($1::text[]))
        AND j.service_code = ANY($2)
        AND j.slot_date >= CURRENT_DATE
      ORDER BY j.slot_date`,
    [anywhere ? null : areas, services]
  );

  let activated = 0;
  for (const job of waiting) {
    // Covering the postcode isn't enough — they have to be free that half-day.
    const matches = await findMatchingCleaners(
      job.outward,
      job.slot_date,
      job.slot_window,
      job.service_code
    );
    if (matches.length === 0) continue;

    const moved = await query<{ id: number }>(
      `UPDATE jobs SET status = 'offered'
        WHERE id = $1 AND status = 'provisional'
        RETURNING id`,
      [job.id]
    );
    if (moved.length === 0) continue;

    // The message below is this customer's confirmation, so solo mode must not
    // also send its own — see broadcastJob.
    await broadcastJob(job.id, false);

    await notifyCustomer(job, {
      subject: `Good news — we can cover ${job.outward} for ${job.ref}`,
      body:
        `${job.customer_name}, we now cover ${job.service_label.toLowerCase()} ` +
        `in ${job.outward}, so your request for ${job.slot_date} ` +
        `(${job.slot_window.toUpperCase()}) is going ahead.\n\n` +
        `Your ${gbpShort(job.total_pence)} price is unchanged and there's still ` +
        `nothing to pay until the day. We'll confirm the details shortly.`,
      smsBody:
        `${job.ref}: good news, we now cover ${job.outward}. Your ` +
        `${job.slot_date} ${job.slot_window.toUpperCase()} booking is going ` +
        `ahead — we'll confirm shortly. ${gbpShort(job.total_pence)}, nothing ` +
        `to pay until the day.`,
      jobId: job.id,
    });

    activated += 1;
  }

  return activated;
}

// ------------------------------------------------------- job detail -------

export type JobOfferRow = {
  cleaner_id: number;
  cleaner_name: string;
  business_name: string;
  phone: string;
  sent_at: string;
  response: string | null;
  responded_at: string | null;
};

/** Who a job went to and what they did about it. */
export async function getJobOffers(jobId: number): Promise<JobOfferRow[]> {
  return query<JobOfferRow>(
    `SELECT o.cleaner_id, c.name AS cleaner_name, c.business_name, c.phone,
            to_char(o.sent_at,      'YYYY-MM-DD HH24:MI') AS sent_at,
            o.response,
            to_char(o.responded_at, 'YYYY-MM-DD HH24:MI') AS responded_at
       FROM job_offers o
       JOIN cleaners c ON c.id = o.cleaner_id
      WHERE o.job_id = $1
      ORDER BY o.sent_at`,
    [jobId]
  );
}

export type JobDropRow = {
  cleaner_name: string;
  dropped_by: string;
  hours_notice: string | number;
  reason: string;
  dropped_at: string;
};

/** Anyone who took this job and then handed it back. */
export async function getJobDrops(jobId: number): Promise<JobDropRow[]> {
  return query<JobDropRow>(
    `SELECT c.name AS cleaner_name, d.dropped_by, d.hours_notice, d.reason,
            to_char(d.dropped_at, 'YYYY-MM-DD HH24:MI') AS dropped_at
       FROM job_drops d
       JOIN cleaners c ON c.id = d.cleaner_id
      WHERE d.job_id = $1
      ORDER BY d.dropped_at`,
    [jobId]
  );
}

export type JobMessage = {
  id: number;
  channel: string;
  recipient: string;
  subject: string;
  created_at: string;
  sent_at: string | null;
  error: string | null;
};

/**
 * Every message generated for one job.
 *
 * Being on the offer list only means a job was *addressed* to a cleaner — the
 * text may have bounced, or their number may not be a mobile. Without this,
 * a cleaner who never received the offer looks identical to one ignoring it.
 */
export async function getJobMessages(jobId: number): Promise<JobMessage[]> {
  return query<JobMessage>(
    `SELECT id, channel, recipient, subject,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
            to_char(sent_at,    'HH24:MI')            AS sent_at,
            error
       FROM notifications
      WHERE job_id = $1
      ORDER BY id`,
    [jobId]
  );
}
