import SiteHeader from "@/components/marketplace/SiteHeader";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingByRef, getBookingJobs } from "@/lib/marketplace/repo";
import { bookingToken } from "@/lib/marketplace/auth";
import TrackBooking from "@/components/marketplace/TrackBooking";
import { gbp } from "@/lib/marketplace/money";
import { CONTACT, IS_SOLO, V } from "@/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

const WINDOW_LABEL = {
  am: "Morning 8am–12pm",
  pm: "Afternoon 12pm–5pm",
} as const;

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref.toUpperCase());
  if (!booking) notFound();

  const jobs = await getBookingJobs(booking.id);
  if (jobs.length === 0) notFound();

  const anyProvisional = jobs.some((job) => job.status === "provisional");

  return (
    <>
      <SiteHeader />
      <TrackBooking
        valuePence={booking.total_pence}
        provisional={anyProvisional}
        reference={booking.ref}
      />
      <main className="min-h-screen bg-slate-50 pt-10 pb-20">
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-2xl border border-accent-200 bg-white p-8 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-3xl">
              ✓
            </div>
            <h1 className="mt-5 text-3xl font-bold text-slate-900">
              You&apos;re booked in
            </h1>
            <p className="mt-2 text-slate-600">
              Reference <strong className="text-slate-900">{booking.ref}</strong>
              . We emailed a copy to {booking.customer_email}.
            </p>

            <dl className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
              <Row
                label="Address"
                value={`${booking.address_line}${booking.town ? `, ${booking.town}` : ""}, ${booking.postcode}`}
              />
              <Row
                label={jobs.length > 1 ? "Visits booked" : "Visit booked"}
                value={`${jobs.length} — ${jobs.map((j) => j.service_label).join(", ")}`}
              />
              <Row
                label="Total"
                value={
                  IS_SOLO
                    ? `${gbp(booking.total_pence)} — paid on the day`
                    : `${gbp(booking.total_pence)} — paid to each ${V.one} on the day`
                }
              />
            </dl>

            {jobs.map((job) => {
              const itemsTotal = job.items.reduce(
                (sum, line) => sum + line.amount_pence,
                0
              );
              const minimumTopUp = Math.max(0, job.total_pence - itemsTotal);
              const date = new Date(
                `${job.slot_date}T12:00:00`
              ).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });

              return (
                <section
                  key={job.id}
                  className="mt-8 rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-bold text-slate-900">
                      {job.service_label}
                    </h2>
                    <p className="text-sm text-slate-500">{job.ref}</p>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {date} · {WINDOW_LABEL[job.slot_window]}
                  </p>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    {job.status === "accepted" ? (
                      <p>
                        <strong className="text-slate-900">
                          {IS_SOLO ? "Booked in." : `${V.One} confirmed.`}
                        </strong>{" "}
                        {IS_SOLO ? (
                          <>
                            We&apos;ve got you in the diary. Call{" "}
                            {CONTACT.phone} if anything changes.
                          </>
                        ) : (
                          <>You&apos;ll get their name and number by email shortly.</>
                        )}
                      </p>
                    ) : job.status === "provisional" ? (
                      <p>
                        <strong className="text-slate-900">
                          Awaiting confirmation.
                        </strong>{" "}
                        {IS_SOLO ? (
                          <>
                            We don&apos;t cover {job.outward} for{" "}
                            {job.service_label.toLowerCase()} yet, so this part
                            is a request.
                          </>
                        ) : (
                          <>
                            Nobody covers {job.service_label.toLowerCase()} in{" "}
                            {job.outward} yet, so this part is a request.
                          </>
                        )}{" "}
                        We&apos;ll confirm within 24 hours or call you on{" "}
                        {booking.customer_phone}. Nothing to pay either way.
                      </p>
                    ) : job.status === "unfilled" ? (
                      <p>
                        <strong className="text-slate-900">
                          {IS_SOLO
                            ? "We need to sort a time with you."
                            : `We're finding you a ${V.one}.`}
                        </strong>{" "}
                        Nobody was free for that exact slot, so we&apos;ll call
                        you on {booking.customer_phone} to sort an alternative.
                      </p>
                    ) : (
                      <p>
                        <strong className="text-slate-900">
                          We&apos;re confirming your {V.one}.
                        </strong>{" "}
                        Our vetted specialists covering {job.outward} have been
                        notified. We&apos;ll email you their name and number as
                        soon as this job is claimed.
                      </p>
                    )}
                  </div>

                  <ul className="mt-4 space-y-1 text-sm text-slate-700">
                    {job.items.map((line) => (
                      <li key={line.code} className="flex justify-between">
                        <span>
                          {line.qty} × {line.label}
                          {line.note && (
                            <span className="ml-1 text-accent-700">
                              ({line.note})
                            </span>
                          )}
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
                    <li className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
                      <span>This visit</span>
                      <span className="tabular-nums">
                        {gbp(job.total_pence)}
                      </span>
                    </li>
                  </ul>
                </section>
              );
            })}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/booking/${booking.ref}?t=${bookingToken(booking.ref)}`}
                className="rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
              >
                Change or cancel this booking
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Back to the site
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              We&apos;ve texted and emailed you this link so you can find it
              later.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}
