"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checkAdminPassword,
  endAdminSession,
  isAdmin,
  startAdminSession,
} from "@/lib/marketplace/auth";
import {
  cancelJob,
  deleteBundle,
  deletePriceItem,
  generateCommissionInvoices,
  getPriceItems,
  getService,
  getServices,
  upsertService,
  setCleanerServices,
  rebroadcastJob,
  setCleanerStatus,
  setInvoiceStatus,
  updateSettings,
  upsertBundle,
  upsertPriceItem,
  notify,
  getCleaner,
} from "@/lib/marketplace/repo";
import { penceFromInput } from "@/lib/marketplace/money";
import { hitRateLimit } from "@/lib/marketplace/rate-limit";
import { parseOutwardList } from "@/lib/marketplace/postcode";
import { makeResetToken } from "@/lib/marketplace/auth";
import { BRAND, IS_SOLO, V, siteUrl } from "@/config";
import {
  activateProvisionalJobs,
  assignJob,
  getCleanerPasswordHash,
  getJob,
  getOwnerOperative,
  releaseJob,
  waiveCommission,
  setAvailability,
  setCleanerAreas,
  updateCleanerProfile,
  worksThatHalfDay,
} from "@/lib/marketplace/repo";

function field(data: FormData, name: string, max = 200): string {
  return String(data.get(name) ?? "").trim().slice(0, max);
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function requireAdmin(path: string) {
  if (!(await isAdmin())) redirect(`/admin?error=${encodeURIComponent("Please sign in.")}`);
  return path;
}

// ------------------------------------------------------------------ access --

export async function adminLoginAction(data: FormData) {
  // One shared password guards every customer record in the system, so this is
  // the highest-value target on the site.
  const attempts = await hitRateLimit("login:admin", "admin", 10, 15 * 60);
  if (!attempts.allowed) {
    fail("/admin", "Too many attempts. Please wait a few minutes.");
  }

  if (!checkAdminPassword(field(data, "password", 200))) {
    fail("/admin", "Incorrect password.");
  }
  await startAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await endAdminSession();
  redirect("/admin");
}

// ------------------------------------------------------------ price control --

/** Save the whole national price list and platform settings in one submit. */
export async function savePricesAction(data: FormData) {
  await requireAdmin("/admin/prices");

  const commissionPct = Number(field(data, "commissionPct", 6));
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 90) {
    fail("/admin/prices", "Commission must be between 0 and 90 percent.");
  }

  const minNoticeDays = Number(field(data, "minNoticeDays", 3));
  if (!Number.isFinite(minNoticeDays) || minNoticeDays < 0 || minNoticeDays > 30) {
    fail("/admin/prices", "Notice period must be between 0 and 30 days.");
  }

  const cancellationNoticeHours = Number(field(data, "cancellationNoticeHours", 4));
  if (
    !Number.isFinite(cancellationNoticeHours) ||
    cancellationNoticeHours < 0 ||
    cancellationNoticeHours > 336
  ) {
    fail("/admin/prices", "Cancellation notice must be between 0 and 336 hours.");
  }

  await updateSettings({
    commissionPct,
    minNoticeDays,
    bookingEmail: field(data, "bookingEmail", 120),
    cancellationNoticeHours,
    payeeName: field(data, "payeeName", 120),
    // Digits only — a stray space or dash makes a bank transfer fail.
    payeeAccount: field(data, "payeeAccount", 20).replace(/\D/g, ""),
    payeeSortCode: field(data, "payeeSortCode", 12).replace(/\D/g, ""),
    payeeAddress: field(data, "payeeAddress", 300),
    paymentTermsDays: Math.max(
      0,
      Math.min(90, Number(field(data, "paymentTermsDays", 3)) || 7)
    ),
    legalFooter: field(data, "legalFooter", 300),
    adminMobile: field(data, "adminMobile", 30),
    adminSmsEnabled: data.get("adminSmsEnabled") === "on",
  });

  for (const service of await getServices()) {
    const minimum = penceFromInput(field(data, `min-${service.code}`, 12));
    if (minimum === null) {
      fail(
        "/admin/prices",
        `"${service.label}" needs a valid minimum charge, e.g. 45 or 45.00.`
      );
    }
    const protectionPct = Number(field(data, `protection-${service.code}`, 6) || 0);
    if (!Number.isFinite(protectionPct) || protectionPct < 0 || protectionPct > 100) {
      fail(
        "/admin/prices",
        `"${service.label}" add-on must be between 0 and 100 percent.`
      );
    }

    await upsertService({
      code: service.code,
      label: field(data, `slabel-${service.code}`, 80) || service.label,
      hint: field(data, `shint-${service.code}`, 160),
      blurb: service.blurb,
      minimumChargePence: minimum,
      protectionPct,
      protectionLabel: field(data, `plabel-${service.code}`, 80),
      protectionHint: field(data, `phint-${service.code}`, 200),
      sort: service.sort,
      active: data.get(`sactive-${service.code}`) === "on",
    });
  }

  for (const item of await getPriceItems()) {
    const price = penceFromInput(field(data, `price-${item.code}`, 12));
    if (price === null) {
      fail("/admin/prices", `"${item.label}" needs a valid price.`);
    }
    await upsertPriceItem({
      code: item.code,
      serviceCode: item.service_code,
      label: field(data, `label-${item.code}`, 80) || item.label,
      hint: field(data, `hint-${item.code}`, 120),
      kind: field(data, `kind-${item.code}`, 40),
      unitPricePence: price,
      maxQty: Math.max(1, Math.min(50, Number(field(data, `max-${item.code}`, 3)) || item.max_qty)),
      sort: item.sort,
      active: data.get(`active-${item.code}`) === "on",
    });
  }

  revalidatePath("/admin/prices");
  revalidatePath("/book");
  redirect("/admin/prices?saved=1");
}

