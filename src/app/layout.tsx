import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.freshforlessovencleaning.co.uk"),
  title: "Fresh For Less Oven Cleaning | Book Online, Fixed Prices from \u00a360",
  description:
    "Oven, hob, extractor and Aga cleaning at fixed prices you can see before you book. Single oven from \u00a360, booked online in a minute, no home visit and nothing to pay upfront.",
  keywords: [
    "oven cleaning",
    "professional oven cleaner",
    "hob cleaning",
    "extractor hood cleaning",
    "Aga cleaning",
    "Range cooker cleaning",
    "microwave cleaning",
    "BBQ cleaning",
    "affordable oven cleaning",
    "oven cleaner near me",
    "end of tenancy oven clean",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Fresh For Less Oven Cleaning",
    title: "Fresh For Less Oven Cleaning | Sparkling Results, Affordable Prices",
    description:
      "Fixed prices online, single oven from \u00a360. Pick a slot, pay on the day, use the oven the same evening. Non-caustic products, insured and vetted.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fresh For Less Oven Cleaning",
    description:
      "Professional oven cleaning at affordable prices. Free quotes, eco-friendly products, 100% satisfaction guarantee. Call 0330 043 4811.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  additionalType: "https://schema.org/ProfessionalService",
  name: "Fresh For Less Oven Cleaning",
  description:
    "Professional oven, hob, extractor and Aga cleaning services delivering sparkling results at affordable prices.",
  telephone: "0330 043 4811",
  email: "info@freshforlessovencleaning.co.uk",
  url: "https://www.freshforlessovencleaning.co.uk",
  priceRange: "£",
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "07:00",
    closes: "19:00",
  },
  // Only ever the real figure. Google treats an unsupported aggregateRating
  // as a structured-data violation, and the penalty is a manual action across
  // the domain rather than the loss of stars on one page.
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    bestRating: "5",
    ratingCount: "500",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Oven Cleaning Services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Single Oven Cleaning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Double Oven Cleaning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Range Cooker & Aga Cleaning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Hob & Extractor Cleaning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Microwave & BBQ Cleaning" } },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
