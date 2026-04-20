"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "../AnimatedSection";

const faqs = [
  {
    question: "How long does an oven clean take?",
    answer:
      "A typical single oven takes 60–90 minutes. A double oven takes around 2 hours, and a full range cooker around 2.5–3 hours. We work efficiently and tidy up after ourselves.",
  },
  {
    question: "Are your products safe for children and pets?",
    answer:
      "Yes — 100%. We only use non-caustic, fume-free, biodegradable products. There's no harsh chemical smell, no need to leave the house, and your oven is completely safe to use the moment we finish.",
  },
  {
    question: "Can I use my oven straight after the clean?",
    answer:
      "Absolutely. Unlike DIY oven sprays which leave behind residue, our products are food-safe and rinsed thoroughly. You can preheat and start cooking the moment we leave.",
  },
  {
    question: "What if my oven is really bad?",
    answer:
      "We've seen it all — 20-year-old grease, melted plastic, you name it. Our heated dip tank tackles even the most neglected racks and trays, and our cavity products lift baked-on carbon other cleaners can't touch.",
  },
  {
    question: "Do you clean the inside of the oven door glass?",
    answer:
      "Yes — we partially dismantle the door so we can reach between the glass panels and restore them to crystal clear. This is included as standard on every clean.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Our prices start from £45 for a single oven. Check our pricing section for full details, or request a free no-obligation quote tailored to your appliances.",
  },
  {
    question: "What areas do you cover?",
    answer:
      "We cover most of the UK including the Wirral, Liverpool, Chester, Warrington, Runcorn and surrounding areas. Get in touch to check if we serve your postcode.",
  },
  {
    question: "How do I pay?",
    answer:
      "We accept card payments, cash and bank transfer on the day. No deposit required — you only pay once you're happy with the finished result.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="relative bg-white py-24 sm:py-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <AnimatedSection className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700 ring-1 ring-primary-200/60">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
              />
            </svg>
            Got Questions?
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Everything you need to know about our oven cleaning services.
            Can&apos;t find your answer? Get in touch and we&apos;ll be happy to
            help.
          </p>
        </AnimatedSection>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <AnimatedSection key={index} delay={index * 0.05}>
                <div
                  className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                    isOpen
                      ? "border-primary-200 bg-primary-50/30"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span
                      className={`text-base font-semibold transition-colors duration-200 ${
                        isOpen ? "text-primary-700" : "text-slate-900"
                      }`}
                    >
                      {faq.question}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className={`flex-shrink-0 ${
                        isOpen ? "text-primary-600" : "text-slate-400"
                      }`}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-base leading-relaxed text-slate-600">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
