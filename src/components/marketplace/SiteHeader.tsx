import Link from "next/link";
import { BRAND, CONTACT, THEME } from "@/config";
import { PhoneIcon } from "@/config/icons";

/**
 * Brand header for the customer-facing marketplace pages.
 *
 * The main Navbar can't be reused here: its links are homepage anchors that
 * do nothing on /book. This keeps the same
 * logo, wordmark and phone CTA so the booking flow reads as part of the
 * client's own site rather than a detached third-party tool.
 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 lg:h-20">
        <Link href="/" className="flex items-center gap-2">
          {THEME.logo ? (
            <img
              src={THEME.logo}
              alt={BRAND.tradingName}
              className="h-12 w-12 rounded-full object-contain lg:h-14 lg:w-14"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white lg:h-14 lg:w-14 lg:text-xl"
            >
              {BRAND.shortName.charAt(0)}
            </span>
          )}
          <div>
            <span className="block text-lg font-bold tracking-tight text-slate-900 lg:text-xl">
              {BRAND.shortName}
            </span>
            {BRAND.strapline && (
              <span className="hidden text-[10px] font-medium uppercase tracking-widest text-primary-600 sm:block">
                {BRAND.strapline}
              </span>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="hidden text-sm font-semibold text-slate-600 transition hover:text-primary-600 sm:block"
          >
            Back to site
          </Link>
          <a
            href={`tel:${CONTACT.phoneHref}`}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{CONTACT.phone}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </div>
    </header>
  );
}
