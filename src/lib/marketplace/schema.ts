import {
  BRAND,
  COMMISSION_PCT,
  COMPANY_DISCLOSURE,
  CONTACT,
  IS_SOLO,
  SITE,
} from "@/config";

/**
 * Booking schema. Every statement is idempotent so `ensureSchema()` can run on
 * any cold start without a separate migration step.
 *
 * All money is stored as integer pence — never floats.
 *
 * The schema is multi-service by design, whatever the client sells. A trade is
 * a first-class dimension rather than a label, because it decides who a job is
 * offered to — an oven specialist must never be texted about a gutter clean.
 * Three tables carry it:
 *
 *   services         the trades on offer, priced and minimum-charged separately
 *   price_items      every bookable line belongs to exactly one service
 *   cleaner_services which trades each operative has been approved for
 *
 * A customer builds one basket across services. `bookings` holds the customer
 * and address once; `jobs` holds one visit per service, each with its own slot,
 * its own operative and its own commission. That split is deliberate — a
 * window cleaner and a carpet cleaner are two different people arriving on two
 * different days, and pretending otherwise would leave jobs unfillable.
 *
 * The seed at the bottom is generated from the active preset in
 * `src/config`, so standing up a new client site means editing a config file,
 * not this one. Seeded rows use ON CONFLICT DO NOTHING: after the first boot
 * the live price list belongs to /admin/prices, and a redeploy must never
 * quietly undo a price the operator changed there.
 */

/**
 * `migrate()` skips every statement when the recorded version already matches,
 * so anything added to STATEMENTS or SEED needs this bumped or it will never
 * reach a database that has already booted once.
 */
export const SCHEMA_VERSION = 2;

