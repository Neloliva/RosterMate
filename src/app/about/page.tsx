import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RosterMate — rostering for Australian small businesses",
  description:
    "Weekly rosters with award-aware costing, no-login staff access, and coverage-impact approvals. Built for owner-operators, not enterprise HR.",
};

const COMPARISON_LAST_UPDATED = "April 2026";

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
      <Hero />
      <ProductTour />
      <PitchCards />
      <WhatItDoes />
      <Differentiators />
      <ComparisonTable />
      <Roadmap />
      <WhoFor />
      <CallToAction />
    </main>
  );
}

function ProductTour() {
  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="A quick look"
        title="Here's the actual product"
        sub="Not mockups — these are screenshots from a running RosterMate install."
      />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image
              src="/screenshots/dashboard.png"
              alt="RosterMate manager dashboard showing the weekly roster grid with colour-coded shifts, KPI cards, coverage banner, and savings suggestions."
              width={1440}
              height={1024}
              priority
              className="h-auto w-full"
            />
            <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">
                Manager dashboard.
              </span>{" "}
              Drag-and-drop weekly grid; every cell shows the actual dollar
              cost of that shift with casual loading and penalty rates baked
              in. KPI cards track week-over-week change. The Coverage banner
              flags days that fall below the minimums you set in Business
              Settings. The savings banner totals every cost-reduction
              opportunity the optimizer found this week and links through
              to the specific suggestions behind it.
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image
              src="/screenshots/notifications.png"
              alt="Manager notification popover showing a pending time-off request with staff note, others working that day, and a coverage delta showing approval would drop Supervisor count below the minimum."
              width={1800}
              height={1300}
              className="h-auto w-full"
            />
            <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">
                Approvals with context.
              </span>{" "}
              When someone asks for time off or a swap, the bell shows the
              shift at risk, the staff&apos;s note, others working that
              day, and — with coverage rules set — the exact staffing
              delta if you approve. Rose marks days where approving would
              breach your minimums (here: Supervisor 1 → 0, below your min
              of 1, so the line flags ✗). Decide with the answer visible,
              not guessed. Decline opens an optional-reason dialog;
              approving a time-off also deletes the shift from the roster
              behind a confirm.
            </figcaption>
          </figure>
        </div>

        <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Image
            src="/screenshots/staff-portal.png"
            alt="RosterMate staff portal on mobile — welcome card, sick-today button, my-requests card, today/tomorrow heroes with teal tint on today, and week list with a declined time-off chip."
            width={430}
            height={1100}
            className="h-auto w-full"
          />
          <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">
              Staff portal on a phone.
            </span>{" "}
            Each staff member gets a private URL they bookmark — no app
            install, no password. A one-tap &quot;I&apos;m sick today&quot;
            button files a cover request to the manager immediately.
            Underneath sits a live status of any requests they&apos;ve filed
            (updates within 15 seconds of a manager decision), today and
            tomorrow with times, role, and who else is rostered, then the
            full four-week schedule. Swap and time-off requests come from the
            same page.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <header className="mb-12">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500 text-xl font-bold text-white shadow-sm">
          R
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            RosterMate
          </div>
          <div className="text-xs text-slate-500">
            Weekly rosters for Australian small businesses
          </div>
        </div>
      </div>
      <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Roster your week. See the real cost.{" "}
        <span className="text-teal-600">Skip the login.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
        RosterMate is a lean rostering tool for owner-operators running 2–30 staff
        on a single site. Every shift shows its award-aware labour cost as you
        build the week, and your team checks their schedule from a private URL
        on any phone — no app, no account, no onboarding.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="#see-it"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600"
        >
          See the demo →
        </a>
        <a
          href="#comparison"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          How it compares
        </a>
      </div>
    </header>
  );
}

