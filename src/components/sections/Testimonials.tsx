"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "../AnimatedSection";

const testimonials = [
  {
    name: "Sarah M.",
    role: "Homeowner",
    location: "Single oven & hob",
    quote:
      "I was embarrassed by the state of our oven — years of baked-on grease I couldn't shift. Fresh For Less made it look brand new in 90 minutes. And the price was half what the big franchise quoted.",
    rating: 5,
  },
  {
    name: "Jennifer T.",
    role: "Mum of 3",
    location: "Range cooker clean",
    quote:
      "With three kids and a husband who loves a roast, our range cooker takes a beating. The team was so professional, no fumes, no mess, and the door glass is crystal clear again. I'll never use anyone else.",
    rating: 5,
  },
  {
    name: "David R.",
    role: "Pub Landlord",
    location: "Commercial kitchen",
    quote:
      "We needed our pub kitchen ovens deep cleaned overnight to pass our hygiene inspection. They arrived exactly when promised and the results were outstanding. Got our 5-star rating back.",
    rating: 5,
  },
  {
    name: "Michelle K.",
    role: "Homeowner",
    location: "Double oven & extractor",
    quote:
      "I tried every product Sainsbury's sells to clean our oven. Nothing worked. Fresh For Less got it sparkling — even the inside of the door glass. I genuinely couldn't believe my eyes.",
    rating: 5,
  },
  {
    name: "Lisa W.",
    role: "Letting Agent",
    location: "End-of-tenancy clean",
    quote:
      "I book Fresh For Less for every end-of-tenancy oven we manage. Tenants get their deposit back, landlords are happy, and the price always makes sense. Brilliant service.",
    rating: 5,
  },
  {
    name: "Robert J.",
    role: "Restaurant Owner",
    location: "Monthly maintenance",
    quote:
      "They handle our restaurant ovens and extractors every month. Always on time, always thorough, and they work around our service hours. Best value in town, hands down.",
    rating: 5,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [active, setActive] = useState(0);
  const visibleCount = 3;

  return (
    <section id="testimonials" className="relative overflow-hidden bg-slate-50 py-20 lg:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-primary-50)_0%,_transparent_50%)] opacity-60" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            Real Results
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Loved by Families &amp; Businesses
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Don&apos;t just take our word for it — hear from people who&apos;ve experienced the Fresh For Less difference.
          </p>
        </AnimatedSection>

        {/* Desktop Grid */}
        <div className="mt-16 hidden gap-6 md:grid md:grid-cols-3">
          {testimonials.slice(0, 6).map((t, i) => (
            <AnimatedSection key={t.name} delay={i * 0.1}>
              <div className="group relative h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-50 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <StarRating count={t.rating} />
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.role} &middot; {t.location}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="relative mt-12 md:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
            >
              <StarRating count={testimonials[active].rating} />
              <p className="mt-4 text-sm leading-relaxed text-slate-700">
                &ldquo;{testimonials[active].quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {testimonials[active].name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{testimonials[active].name}</p>
                  <p className="text-xs text-slate-500">
                    {testimonials[active].role} &middot; {testimonials[active].location}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="mt-6 flex justify-center gap-2">
            {testimonials.slice(0, visibleCount * 2).map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all ${
                  active === i ? "w-6 bg-primary-600" : "w-2 bg-slate-300"
                }`}
                aria-label={`Show testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
