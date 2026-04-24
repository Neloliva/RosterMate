import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RosterMate · History — what we've built so far",
  description:
    "Chronological log of changes shipped to RosterMate, grouped into three phases.",
  robots: { index: false, follow: false },
};

type Entry = {
  sha: string;
  date: string;
  title: string;
  summary: string;
  bullets: string[];
};

type Phase = {
  number: 1 | 2 | 3;
  theme: string;
  subtitle: string;
  period: string;
  tone: "emerald" | "teal" | "slate";
  entries: Entry[];
};

const PHASES: Phase[] = [
  {
    number: 1,
    theme: "Build the planning tool",
    subtitle:
      "The manager-facing foundation: weekly roster, award-aware costing, and the scaffolding (reports, settings, staff) that a small business needs before any staff ever touch the product.",
    period: "21 April 2026",
    tone: "emerald",
    entries: [
      {
        sha: "9f6806e",
        date: "2026-04-21",
        title: "Initial commit — RosterMate dashboard",
        summary:
          "The seed version: everything the manager needs to build a week's roster end-to-end.",
        bullets: [
          "Weekly roster grid with drag-and-drop shift assignment",
          "Monthly view for longer-range planning",
          "Award engine — casual loading, weekend and night penalty rates, automatic break deduction at 5h and 9h",
          "Shift editor modal with real-time cost breakdown before saving",
          "KPI cards (total labor cost, staff hours, headcount, avg cost/hour)",
          "Smart Insights flagging overtime risk, thin coverage, and high penalty loading",
          "Cost optimizer suggestions for the biggest weekly savings",
          "SQLite + drizzle-orm for local persistence",
        ],
      },
      {
        sha: "a17b1d6",
        date: "2026-04-21",
        title: "Copy-schedule action with last-week or last-month",
        summary:
          "Seed a new week quickly by duplicating a previous one, behind a confirm dialog because it overwrites.",
        bullets: [
          "Copy last week: fills empty cells from the prior 7 days, leaves existing shifts alone",
          "Copy last month: 4 weeks from 4 weeks ago, mapped onto the current 4 weeks",
          "Soft-deleted staff are skipped so removed people don't reappear",
          "Destructive operation — confirm dialog before any writes",
        ],
      },
      {
        sha: "5706af0",
        date: "2026-04-21",
        title: "PDF and Word report exports",
        summary:
          "Hand the weekly or monthly roster to the accountant in the format they want, no screenshots.",
        bullets: [
          "Download dropdown: CSV, PDF, Word",
          "PDF via jsPDF + jspdf-autotable",
          "Word via the HTML-blob-as-.doc trick (zero extra dependencies)",
          "Weekly, monthly, or custom date range scopes",
        ],
      },
      {
        sha: "5246574",
        date: "2026-04-21",
        title: "Staff editor with industry templates and qualifications",
        summary:
          "The staff form grows from a name + rate into a full profile — but honestly, without the \"122 awards\" marketing badge we trimmed in the same pass.",
        bullets: [
          "Role catalog per business type (cafe, restaurant, retail, allied health, clinic, healthcare)",
          "Qualifications checklist (RSA, RSG, First Aid, Food Safety, AHPRA-registered, etc.)",
          "Optional age + junior-employee flag, with age-based auto-detection",
          "Professional registration number (AHPRA, RNs, pharmacists) as free text",
          "Softened the compliance claim: now \"Built for Australian award compliance\" with a tooltip pointing at the DEFERRED list — no overreach",
        ],
      },
      {
        sha: "cbbbfe4",
        date: "2026-04-21",
        title: "Business Settings with per-industry defaults",
        summary:
          "One dialog for the numbers that drive insights and thresholds, with sensible starting points for each industry.",
        bullets: [
          "Penalty target % and overtime-hours threshold, with inline warnings for unusual values",
          "Default roster view (week / month)",
          "Industry switcher — pre-fills thresholds from sensible defaults when changed",
          "Manager contact phone + email, optional, shown on the staff portal later",
        ],
      },
    ],
  },
  {
    number: 2,
    theme: "Bring staff into the product",
    subtitle:
      "Everything about making RosterMate a two-sided tool: staff can see their roster and file requests, the manager can approve with context, and the app knows enough to help decide.",
    period: "22 – 23 April 2026",
    tone: "teal",
    entries: [
      {
        sha: "0ff04d6",
        date: "2026-04-22",
        title: "Australian national public holidays on the grid",
        summary:
          "🎉 tags on holiday dates so roster planning respects what the team won't want to work. Pay multiplier stays manual for now.",
        bullets: [
          "National holidays for multiple years computed in-code (Easter via Gauss's algorithm, fixed-date holidays, ANZAC Day, Queen's Birthday)",
          "Holiday cells render a 🎉 tag on the grid and staff portal",
          "Deliberately display-only — automatic public-holiday pay multiplier is tracked in Bucket A of the roadmap",
          "State/territory-specific holidays also deferred — the national set covers the common case",
        ],
      },
      {
        sha: "f7b28a3",
        date: "2026-04-22",
        title: "Staff edit + soft-delete with historical preservation",
        summary:
          "\"Remove staff\" stops wiping history. Removed people keep their past shifts, just no longer show up for new rostering.",
        bullets: [
          "Edit existing staff: name, role, employment type, base rate, qualifications, age, junior flag",
          "Soft delete — is_active flag flipped, DB row preserved",
          "Removed staff appear greyed out in weeks they had shifts, hidden in weeks they didn't",
          "Copy-last-week and Copy-last-month skip inactive staff so removed people don't re-appear",
          "Reusable ConfirmDialog for every destructive action across the app",
        ],
      },
      {
        sha: "f5ae8d7",
        date: "2026-04-23",
        title: "Staff portal, request approvals, and minimum-staff coverage rules",
        summary:
          "The biggest ship in the project so far — RosterMate becomes a two-sided product with decision intelligence baked in.",
        bullets: [
          "Staff portal at /staff/[token] — private URL per staff, no login, no app install",
          "Today and Tomorrow hero cards, full 4-week view, one-tap \"I'm sick today\"",
          "Swap and time-off request flows from the staff portal",
          "Manager-owned preferences (agreed schedule, preferred days off, preferred shift) — moved out of the staff portal so it's planning, not conflict",
          "Notification bell in the dashboard header with count badge and popover",
          "Approve / Decline replace the old single \"Resolve\" — approving time off auto-deletes the shift behind a confirm",
          "Request impact panel: at-risk shift, others working that day, candidates who could cover (ranked by role, preferred day off, hours this week)",
          "Minimum-staff coverage rules: per-day headcount + optional \"at least N of role X\"",
          "Coverage banner on the dashboard, coverage-delta line on approvals, below-minimum insight in Smart Insights",
          "15-second visible-tab polling on both surfaces as a pragmatic stand-in for realtime push",
        ],
      },
      {
        sha: "d54c2aa",
        date: "2026-04-23",
        title: "Dim past days on the roster and warn before editing history",
        summary:
          "Soft friction on past-date edits — the kind that prevents accidental rewrites without blocking legitimate corrections.",
        bullets: [
          "Past-day columns on the weekly and monthly views render dimmed (opacity-60)",
          "Shift editor shows an amber banner when the selected day is in the past",
          "Drag-drop into a past cell triggers a confirm dialog",
          "Today is treated as present (no warning); yesterday and earlier is past",
          "Deliberately no hard lock — corrections (shift ran long, forgot to mark unavailable) still possible",
        ],
      },
      {
        sha: "bd57c27",
        date: "2026-04-23",
        title: "My requests card, resolution banners, and copy fixes",
        summary:
          "Staff-side feedback loop: the status of what you asked for is always visible at the top, not 4 weeks down-scroll.",
        bullets: [
          "My requests card: pending + resolved-in-48h, collapsible. Pending visible by default; resolved collapses behind \"Show N resolved\". All-caught-up state collapses the whole card.",
          "Dismissible per-resolution banners — \"Time off request approved\" / \"declined — 'Already short'\" — with a localStorage seen-set per token so each shows once",
          "Copy cleanup: \"Unavailable report\" → \"Time off request\" across toast, chip, dialog, and button labels (unifying vocabulary on both sides)",
          "Gating fix: same-type action button hidden for 48h after a decline so staff don't re-submit",
          "Today hero card gets a subtle teal tint so it reads as \"matters now\" at a glance",
        ],
      },
    ],
  },
  {
    number: 3,
    theme: "Position and document",
    subtitle:
      "The work that takes RosterMate from \"thing we built\" to \"thing we can show people.\" Public landing page with real screenshots, internal roadmap so the next engineer knows what's up.",
    period: "23 April 2026",
    tone: "slate",
    entries: [
      {
        sha: "0854c61",
        date: "2026-04-23",
        title: "Add /about pitch page with real screenshots and sourced competitor table",
        summary:
          "A page for a business owner about to see a demo. Honest copy, real product shots, and competitor comparisons cited from vendor pricing pages — no fabricated claims.",
        bullets: [
          "Hero, 3-card pitch, full feature inventory by area, 4 honest differentiators",
          "Product tour with 3 live screenshots: dashboard, notification popover (showing the coverage breach in action), mobile staff portal",
          "Comparison table vs Deputy, Tanda, RosterElf, Findmyshift, When I Work — every row sourced, April 2026 disclaimer, explicitly calling out where competitors are stronger",
          "\"What RosterMate doesn't do yet\" section — 9 real gaps, honest roadmap framing",
          "Good-fit / not-a-fit cards and a 20-minute demo CTA",
          "puppeteer-core added as a dev dependency so future modal/popover screenshots can be scripted (uses system Chrome, no Chromium download)",
          "Reusable scripts/screenshot-popover.mjs for regenerating the notification popover shot",
        ],
      },
      {
        sha: "491debb",
        date: "2026-04-23",
        title: "Add /DevHelp internal planning page with Bucket A roadmap",
        summary:
          "The planning doc to take to Hannah. Bucket A prioritised (ship now, product shape unchanged); Bucket B called out as strategic decisions, not sprints.",
        bullets: [
          "Bucket A in priority order: public holiday multiplier, junior rate override, email notifications, state holidays, PWA, Web Push, licensed Fair Work award data",
          "Each item has what / why / how (with file paths, column names, libraries) / effort / dependencies",
          "TL;DR: ~6–9 weeks of focused dev for one engineer to ship all of Bucket A",
          "3-phase sequencing (quick-wins → loop-closers → award data)",
          "Bucket B deferrals: time clock, native payroll, multi-site, React Native — each with the reason it's not planned work",
          "Out-of-scope list (SOC 2, AI features, AHPRA integration) to forestall scope creep",
        ],
      },
    ],
  },
];