export async function addPriceItemAction(data: FormData) {
  await requireAdmin("/admin/prices");

  const code = field(data, "code", 40)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const label = field(data, "label", 80);
  const price = penceFromInput(field(data, "price", 12));
  const serviceCode = field(data, "serviceCode", 40);

  if (!code) fail("/admin/prices", "Give the new item a short code, e.g. curtains.");
  if (!label) fail("/admin/prices", "Give the new item a customer-facing label.");
  if (price === null) fail("/admin/prices", "Give the new item a valid price.");
  // Without a service the item belongs to no trade, so nobody would ever be
  // offered it — better to refuse than to create an invisible line.
  if (!(await getService(serviceCode))) {
    fail("/admin/prices", "Choose which service the new item belongs to.");
  }

  await upsertPriceItem({
    code,
    serviceCode,
    label,
    hint: field(data, "hint", 120),
    kind: field(data, "kind", 40),
    unitPricePence: price,
    maxQty: Math.max(1, Math.min(50, Number(field(data, "maxQty", 3)) || 10)),
    sort: Number(field(data, "sort", 4)) || 500,
    active: true,
  });

  revalidatePath("/admin/prices");
  revalidatePath("/book");
  redirect("/admin/prices?saved=1");
}

/**
 * Bound-argument variant for the per-row Remove button.
 *
 * A button using formAction can't also carry name/value data — React claims
 * that slot to encode the server action reference, so a `name="code"` field is
 * silently overwritten and the delete arrives with nothing to delete. Binding
 * the code into the action sidesteps the collision entirely.
 */
export async function removePriceItemAction(code: string, _data: FormData) {
  await requireAdmin("/admin/prices");
  await deletePriceItem(code);
  revalidatePath("/admin/prices");
  revalidatePath("/book");
  redirect("/admin/prices?saved=1");
}

export async function deletePriceItemAction(data: FormData) {
  await requireAdmin("/admin/prices");
  await deletePriceItem(field(data, "code", 40));
  revalidatePath("/admin/prices");
  revalidatePath("/book");
  redirect("/admin/prices?saved=1");
}

