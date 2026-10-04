/**
 * The shape of one client site.
 *
 * Everything that differs between an oven-cleaning company in Leeds and a
 * mobile dog groomer in Bristol lives in this type and nowhere else. A new
 * client is a new object of this shape — no component, route or query is
 * expected to change.
 *
 * Money is integer pence throughout, matching the database. Writing prices as
 * pounds anywhere in a config is the one mistake that silently charges a
 * customer a hundredth of the intended price, so there is no pounds field.
 */

export type PaletteName =
  | "blue"
  | "teal"
  | "emerald"
  | "amber"
  | "orange"
  | "violet"
  | "rose"
  | "slate";

/**
 * Who fulfils the work.
 *
 * "solo"    — one business doing its own jobs. Bookings land straight in the
 *             owner's diary, there is no contractor sign-up, no first-to-accept
 *             text, and no commission: the whole job value is theirs.
 * "network" — a pool of self-employed contractors. Jobs are texted out,
 *             first to accept wins, and commission is invoiced weekly.
 *
 * The switch is read on the server for routing and on the client for copy, so
 * solo sites never render a contractor area at all rather than hiding it.
 */
export type OperatingMode = "solo" | "network";

/**
 * The nouns the site uses for the person who turns up and the work they do.
 *
 * Kept as data because it is the single most visible difference between
 * niches: "we'll confirm a vetted local cleaner" has to become "a vetted local
 * gardener" in every one of the forty-odd places it appears, and a site that
 * gets one of them wrong reads like a template.
 *
 * `one`/`many` are lower case for mid-sentence use; `One`/`Many` are
 * capitalised for headings and buttons. Keep them short — they appear inside
 * text messages with a 160-character budget.
 */
export type Vocabulary = {
  /** The contractor or operative: "cleaner", "gardener", "fitter". */
  one: string;
  many: string;
  One: string;
  Many: string;
  /** The unit of work as a noun: "clean", "cut", "valet", "groom". */
  job: string;
  Job: string;
  /** The same as a verb, for "we'll {verb} your oven": "clean", "mow". */
  verb: string;
  /** What the customer's property is called: "home", "property", "vehicle". */
  place: string;
};

export type LegalIdentity = {
  /** The name customers see everywhere. */
  tradingName: string;
  /** Short form for tight spaces — nav wordmark, SMS sender, invoice header. */
  shortName: string;
  /** Second line under the wordmark, e.g. "Oven Cleaning". Blank to hide. */
  strapline: string;
  /**
   * Companies Act 2006 s.82 disclosure. A limited company must show these on
   * its website and invoices; a sole trader sets `isLimited: false` and only
   * `registeredName` and `registeredOffice` are used.
   */
  isLimited: boolean;
  registeredName: string;
  companyNumber: string;
  placeOfRegistration: string;
  registeredOffice: string;
  /** Blank unless VAT registered — an invented VAT number is an offence. */
  vatNumber: string;
};

export type Contact = {
  /** Display form, e.g. "0151 000 0000". */
  phone: string;
  /** Dialable form with no spaces, e.g. "01510000000". */
  phoneHref: string;
  email: string;
  /** Digits only with country code, e.g. "447700900000". Blank hides the button. */
  whatsapp: string;
  /**
   * Where enquiry-form submissions go. Kept separate from `email` because the
   * published inbox and the inbox that should ping on a new lead are often
   * different people — and on a site sold to a client, getting this wrong
   * sends their leads to whoever set the site up.
   */
  leadEmail: string;
  /** Free text, e.g. "Mon–Sun: 7am – 7pm". */
  hours: string;
  /** Where they work, in the customer's words: "Wirral, Liverpool & Chester". */
  serviceArea: string;
};

export type SiteMeta = {
  /** Canonical origin with protocol and no trailing slash. */
  baseUrl: string;
  title: string;
  description: string;
  keywords: string[];
  /** Shown in schema.org LocalBusiness — only claim ratings you really hold. */
  ratingValue: string;
  ratingCount: string;
  /** schema.org type, e.g. "HomeAndConstructionBusiness". */
  businessType: string;
  /** Date shown on the privacy policy, e.g. "4 October 2026". */
  privacyUpdated: string;
};

export type TrustStat = { value: string; label: string };

/** Named icon from src/config/icons.tsx — keeps copy files plain data. */
export type IconName =
  | "sparkle"
  | "shield"
  | "coin"
  | "clock"
  | "check"
  | "building"
  | "warning"
  | "heart"
  | "card"
  | "phone"
  | "mail"
  | "calendar"
  | "van"
  | "star"
  | "leaf"
  | "wrench";

export type IconCard = { icon: IconName; title: string; description: string };
export type IconLabel = { icon: IconName; label: string };
export type Step = { icon: IconName; title: string; description: string };
export type Testimonial = {
  quote: string;
  /** Stars shown, 1-5. */
  rating: number;
  name: string;
  /** Who they are: "Working mum", "Letting agent". */
  role: string;
  /** What they bought: "Weekly domestic clean". */
  service: string;
};
export type FaqItem = { question: string; answer: string };