function toneStyles(tone: Phase["tone"]) {
  const variants: Record<
    Phase["tone"],
    {
      wrapperBorder: string;
      dotBg: string;
      badgeBg: string;
      badgeText: string;
      headingText: string;
    }
  > = {
    emerald: {
      wrapperBorder: "border-emerald-200",
      dotBg: "bg-emerald-500",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-800",
      headingText: "text-emerald-700",
    },
    teal: {
      wrapperBorder: "border-teal-200",
      dotBg: "bg-teal-500",
      badgeBg: "bg-teal-50",
      badgeText: "text-teal-800",
      headingText: "text-teal-700",
    },
    slate: {
      wrapperBorder: "border-slate-300",
      dotBg: "bg-slate-700",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-800",
      headingText: "text-slate-700",
    },
  };
  return variants[tone];
}

export default function HistoryPage() {
  const totalEntries = PHASES.reduce((sum, p) => sum + p.entries.length, 0);
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
      <Header totalEntries={totalEntries} />
      {PHASES.map((phase) => (
        <PhaseSection key={phase.number} phase={phase} />
      ))}
      <Footer />
    </main>
  );
}

function Header({ totalEntries }: { totalEntries: number }) {
  return (
    <header className="mb-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white">
          R
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            RosterMate · History
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {totalEntries} changes shipped across 3 phases
          </div>
        </div>
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        What we&apos;ve built so far
      </h1>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
        A chronological record of every change shipped to RosterMate,
        reconstructed from the git log. Grouped into three phases that
        roughly describe what the product was becoming at each point:
        a planning tool, then a two-sided product, then something you can
        show to other people.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        What&apos;s next lives in{" "}
        <Link href="/DevHelp" className="text-teal-700 underline-offset-2 hover:underline">
          /DevHelp
        </Link>{" "}
        — the prioritised Bucket A roadmap.
      </p>
    </header>
  );
}