export async function addBundleAction(data: FormData) {
  await requireAdmin("/admin/prices");

  const itemCode = field(data, "itemCode", 40);
  const qty = Number(field(data, "qty", 3));
  const price = penceFromInput(field(data, "price", 12));

  if (!itemCode) fail("/admin/prices", "Pick which item the offer applies to.");
  if (!Number.isFinite(qty) || qty < 2 || qty > 50) {
    fail("/admin/prices", "An offer needs a quantity between 2 and 50.");
  }
  if (price === null) fail("/admin/prices", "Give the offer a valid price.");

  await upsertBundle({
    itemCode,
    qty,
    pricePence: price,
    label: field(data, "label", 80) || `${qty} for £${(price / 100).toFixed(0)}`,
  });

  revalidatePath("/admin/prices");
  revalidatePath("/book");
  redirect("/admin/prices?saved=1");
}

export async function deleteBundleAction(data: FormData) {
  await requireAdmin("/admin/prices");
  await deleteBundle(Number(field(data, "id", 12)));
  revalidatePath("/admin/prices");
  revalidatePath("/book");
  redirect("/admin/prices?saved=1");
}

// ---------------------------------------------------------------- vetting --

export async function setCleanerStatusAction(data: FormData) {
  await requireAdmin("/admin/cleaners");

  const id = Number(field(data, "id", 12));
  const status = field(data, "status", 20);
  if (!["approved", "suspended", "rejected", "pending"].includes(status)) {
    fail("/admin/cleaners", "Unknown status.");
  }

  await setCleanerStatus(id, status, field(data, "adminNotes", 1000) || undefined);

  if (status === "approved") {
    // Anyone who booked provisionally in their patch has been waiting on
    // exactly this.
    await activateProvisionalJobs(id);
    const cleaner = await getCleaner(id);
    if (cleaner) {
      await notify({
        recipient: cleaner.email,
        subject: "You're approved — jobs are on their way",
        body:
          `Good news ${cleaner.name}, your ${BRAND.shortName} ${V.one} ` +
          `account is live.\n\n` +
          `Jobs in your postcode areas will now appear at /pro/dashboard. ` +
          `First ${V.one} to accept keeps the job, so turn your ` +
          `notifications on.`,
      });
    }
  }

  revalidatePath("/admin/cleaners");
  redirect("/admin/cleaners?saved=1");
}

// ------------------------------------------------------------------- jobs --

/**
 * Refuse to drop a job onto a half-day the solo operator isn't working.
 *
 * In network mode a broadcast filters on the rota, so a blacked-out day simply
 * means nobody matches and the job goes unfilled — visibly. Solo allocation
 * goes straight into the one diary there is, so without this an admin click
 * would confirm a slot the operator has already said they aren't working, and
 * the customer finds out when nobody arrives. Customer bookings are untouched:
 * the slot picker never offers a half-day they aren't working in the first
 * place, and that path stays free to put two services in one visit.
 *
 * Refuses rather than warns, because a server action has no second step to warn
 * into — the message names the two ways out instead.
 */
async function refuseIfOperativeIsOff(
  path: string,
  jobId: number,
  cleanerId: number
): Promise<void> {
  if (!IS_SOLO) return;
  const job = await getJob(jobId);
  if (!job) return;
  if (await worksThatHalfDay(cleanerId, job.slot_date, job.slot_window)) return;
  fail(
    path,
    `You're not working ${job.slot_date} ${job.slot_window.toUpperCase()} — ` +
      `it's a day off or outside your weekly hours. Free that half-day in ` +
      `/admin/cleaners, or move the booking to a day you are working, then ` +
      `try again.`
  );
}

export async function cancelJobAction(data: FormData) {
  await requireAdmin("/admin/jobs");
  await cancelJob(
    Number(field(data, "id", 12)),
    field(data, "reason", 200) || "Cancelled by admin"
  );
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs?saved=1");
}

