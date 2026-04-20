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
  title: "Fresh For Less Oven Cleaning | Professional Oven Cleaning at Affordable Prices",
  description:
    "Professional oven, hob, extractor and Aga cleaning that brings your appliances back to life. Trusted by 2,000+ households and businesses across the UK. Free no-obligation quotes.",
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
      "Professional oven cleaning trusted by 2,000+ households. Free no-obligation quotes, non-toxic eco products, 100% satisfaction guarantee.",
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
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    bestRating: "5",
    ratingCount: "2000",
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
