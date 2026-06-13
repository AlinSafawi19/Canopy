"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      role="banner"
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-150 border-b ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-slate-200"
          : "bg-transparent border-transparent"
      }`}
    >
      <nav
        className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label="Canopy home">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-5 h-5" aria-hidden="true" fill="none">
              <path d="M5 22 Q16 8 27 22" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <path d="M9 27 Q16 17 23 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-slate-900 font-semibold text-[15px] tracking-tight">Canopy</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={(e) => scrollTo(e, href)}
              className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors duration-150"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="text-slate-600 hover:text-slate-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-all duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-slate-500 hover:text-slate-900 p-1 -mr-1 rounded-lg hover:bg-slate-100 transition-all duration-150"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden bg-white border-t border-slate-200 px-6 py-4 flex flex-col gap-1"
          role="menu"
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={(e) => scrollTo(e, href)}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-150"
              role="menuitem"
            >
              {label}
            </a>
          ))}
          <div className="border-t border-slate-200 pt-3 mt-2 flex flex-col gap-2">
            <Link
              href="/login"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-150"
              role="menuitem"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              role="menuitem"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
