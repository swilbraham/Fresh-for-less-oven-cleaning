import SiteHeader from "@/components/marketplace/SiteHeader";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyBookingToken } from "@/lib/marketplace/auth";
import {
  getBookingByRef,
  getBookingJobs,
  getCleaner,
  getOpenSlots,
  getSettings,
} from "@/lib/marketplace/repo";
import { gbp } from "@/lib/marketplace/money";
import { firstName } from "@/lib/marketplace/names";
import { Alert, Card, StatusPill } from "@/components/marketplace/shell";
import SlotPicker from "@/components/marketplace/SlotPicker";
import type { Job } from "@/lib/marketplace/types";
import { cancelBookingAction, rescheduleBookingAction } from "../actions";
import { CONTACT, IS_SOLO, V } from "@/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage your booking",
  robots: { index: false, follow: false },
};

const BOOKING_WINDOW_DAYS = 27;

function longDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const WINDOW_LABEL = {
  am: "Morning 8am–12pm",
  pm: "Afternoon 12pm–5pm",
} as const;

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{
    t?: string;
    error?: string;
    moved?: string;
    cancelled?: string;
  }>;
}) {
  const { ref } = await params;
  const { t, error, moved, cancelled } = await searchParams;
  const reference = ref.toUpperCase();

  // The link is the credential — a wrong or missing token reveals nothing,
  // not even whether the reference exists.
  if (!t || !verifyBookingToken(reference, t)) notFound();

  const booking = await getBookingByRef(reference);
  if (!booking) notFound();

  const [jobs, settings] = await Promise.all([
    getBookingJobs(booking.id),
    getSettings(),
  ]);
  if (jobs.length === 0) notFound();

  const live = jobs.filter(
    (job) => job.status !== "completed" && job.status !== "cancelled"
  );

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-slate-50 pt-10 pb-20">
        <div className="mx-auto max-w-2xl px-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            Booking {booking.ref}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {jobs.length > 1
              ? `Your ${jobs.length} visits`
              : "Manage your booking"}
          </h1>
          <p className="mt-2 text-slate-600">
            {booking.address_line}
            {booking.town ? `, ${booking.town}` : ""}, {booking.postcode}
            {jobs.length > 1 && (
              <>
                {" "}
                · Each service is done by its own specialist, so you can move or
                cancel them separately.
              </>
            )}
          </p>

          <div className="mt-6">
            {error && <Alert>{error}</Alert>}
            {moved === "kept" && (
              <Alert tone="success">
                Moved. Your {V.one} was free at the new time, so you&apos;ve
                still got the same person.
              </Alert>
            )}
            {moved === "unassigned" && (
              <Alert tone="success">
                Moved. We&apos;re still matching you with a {V.one} and will
                confirm as soon as that visit is claimed.
              </Alert>
            )}
            {moved === "rebroadcast" && (
              <Alert tone="info">
                Moved. Your previous {V.one} wasn&apos;t free then, so we&apos;ve
                sent that visit back out — we&apos;ll confirm your new {V.one}
                shortly.
              </Alert>
            )}
            {cancelled && (
              <Alert tone="success">
                That visit is cancelled. There&apos;s nothing to pay for it.
              </Alert>
            )}
          </div>

          {jobs.map((job) => (
            <VisitCard
              key={job.id}
              job={job}
              bookingRef={booking.ref}
              token={t}
              minNoticeDays={settings.min_notice_days}
              cancellationNoticeHours={settings.cancellation_notice_hours}
            />
          ))}

          {jobs.length > 1 && (
            <Card className="mt-6">
              <div className="flex items-baseline justify-between">
                <p className="font-bold text-slate-900">Booking total</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {gbp(
                    jobs
                      .filter((job) => job.status !== "cancelled")
                      .reduce((sum, job) => sum + job.total_pence, 0)
                  )}
                </p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {IS_SOLO
                  ? "Paid on the day each visit is done."
                  : `Paid to each ${V.one} on the day they do their part.`}
              </p>
            </Card>
          )}

          {live.length === 0 && (
            <Card className="mt-6">
              <p className="text-slate-600">
                Nothing is outstanding on this booking.{" "}
                <Link
                  href="/book"
                  className="font-semibold text-primary-600 underline"
                >
                  Book something else
                </Link>
                .
              </p>
            </Card>
          )}

          <p className="mt-8 text-center text-sm text-slate-500">
            Need a hand? Call{" "}
            <a
              href={`tel:${CONTACT.phoneHref}`}
              className="font-semibold underline"
            >
              {CONTACT.phone}
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