/**
 * Take a job off its cleaner and put it back out. Distinct from cancelling:
 * the customer keeps their slot and price, so they must not be told their
 * booking is cancelled.
 */
/** Put a job in a named cleaner's diary — usually straight after a phone call. */
export async function assignJobAction(data: FormData) {
  await requireAdmin("/admin/jobs");
  const jobId = Number(field(data, "id", 12));
  const cleanerId = Number(field(data, "cleanerId", 12));
  if (!cleanerId) fail("/admin/jobs", `Pick a ${V.one} to assign it to.`);
  await refuseIfOperativeIsOff("/admin/jobs", jobId, cleanerId);

  const result = await assignJob(
    jobId,
    cleanerId,
    data.get("waiveCommission") === "on"
  );
  revalidatePath("/admin/jobs");
  if (!result.ok) fail("/admin/jobs", result.reason ?? "Couldn't assign that job.");
  redirect("/admin/jobs?assigned=1");
}

/** Drop the commission on a job that's already booked in. */
export async function waiveCommissionAction(data: FormData) {
  await requireAdmin("/admin/jobs");
  const ref = field(data, "ref", 20);
  const result = await waiveCommission(Number(field(data, "id", 12)));
  revalidatePath(`/admin/jobs/${ref}`);
  if (!result.ok) {
    redirect(`/admin/jobs/${ref}?error=${encodeURIComponent(result.reason ?? "Couldn't change that.")}`);
  }
  redirect(`/admin/jobs/${ref}?waived=1`);
}

export async function reassignJobAction(data: FormData) {
  await requireAdmin("/admin/jobs");
  const result = await releaseJob({
    jobId: Number(field(data, "id", 12)),
    by: "admin",
    reason: field(data, "reason", 300) || "Reassigned by the office",
  });
  revalidatePath("/admin/jobs");
  if (!result.ok) {
    fail("/admin/jobs", result.reason ?? "Couldn't reassign that job.");
  }
  redirect(`/admin/jobs?offered=${result.offered}`);
}

export async function rebroadcastJobAction(data: FormData) {
  await requireAdmin("/admin/jobs");
  const jobId = Number(field(data, "id", 12));

  // In solo mode this button puts the job in the owner's own diary rather than
  // back out to a pool, so it is an admin allocation and gets the same check.
  if (IS_SOLO) {
    const owner = await getOwnerOperative();
    if (owner) await refuseIfOperativeIsOff("/admin/jobs", jobId, owner.id);
  }

  const offered = await rebroadcastJob(jobId);
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs?offered=${offered}`);
}

// -------------------------------------------------------------- invoicing --

export async function generateInvoicesAction(data: FormData) {
  await requireAdmin("/admin/invoices");

  const periodStart = field(data, "periodStart", 10);
  const periodEnd = field(data, "periodEnd", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)
  ) {
    fail("/admin/invoices", "Pick a valid start and end date for the period.");
  }

  const created = await generateCommissionInvoices(periodStart, periodEnd);
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?created=${created.length}`);
}

export async function setInvoiceStatusAction(data: FormData) {
  await requireAdmin("/admin/invoices");
  const status = field(data, "status", 10) === "paid" ? "paid" : "issued";
  await setInvoiceStatus(Number(field(data, "id", 12)), status);
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices?saved=1");
}


// ------------------------------------------------ editing operatives ------

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Change an operative's details on their behalf — the "I've got a new mobile"
 * phone call, or the owner's own record on a solo site. The mobile matters
 * most: it's where job texts go, so a stale number silently costs work.
 */
