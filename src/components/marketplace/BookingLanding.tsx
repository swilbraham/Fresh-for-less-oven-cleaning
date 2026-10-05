import Link from "next/link";
import { gbpShort } from "@/lib/marketplace/money";
import type { PriceBundle, PriceItem, Service } from "@/lib/marketplace/types";
import { CONTACT, IS_NETWORK, V } from "@/config";

/**
 * Marketing content beneath the postcode check on /book.
 *
 * Shown only before the customer starts their quote — once they're picking
 * rooms, this would just be in the way. Services and prices come from the live
 * list so the page can never advertise a figure, or a trade, the booking engine
 * won't honour.
 */
export default function BookingLanding({
  services,
  items,
  bundles,
}: {
  services: Service[];
  items: PriceItem[];
  bundles: PriceBundle[];
}) {
  const steps = [
    {
      title: "Tell us your postcode",
      body: "We check who covers your street, service by service, and when they're free.",
    },
    {
      title: "Pick what needs doing",
      body: "Ovens, hobs, extractors, ranges and Agas — your fixed price updates as you go. No survey, no home visit.",
    },
    {
      title: "Choose your slots and book",
      body: "Nothing to pay now. Each specialist is confirmed and you pay them on the day they come.",
    },
  ];

  const reasons = [
    {
      title: "The price is the price",
      body: "What you see is what you pay. No add-ons on the doorstep, no pressure selling.",
    },
    {
      title: "Vetted, insured specialists",
      body: "Every cleaner is checked for public liability insurance and experience in their trade before they take a single job.",
    },
    {
      title: "Nothing upfront",
      body: "No deposit and no card details. You pay each cleaner directly once the work is done.",
    },
    {
      title: "Change it any time",
      body: "Move or cancel any part of your booking yourself from the link we text you.",
    },
  ];

  const cheapestMinimum = services.length
    ? Math.min(...services.map((s) => s.minimum_charge_pence))
    : 0;

  const faqs = [
    {
      q: "Do you cover my area?",
      a: "We're building coverage across the UK, trade by trade. Pop your postcode in above — if nobody covers you yet, leave your details and we'll arrange it directly.",
    },
    {
      q: "Can I book more than one service at once?",
      a: "Yes. Add as many as you like to one basket. Each one is done by its own specialist, so each gets its own visit and its own time slot — pick the same day for all of them if that suits.",
    },
    {
      q: "Why don't you need to visit first?",
      a: "Everything here is priced per room, per oven, per hour or per property type, so counting what you need is enough. That's how we can fix the price before you book.",
    },
    {
      q: "How do I pay?",
      a: `Directly to each cleaner on the day, by cash or card. Nothing is taken when you book, and every service has its own minimum — from ${gbpShort(cheapestMinimum)}.`,
    },
    {
      q: "What if I need to rearrange?",
      a: "Use the link in your confirmation text to move or cancel any visit. If your cleaner can't make the new time, we find you another one.",
    },
  ];

  return (
    <div className="mt-16 space-y-16">
      {/* How it works */}
      <section>
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Booked in about a minute
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 font-bold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* What we do — only worth a section when there is more than one trade.
          On a single-trade site it is one card under a heading counting four
          services that do not exist, and the price list below says it better. */}
      {services.length > 1 && (
        <section>
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            {services.length} trades, one booking
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.code}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="font-bold text-slate-900">{service.label}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {service.blurb || service.hint}
                </p>
                <p className="mt-3 text-sm font-semibold text-primary-700">
                  From {gbpShort(service.minimum_charge_pence)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prices */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl sm:text-center">
          What it costs
        </h2>
        <p className="mt-2 text-slate-600 sm:text-center">
          The same prices everywhere in the country — no postcode premiums.
        </p>

        {bundles.length > 0 && (
          <ul className="mt-6 flex flex-wrap justify-center gap-3">
            {bundles.map((bundle) => (
              <li
                key={bundle.id}
                className="rounded-xl border border-accent-300 bg-accent-50 px-4 py-2 text-sm font-bold text-accent-800"
              >
                {bundle.label}
              </li>
            ))}
          </ul>
        )}

        <div
          className={`mt-6 grid gap-8 ${
            services.length > 1 ? "sm:grid-cols-2" : "mx-auto max-w-lg"
          }`}
        >
          {services.map((service) => {
            const list = items.filter((i) => i.service_code === service.code);
            if (list.length === 0) return null;
            return (
              <div key={service.code}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {service.label}
                </h3>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {list.map((item) => (
                    <li key={item.code} className="flex justify-between gap-4 py-2">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {gbpShort(item.unit_price_pence)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  {gbpShort(service.minimum_charge_pence)} minimum
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-sm text-slate-500 sm:text-center">
          Offers apply automatically whenever they beat the itemised price.
        </p>
      </section>

      {/* Why */}
      <section>
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Why book online
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {reasons.map((reason) => (
            <div key={reason.title} className="flex gap-3">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-700">
                ✓
              </span>
              <div>
                <h3 className="font-bold text-slate-900">{reason.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{reason.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Questions people ask
        </h2>
        <dl className="mx-auto mt-8 max-w-2xl divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((faq) => (
            <div key={faq.q} className="py-5">
              <dt className="font-bold text-slate-900">{faq.q}</dt>
              <dd className="mt-1 text-sm text-slate-600">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Closing CTA */}
      <section className="rounded-2xl bg-slate-900 px-6 py-10 text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Ready to get the whole place done?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-300">
          Enter your postcode at the top of this page for your fixed price, or
          talk to us if you&apos;d rather book over the phone.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`tel:${CONTACT.phoneHref}`}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Call {CONTACT.phone}
          </a>
          {IS_NETWORK && (
            <Link
              href="/pro"
              className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Are you a {V.one}?
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
