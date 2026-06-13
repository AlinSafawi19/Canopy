import Link from "next/link";

const LINKS: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Security", href: "#security" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
};

export function MarketingFooter() {
  return (
    <footer
      className="bg-slate-950 border-t border-white/5 py-16 sm:py-20"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 mb-5"
              aria-label="Canopy home"
            >
              <div className="w-7 h-7 rounded-[5px] bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 32 32" className="w-4 h-4" aria-hidden="true" fill="none">
                  <path d="M5 22 Q16 8 27 22" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <path d="M9 27 Q16 17 23 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-white font-semibold text-sm">Canopy</span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              Content management built for creative teams. From first draft to final publish.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <nav key={group} aria-label={`${group} links`}>
              <h3 className="text-slate-400 font-semibold text-xs tracking-widest uppercase mb-5">
                {group}
              </h3>
              <ul className="space-y-3">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-slate-500 hover:text-slate-200 text-sm transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-slate-600 text-sm">
            © {new Date().getFullYear()} Canopy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