function PitchCards() {
  const cards = [
    {
      heading: "Cost you can see as you roster",
      body: "Every shift shows its actual labour cost in real time — base rate plus casual loading, weekend and night penalty rates, and automatic break deduction at 5h and 9h. Know the Saturday bill before you commit.",
    },
    {
      heading: "Staff check shifts without an app",
      body: "Each person gets a private, rotatable URL. Text it once — they bookmark it on their phone and it opens like a website. No account, no password, no install. Request swaps and time off from the same page.",
    },
    {
      heading: "Coverage you can trust",
      body: "Set minimums (e.g. \"3 on Mon–Fri, at least 1 Supervisor\"). The dashboard flags days that fall short. When staff ask for time off, you see who could cover before you approve — and whether approving would drop you below.",
    },
  ];
  return (
    <section className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.heading}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="text-base font-semibold text-slate-900">
            {c.heading}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {c.body}
          </p>
        </div>
      ))}
    </section>
  );
}

function WhatItDoes() {
  const groups: { title: string; features: string[] }[] = [
    {
      title: "Build the roster",
      features: [
        "Drag-and-drop weekly grid; monthly view for longer planning",
        "Every shift costed live against a generic award model (casual loading, weekend + night penalty, break deduction at 5h/9h)",
        "Shift editor with cost breakdown before you save",
        "Copy last week or last month to seed the next one",
        "Public holidays shown on the grid (AU national set)",
      ],
    },
    {
      title: "Staff portal",
      features: [
        "Private URL per staff member — no login, no app install",
        "Today and Tomorrow hero cards show own shift plus who else is working",
        "This week + next 3 weeks visible; past days dim automatically",
        "Request a swap or report time off with optional note",
        "Pending / approved / declined status visible at a glance",
      ],
    },
    {
      title: "Manager workflow",
      features: [
        "Notification bell with count badge when staff submit requests",
        "Impact panel on each request: others working that day, who could cover, coverage delta if approved",
        "Approve-to-remove-shift for time-off requests (behind a confirm)",
        "Optional reason on decline — shown to staff on their row for 48h",
        "Soft-warning on past-date edits (dimmed columns, amber banner in the editor)",
      ],
    },
    {
      title: "Insights and reports",
      features: [
        "Smart insights: overtime risk, thin coverage, high penalty loading, below-minimum days",
        "KPI cards: total labour cost, hours, staff scheduled, avg cost/hour — with week-over-week delta",
        "Coverage banner showing days-met against your minimum rules",
        "CSV, PDF, and Word exports (weekly / monthly / custom range)",
      ],
    },
    {
      title: "Configuration",
      features: [
        "Industry presets (cafe, restaurant, retail, healthcare, allied health, clinic)",
        "Minimum staff per day + optional required role (e.g. \"at least 1 Supervisor\")",
        "Overtime threshold (38h default) and penalty target %",
        "Manager contact (phone / email) shown on staff portal for quick call/email",
        "Staff qualifications, junior flag, professional registration # — stored for reference",
      ],
    },
  ];
  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="What's in the box"
        title="Everything RosterMate does today"
        sub="No gated modules. Nothing on the feature list is hidden behind a higher plan."
      />
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="text-sm font-bold uppercase tracking-wider text-teal-600">
              {g.title}
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              {g.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span
                    className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                    aria-hidden
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Differentiators() {
  const items = [
    {
      title: "Staff access without an app or account",
      body: "Every rostering tool we checked — Deputy, Tanda, RosterElf, Findmyshift, When I Work, Humanity, Sling — requires staff to install an app or register an account before they can see their shifts. RosterMate uses a rotatable tokenised URL. You text it once; they open it on whatever phone they have. Lower onboarding friction for casual staff, less IT overhead for you.",
    },
    {
      title: "Approvals that show the consequence",
      body: "When a staff member asks for Thursday off, the manager sees a panel: the at-risk shift, everyone else scheduled that day, everyone who is free to cover (ranked by same role, whether that day is their preferred day off, and hours worked this week), and — if you've set coverage rules — whether approving would drop the day below minimum. Decide with context, not guesswork.",
    },
    {
      title: "Honest about what it can't do",
      body: "RosterMate ships with a generic award-loading model, not a licensed Fair Work award database. If you need exact interpretation of the Restaurant Industry Award or Hospitality Industry (General) Award down to the clause, Deputy, Tanda, or RosterElf maintain those libraries. RosterMate surfaces a disclaimer and leaves the manager responsible — we'd rather under-promise than be the reason for a payroll error.",
    },
    {
      title: "Lean product, lean price shape",
      body: "No per-user pricing curve, no paywalled integrations, no seat-minimum. Pricing will match the scope — single-site, single-manager, web-first — rather than forcing SMBs to buy mid-market features they don't need.",
    },
  ];
  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="Why it's different"
        title="Four things RosterMate does that most alternatives don't"
        sub="Based on public research across Deputy, Tanda, RosterElf, Findmyshift, When I Work, Humanity, and Sling — sourced in the comparison table below."
      />
      <div className="mt-8 space-y-4">
        {items.map((it, i) => (
          <div
            key={it.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-bold text-teal-600">
                0{i + 1}
              </span>
              <h3 className="text-lg font-semibold text-slate-900">
                {it.title}
              </h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

type Row = {
  label: string;
  values: Record<string, string>;
  note?: string;
};

function ComparisonTable() {
  const products = [
    "RosterMate",
    "Deputy",
    "Tanda",
    "RosterElf",
    "Findmyshift",
    "When I Work",
  ];
  const rows: Row[] = [
    {
      label: "Based in",
      values: {
        RosterMate: "Australia",
        Deputy: "Australia (Sydney)",
        Tanda: "Australia (Brisbane)",
        RosterElf: "Australia (Sydney)",
        Findmyshift: "United Kingdom",
        "When I Work": "United States",
      },
    },
    {
      label: "Starting price",
      values: {
        RosterMate: "TBD",
        Deputy: "A$6.75 / user / mo (Lite)",
        Tanda: "A$12.80 / user / mo bundle",
        RosterElf: "A$6 / user / mo (annual)",
        Findmyshift: "A$27 / mo flat (up to 20 staff)",
        "When I Work": "US$2.50 / user / mo",
      },
      note: "Published as of April 2026. Most vendors list ex-GST; verify on their pricing page.",
    },
    {
      label: "Free tier",
      values: {
        RosterMate: "Pending",
        Deputy: "No",
        Tanda: "No",
        RosterElf: "15-day trial",
        Findmyshift: "Yes — up to 5 staff, 1 manager",
        "When I Work": "14-day trial",
      },
    },
    {
      label: "AU modern award interpretation",
      values: {
        RosterMate: "Generic model (disclosed)",
        Deputy: "Yes — advertised on pricing page",
        Tanda: "Yes — 30+ award templates maintained in-house",
        RosterElf: "Yes — built-in",
        Findmyshift: "Not advertised",
        "When I Work": "Not advertised",
      },
      note: "\"Generic model\" = casual + weekend + night loading + break deduction applied by rule, not from a licensed Fair Work data feed.",
    },
    {
      label: "Built-in time clock",
      values: {
        RosterMate: "No",
        Deputy: "Yes (with geofencing)",
        Tanda: "Yes (photo / kiosk)",
        RosterElf: "Yes",
        Findmyshift: "Yes",
        "When I Work": "Yes",
      },
    },
    {
      label: "Payroll export",
      values: {
        RosterMate: "CSV, PDF, Word",
        Deputy: "Xero, MYOB integrations",
        Tanda: "Built-in payroll module",
        RosterElf: "Xero, MYOB exports",
        Findmyshift: "Basic reports",
        "When I Work": "Integrations (US-centric)",
      },
    },
    {
      label: "Staff needs an app or account",
      values: {
        RosterMate: "No — private URL",
        Deputy: "Yes",
        Tanda: "Yes",
        RosterElf: "Yes",
        Findmyshift: "Yes",
        "When I Work": "Yes",
      },
      note: "Verified on each vendor's onboarding or help documentation.",
    },
    {
      label: "Coverage impact on approvals",
      values: {
        RosterMate: "Yes — shown before approve",
        Deputy: "Not publicly documented",
        Tanda: "Not publicly documented",
        RosterElf: "Not publicly documented",
        Findmyshift: "No",
        "When I Work": "No",
      },
      note: "Absence on public sites ≠ absence in product. Happy to be corrected.",
    },
    {
      label: "Multi-site",
      values: {
        RosterMate: "Single-site",
        Deputy: "Yes",
        Tanda: "Yes",
        RosterElf: "Yes",
        Findmyshift: "Limited",
        "When I Work": "Yes",
      },
    },
  ];

  return (
    <section id="comparison" className="mb-16">
      <SectionHeading
        eyebrow="Honest comparison"
        title="How RosterMate stacks up"
        sub={`All competitor data sourced from vendor pricing pages or third-party reviews (${COMPARISON_LAST_UPDATED}). We'd rather flag a gap than invent a win — where a competitor is stronger, the table says so.`}
      />

      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-500">
                Feature
              </th>
              {products.map((p) => (
                <th
                  key={p}
                  className={`px-4 py-3 text-left font-semibold ${
                    p === "RosterMate" ? "text-teal-700" : "text-slate-700"
                  }`}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-slate-100 last:border-b-0 align-top"
              >
                <td className="sticky left-0 bg-white px-4 py-3 font-medium text-slate-700">
                  {row.label}
                  {row.note && (
                    <div className="mt-1 text-[11px] font-normal italic text-slate-500">
                      {row.note}
                    </div>
                  )}
                </td>
                {products.map((p) => (
                  <td
                    key={p}
                    className={`px-4 py-3 ${
                      p === "RosterMate"
                        ? "bg-teal-50/40 font-medium text-slate-900"
                        : "text-slate-700"
                    }`}
                  >
                    {row.values[p] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <strong>Reading the table honestly.</strong> Deputy and Tanda both run
        larger product teams than RosterMate and have maintained AU award
        libraries. If your compliance exposure is high (mid-size hospitality,
        multi-site retail, aged care) and you can afford the per-user pricing,
        they are the stronger choice on compliance. RosterMate's case is for
        owner-operators who value simplicity, a no-login staff surface, and
        honest cost modelling over enterprise depth.
      </div>

      <Sources />
    </section>
  );
}

function Sources() {
  const sources: { name: string; url: string }[] = [
    { name: "Deputy AU pricing", url: "https://www.deputy.com/au/pricing" },
    {
      name: "Deputy award interpretation",
      url: "https://www.deputy.com/au/award-interpretation",
    },
    { name: "Tanda pricing", url: "https://www.tanda.com.au/pricing/" },
    {
      name: "Tanda award interpretation",
      url: "https://www.tanda.com.au/features/industry-award-interpretation",
    },
    { name: "RosterElf pricing", url: "https://rosterelf.com/pricing" },
    {
      name: "Findmyshift AU pricing",
      url: "https://www.findmyshift.com/au/pricing",
    },
    {
      name: "Findmyshift staff login docs",
      url: "https://www.findmyshift.com/au/help/ive-been-added-to-a-staff-roster-how-do-i-log-in-to-check-my-shifts",
    },
    { name: "When I Work pricing", url: "https://wheniwork.com/pricing" },
  ];
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-700">
        Sources ({COMPARISON_LAST_UPDATED})
      </summary>
      <ul className="mt-3 space-y-1.5">
        {sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-teal-700 underline-offset-2 hover:underline"
            >
              {s.name}
            </a>{" "}
            <span className="text-slate-400">— {s.url}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] italic text-slate-500">
        Pricing and feature claims on vendor pages change frequently. Verify the
        day you need to make a decision. If a cell in the table turns out to be
        wrong, we will fix it.
      </p>
    </details>
  );
}

function Roadmap() {
  const items: { label: string; detail: string }[] = [
    {
      label: "Licensed Fair Work award data",
      detail:
        "Today RosterMate uses a generic loading model. A licensed award data feed is on the roadmap; until then, verify against your award.",
    },
    {
      label: "Public holiday pay multiplier (automatic)",
      detail:
        "Public holidays are displayed on the grid. The public-holiday penalty rate isn't auto-applied yet — it's flagged in the shift editor for you to handle.",
    },
    {
      label: "Junior rate tables",
      detail:
        "RosterMate flags junior staff but doesn't auto-apply junior % rates. You set the base rate manually.",
    },
    {
      label: "State/territory-specific public holidays",
      detail:
        "National set only. State observances (Labour Day, Show Day, Queen's Birthday variants) aren't yet wired in.",
    },
    {
      label: "Built-in time clock / geofencing",
      detail:
        "RosterMate doesn't clock staff in or out. If you need attendance proof, pair it with a dedicated clock, or use a competitor that ships one.",
    },
    {
      label: "Native payroll integrations",
      detail:
        "Exports are CSV / PDF / Word. Direct Xero or MYOB sync is not shipped.",
    },
    {
      label: "Native mobile app",
      detail:
        "The staff portal is a responsive web page. It works on any phone browser and can be added to the home screen, but there's no iOS/Android app store listing.",
    },
    {
      label: "Multi-site / multi-business",
      detail:
        "One business per install. Owning multiple sites today means multiple installs.",
    },
    {
      label: "SMS / push notifications",
      detail:
        "The staff portal polls every 15 seconds while open. No push or SMS to alert staff when a request is resolved.",
    },
  ];
  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="The honest bit"
        title="What RosterMate doesn't do yet"
        sub="A deliberate list, not an accident. We'd rather you find out now than in month two."
      />
      <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-sm font-semibold text-slate-900">
              {it.label}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {it.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WhoFor() {
  return (
    <section className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
        <div className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          Good fit
        </div>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-800">
          <li>• 2–30 staff on a single site</li>
          <li>
            • Cafes, restaurants, retail, allied health, small clinics,
            pharmacies
          </li>
          <li>• Owner-operator or single manager building the weekly roster</li>
          <li>
            • Value staff having instant schedule access over "enterprise
            workforce management"
          </li>
          <li>• Casual-heavy team where account-based apps feel like friction</li>
          <li>• Exporting to an accountant or bookkeeper, not running payroll in-app</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
        <div className="text-sm font-bold uppercase tracking-wider text-slate-600">
          Not a fit (yet)
        </div>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-800">
          <li>• Multi-location chains needing centralised rostering</li>
          <li>• Businesses that need payroll processing in the same tool</li>
          <li>
            • HR teams requiring SSO, audit logs, role-based permissions
          </li>
          <li>
            • Complex award structures that need a maintained data feed today
          </li>
          <li>• Need built-in time clock / geofenced sign-in</li>
        </ul>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section
      id="see-it"
      className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-8 shadow-sm sm:p-12"
    >
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-sm font-bold uppercase tracking-wider text-teal-700">
          Ready to see it in action
        </div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Book a 20-minute demo
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          We'll build a live roster with your week's shifts, text you the staff
          portal link to open on your phone, and walk through a swap + time-off
          approval loop end-to-end. No slide deck. No pressure.
        </p>
        <div className="mt-2 text-sm text-slate-500">
          Pricing details coming with the demo.
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600"
          >
            Open the dashboard →
          </Link>
          <a
            href="mailto:hannah@opdee.com?subject=RosterMate%20demo"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Email to book a demo
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-sm font-bold uppercase tracking-wider text-teal-600">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          {sub}
        </p>
      )}
    </div>
  );
}