export async function updateCleanerAction(data: FormData) {
  await requireAdmin("/admin/cleaners");
  const id = Number(field(data, "id", 12));

  const name = field(data, "name", 80);
  const email = field(data, "email", 120);
  const phone = field(data, "phone", 30);

  if (name.length < 2) fail("/admin/cleaners", `The ${V.one} needs a name.`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("/admin/cleaners", "That email address doesn't look right.");
  }
  if (phone.replace(/\D/g, "").length < 10) {
    fail("/admin/cleaners", "That phone number doesn't look right.");
  }

  const expiry = field(data, "insuranceExpiry", 10);
  const result = await updateCleanerProfile(id, {
    name,
    businessName: field(data, "businessName", 120),
    email,
    phone,
    insuranceProvider: field(data, "insuranceProvider", 120),
    insuranceExpiry: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null,
    yearsExperience: Math.max(0, Math.min(60, Number(field(data, "yearsExperience", 3)) || 0)),
    equipment: field(data, "equipment", 500),
  });
  if (!result.ok) fail("/admin/cleaners", result.reason ?? "Couldn't save that.");

  revalidatePath("/admin/cleaners");
  redirect("/admin/cleaners?saved=1");
}

/** Change where and when an operative works, on their behalf. */
export async function updateCleanerCoverageAction(data: FormData) {
  await requireAdmin("/admin/cleaners");
  const id = Number(field(data, "id", 12));

  const { codes, invalid } = parseOutwardList(field(data, "coverage", 4000));
  // Blank means "everywhere" for a solo operator and is how they undo a patch
  // they've since outgrown. For a contractor it would mean being offered
  // nothing, which is a mistake rather than a choice, so it stays refused.
  if (codes.length === 0 && !IS_SOLO) {
    fail("/admin/cleaners", "List at least one postcode area.");
  }
  if (invalid.length) {
    fail(
      "/admin/cleaners",
      `These don't look like UK postcode areas: ${invalid.slice(0, 5).join(", ")}`
    );
  }

  const availability = WEEKDAYS.map((weekday) => ({
    weekday,
    am: data.get(`day-${weekday}-am`) === "on",
    pm: data.get(`day-${weekday}-pm`) === "on",
  }));
  if (!availability.some((a) => a.am || a.pm)) {
    fail("/admin/cleaners", "Tick at least one half-day.");
  }

  const serviceCodes = (await getServices())
    .filter((service) => data.get(`service-${service.code}`) === "on")
    .map((service) => service.code);
  if (serviceCodes.length === 0) {
    fail(
      "/admin/cleaners",
      IS_SOLO
        ? "Tick at least one service you offer."
        : `Tick at least one service this ${V.one} offers.`
    );
  }

  await setCleanerServices(id, serviceCodes);
  await setCleanerAreas(id, codes);
  await setAvailability(id, availability);
  await activateProvisionalJobs(id);
  revalidatePath("/admin/cleaners");
  redirect("/admin/cleaners?saved=1");
}

/**
 * Issue a one-time password reset link. With no mail provider configured the
 * link is shown in the admin page to copy and text over; it's also written to
 * the notification log so it's delivered if email is switched on later.
 */
export async function issueResetLinkAction(data: FormData) {
  await requireAdmin("/admin/cleaners");
  const id = Number(field(data, "id", 12));

  const hash = await getCleanerPasswordHash(id);
  const cleaner = await getCleaner(id);
  if (!hash || !cleaner) fail("/admin/cleaners", `${V.One} not found.`);

  const token = makeResetToken(id, hash);
  const base = (process.env.MARKETPLACE_BASE_URL ?? siteUrl()).replace(
    /\/+$/,
    ""
  );
  const link = `${base}/pro/reset/${token}`;

  await notify({
    recipient: cleaner.email,
    subject: `Reset your ${BRAND.shortName} password`,
    body:
      `${cleaner.name}, use this link within 48 hours to set a new password:\n\n` +
      `${link}\n\n` +
      `If you didn't ask for this, ignore it — your current password still works.`,
  });

  revalidatePath("/admin/cleaners");
  redirect(`/admin/cleaners?reset=${encodeURIComponent(link)}`);
}
