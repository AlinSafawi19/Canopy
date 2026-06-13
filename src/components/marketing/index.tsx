import { MarketingNav } from "./nav";
import { HeroSection } from "./hero";
import { FeaturesSection } from "./features";
import { SecuritySection } from "./security";
import { CTASection } from "./cta";
import { MarketingFooter } from "./footer";

export function MarketingPage() {
  return (
    <div className="mk-page">
      {/* A11y: skip nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        Skip to main content
      </a>

      <MarketingNav />

      <main id="main-content" tabIndex={-1} className="outline-none">
        <HeroSection />
        <FeaturesSection />
        <SecuritySection />
        <CTASection />
      </main>

      <MarketingFooter />
    </div>
  );
}
