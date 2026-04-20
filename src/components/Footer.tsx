export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <img
                src="/images/logo.png"
                alt="Fresh For Less Oven Cleaning"
                className="h-12 w-12 rounded-full object-contain"
              />
              <div>
                <span className="text-lg font-bold text-white">Fresh For Less</span>
                <span className="block text-[10px] font-medium uppercase tracking-widest text-primary-400">
                  Oven Cleaning
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Professional oven, hob, extractor and Aga cleaning that delivers sparkling results at prices you&apos;ll love.
            </p>
            {/* Trust badges */}
            <div className="mt-5 flex flex-wrap gap-2">
              {["Fully Insured", "DBS Checked", "Non-Toxic Products"].map((badge) => (
                <span key={badge} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                  <svg className="h-3 w-3 text-accent-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Services</h4>
            <ul className="mt-4 space-y-3">
              {[
                { name: "Single Oven Cleaning", slug: "single-oven-cleaning" },
                { name: "Double Oven Cleaning", slug: "double-oven-cleaning" },
                { name: "Range Cooker Cleaning", slug: "range-cooker-cleaning" },
                { name: "Aga Cleaning", slug: "aga-cleaning" },
                { name: "Hob & Extractor", slug: "hob-extractor-cleaning" },
                { name: "Microwave Cleaning", slug: "microwave-cleaning" },
                { name: "BBQ Cleaning", slug: "bbq-cleaning" },
              ].map((s) => (
                <li key={s.slug}>
                  <span className="text-sm text-slate-400">{s.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Quick Links</h4>
            <ul className="mt-4 space-y-3">
              {[
                { label: "Pricing", href: "#pricing" },
                { label: "How It Works", href: "#process" },
                { label: "Reviews", href: "#testimonials" },
                { label: "FAQ", href: "#faq" },
                { label: "About Us", href: "#about" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Contact</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="tel:03300434811" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  <svg className="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  0330 043 4811
                </a>
              </li>
              <li>
                <a href="mailto:info@freshforlessovencleaning.co.uk" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  <svg className="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  info@freshforlessovencleaning.co.uk
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <svg className="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Mon-Sun: 7am - 7pm
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-8 text-center">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Fresh For Less Oven Cleaning. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
