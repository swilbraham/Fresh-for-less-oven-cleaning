import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/marketplace/auth";
import {
  cleanerReliability,
  DROP_REVIEW_DAYS,
  DROP_REVIEW_LIMIT,
  getAvailability,
  getCleanerAreas,
  getServices,
  listCleaners,
  servicesForCleaners,
} from "@/lib/marketplace/repo";
import {
  issueResetLinkAction,
  setCleanerStatusAction,
  updateCleanerAction,
  updateCleanerCoverageAction,
} from "../actions";
import {
  AdminNav,
  Alert,
  AvailabilityGrid,
  Card,
  Field,
  ServicePicker,
  StatusPill,
} from "@/components/marketplace/shell";
import { IS_SOLO, V } from "@/config";

export const dynamic = "force-dynamic";

export const metadata = {
  // On a solo site this screen is the owner's own diary rather than a list of
  // people, so it is named for what it does instead of who it holds.
  title: IS_SOLO ? "Diary & coverage" : V.Many,
  robots: { index: false, follow: false },
};

export default async function AdminCleanersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; reset?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const { error, saved, reset } = await searchParams;

  const cleaners = await listCleaners();
  const services = await getServices();
  const servicesByCleaner = await servicesForCleaners(cleaners.map((c) => c.id));
  const serviceLabel = new Map(services.map((s) => [s.code, s.label]));
  const areasByCleaner = new Map(
    await Promise.all(
      cleaners.map(
        async (cleaner) =>
          [cleaner.id, await getCleanerAreas(cleaner.id)] as const
      )
    )
  );
  const reliabilityByCleaner = new Map(
    await Promise.all(
      cleaners.map(
        async (cleaner) =>
          [cleaner.id, await cleanerReliability(cleaner.id)] as const
      )
    )
  );
  const availabilityByCleaner = new Map(
    await Promise.all(
      cleaners.map(
        async (cleaner) =>
          [cleaner.id, await getAvailability(cleaner.id)] as const
      )
    )
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />

      <div className="mx-auto max-w-5xl px-4 py-8">
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">{IS_SOLO ? "Saved." : `${V.One} updated.`}</Alert>}
        {reset && (
          <Alert tone="info">
            <strong>One-time reset link — text this to them.</strong> It works
            once and expires in 48 hours.
            <span className="mt-2 block break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">
              {reset}
            </span>
          </Alert>
        )}

        <h1 className="mb-6 text-2xl font-bold text-slate-900">
          {IS_SOLO
            ? "Your diary & coverage"
            : `${V.Many} (${cleaners.length})`}
        </h1>

        {cleaners.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">
              {IS_SOLO ? (
                <>
                  Nothing here yet. Your own record is created the first time
                  the site talks to its database — load the booking page once
                  and come back.
                </>
              ) : (
                <>
                  No applications yet. {V.Many} apply at{" "}
                  <code>/pro/register</code>.
                </>
              )}
            </p>
          </Card>
        )}

        <ul className="space-y-4">
          {cleaners.map((cleaner) => {
            const areas = areasByCleaner.get(cleaner.id) ?? [];
            const record = reliabilityByCleaner.get(cleaner.id);
            const underReview =
              (record?.recent_late_drops ?? 0) >= DROP_REVIEW_LIMIT;
            const insuranceExpired =
              cleaner.insurance_expiry !== null &&
              cleaner.insurance_expiry < new Date().toISOString().slice(0, 10);

            return (
              <li
                key={cleaner.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {cleaner.business_name || cleaner.name}
                      </h2>
                      {!IS_SOLO && <StatusPill status={cleaner.status} />}
                      {underReview && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          Review — {record?.recent_late_drops} late drops
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {cleaner.name} · {cleaner.email} · {cleaner.phone}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      <Link
                        href={`/admin/jobs?q=${encodeURIComponent(cleaner.name)}`}
                        className="font-semibold text-primary-600 underline"
                      >
                        {IS_SOLO ? "View jobs" : "View their jobs"}
                      </Link>{" "}
                      {!IS_SOLO && <>· Applied {cleaner.created_at} </>}·{" "}
                      {cleaner.jobs_done} job
                      {cleaner.jobs_done === 1 ? "" : "s"} completed
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Insurance
                    </dt>
                    <dd
                      className={
                        insuranceExpired
                          ? "font-semibold text-red-600"
                          : "text-slate-700"
                      }
                    >
                      {cleaner.insurance_provider || "Not supplied"}
                      {cleaner.insurance_expiry
                        ? ` · expires ${cleaner.insurance_expiry}`
                        : ""}
                      {insuranceExpired ? " · EXPIRED" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Experience
                    </dt>
                    <dd className="text-slate-700">
                      {cleaner.years_experience} year
                      {cleaner.years_experience === 1 ? "" : "s"}
                      {cleaner.equipment ? ` · ${cleaner.equipment}` : ""}
                    </dd>
                  </div>
                  {!IS_SOLO && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reliability
                      </dt>
                      <dd
                        className={
                          underReview ? "font-semibold text-red-600" : "text-slate-700"
                        }
                      >
                        {record?.completed ?? 0} completed ·{" "}
                        {record?.drops ?? 0} handed back
                        {(record?.late_drops ?? 0) > 0 &&
                          `, ${record?.late_drops} inside 24h`}
                        {underReview &&
                          ` — ${record?.recent_late_drops} in the last ${DROP_REVIEW_DAYS} days`}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Services
                    </dt>
                    <dd className="text-slate-700">
                      {(servicesByCleaner[cleaner.id] ?? []).length
                        ? (servicesByCleaner[cleaner.id] ?? [])
                            .map((code) => serviceLabel.get(code) ?? code)
                            .join(", ")
                        : IS_SOLO
                          ? "No services set — nothing can be booked"
                          : `No services set — this ${V.one} is offered nothing`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Covers ({areas.length})
                    </dt>
                    <dd className="text-slate-700">
                      {areas.length
                        ? areas.join(", ")
                        : IS_SOLO
                          ? "Everywhere — not narrowed to any postcodes"
                          : "No areas set"}
                    </dd>
                  </div>
                </dl>

                <details className="mt-4 border-t border-slate-100 pt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-primary-600">
                    {IS_SOLO
                      ? "Edit details, coverage & availability"
                      : "Edit details, coverage or password"}
                  </summary>

                  <form action={updateCleanerAction} className="mt-4 space-y-4">
                    <input type="hidden" name="id" value={cleaner.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Name" name="name" required defaultValue={cleaner.name} />
                      <Field
                        label="Trading name"
                        name="businessName"
                        defaultValue={cleaner.business_name}
                      />
                      <Field label="Email" name="email" type="email" required defaultValue={cleaner.email} />
                      <Field label="Mobile" name="phone" type="tel" required defaultValue={cleaner.phone} />
                      <Field
                        label="Insurance provider"
                        name="insuranceProvider"
                        defaultValue={cleaner.insurance_provider}
                      />
                      <Field
                        label="Policy expiry"
                        name="insuranceExpiry"
                        type="date"
                        defaultValue={cleaner.insurance_expiry ?? ""}
                      />
                      <Field
                        label="Years of experience"
                        name="yearsExperience"
                        type="number"
                        defaultValue={cleaner.years_experience}
                      />
                      <Field
                        label="Equipment"
                        name="equipment"
                        defaultValue={cleaner.equipment}
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white"
                    >
                      Save details
                    </button>
                  </form>

                  <form
                    action={updateCleanerCoverageAction}
                    className="mt-6 space-y-4 border-t border-slate-100 pt-6"
                  >
                    <input type="hidden" name="id" value={cleaner.id} />
                    <p className="block text-sm font-semibold text-slate-700">
                      Services offered
                    </p>
                    <ServicePicker
                      services={services}
                      selected={servicesByCleaner[cleaner.id] ?? []}
                    />
                    <label
                      htmlFor={`coverage-${cleaner.id}`}
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Postcode areas covered
                    </label>
                    <textarea
                      id={`coverage-${cleaner.id}`}
                      name="coverage"
                      rows={2}
                      defaultValue={areas.join(" ")}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 uppercase tracking-wide"
                    />
                    {IS_SOLO && (
                      <p className="-mt-2 text-xs text-slate-500">
                        Leave this blank to take bookings from anywhere, or list
                        outward codes — <code>CH41 CH42 L1</code> — to turn
                        everywhere else away.
                      </p>
                    )}
                    <AvailabilityGrid
                      availability={availabilityByCleaner.get(cleaner.id) ?? []}
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white"
                    >
                      Save services, coverage &amp; availability
                    </button>
                  </form>

                  {!IS_SOLO && (
                    <form
                      action={issueResetLinkAction}
                      className="mt-6 border-t border-slate-100 pt-6"
                    >
                      <input type="hidden" name="id" value={cleaner.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Issue password reset link
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        Generates a one-time link to text them. Their current
                        password keeps working until they use it.
                      </p>
                    </form>
                  )}
                </details>

                {!IS_SOLO && (
                  <form
                    action={setCleanerStatusAction}
                    className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5"
                  >
                    <input type="hidden" name="id" value={cleaner.id} />
                    <div className="min-w-[240px] flex-1">
                      <label
                        htmlFor={`notes-${cleaner.id}`}
                        className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Vetting notes
                      </label>
                      <input
                        id={`notes-${cleaner.id}`}
                        name="adminNotes"
                        defaultValue={cleaner.admin_notes}
                        placeholder="Certificate seen, references checked…"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <select
                      name="status"
                      defaultValue={cleaner.status}
                      aria-label={`Status for ${cleaner.name}`}
                      className="rounded-xl border border-slate-300 px-3 py-2.5"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="suspended">Suspended</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white"
                    >
                      Save
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