/**
 * A headline package on the pricing section.
 *
 * Deliberately separate from the bookable catalogue: this is the shop window,
 * where three round numbers sell better than forty line items, while the
 * catalogue is what the booking form actually prices. Keeping them apart lets
 * a client advertise "from £195" without that figure having to be a real
 * basket, and change their advertised packages without touching the prices
 * customers are mid-booking on.
 */
export type PricePackage = {
  name: string;
  /** Whole pounds, as advertised. Shop-window copy, never used in a charge. */
  pricePounds: number;
  /** Qualifier after the figure: "per hour", "from", "per visit". */
  subtitle: string;
  description: string;
  /** At most one package should be popular. */
  popular: boolean;
  features: string[];
};

/** A stat bar in the About panel. `value` reads as a percentage or a rating. */
export type AboutStat = { label: string; value: string; color: string };

/** Every word of homepage copy. Nothing here is read by the booking engine. */
export type SiteContent = {
  hero: {
    badge: string;
    /** Headline split so the middle span can be gradient-filled. */
    headlineBefore: string;
    headlineAccent: string;
    headlineAfter: string;
    subheadline: string;
    primaryCta: string;
    stats: TrustStat[];
  };
  /**
   * Short label for the nav button and pricing-card buttons. Separate from
   * `hero.primaryCta` because the hero can afford "Get Your Free Fixed Price"
   * and a 40px nav button cannot.
   */
  navCta: string;
  painPoints: { eyebrow: string; heading: string; intro: string; cards: IconCard[] };
  benefits: { eyebrow: string; heading: string; intro: string; cards: IconCard[] };
  pricing: {
    eyebrow: string;
    heading: string;
    intro: string;
    packages: PricePackage[];
    /** Small print under the cards. */
    note: string;
    badges: IconLabel[];
  };
  process: { eyebrow: string; heading: string; intro: string; steps: Step[] };
  testimonials: {
    eyebrow: string;
    heading: string;
    intro: string;
    items: Testimonial[];
  };
  faq: { eyebrow: string; heading: string; intro: string; items: FaqItem[] };
  about: {
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    points: string[];
    panelTitle: string;
    panelSubtitle: string;
    stats: AboutStat[];
    credentials: IconLabel[];
  };
  finalCta: {
    badge: string;
    headingBefore: string;
    headingAccent: string;
    subheading: string;
    button: string;
    trustRow: string[];
  };
  /** Booking page header, above the quote builder. */
  book: {
    eyebrow: string;
    heading: string;
    intro: string;
    /** Three short reassurances under the heading. */
    points: string[];
  };
  /** Short service names for the footer column. */
  footerServices: string[];
  /** Badges under the footer wordmark, e.g. "Fully Insured". */
  trustBadges: string[];
  footerBlurb: string;
};

/** A bookable trade. One job, one visit, one person, one commission line. */
export type CatalogueService = {
  code: string;
  label: string;
  hint: string;
  blurb: string;
  minimumChargePence: number;
  /** Above zero adds an opt-in percentage add-on, e.g. carpet stain guard. */
  protectionPct: number;
  protectionLabel: string;
  protectionHint: string;
  sort: number;
};

export type CatalogueItem = {
  code: string;
  serviceCode: string;
  label: string;
  hint: string;
  /** Groups items within a service on the booking form, e.g. "Upholstery". */
  kind: string;
  unitPricePence: number;
  maxQty: number;
  sort: number;
};

/** "3 rooms for £99" — applied automatically when it beats the itemised price. */
export type CatalogueBundle = {
  itemCode: string;
  qty: number;
  pricePence: number;
  label: string;
};

export type Catalogue = {
  services: CatalogueService[];
  items: CatalogueItem[];
  bundles: CatalogueBundle[];
};

export type Commercials = {
  /** Ignored in solo mode, where the operator keeps the whole job value. */
  commissionPct: number;
  /** Earliest bookable day, counted from today. */
  minNoticeDays: number;
  /** Free-cancellation window before the slot opens. */
  cancellationNoticeHours: number;
  /** Days to pay a commission invoice. Unused in solo mode. */
  paymentTermsDays: number;
  /**
   * The response promise printed on the enquiry form. A figure the operator
   * has to live up to, so it is theirs to set rather than ours to assume.
   */
  quoteResponseHours: number;
};

export type SiteConfig = {
  /** Slug used in filenames and the setup script, e.g. "oven-cleaning". */
  preset: string;
  mode: OperatingMode;
  identity: LegalIdentity;
  contact: Contact;
  meta: SiteMeta;
  vocab: Vocabulary;
  theme: {
    primary: PaletteName;
    accent: PaletteName;
    /** Path under /public. A square PNG on a transparent background. */
    logo: string;
    /** Hero background photo under /public. Blank falls back to flat colour. */
    heroImage: string;
    /**
     * Decorative banners inside the marketing sections. Any blank string
     * hides that banner rather than rendering a broken image, so a client
     * site can ship with a logo and nothing else while photography is being
     * shot — which is the normal state of a brand-new site.
     */
    sectionImages: {
      painPoints: string;
      benefits: string;
      process: string;
      about: string;
      finalCta: string;
    };
  };
  commercials: Commercials;
  content: SiteContent;
  catalogue: Catalogue;
};
