"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  buildQuote,
  type Basket,
  type ProtectionChoice,
} from "@/lib/marketplace/pricing";
import { gbp, gbpShort } from "@/lib/marketplace/money";
import type { PriceBundle, PriceItem, Service } from "@/lib/marketplace/types";
import { CONTACT, V } from "@/config";

type Slot = { day: string; am: boolean; pm: boolean };
type ServiceAvailability = {
  covered: boolean;
  provisional: boolean;
  slots: Slot[];
};
type Coverage = {
  outward: string;
  services: Record<string, ServiceAvailability>;
};
type ChosenSlot = { date: string; window: "am" | "pm" };
type Step = "postcode" | "services" | "items" | "slot" | "details";

function longDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * The customer-facing booking flow for a multi-service marketplace.
 *
 * One basket can span every trade, but each trade is booked, allocated and paid
 * for on its own — so the flow asks for a slot per service and the confirmation
 * describes a booking made of several visits rather than one job. Prices are
 * computed here with the same engine the server uses, and recomputed server-side
 * at submission; the figure on screen is display only.
 */
export default function BookingFlow({
  services,
  items,
  bundles,
  commissionPct,
  landing,
}: {
  services: Service[];
  items: PriceItem[];
  bundles: PriceBundle[];
  commissionPct: number;
  /** Marketing content, shown only before the customer starts the quote. */
  landing?: ReactNode;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("postcode");
  const [postcode, setPostcode] = useState("");
  const [checking, setChecking] = useState(false);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [chosenServices, setChosenServices] = useState<string[]>([]);
  const [basket, setBasket] = useState<Basket>({});
  const [slots, setSlots] = useState<Record<string, ChosenSlot>>({});
  const [protection, setProtection] = useState<ProtectionChoice>({});
  const [details, setDetails] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    addressLine: "",
    town: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waitlist, setWaitlist] = useState({ name: "", email: "", phone: "" });
  const [joining, setJoining] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);

  // The same pricing engine the server uses, so the figure on screen is the
  // figure that gets booked.
  const quote = useMemo(
    () => buildQuote(basket, services, items, bundles, { commissionPct, protection }),
    [basket, services, items, bundles, commissionPct, protection]
  );

  /** Services the customer picked, in display order. */
  const picked = useMemo(
    () => services.filter((s) => chosenServices.includes(s.code)),
    [services, chosenServices]
  );

  /** Services with something actually in the basket — these become jobs. */
  const booking = quote.services;

  const availabilityFor = (code: string): ServiceAvailability | undefined =>
    coverage?.services[code];

  const anyCovered = useMemo(
    () => Object.values(coverage?.services ?? {}).some((s) => s.covered),
    [coverage]
  );

  /**
   * Offers already apply automatically in the pricing engine, but a customer
   * choosing rooms can't see one coming. Telling them they're one room away
   * from a fixed price is the cheapest upsell available.
   */
  const offers = useMemo(
    () =>
      bundles
        .filter((bundle) => bundle.active !== false)
        .map((bundle) => {
          const item = items.find((i) => i.code === bundle.item_code);
          const have = Math.floor(Number(basket[bundle.item_code] ?? 0));
          return {
            id: bundle.id,
            serviceCode: item?.service_code ?? "",
            label: bundle.label,
            unit: item?.label ?? bundle.item_code,
            needed: Math.max(0, bundle.qty - have),
            applied: have >= bundle.qty,
            qty: bundle.qty,
          };
        })
        .filter((offer) => chosenServices.includes(offer.serviceCode))
        .sort((a, b) => a.needed - b.needed),
    [bundles, items, basket, chosenServices]
  );

  async function checkPostcode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setChecking(true);
    try {
      const response = await fetch(
        `/api/marketplace/slots?postcode=${encodeURIComponent(postcode)}`
      );
      const data = await response.json();
      if (!data.ok) {
        setError(data.error ?? "We couldn't check that postcode.");
        return;
      }
      setCoverage({ outward: data.outward, services: data.services });
      setWaitlisted(false);
      setStep("services");
    } catch {
      setError("We couldn't check that postcode. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  /** No cleaner here yet — keep the lead rather than losing the customer. */
  async function joinWaitlist() {
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(waitlist.email)) {
      setError("Please enter a valid email so we can get back to you.");
      return;
    }
    setJoining(true);
    try {
      const response = await fetch("/api/marketplace/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...waitlist,
          postcode,
          serviceCode: chosenServices.length === 1 ? chosenServices[0] : "",
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error ?? "We couldn't save your details.");
        return;
      }
      setWaitlisted(true);
    } catch {
      setError(
        `We couldn't save your details. Please call ${CONTACT.phone}.`
      );
    } finally {
      setJoining(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/marketplace/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...details,
          postcode,
          basket,
          slots,
          protection,
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error ?? "We couldn't take that booking.");
        return;
      }
      router.push(`/book/confirmed/${data.ref}`);
    } catch {
      setError("We couldn't take that booking. Please try again.");
      setSubmitting(false);
    }
  }

  /**
   * Nudge a quantity up or down.
   *
   * Deliberately a delta applied inside the updater rather than a value
   * computed from the rendered `qty`: someone jabbing "+" three times faster
   * than React re-renders would otherwise send 0+1 three times and end up with
   * one room instead of three.
   */
  function bump(code: string, delta: number, maxQty: number) {
    setBasket((current) => {
      const next = { ...current };
      const wanted = Math.min(Math.max(0, (current[code] ?? 0) + delta), maxQty);
      if (wanted <= 0) delete next[code];
      else next[code] = wanted;
      return next;
    });
  }

  function toggleService(code: string) {
    setChosenServices((current) => {
      if (current.includes(code)) {
        // Dropping a service has to drop everything hanging off it, or the
        // customer pays for a trade they can no longer see on the form.
        setBasket((basketNow) => {
          const next = { ...basketNow };
          for (const item of items) {
            if (item.service_code === code) delete next[item.code];
          }
          return next;
        });
        setSlots(({ [code]: _removed, ...rest }) => rest);
        setProtection(({ [code]: _off, ...rest }) => rest);
        return current.filter((c) => c !== code);
      }
      return [...current, code];
    });
  }

  function chooseSlot(serviceCode: string, day: string, available: Slot) {
    setSlots((current) => ({
      ...current,
      [serviceCode]: { date: day, window: available.am ? "am" : "pm" },
    }));
  }

  function chooseWindow(serviceCode: string, window: "am" | "pm") {
    setSlots((current) => {
      const existing = current[serviceCode];
      if (!existing) return current;
      return { ...current, [serviceCode]: { ...existing, window } };
    });
  }

  /** Every service in the basket needs a slot before we can take the booking. */
  const slotsComplete = booking.every((s) => Boolean(slots[s.service_code]?.date));

  /** Booked services nobody covers yet — the customer is told, not blocked. */
  const provisionalNames = booking
    .filter((s) => !availabilityFor(s.service_code)?.covered)
    .map((s) => s.service_label);

  const steps: { key: Step; label: string }[] = [
    { key: "postcode", label: "Postcode" },
    { key: "services", label: "Services" },
    { key: "items", label: "What needs doing" },
    { key: "slot", label: "Dates" },
    { key: "details", label: "Your details" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-40">
      {/* Progress */}
      <ol
        className={`mb-8 flex-wrap gap-x-2 gap-y-1 text-sm ${
          step === "postcode" ? "hidden" : "flex"
        }`}
      >
        {steps.map((s, index) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                index < stepIndex
                  ? "bg-accent-600 text-white"
                  : index === stepIndex
                    ? "bg-primary-600 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {index < stepIndex ? "✓" : index + 1}
            </span>
            <span
              className={
                index === stepIndex
                  ? "font-semibold text-slate-900"
                  : "text-slate-500"
              }
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <span className="mx-1 text-slate-300">→</span>
            )}
          </li>
        ))}
      </ol>

      {step !== "postcode" && step !== "services" && provisionalNames.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>
            We don&apos;t have anyone for {provisionalNames.join(" or ").toLowerCase()} in{" "}
            {coverage?.outward} yet.
          </strong>{" "}
          Carry on and we&apos;ll treat {provisionalNames.length === 1 ? "it" : "those"} as
          a request — we&apos;ll confirm within 24 hours or call you to sort
          something out. Nothing to pay either way.
        </div>
      )}

      {error && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Step 1 — postcode */}
      {step === "postcode" && (
        <form onSubmit={checkPostcode} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Where are we cleaning?
          </h2>
          <p className="mt-2 text-slate-600">
            Enter your postcode and we&apos;ll show you the vetted cleaners
            covering your area, with a fixed price — no home visit, no haggling.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. CH41 5AB"
              autoComplete="postal-code"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-wide uppercase placeholder:normal-case outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
            <button
              type="submit"
              disabled={checking || postcode.trim().length < 5}
              className="rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              {checking ? "Checking…" : "Check my area"}
            </button>
          </div>
        </form>
      )}

      {/* Step 2 — which trades */}
      {step === "services" && (
        <div className="space-y-6">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              anyCovered
                ? "border-accent-200 bg-accent-50 text-accent-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {anyCovered ? (
              <>
                We cover <strong>{coverage?.outward}</strong> — pick everything
                you want doing. Each service is booked with its own specialist,
                so you can have all five if you want them.
              </>
            ) : (
              <>
                Nobody is covering <strong>{coverage?.outward}</strong> online
                just yet. You can still tell us what you need and we&apos;ll
                confirm within 24 hours.
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const chosen = chosenServices.includes(service.code);
              const covered = availabilityFor(service.code)?.covered;
              return (
                <button
                  key={service.code}
                  type="button"
                  onClick={() => toggleService(service.code)}
                  aria-pressed={chosen}
                  className={`rounded-2xl border p-5 text-left transition ${
                    chosen
                      ? "border-primary-600 bg-primary-50 ring-2 ring-primary-100"
                      : "border-slate-200 bg-white hover:border-primary-300"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-bold text-slate-900">
                      {service.label}
                    </span>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        chosen
                          ? "bg-primary-600 text-white"
                          : "border border-slate-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {service.blurb || service.hint}
                  </span>
                  <span
                    className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      covered
                        ? "bg-accent-100 text-accent-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {covered
                      ? `Available in ${coverage?.outward}`
                      : "Confirmed within 24 hours"}
                  </span>
                </button>
              );
            })}
          </div>

          {!anyCovered && !waitlisted && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                Want us to call you instead?
              </p>
              <p className="mt-1">
                Leave your details and we&apos;ll get you booked in — or call{" "}
                <a
                  href={`tel:${CONTACT.phoneHref}`}
                  className="font-semibold underline"
                >
                  {CONTACT.phone}
                </a>{" "}
                right now.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <input
                  value={waitlist.name}
                  onChange={(e) => setWaitlist({ ...waitlist, name: e.target.value })}
                  placeholder="Your name"
                  aria-label="Your name"
                  autoComplete="name"
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-primary-500"
                />
                <input
                  value={waitlist.email}
                  onChange={(e) => setWaitlist({ ...waitlist, email: e.target.value })}
                  placeholder="Email"
                  aria-label="Email"
                  type="email"
                  autoComplete="email"
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-primary-500"
                />
                <input
                  value={waitlist.phone}
                  onChange={(e) => setWaitlist({ ...waitlist, phone: e.target.value })}
                  placeholder="Phone"
                  aria-label="Phone"
                  type="tel"
                  autoComplete="tel"
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-primary-500"
                />
              </div>
              <button
                type="button"
                onClick={joinWaitlist}
                disabled={joining}
                className="mt-3 w-full rounded-xl bg-amber-600 px-6 py-2.5 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50 sm:w-auto"
              >
                {joining ? "Sending…" : "Get me booked in"}
              </button>
            </div>
          )}

          {waitlisted && (
            <div className="rounded-2xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-900">
              <p className="font-semibold">Thanks — we&apos;ve got your details.</p>
              <p className="mt-1">
                We&apos;ll be in touch to arrange your {V.job} in{" "}
                {coverage?.outward}. If it&apos;s urgent, call {CONTACT.phone}.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("postcode")}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("items")}
              disabled={chosenServices.length === 0}
              className="flex-1 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — items, one section per chosen trade */}
      {step === "items" && (
        <div className="space-y-6">
          {offers.length > 0 && (
            <ul className="space-y-2">
              {offers.map((offer) => (
                <li
                  key={offer.id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                    offer.applied
                      ? "border-accent-300 bg-accent-50 text-accent-900"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                      offer.applied
                        ? "bg-accent-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {offer.applied ? "✓" : "%"}
                  </span>
                  <span>
                    {offer.applied ? (
                      <>
                        <strong>{offer.label}</strong> applied — that&apos;s the
                        best price for {offer.qty} × {offer.unit}.
                      </>
                    ) : offer.needed === offer.qty ? (
                      <>
                        <strong>{offer.label}</strong> — add {offer.qty} ×{" "}
                        {offer.unit} and it applies automatically.
                      </>
                    ) : (
                      <>
                        Add{" "}
                        <strong>
                          {offer.needed} more × {offer.unit}
                        </strong>{" "}
                        for <strong>{offer.label}</strong>.
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {picked.map((service) => {
            const serviceItems = items.filter(
              (item) => item.service_code === service.code
            );
            const groups = new Map<string, PriceItem[]>();
            for (const item of serviceItems) {
              const list = groups.get(item.kind) ?? [];
              list.push(item);
              groups.set(item.kind, list);
            }
            const priced = quote.services.find(
              (s) => s.service_code === service.code
            );
            const protectionPct = Number(service.protection_pct ?? 0);

            return (
              <section
                key={service.code}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {service.label}
                    </h3>
                    <p className="text-sm text-slate-500">{service.hint}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-slate-900">
                    {gbp(priced?.total_pence ?? 0)}
                  </p>
                </div>

                {[...groups.entries()].map(([kind, kindItems]) => (
                  <div key={kind} className="mt-5">
                    {kind && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {kind}
                      </p>
                    )}
                    <ul className="mt-1 divide-y divide-slate-100">
                      {kindItems.map((item) => {
                        const qty = basket[item.code] ?? 0;
                        return (
                          <li
                            key={item.code}
                            className="flex items-center justify-between gap-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {item.label}
                              </p>
                              <p className="text-sm text-slate-500">
                                {gbpShort(item.unit_price_pence)} each
                                {item.hint ? ` · ${item.hint}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Remove one ${item.label}`}
                                onClick={() => bump(item.code, -1, item.max_qty)}
                                disabled={qty === 0}
                                className="h-10 w-10 rounded-lg border border-slate-300 text-lg font-bold text-slate-600 transition hover:border-primary-400 hover:text-primary-600 disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-lg font-semibold tabular-nums">
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Add one ${item.label}`}
                                onClick={() => bump(item.code, 1, item.max_qty)}
                                disabled={qty >= item.max_qty}
                                className="h-10 w-10 rounded-lg border border-slate-300 text-lg font-bold text-slate-600 transition hover:border-primary-400 hover:text-primary-600 disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                {priced?.minimum_applied && (
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                    {service.label} has a {gbpShort(service.minimum_charge_pence)}{" "}
                    minimum — add more and you get more for the same money.
                  </p>
                )}

                {protectionPct > 0 && (priced?.cleaning_pence ?? 0) > 0 && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-accent-200 bg-accent-50/50 p-4">
                    <input
                      type="checkbox"
                      checked={Boolean(protection[service.code])}
                      onChange={(e) =>
                        setProtection((current) => ({
                          ...current,
                          [service.code]: e.target.checked,
                        }))
                      }
                      className="mt-1 h-5 w-5 rounded border-slate-300 accent-accent-600"
                    />
                    <span>
                      <span className="block font-bold text-slate-900">
                        Add {service.protection_label.toLowerCase()} —{" "}
                        {gbp(
                          Math.round(
                            ((priced?.cleaning_pence ?? 0) * protectionPct) / 100
                          )
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {service.protection_hint}
                      </span>
                    </span>
                  </label>
                )}
              </section>
            );
          })}

          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <strong className="text-slate-900">
              Hard floors, curtains or something unusual?
            </strong>{" "}
            We don&apos;t price those online because the work varies too much to
            quote sight-unseen. Call{" "}
            <a
              href={`tel:${CONTACT.phoneHref}`}
              className="font-semibold text-primary-600 underline"
            >
              {CONTACT.phone}
            </a>{" "}
            and we&apos;ll give you a price — you can still book everything else
            here.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("services")}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("slot")}
              disabled={quote.total_pence === 0}
              className="flex-1 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              {booking.length > 1 ? "Choose your dates" : "Choose a date"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — a slot per trade */}
      {step === "slot" && (
        <div className="space-y-6">
          {booking.length > 1 && (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Each service is done by its own specialist, so they each get their
              own visit. Pick the same day for all of them if you like — they
              won&apos;t get in each other&apos;s way.
            </p>
          )}

          {booking.map((service) => {
            const availability = availabilityFor(service.service_code);
            const chosen = slots[service.service_code];
            const selectedSlot = availability?.slots.find(
              (s) => s.day === chosen?.date
            );

            return (
              <section
                key={service.service_code}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {service.service_label}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {availability?.covered
                    ? `Only dates with someone free in ${coverage?.outward} are shown.`
                    : `Tell us when suits and we'll try to cover ${coverage?.outward}.`}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {availability?.slots.map((slot) => (
                    <button
                      key={slot.day}
                      type="button"
                      onClick={() => chooseSlot(service.service_code, slot.day, slot)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        chosen?.date === slot.day
                          ? "border-primary-600 bg-primary-50 text-primary-800"
                          : "border-slate-200 text-slate-700 hover:border-primary-300"
                      }`}
                    >
                      {longDate(slot.day)}
                    </button>
                  ))}
                </div>

                {availability?.slots.length === 0 && (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Everyone doing {service.service_label.toLowerCase()} in{" "}
                    {coverage?.outward} is fully booked for the next few weeks.
                    Please call {CONTACT.phone}.
                  </p>
                )}

                {selectedSlot && (
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-700">
                      Arrival window
                    </p>
                    <div className="mt-2 flex gap-2">
                      {(["am", "pm"] as const).map((window) => (
                        <button
                          key={window}
                          type="button"
                          disabled={!selectedSlot[window]}
                          onClick={() => chooseWindow(service.service_code, window)}
                          className={`flex-1 rounded-xl border px-4 py-3 font-semibold transition disabled:opacity-30 ${
                            chosen?.window === window
                              ? "border-primary-600 bg-primary-50 text-primary-800"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          {window === "am" ? "Morning 8am–12pm" : "Afternoon 12pm–5pm"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("items")}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              disabled={!slotsComplete}
              className="flex-1 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — details */}
      {step === "details" && (
        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Your details</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                value={details.customerName}
                onChange={(v) => setDetails({ ...details, customerName: v })}
                autoComplete="name"
                required
              />
              <Field
                label="Phone"
                value={details.customerPhone}
                onChange={(v) => setDetails({ ...details, customerPhone: v })}
                autoComplete="tel"
                type="tel"
                required
              />
              <Field
                label="Email"
                value={details.customerEmail}
                onChange={(v) => setDetails({ ...details, customerEmail: v })}
                autoComplete="email"
                type="email"
                required
                className="sm:col-span-2"
              />
              <Field
                label="Address"
                value={details.addressLine}
                onChange={(v) => setDetails({ ...details, addressLine: v })}
                autoComplete="street-address"
                required
                className="sm:col-span-2"
              />
              <Field
                label="Town"
                value={details.town}
                onChange={(v) => setDetails({ ...details, town: v })}
                autoComplete="address-level2"
              />
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Postcode
                </label>
                <input
                  value={postcode}
                  readOnly
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 uppercase text-slate-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Anything your cleaner should know?
                </label>
                <textarea
                  value={details.notes}
                  onChange={(e) =>
                    setDetails({ ...details, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="Parking, pets, stubborn stains, access instructions…"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-lg font-bold text-slate-900">Your booking</h3>
            <div className="mt-4 space-y-5">
              {booking.map((service) => {
                const chosen = slots[service.service_code];
                return (
                  <div key={service.service_code}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-bold text-slate-900">
                        {service.service_label}
                      </p>
                      <p className="font-bold tabular-nums text-slate-900">
                        {gbp(service.total_pence)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">
                      {chosen ? longDate(chosen.date) : "—"} ·{" "}
                      {chosen?.window === "pm" ? "Afternoon" : "Morning"}
                      {availabilityFor(service.service_code)?.covered
                        ? ""
                        : " · awaiting confirmation"}
                    </p>
                    <dl className="mt-2 space-y-1 text-sm text-slate-700">
                      {service.lines.map((line) => (
                        <div key={line.code} className="flex justify-between">
                          <dt>
                            {line.qty} × {line.label}
                            {line.note && (
                              <span className="ml-1 text-accent-700">
                                ({line.note})
                              </span>
                            )}
                          </dt>
                          <dd className="tabular-nums">{gbp(line.amount_pence)}</dd>
                        </div>
                      ))}
                      {service.minimum_applied && (
                        <div className="flex justify-between text-slate-500">
                          <dt>Minimum charge applied</dt>
                          <dd className="tabular-nums">
                            {gbp(service.minimum_charge_pence)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <p className="font-bold text-slate-900">Total</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {gbp(quote.total_pence)}
              </p>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {booking.length > 1
                ? "You pay each cleaner for their own visit, on the day they do the work. Nothing to pay now."
                : "Pay your cleaner on the day — cash or card. Nothing to pay now."}
            </p>
          </section>

          <p className="text-xs text-slate-500">
            When a cleaner accepts your job we share your name, address and
            phone number with them so they can reach you and get to your home.
            Nothing else is shared, and we never sell your details. See our{" "}
            <a href="/privacy" className="underline" target="_blank" rel="noopener noreferrer">
              privacy policy
            </a>
            .
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("slot")}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-accent-600 px-6 py-3 font-semibold text-white transition hover:bg-accent-700 disabled:opacity-40"
            >
              {submitting
                ? "Sending…"
                : provisionalNames.length > 0
                  ? `Request this booking — ${gbp(quote.total_pence)}`
                  : `Confirm booking — ${gbp(quote.total_pence)}`}
            </button>
          </div>
        </form>
      )}

      {step === "postcode" && landing}

      {/* Sticky running price */}
      {step !== "postcode" && quote.total_pence > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your fixed price
              </p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {gbp(quote.total_pence)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              {quote.savings_pence > 0 && (
                <p className="font-semibold text-accent-700">
                  Offer saves you {gbp(quote.savings_pence)}
                </p>
              )}
              <p>
                {booking.length > 1
                  ? `${booking.length} visits · pay each cleaner on the day`
                  : "No deposit · pay the cleaner on the day"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
    </div>
  );
}
