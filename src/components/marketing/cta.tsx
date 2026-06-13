import Link from "next/link";

export function CTASection() {
  return (
    <section
      className="relative bg-slate-950 overflow-hidden py-16 sm:py-20"
      aria-labelledby="cta-heading"
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      {/* Indigo glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 65%)" }}
        aria-hidden="true"
      />

      {/* Top edge fade from previous section */}
      <div
        className="absolute top-0 inset-x-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(248,250,252,0) 0%, transparent 100%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 flex flex-col items-center text-center">
        <h2
          id="cta-heading"
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] mb-6 text-white"
        >
          Ready to ship better content,
          <br className="hidden sm:block" />
          {" "}<span style={{ background: "linear-gradient(135deg, #818cf8 0%, #c084fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", paddingRight: "0.06em" }}>faster?</span>
        </h2>

        <p className="text-slate-400 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl">
          Join content teams already using Canopy to streamline their workflows,
          align stakeholders, and publish with confidence.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full sm:w-auto border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 font-medium px-6 py-3 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Sign in to existing account
          </Link>
        </div>
      </div>
    </section>
  );
}
