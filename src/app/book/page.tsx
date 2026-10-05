import SiteHeader from "@/components/marketplace/SiteHeader";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import BookingFlow from "@/components/marketplace/BookingFlow";
import { gbpShort } from "@/lib/marketplace/money";
import BookingLanding from "@/components/marketplace/BookingLanding";
import {
  getBundles,
  getPriceItems,
  getServices,
  getSettings,
} from "@/lib/marketplace/repo";
import { BRAND, CONTENT } from "@/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${CONTENT.book.heading} | ${BRAND.shortName}`,
  description: CONTENT.book.intro,
  alternates: { canonical: "/book" },
};

export default async function BookPage({
  searchParams,
}: {
  // Carried over from the homepage postcode box. Validated downstream by the
  // slots endpoint, so anything unusable simply leaves the customer on step
  // one rather than failing.
  searchParams: Promise<{ postcode?: string; from?: string }>;
}) {
  const { postcode = "", from = "" } = await searchParams;
  const [services, items, bundles, settings] = await Promise.all([
    getServices(true),
    getPriceItems(true),
    getBundles(true),
    getSettings(),
  ]);

  const singleOvenPence =
    items.find((item) => item.code === "oven_single")?.unit_price_pence ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden bg-slate-900 pb-14 pt-14">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-primary-500),transparent_55%)] opacity-[0.18]"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-400">
            {CONTENT.book.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl">
            {CONTENT.book.heading}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            {CONTENT.book.intro}
          </p>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
            {CONTENT.book.points.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="text-accent-400">✓</span>
                {point}
              </li>
            ))}
          </ul>

          {/* The one thing a price list cannot do: show what is being bought.
              Shown whole rather than cropped to a banner, because half of a
              before-and-after is just a photograph of a dirty oven. The figure
              comes from the live price list, so it cannot drift from what the
              form charges a few inches further down the page. */}
          <figure className="mx-auto mt-10 max-w-xl overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/10">
            <img
              src="/images/oven-before-after.jpg"
              alt="The same single oven before and after cleaning: burnt-on carbon across the door glass and base, then clear glass and bare enamel"
              className="w-full object-contain"
            />
            <figcaption className="bg-slate-800 px-5 py-3 text-center text-sm font-medium text-slate-300">
              A real job, done in about 90 minutes.
              {singleOvenPence > 0 && (
                <>
                  {" "}
                  <span className="text-white">
                    This one cost {gbpShort(singleOvenPence)}.
                  </span>
                </>
              )}
            </figcaption>
          </figure>
        </div>
      </header>

      <div className="pt-10">
        <BookingFlow
          initialPostcode={postcode}
          source={from.slice(0, 40)}
          services={services}
          items={items}
          bundles={bundles}
          commissionPct={Number(settings.commission_pct)}
          landing={
            <BookingLanding
              services={services}
              items={items}
              bundles={bundles}
            />
          }
        />
      </div>

    </main>
      <Footer />
    </>
  );
}
