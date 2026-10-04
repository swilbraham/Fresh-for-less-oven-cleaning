/**
 * The active site.
 *
 * Two lines decide which configuration this deployment runs: the import and
 * the `SITE` assignment. Nothing else in the codebase names a preset.
 */
import type { SiteConfig } from "./types";
import { preset } from "./presets/ffl-oven";

export const SITE: SiteConfig = preset;

export const BRAND = SITE.identity;
export const CONTACT = SITE.contact;
export const META = SITE.meta;
export const CONTENT = SITE.content;
export const THEME = SITE.theme;
export const COMMERCIALS = SITE.commercials;

/**
 * The trade nouns. Imported as `V` everywhere for the same reason it is short
 * in the first place: it appears mid-sentence inside JSX and template strings
 * dozens of times per file, and `{SITE.vocab.many}` makes copy unreadable.
 */
export const V = SITE.vocab;

/**
 * Who does the work. Read these rather than comparing `SITE.mode` by hand:
 * a stray `=== "network"` typo silently takes the wrong branch, and on a solo
 * site the wrong branch means texting job offers to a contractor pool that
 * does not exist.
 */
export const IS_NETWORK = SITE.mode === "network";
export const IS_SOLO = SITE.mode === "solo";

/**
 * Commission actually charged. A solo operator keeps the whole job value, and
 * forcing that through the same accessor means the pricing engine, the
 * invoice run and the admin screens cannot disagree about it.
 */
export const COMMISSION_PCT = IS_SOLO ? 0 : SITE.commercials.commissionPct;

/**
 * Statutory trading disclosure (Companies Act 2006 s.82 and the 2015 Trading
 * Disclosures Regulations): a limited company must show its registered name,
 * number, place of registration and registered office on its website and
 * business documents. A sole trader must show their own name and a business
 * address, which is what the second branch produces.
 *
 * Built by joining rather than concatenating: the production minifier drops a
 * trailing space at the end of a template literal, which once ran two words
 * together in a deployed build while dev looked fine. Punctuation stays
 * attached to its word and join() supplies the spaces, so there is no trailing
 * whitespace left to lose.
 */
export const COMPANY_DISCLOSURE: string = (() => {
  const id = SITE.identity;
  const parts: string[] = [];

  if (id.isLimited) {
    if (id.registeredName && id.registeredName !== id.tradingName) {
      parts.push(`${id.tradingName} is a trading name of ${id.registeredName},`);
      parts.push(
        `registered in ${id.placeOfRegistration}, company number ${id.companyNumber}.`
      );
    } else {
      parts.push(
        `${id.registeredName} is registered in ${id.placeOfRegistration}, company number ${id.companyNumber}.`
      );
    }
    parts.push(`Registered office: ${id.registeredOffice}.`);
  } else {
    parts.push(`${id.tradingName} is a trading name of ${id.registeredName}.`);
    parts.push(`Business address: ${id.registeredOffice}.`);
  }

  if (id.vatNumber) parts.push(`VAT registration number ${id.vatNumber}.`);

  return parts.join(" ");
})();

/** Absolute URL for a path, for canonical tags, emails and SMS links. */
export function siteUrl(path = "/"): string {
  const base = SITE.meta.baseUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type { SiteConfig } from "./types";