/** One visit: its own state, its own reschedule and its own cancellation. */
async function VisitCard({
  job,
  bookingRef,
  token,
  minNoticeDays,
  cancellationNoticeHours,
}: {
  job: Job;
  bookingRef: string;
  token: string;
  minNoticeDays: number;
  cancellationNoticeHours: number;
}) {
  const isOver = job.status === "completed" || job.status === "cancelled";
  const isLate = Number(job.hours_until_slot) < cancellationNoticeHours;
  const cleaner = job.cleaner_id ? await getCleaner(job.cleaner_id) : null;

  // The minimum charge can lift the total above the sum of the lines; show it
  // rather than leaving the customer to wonder why the figures don't add up.
  const itemsTotal = job.items.reduce((sum, line) => sum + line.amount_pence, 0);
  const minimumTopUp = Math.max(0, job.total_pence - itemsTotal);

  const slots = isOver
    ? []
    : (
        await getOpenSlots(
          job.outward,
          job.service_code,
          minNoticeDays,
          minNoticeDays + BOOKING_WINDOW_DAYS,
          job.id
        )
      ).filter((s) => s.am || s.pm);

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            {job.service_label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {longDate(job.slot_date)}
          </p>
          <p className="text-slate-600">{WINDOW_LABEL[job.slot_window]}</p>
        </div>
        <StatusPill status={job.status} />
      </div>

      <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-sm">
        <Row label="Reference" value={job.ref} />
        <Row
          label="Price"
          value={
            job.status === "cancelled"
              ? `${gbp(job.total_pence)} — nothing to pay, this visit was cancelled`
              : job.status === "completed"
                ? `${gbp(job.total_pence)} — paid on the day`
                : `${gbp(job.total_pence)} — pay on the day`
          }
        />
        <Row
          label={`Your ${V.one}`}
          value={
            cleaner
              ? `${firstName(cleaner.name)} · ${cleaner.phone}`
              : job.status === "cancelled"
                ? "—"
                : "Being matched — we'll confirm shortly"
          }
        />
      </dl>

      <ul className="mt-4 space-y-1 text-sm text-slate-700">
        {job.items.map((line) => (
          <li key={line.code} className="flex justify-between">
            <span>
              {line.qty} × {line.label}
            </span>
            <span className="font-semibold tabular-nums">
              {gbp(line.amount_pence)}
            </span>
          </li>
        ))}
        {minimumTopUp > 0 && (
          <li className="flex justify-between text-slate-500">
            <span>Minimum charge applied</span>
            <span className="tabular-nums">+{gbp(minimumTopUp)}</span>
          </li>
        )}
      </ul>

      {isOver ? (
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
          {job.status === "completed"
            ? "This visit has been completed — thanks for booking with us."
            : "This visit was cancelled."}
        </p>
      ) : (
        <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
          {/* Reschedule */}
          <div>
            <h3 className="font-bold text-slate-900">Move to another day</h3>
            <p className="mt-1 text-sm text-slate-500">
              Only times with someone free for {job.service_label.toLowerCase()}{" "}
              in your area are shown.
              {IS_SOLO
                ? ""
                : ` We keep your current ${V.one} whenever they can make the new slot.`}
            </p>
            {slots.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No alternative slots are free in {job.outward} at the moment.
                Please call {CONTACT.phone} and we&apos;ll sort it.
              </p>
            ) : (
              <form action={rescheduleBookingAction} className="mt-4">
                <input type="hidden" name="ref" value={bookingRef} />
                <input type="hidden" name="job" value={job.ref} />
                <input type="hidden" name="token" value={token} />

                <SlotPicker slots={slots} />

                <button
                  type="submit"
                  className="mt-5 w-full rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                >
                  Move this visit
                </button>
              </form>
            )}
          </div>

          {/* Cancel */}
          <div>
            <h3 className="font-bold text-slate-900">Cancel this visit</h3>
            <p className="mt-1 text-sm text-slate-500">
              There&apos;s nothing to pay — you haven&apos;t been charged. Your
              other visits are unaffected.
            </p>
            {isLate && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This one is in under {cancellationNoticeHours} hours. You can
                still cancel, but your {V.one} has set the time aside — please
                let us know as early as you can.
              </p>
            )}
            <form action={cancelBookingAction} className="mt-4">
              <input type="hidden" name="ref" value={bookingRef} />
              <input type="hidden" name="job" value={job.ref} />
              <input type="hidden" name="token" value={token} />
              <label
                htmlFor={`reason-${job.ref}`}
                className="block text-sm font-semibold text-slate-700"
              >
                Reason (optional)
              </label>
              <input
                id={`reason-${job.ref}`}
                name="reason"
                placeholder="Change of plan, no longer needed…"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                className="mt-4 w-full rounded-xl border border-red-300 px-6 py-3 font-semibold text-red-700 transition hover:bg-red-50"
              >
                Cancel this visit
              </button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}
