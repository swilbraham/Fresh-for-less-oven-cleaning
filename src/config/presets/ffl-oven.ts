import type { SiteConfig } from "../types";

/**
 * Fresh For Less Oven Cleaning — the live site.
 *
 * Prices for the six oven and range lines are the figures already advertised
 * on the marketing pages, so the booking form and the pricing section cannot
 * contradict each other. Everything else in the list is a starting figure:
 * change it in /admin/prices, not here, because the seed only ever inserts
 * on a first boot and an edit to this file will not reach a live database.
 */
export const preset: SiteConfig = {
  preset: "ffl-oven",
  mode: "network",

  identity: {
    tradingName: "Fresh For Less Oven Cleaning",
    shortName: "Fresh For Less",
    strapline: "Oven Cleaning",
    isLimited: true,
    registeredName: "Wirral Carpet Cleaning Limited",
    companyNumber: "11103869",
    placeOfRegistration: "England and Wales",
    registeredOffice: "8 Overton Way, Prenton, Wirral, CH43 2LF",
    vatNumber: "",
  },

  contact: {
    phone: "0330 043 4811",
    phoneHref: "03300434811",
    email: "info@freshforlessovencleaning.co.uk",
    leadEmail: "info@freshforlessovencleaning.co.uk",
    whatsapp: "447479921066",
    hours: "Mon-Sun: 7am - 7pm",
    serviceArea: "Wirral, Liverpool, Chester and most of the UK",
  },

  meta: {
    baseUrl: "https://www.freshforlessovencleaning.co.uk",
    title:
      "Fresh For Less Oven Cleaning | Professional Oven Cleaning at Affordable Prices",
    description:
      "Professional oven, hob, extractor and Aga cleaning that brings your appliances back to life. Instant fixed prices online, no home visit needed.",
    keywords: [
      "oven cleaning",
      "professional oven cleaner",
      "book oven cleaning online",
      "hob cleaning",
      "extractor hood cleaning",
      "Aga cleaning",
      "range cooker cleaning",
      "end of tenancy oven clean",
      "oven cleaner near me",
    ],
    // Left at zero until there are reviews that can be pointed at. A made-up
    // aggregateRating is a structured-data violation and risks rich results
    // being withdrawn for the whole domain.
    ratingValue: "0",
    ratingCount: "0",
    businessType: "https://schema.org/ProfessionalService",
    privacyUpdated: "4 October 2026",
  },

  vocab: {
    one: "oven cleaner",
    many: "oven cleaners",
    One: "Oven cleaner",
    Many: "Oven cleaners",
    job: "clean",
    Job: "Clean",
    verb: "clean",
    place: "kitchen",
  },

  theme: {
    primary: "blue",
    accent: "emerald",
    logo: "/images/logo.png",
    heroImage: "/images/hero-bg.jpg",
    sectionImages: {
      painPoints: "/images/clean-carpet.jpg",
      benefits: "/images/family-home.jpg",
      process: "/images/clean-room.jpg",
      about: "/images/about-cleaner.jpg",
      finalCta: "/images/cta-interior.jpg",
    },
  },

  commercials: {
    commissionPct: 20,
    minNoticeDays: 1,
    cancellationNoticeHours: 24,
    paymentTermsDays: 7,
    quoteResponseHours: 2,
  },

  content: {
    hero: {
      badge: "Instant fixed prices, booked online",
      headlineBefore: "An Oven That Looks",
      headlineAccent: "Brand New",
      headlineAfter: "Without the Brand-New Price",
      subheadline:
        "Ovens, hobs, extractors, ranges and Agas cleaned by hand with non-caustic products. See your fixed price in under a minute and pick a slot that suits you.",
      primaryCta: "Get Your Fixed Price",
      stats: [
        { value: "£45", label: "Single Oven" },
        { value: "90 min", label: "Typical Visit" },
        { value: "Same day", label: "Use It Again" },
      ],
    },

    navCta: "Book Online",

    painPoints: {
      eyebrow: "Sound Familiar?",
      heading: "Nobody Enjoys Cleaning an Oven",
      intro:
        "An hour on your knees with a caustic spray and it still comes out grey. We take the whole job off your hands.",
      cards: [
        {
          icon: "warning",
          title: "Carbon That Won't Shift",
          description:
            "Baked-on carbon on the roof, the floor and the element does not come off with a supermarket spray and a scourer. It needs taking out and tanking.",
        },
        {
          icon: "clock",
          title: "Half a Saturday Gone",
          description:
            "Racks in the bath, fumes through the kitchen, and the glass still cloudy at the end of it. There are better things to do with a day off.",
        },
        {
          icon: "heart",
          title: "Fumes Around the Family",
          description:
            "Most oven cleaners you buy are caustic. Nobody wants that on the surfaces their children eat off, or breathing it in while they work.",
        },
        {
          icon: "card",
          title: "Quotes You Have to Chase",
          description:
            "Ring round, wait for someone to call back, and still not know what it costs until they're stood in your kitchen. Price it yourself instead.",
        },
      ],
    },

    benefits: {
      eyebrow: "Why Fresh For Less",
      heading: "Professional Results.\nHonest Prices.",
      intro:
        "Every clean is done by an insured, vetted oven cleaner with a dip tank in the van and non-caustic products in the kitchen.",
      cards: [
        {
          icon: "sparkle",
          title: "Dip Tank, Not Elbow Grease",
          description:
            "Racks, trays, shelves and extractor filters come out and go in the tank. They come back the colour they were when the oven was new.",
        },
        {
          icon: "shield",
          title: "Insured & Vetted",
          description:
            "Every oven cleaner on the network is checked, referenced and carries public liability insurance before they are sent a single job.",
        },
        {
          icon: "coin",
          title: "Fixed Price Before You Book",
          description:
            "Tick what needs doing and the total is worked out from the published price list. No home visit, no haggling, nothing to pay upfront.",
        },
        {
          icon: "leaf",
          title: "Non-Caustic Products",
          description:
            "Safe around children, pets and food preparation surfaces, and no lingering smell. You can use the oven as soon as we have finished.",
        },
        {
          icon: "clock",
          title: "Slots That Suit You",
          description:
            "Morning or afternoon, next day if somebody is free. You pick the half-day and we confirm who is coming.",
        },
        {
          icon: "check",
          title: "Pay on the Day",
          description:
            "You pay your oven cleaner when the work is done, not when you book. Nothing is owed if the job does not go ahead.",
        },
      ],
    },

    pricing: {
      eyebrow: "Simple Pricing",
      heading: "Honest Prices.\nEverything Included.",
      intro:
        "The price you see is the price you pay. Hobs, extractors, microwaves and BBQs can be added to any booking.",
      packages: [
        {
          name: "Single Oven",
          pricePounds: 45,
          subtitle: "per clean",
          description: "Cavity, door, glass, racks and trays",
          popular: false,
          features: [
            "Full cavity and roof deep clean",
            "Racks and trays dip-tank cleaned",
            "Inside-the-glass door clean",
            "Bulbs and seals checked",
            "Ready to use immediately",
          ],
        },
        {
          name: "Double Oven",
          pricePounds: 65,
          subtitle: "per clean",
          description: "Our most popular choice",
          popular: true,
          features: [
            "Both cavities deep cleaned",
            "All racks and trays restored",
            "Door glass restored to clear",
            "Bulbs and seals checked",
            "Priority booking",
          ],
        },
        {
          name: "Range Cooker",
          pricePounds: 95,
          subtitle: "from",
          description: "Aga, Rayburn, Stoves and more",
          popular: false,
          features: [
            "All cavities and the grill",
            "Hob plates and pan supports",
            "Racks, trays and enamel restored",
            "Knobs and controls degreased",
            "Enamel-safe on Agas",
            "Priority booking",
          ],
        },
      ],
      note: "Hobs, extractor hoods and filters, microwaves, air fryers, warming drawers, BBQs and outdoor pizza ovens can all be added at the prices shown on the booking page.",
      badges: [
        { icon: "shield", label: "Fully Insured" },
        { icon: "card", label: "DBS Checked" },
        { icon: "leaf", label: "Non-Toxic Products" },
        { icon: "star", label: "Satisfaction Guaranteed" },
      ],
    },

    process: {
      eyebrow: "Simple Process",
      heading: "Four Steps to a Spotless Oven",
      intro: "No home visit and no phone tag. Here is the whole thing.",
      steps: [
        {
          icon: "calendar",
          title: "Price It Yourself",
          description:
            "Enter your postcode, tick the oven, hob or extractor that needs doing, and the fixed price appears straight away.",
        },
        {
          icon: "clock",
          title: "Pick Your Half-Day",
          description:
            "Choose a morning or an afternoon that suits you. We confirm a vetted local oven cleaner and send you their first name.",
        },
        {
          icon: "sparkle",
          title: "We Strip and Tank It",
          description:
            "Racks, trays, shelves and filters come out to the dip tank in the van. The cavity, roof, element and door glass are done by hand.",
        },
        {
          icon: "check",
          title: "Use It the Same Day",
          description:
            "No caustic residue and no fumes left behind, so dinner can go straight in. You pay your oven cleaner on the day.",
        },
      ],
    },

    testimonials: {
      eyebrow: "Real Results",
      heading: "What Customers Say",
      intro: "A clean oven is the sort of thing people tell their neighbours about.",
      items: [
        {
          rating: 5,
          name: "Karen H.",
          role: "Homeowner",
          service: "Double oven and hob",
          quote:
            "I genuinely thought the glass was permanently stained. It came back clear. The racks look like they came out of the box.",
        },
        {
          rating: 5,
          name: "Tom B.",
          role: "Landlord",
          service: "End of tenancy oven clean",
          quote:
            "Booked it online on the Sunday, done Tuesday morning, photo sent through. Exactly what I need between tenants.",
        },
        {
          rating: 5,
          name: "Priya S.",
          role: "Working mum",
          service: "Single oven and extractor",
          quote:
            "No smell at all afterwards, which was my worry with two little ones in the house. Used the oven that evening.",
        },
        {
          rating: 5,
          name: "Geoff W.",
          role: "Homeowner",
          service: "Aga clean",
          quote:
            "Knew what he was doing with the enamel, which not everybody does. Took his time and left the kitchen tidy.",
        },
        {
          rating: 5,
          name: "Nicola F.",
          role: "Letting agent",
          service: "Multiple properties",
          quote:
            "Fixed prices online means I can book without ringing for a quote every time. Saves me more time than the clean does.",
        },
        {
          rating: 5,
          name: "Dave M.",
          role: "Homeowner",
          service: "Range cooker and BBQ",
          quote:
            "Did the range and the barbecue in the same visit. Both better than I expected for the money.",
        },
      ],
    },

    faq: {
      eyebrow: "Got Questions?",
      heading: "Frequently Asked Questions",
      intro:
        "Everything people ask before booking. Anything else, give us a ring.",
      items: [
        {
          question: "Can I use the oven straight afterwards?",
          answer:
            "Yes. The products are non-caustic and leave no residue or smell, so there is no need to run the oven empty first. Dinner can go straight in.",
        },
        {
          question: "How long does an oven clean take?",
          answer:
            "A single oven is usually around 90 minutes. A double oven is around two hours, and a range cooker or Aga can take most of a morning depending on size and condition.",
        },
        {
          question: "Do you need anything from me on the day?",
          answer:
            "Access to a sink and a power point, and the oven cool rather than warm. Everything else, including the dip tank, comes in the van.",
        },
        {
          question: "What if my oven is really bad?",
          answer:
            "The price does not change for a dirty oven, which is the whole point of a fixed price. If something is genuinely beyond a clean, such as a cracked door pane, your oven cleaner will tell you before starting rather than after.",
        },
        {
          question: "Is the hob included with the oven?",
          answer:
            "Hobs, extractor hoods, filters, microwaves, air fryers and warming drawers are priced separately on the booking page so you only pay for what you want doing.",
        },
        {
          question: "How much does it cost?",
          answer:
            "A single oven is £45, a double oven £65, and range cookers start at £95. Enter your postcode on the booking page and the exact total for whatever you tick appears straight away.",
        },
        {
          question: "What areas do you cover?",
          answer:
            "Wirral, Liverpool, Chester and most of the UK. Enter your postcode on the booking page and you will be told immediately whether somebody is available near you.",
        },
        {
          question: "How do I pay?",
          answer:
            "You pay your oven cleaner on the day the work is done, by card, bank transfer or cash. There is no deposit and nothing to pay if the booking does not go ahead.",
        },
      ],
    },

    about: {
      eyebrow: "About Us",
      heading: "A Network of Oven Cleaners, Not a Call Centre",
      paragraphs: [
        "Fresh For Less Oven Cleaning exists because getting an oven cleaned should not involve three phone calls and a stranger guessing at a price in your kitchen. You price the job yourself, pick a slot, and a vetted local oven cleaner turns up.",
        "Every oven cleaner on the network is insured, checked and equipped with a dip tank and non-caustic products before they are offered a single job. You get their first name once the booking is confirmed, and you pay them directly on the day.",
      ],
      points: [
        "Insured and vetted",
        "Non-caustic products",
        "Fixed prices online",
        "Pay on the day",
      ],
      panelTitle: "Service Standards",
      panelSubtitle: "What the network is held to",
      stats: [
        { label: "Fixed Price Honoured", value: "100%", color: "bg-accent-500" },
        { label: "Arrive in the Slot Booked", value: "98%", color: "bg-primary-500" },
        { label: "Same-Day Oven Use", value: "100%", color: "bg-amber-500" },
        { label: "Insured & Vetted", value: "100%", color: "bg-violet-500" },
      ],
      credentials: [
        { icon: "shield", label: "Licensed & Insured" },
        { icon: "leaf", label: "Non-Caustic Products" },
        { icon: "clock", label: "Morning or Afternoon Slots" },
        { icon: "coin", label: "Pay on the Day" },
      ],
    },

    finalCta: {
      badge: "Book online in under a minute",
      headingBefore: "Ready for an Oven That Looks",
      headingAccent: "Brand New Again?",
      subheading:
        "Enter your postcode, tick what needs doing, pick a half-day. Fixed price, no home visit, nothing to pay until the work is done.",
      button: "Get Your Fixed Price",
      trustRow: [
        "Instant fixed prices",
        "No hidden fees",
        "Pay on the day",
      ],
    },

    book: {
      eyebrow: "Ovens - hobs - extractors - ranges - Agas",
      heading: "Your fixed price in under a minute",
      intro:
        "No home visit, no haggling, nothing to pay upfront. Enter your postcode, tick what needs cleaning, and we will confirm a vetted local oven cleaner.",
      points: [
        "Single oven from £45",
        "Insured & vetted oven cleaners",
        "Use the oven the same day",
      ],
    },

    footerServices: [
      "Single & Double Ovens",
      "Range Cookers",
      "Agas & Rayburns",
      "Hobs & Extractors",
      "Microwaves & Air Fryers",
      "BBQs & Pizza Ovens",
      "End of Tenancy Ovens",
    ],
    trustBadges: ["Fully Insured", "DBS Checked", "Non-Toxic"],
    footerBlurb:
      "Professional oven, hob, extractor and range cleaning at honest fixed prices, booked online in under a minute.",
  },

  catalogue: {
    services: [
      {
        code: "oven",
        label: "Oven cleaning",
        hint: "Ovens, hobs, extractors, ranges and Agas",
        blurb:
          "Dip-tank cleaning that takes the racks, trays and door glass back to new, with non-caustic products so the oven can be used the same day.",
        // A single oven is the smallest job worth sending a van out for, so it
        // is also the floor: no basket can come in under it.
        minimumChargePence: 4500,
        protectionPct: 0,
        protectionLabel: "",
        protectionHint: "",
        sort: 10,
      },
    ],

    items: [
      { code: "oven_single", serviceCode: "oven", label: "Single oven", hint: "One cavity, racks, trays and door glass", kind: "Ovens & ranges", unitPricePence: 4500, maxQty: 4, sort: 10 },
      { code: "oven_double", serviceCode: "oven", label: "Double oven", hint: "Two cavities, racks, trays and door glass", kind: "Ovens & ranges", unitPricePence: 6500, maxQty: 4, sort: 20 },
      { code: "oven_range_90", serviceCode: "oven", label: "Range cooker (90cm)", hint: "All cavities, grill and hob included", kind: "Ovens & ranges", unitPricePence: 9500, maxQty: 2, sort: 30 },
      { code: "oven_range_100", serviceCode: "oven", label: "Range cooker (100cm+)", hint: "Twin doors, grill and full hob", kind: "Ovens & ranges", unitPricePence: 11000, maxQty: 2, sort: 40 },
      { code: "oven_aga_2", serviceCode: "oven", label: "Aga or Rayburn (2 oven)", hint: "Enamel-safe, nothing abrasive used", kind: "Ovens & ranges", unitPricePence: 12000, maxQty: 2, sort: 50 },
      { code: "oven_aga_4", serviceCode: "oven", label: "Aga or Rayburn (4 oven)", hint: "Enamel-safe, allow most of a morning", kind: "Ovens & ranges", unitPricePence: 15000, maxQty: 2, sort: 60 },

      { code: "hob_gas", serviceCode: "oven", label: "Hob (gas)", hint: "Burners, caps and pan supports tanked", kind: "Hobs & extractors", unitPricePence: 1500, maxQty: 3, sort: 70 },
      { code: "hob_flat", serviceCode: "oven", label: "Hob (ceramic or induction)", hint: "Burnt-on residue lifted, glass polished", kind: "Hobs & extractors", unitPricePence: 1200, maxQty: 3, sort: 80 },
      { code: "extractor", serviceCode: "oven", label: "Extractor hood", hint: "Canopy degreased inside and out", kind: "Hobs & extractors", unitPricePence: 2000, maxQty: 3, sort: 90 },
      { code: "extractor_filter", serviceCode: "oven", label: "Extractor filter (each)", hint: "Metal mesh or baffle filters, dip tanked", kind: "Hobs & extractors", unitPricePence: 500, maxQty: 8, sort: 100 },

      { code: "microwave", serviceCode: "oven", label: "Microwave", hint: "Inside, outside, turntable and roof", kind: "Small appliances", unitPricePence: 1500, maxQty: 3, sort: 110 },
      { code: "air_fryer", serviceCode: "oven", label: "Air fryer", hint: "Basket, drawer and element", kind: "Small appliances", unitPricePence: 1200, maxQty: 4, sort: 120 },
      { code: "warming_drawer", serviceCode: "oven", label: "Warming drawer", hint: "Cleaned alongside the main oven", kind: "Small appliances", unitPricePence: 1000, maxQty: 3, sort: 130 },

      { code: "bbq_gas", serviceCode: "oven", label: "Gas BBQ", hint: "Grates, flame tamers and burners tanked", kind: "Outdoor cooking", unitPricePence: 5500, maxQty: 2, sort: 140 },
      { code: "bbq_charcoal", serviceCode: "oven", label: "Charcoal BBQ or kettle", hint: "Grates, bowl and lid de-carbonised", kind: "Outdoor cooking", unitPricePence: 4000, maxQty: 2, sort: 150 },
      { code: "pizza_oven", serviceCode: "oven", label: "Outdoor pizza oven", hint: "Stone brushed, shell and chimney cleaned", kind: "Outdoor cooking", unitPricePence: 5000, maxQty: 2, sort: 160 },

      { code: "oven_bulb", serviceCode: "oven", label: "Oven bulb replacement", hint: "Fitted on the visit, part included", kind: "Parts & extras", unitPricePence: 1000, maxQty: 4, sort: 170 },
      { code: "oven_seal", serviceCode: "oven", label: "Door seal replacement", hint: "Common models carried in the van", kind: "Parts & extras", unitPricePence: 3000, maxQty: 3, sort: 180 },
    ],

    // No bundles. A bundle is keyed to one item code, so the obvious offer
    // here - oven, hob and extractor together - cannot be expressed, and
    // advertising a combined price the form would not honour is worse than
    // having no offer at all.
    bundles: [],
  },
};