function PhaseSection({ phase }: { phase: Phase }) {
  const tone = toneStyles(phase.tone);
  return (
    <section className={`mb-16`}>
      <div
        className={`mb-6 rounded-2xl border ${tone.wrapperBorder} ${tone.badgeBg} p-5`}
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={`inline-flex h-7 items-center rounded-full ${tone.dotBg} px-3 text-xs font-bold uppercase tracking-wider text-white`}
          >
            Phase {phase.number}
          </span>
          <h2 className={`text-2xl font-bold tracking-tight ${tone.headingText}`}>
            {phase.theme}
          </h2>
          <span className="ml-auto text-xs font-medium text-slate-500">
            {phase.period}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {phase.subtitle}
        </p>
      </div>

      <ol className="space-y-4">
        {phase.entries.map((entry, idx) => (
          <Entry
            key={entry.sha}
            entry={entry}
            number={idx + 1}
            dot={tone.dotBg}
          />
        ))}
      </ol>
    </section>
  );
}

function Entry({
  entry,
  number,
  dot,
}: {
  entry: Entry;
  number: number;
  dot: string;
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-3">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dot} text-xs font-bold text-white`}
        >
          {number}
        </span>
        <h3 className="text-lg font-semibold text-slate-900">{entry.title}</h3>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-slate-500">
          <span>{entry.date}</span>
          <span className="font-mono text-[11px] text-slate-400">·</span>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            {entry.sha}
          </code>
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {entry.summary}
      </p>
      <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
        {entry.bullets.map((b, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm leading-relaxed text-slate-700"
          >
            <span
              className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
              aria-hidden
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Footer() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-sm leading-relaxed text-slate-700">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Where to look next
      </div>
      <ul className="space-y-1.5">
        <li>
          •{" "}
          <Link href="/" className="font-medium text-teal-700 underline-offset-2 hover:underline">
            /
          </Link>{" "}
          — the live manager dashboard
        </li>
        <li>
          •{" "}
          <Link
            href="/about"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            /about
          </Link>{" "}
          — the pitch page with screenshots and competitor comparison
        </li>
        <li>
          •{" "}
          <Link
            href="/DevHelp"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            /DevHelp
          </Link>{" "}
          — what&apos;s next: Bucket A roadmap in priority order
        </li>
      </ul>
    </section>
  );
}