export const STATEMENTS: string[] = [
  // ---- Platform settings (single row) -------------------------------------
  `CREATE TABLE IF NOT EXISTS settings (
     id                        int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
     commission_pct            numeric(5,2) NOT NULL DEFAULT 20.00,
     min_notice_days           int  NOT NULL DEFAULT 1,
     booking_email             text NOT NULL DEFAULT '',
     cancellation_notice_hours int  NOT NULL DEFAULT 24,
     payee_name                text NOT NULL DEFAULT '',
     payee_account             text NOT NULL DEFAULT '',
     payee_sort_code           text NOT NULL DEFAULT '',
     payee_address             text NOT NULL DEFAULT '',
     payment_terms_days        int  NOT NULL DEFAULT 7,
     legal_footer              text NOT NULL DEFAULT '',
     admin_mobile              text NOT NULL DEFAULT '',
     admin_sms_enabled         boolean NOT NULL DEFAULT true,
     updated_at                timestamptz NOT NULL DEFAULT now()
   )`,

  // ---- Services (the trades on offer) -------------------------------------
  // Minimum charge is per service because the trades are nothing alike: £90
  // is a sensible floor for sending a carpet machine out and an absurd one for
  // a terraced window clean. `protection_pct` above zero means the service
  // offers a protection add-on (stain guard on carpets); zero means it doesn't.
  `CREATE TABLE IF NOT EXISTS services (
     code                 text PRIMARY KEY,
     label                text NOT NULL,
     hint                 text NOT NULL DEFAULT '',
     blurb                text NOT NULL DEFAULT '',
     minimum_charge_pence int  NOT NULL DEFAULT 0,
     protection_pct       numeric(5,2) NOT NULL DEFAULT 0,
     protection_label     text NOT NULL DEFAULT '',
     protection_hint      text NOT NULL DEFAULT '',
     sort                 int  NOT NULL DEFAULT 100,
     active               boolean NOT NULL DEFAULT true
   )`,

  // ---- National price list (admin controlled) -----------------------------
  // `kind` groups items *within* a service on the booking form (carpets vs
  // upholstery); `service_code` decides which cleaner ever sees them.
  `CREATE TABLE IF NOT EXISTS price_items (
     code             text PRIMARY KEY,
     service_code     text NOT NULL REFERENCES services(code) ON DELETE CASCADE,
     label            text NOT NULL,
     hint             text NOT NULL DEFAULT '',
     kind             text NOT NULL DEFAULT '',
     unit_price_pence int  NOT NULL,
     max_qty          int  NOT NULL DEFAULT 10,
     sort             int  NOT NULL DEFAULT 100,
     active           boolean NOT NULL DEFAULT true
   )`,
  `CREATE INDEX IF NOT EXISTS price_items_service ON price_items (service_code)`,

  // Fixed-price bundles, e.g. "3 rooms for £99". Applied automatically when the
  // customer's quantity reaches the bundle size and it beats the itemised price.
  `CREATE TABLE IF NOT EXISTS price_bundles (
     id          serial PRIMARY KEY,
     item_code   text NOT NULL REFERENCES price_items(code) ON DELETE CASCADE,
     qty         int  NOT NULL,
     price_pence int  NOT NULL,
     label       text NOT NULL,
     active      boolean NOT NULL DEFAULT true
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS price_bundles_item_qty
     ON price_bundles (item_code, qty)`,

  // ---- Cleaners -----------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS cleaners (
     id                 serial PRIMARY KEY,
     name               text NOT NULL,
     business_name      text NOT NULL DEFAULT '',
     email              text NOT NULL,
     phone              text NOT NULL,
     password_hash      text NOT NULL,
     status             text NOT NULL DEFAULT 'pending',
     insurance_provider text NOT NULL DEFAULT '',
     insurance_expiry   date,
     years_experience   int  NOT NULL DEFAULT 0,
     equipment          text NOT NULL DEFAULT '',
     dbs_checked        boolean NOT NULL DEFAULT false,
     admin_notes        text NOT NULL DEFAULT '',
     notify_sms         boolean NOT NULL DEFAULT true,
     notify_email       boolean NOT NULL DEFAULT true,
     created_at         timestamptz NOT NULL DEFAULT now(),
     reviewed_at        timestamptz
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cleaners_email_lower
     ON cleaners (lower(email))`,

  // Which trades this cleaner is approved to be offered work in. A cleaner with
  // no rows here is offered nothing, which is the safe default.
  `CREATE TABLE IF NOT EXISTS cleaner_services (
     cleaner_id   int  NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     service_code text NOT NULL REFERENCES services(code) ON DELETE CASCADE,
     PRIMARY KEY (cleaner_id, service_code)
   )`,
  `CREATE INDEX IF NOT EXISTS cleaner_services_service
     ON cleaner_services (service_code)`,

  // Postcode coverage, stored as outward codes (the part before the space).
  `CREATE TABLE IF NOT EXISTS cleaner_areas (
     cleaner_id int  NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     outward    text NOT NULL,
     PRIMARY KEY (cleaner_id, outward)
   )`,
  `CREATE INDEX IF NOT EXISTS cleaner_areas_outward ON cleaner_areas (outward)`,

  // Weekly availability: one row per weekday the cleaner works (0 = Sunday).
  `CREATE TABLE IF NOT EXISTS cleaner_availability (
     cleaner_id int NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     weekday    int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
     am         boolean NOT NULL DEFAULT true,
     pm         boolean NOT NULL DEFAULT true,
     PRIMARY KEY (cleaner_id, weekday)
   )`,

  // One-off days off, by half day. Cleaners have their own work outside the
  // platform, and blocking a whole day to cover one private afternoon costs
  // them the morning too.
  `CREATE TABLE IF NOT EXISTS cleaner_blackouts (
     cleaner_id int  NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     day        date NOT NULL,
     am         boolean NOT NULL DEFAULT true,
     pm         boolean NOT NULL DEFAULT true,
     PRIMARY KEY (cleaner_id, day)
   )`,

  // ---- Bookings -----------------------------------------------------------
  // One basket the customer submitted. Customer and address live here so a
  // five-service booking stores them once, and the manage-my-booking link is a
  // single URL rather than one per trade.
  `CREATE TABLE IF NOT EXISTS bookings (
     id             serial PRIMARY KEY,
     ref            text NOT NULL UNIQUE,
     customer_name  text NOT NULL,
     customer_email text NOT NULL,
     customer_phone text NOT NULL,
     address_line   text NOT NULL,
     town           text NOT NULL DEFAULT '',
     postcode       text NOT NULL,
     outward        text NOT NULL,
     notes          text NOT NULL DEFAULT '',
     total_pence    int  NOT NULL DEFAULT 0,
     created_at     timestamptz NOT NULL DEFAULT now()
   )`,

  // ---- Jobs (one visit, one trade, one cleaner) ---------------------------
  // The customer columns are duplicated from `bookings` rather than joined:
  // a job is what a cleaner accepts and gets paid for, and it has to stay
  // readable on its own in the cleaner's diary and on an invoice line.
  `CREATE TABLE IF NOT EXISTS jobs (
     id               serial PRIMARY KEY,
     ref              text NOT NULL UNIQUE,
     booking_id       int  REFERENCES bookings(id) ON DELETE CASCADE,
     service_code     text NOT NULL REFERENCES services(code),
     customer_name    text NOT NULL,
     customer_email   text NOT NULL,
     customer_phone   text NOT NULL,
     address_line     text NOT NULL,
     town             text NOT NULL DEFAULT '',
     postcode         text NOT NULL,
     outward          text NOT NULL,
     slot_date        date NOT NULL,
     slot_window      text NOT NULL,
     items            jsonb NOT NULL DEFAULT '[]'::jsonb,
     notes            text NOT NULL DEFAULT '',
     subtotal_pence   int NOT NULL,
     total_pence      int NOT NULL,
     commission_pct   numeric(5,2) NOT NULL,
     commission_pence int NOT NULL,
     status           text NOT NULL DEFAULT 'offered',
     cleaner_id       int REFERENCES cleaners(id) ON DELETE SET NULL,
     created_at       timestamptz NOT NULL DEFAULT now(),
     accepted_at      timestamptz,
     completed_at     timestamptz,
     cancelled_at     timestamptz,
     cancel_reason    text NOT NULL DEFAULT '',
     cancelled_by     text NOT NULL DEFAULT '',
     late_cancellation boolean NOT NULL DEFAULT false,
     rescheduled_count int NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status)`,
  `CREATE INDEX IF NOT EXISTS jobs_cleaner ON jobs (cleaner_id)`,
  `CREATE INDEX IF NOT EXISTS jobs_outward ON jobs (outward)`,
  `CREATE INDEX IF NOT EXISTS jobs_service ON jobs (service_code)`,
  `CREATE INDEX IF NOT EXISTS jobs_booking ON jobs (booking_id)`,

  // Broadcast record: one row per cleaner the job was offered to.
  `CREATE TABLE IF NOT EXISTS job_offers (
     id           serial PRIMARY KEY,
     job_id       int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     cleaner_id   int NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     sent_at      timestamptz NOT NULL DEFAULT now(),
     response     text,
     responded_at timestamptz
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS job_offers_job_cleaner
     ON job_offers (job_id, cleaner_id)`,

  // A cleaner walking away from an accepted job is the thing most likely to
  // cost a customer, so it gets its own record. Notice given is stored at the
  // moment of the drop because it can't be reconstructed afterwards.
  `CREATE TABLE IF NOT EXISTS job_drops (
     id           serial PRIMARY KEY,
     job_id       int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     cleaner_id   int NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     dropped_by   text NOT NULL DEFAULT 'cleaner',
     hours_notice numeric(8,2) NOT NULL DEFAULT 0,
     reason       text NOT NULL DEFAULT '',
     dropped_at   timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS job_drops_cleaner ON job_drops (cleaner_id)`,

  // ---- Commission invoicing ----------------------------------------------
  `CREATE TABLE IF NOT EXISTS commission_invoices (
     id           serial PRIMARY KEY,
     ref          text NOT NULL UNIQUE,
     cleaner_id   int  NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
     period_start date NOT NULL,
     period_end   date NOT NULL,
     total_pence  int  NOT NULL,
     status       text NOT NULL DEFAULT 'issued',
     issued_at    timestamptz NOT NULL DEFAULT now(),
     paid_at      timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS commission_invoice_lines (
     invoice_id   int NOT NULL REFERENCES commission_invoices(id) ON DELETE CASCADE,
     job_id       int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     amount_pence int NOT NULL,
     PRIMARY KEY (invoice_id, job_id)
   )`,
  // A completed job can only ever appear on one commission invoice.
  `CREATE UNIQUE INDEX IF NOT EXISTS commission_invoice_lines_job
     ON commission_invoice_lines (job_id)`,

  // ---- Demand in uncovered areas ------------------------------------------
  // A postcode with no cleaner is a lost customer AND the best possible signal
  // of where to recruit next, so capture it rather than showing a dead end.
  // The service is recorded too: "nobody does gutters in CH43" is a different
  // recruitment problem from "nobody works in CH43 at all".
  `CREATE TABLE IF NOT EXISTS coverage_requests (
     id           serial PRIMARY KEY,
     name         text NOT NULL DEFAULT '',
     email        text NOT NULL,
     phone        text NOT NULL DEFAULT '',
     postcode     text NOT NULL,
     outward      text NOT NULL,
     service_code text NOT NULL DEFAULT '',
     created_at   timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS coverage_requests_outward
     ON coverage_requests (outward)`,

  // Every booking texts cleaners, so an open booking endpoint is a way to
  // spend someone else's money. Counters live in the database because
  // serverless instances don't share memory.
  `CREATE TABLE IF NOT EXISTS rate_limits (
     bucket       text NOT NULL,
     key          text NOT NULL,
     window_start timestamptz NOT NULL DEFAULT now(),
     count        int NOT NULL DEFAULT 0,
     PRIMARY KEY (bucket, key)
   )`,

  // ---- Notification outbox ------------------------------------------------
  // Written on every broadcast/allocation event. A sender picks these up; with
  // no provider configured they still give admin a full audit trail.
  `CREATE TABLE IF NOT EXISTS notifications (
     id         serial PRIMARY KEY,
     channel    text NOT NULL DEFAULT 'email',
     recipient  text NOT NULL,
     subject    text NOT NULL,
     body       text NOT NULL,
     job_id     int REFERENCES jobs(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now(),
     sent_at    timestamptz,
     error      text
   )`,

  // ==== ONE-OFF DATA CHANGES — always the last entries in this array ========
  // These get replaced wholesale on each version bump, so nothing else may
  // live below this line. Ongoing price changes belong in /admin/prices, not
  // here: a one-off replayed on a later bump silently undoes admin edits.
];

/**
 * The owner, as an operative row — solo mode's entire allocation mechanism.
 *
 * Solo mode is a network of one: rather than teaching every query a second way
 * to find who is doing the work, the one person doing it gets a row like any
 * contractor, and the diary, availability, slot picker and job history all keep
 * working untouched. Approved on sight for every service, available all week,
 * because a solo site that ships unable to take a booking is broken on day one;
 * the operator narrows both in /admin/cleaners.
 *
 * No coverage rows: an empty patch is read as "wherever I'm asked" in solo mode
 * (see `coversOutward` in repo.ts), which is the only workable default when the
 * alternative is seeding every outward code in the UK.
 *
 * The password hash is deliberately unusable rather than a hash of something
 * guessable. Solo mode has no contractor portal at all, so this account must
 * never be a way in: the stored value has no `scrypt$salt$hash` shape, so
 * `verifyPassword` rejects every candidate before it computes anything.
 */
const SOLO_OPERATIVE_SEED: [string, unknown[]][] = !IS_SOLO
  ? []
  : [
      [
        `INSERT INTO cleaners
           (name, business_name, email, phone, password_hash, status, reviewed_at)
         VALUES ($1,$2,$3,$4,'no-login$solo-operator','approved', now())
         ON CONFLICT DO NOTHING`,
        [BRAND.tradingName, BRAND.tradingName, CONTACT.email, CONTACT.phone],
      ],
      // Keyed off the email rather than a returned id: the seed runner takes
      // one statement at a time with no way to pass a value between them, and
      // the unique index on lower(email) makes this exact anyway.
      [
        `INSERT INTO cleaner_services (cleaner_id, service_code)
         SELECT c.id, s.code
           FROM cleaners c, services s
          WHERE lower(c.email) = lower($1) AND s.code = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [CONTACT.email, SITE.catalogue.services.map((service) => service.code)],
      ],
      [
        `INSERT INTO cleaner_availability (cleaner_id, weekday, am, pm)
         SELECT c.id, w.weekday, true, true
           FROM cleaners c, generate_series(0, 6) AS w(weekday)
          WHERE lower(c.email) = lower($1)
         ON CONFLICT DO NOTHING`,
        [CONTACT.email],
      ],
    ];

/**
 * Seed rows, generated from the active preset.
 *
 * `ON CONFLICT DO NOTHING` throughout: these are starting values, not the
 * source of truth. Once a site is live the operator owns the price list from
 * /admin/prices, and an upsert here would silently revert their edits on the
 * next deploy — the single most expensive bug this file could have.
 */
export const SEED: [string, unknown[]][] = [
  [
    `INSERT INTO settings (id, commission_pct, min_notice_days, booking_email,
       cancellation_notice_hours, payment_terms_days, legal_footer)
     VALUES (1,$1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [
      COMMISSION_PCT,
      SITE.commercials.minNoticeDays,
      SITE.contact.email,
      SITE.commercials.cancellationNoticeHours,
      SITE.commercials.paymentTermsDays,
      COMPANY_DISCLOSURE,
    ],
  ],

  ...SITE.catalogue.services.map(
    (service) =>
      [
        `INSERT INTO services
           (code, label, hint, blurb, minimum_charge_pence,
            protection_pct, protection_label, protection_hint, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO NOTHING`,
        [
          service.code,
          service.label,
          service.hint,
          service.blurb,
          service.minimumChargePence,
          service.protectionPct,
          service.protectionLabel,
          service.protectionHint,
          service.sort,
        ],
      ] as [string, unknown[]]
  ),

  ...SITE.catalogue.items.map(
    (item) =>
      [
        `INSERT INTO price_items
           (code, service_code, label, hint, kind, unit_price_pence, max_qty, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING`,
        [
          item.code,
          item.serviceCode,
          item.label,
          item.hint,
          item.kind,
          item.unitPricePence,
          item.maxQty,
          item.sort,
        ],
      ] as [string, unknown[]]
  ),

  ...SITE.catalogue.bundles.map(
    (bundle) =>
      [
        `INSERT INTO price_bundles (item_code, qty, price_pence, label)
         VALUES ($1,$2,$3,$4) ON CONFLICT (item_code, qty) DO NOTHING`,
        [bundle.itemCode, bundle.qty, bundle.pricePence, bundle.label],
      ] as [string, unknown[]]
  ),

  ...SOLO_OPERATIVE_SEED,
];
