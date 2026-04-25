import type { Metadata } from "next";
import { PageNav } from "@/components/PageNav";

export const metadata: Metadata = {
  title: "RosterMate · Project Plan",
  description:
    "Where RosterMate is going and why. Strategic plan grounded in leadership input.",
  robots: { index: false, follow: false },
};

const LAST_UPDATED = "25 April 2026";

export default function ProjectPlanPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
      <PageNav current="projectplan" />
      <Header />
      <Thesis />
      <StrategicDirection />
      <StrategicBets />
      <FrameworkDecision />
      <NinetyDayPlan />
      <NotDoing />
      <OpenQuestions />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="mb-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white">
          R
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            RosterMate · Project Plan
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Strategic plan · 12-month horizon
          </div>
        </div>
      </div>
      <h1 className="mt-7 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Where RosterMate is going, and why.
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
        Until now we&apos;ve built RosterMate one feature at a time. This page
        is the foundation document — what we&apos;re becoming, what we&apos;re
        not, and the calls we&apos;re making early so we don&apos;t have to
        rebuild later.
      </p>
    </header>
  );
}

function Thesis() {
  return (
    <section className="mb-12 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        The thesis
      </div>
      <p className="text-lg leading-relaxed text-slate-800">
        RosterMate stops being a small-business roster <em>tool</em> and becomes
        a <span className="font-semibold text-teal-700">platform</span> that
        small businesses, accountants, and adjacent software vendors plug into
        for compliant, low-friction workforce planning — backed by{" "}
        <span className="font-semibold text-teal-700">human support</span> as
        the differentiator nobody else can copy cheaply.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        The product is the same. The shape changes. We design every flow from
        today onward as if a third party will plug into it, and as if a real
        person will answer when something goes wrong.
      </p>
    </section>
  );
}

function StrategicDirection() {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Strategic direction from leadership
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Source quotes
        </span>
      </div>
      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-slate-600">
        Three inputs from leadership shape this plan. Each is included
        verbatim, with the operational interpretation set out directly
        underneath. The goal is to engage with each prompt substantively —
        extending the implications and naming the trade-offs — rather than
        filing them as standalone directives.
      </p>
      <div className="space-y-4">
        <Quote
          author="Leadership input"
          text="I would change the code base slightly to allow plugin integration. It could be a plugin integration with a web app front. You just need to think bigger."
          takeaway="Treats RosterMate as a platform with potentially several frontends, not a single web product. The web app remains one client among others. Translated into Bet 1 (Platform, not product) below."
        />
        <Quote
          author="Leadership input"
          text="Make sure this is baked into the solution from the beginning and it will give you the advantage."
          takeaway="Architectural posture: design now is cheap, retrofit later is expensive. Applied throughout — to the plugin contract layer, the service model, and the framework decision."
        />
        <Quote
          author="Leadership input (earlier discussion, paraphrased)"
          text="Service-as-a-Software, with support as the moat. Consider Svelte for the front-end."
          takeaway="Three distinct prompts. The service framing informs Bet 2 (Service-as-a-Software). Support as differentiator informs Bet 3 (Support is the moat). The framework recommendation is addressed under Decision: migrate to Svelte."
        />
      </div>
    </section>
  );
}

function Quote({
  author,
  text,
  takeaway,
}: {
  author: string;
  text: string;
  takeaway: string;
}) {
  return (
    <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <blockquote className="text-base leading-relaxed text-slate-800">
        <span className="mr-1 text-2xl leading-none text-slate-400">“</span>
        {text}
        <span className="ml-1 text-2xl leading-none text-slate-400">”</span>
      </blockquote>
      <figcaption className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        — {author}
      </figcaption>
      <div className="mt-3 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-800">Takeaway: </span>
        {takeaway}
      </div>
    </figure>
  );
}

type Bet = {
  number: number;
  title: string;
  oneLiner: string;
  whyNow: string;
  whatItLooksLike: string[];
  whatWeWontDo: string;
};

const BETS: Bet[] = [
  {
    number: 1,
    title: "Platform, not product",
    oneLiner:
      "Design every flow as if a third party will plug into it. Treat the web app as one client of an internal API.",
    whyNow:
      "Retrofitting plugin support is expensive — it forces a rewrite of every server action and tightly-coupled UI assumption. Designing for it from now on costs almost nothing extra per feature, while unlocking Xero, MYOB, Square POS, accountant tooling, and white-label opportunities later. The leadership prompt to change the codebase 'slightly' for plugin integration is the right time to start; the cost only grows from here.",
    whatItLooksLike: [
      "Every new server action gets a stable, versioned shape (request/response types in src/lib/api-contracts/) before the UI consumes it. The UI is one consumer.",
      "Read endpoints (rosters, staff, requests) get exposed as authenticated REST routes by Q3 — built thin on top of existing Drizzle queries.",
      "Webhook layer for outbound events (request approved, shift published, coverage breach) lands the moment we have one external system asking for it. Not before.",
      "API key + scoped permissions land alongside the first webhook. Plugin SDK doesn't.",
      "Documented extension points (custom award rules, custom report exporters) — even if the only \"plugin\" today is internal.",
    ],
    whatWeWontDo:
      "We do not write a public plugin SDK in 2026. The leadership prompt to change the codebase 'slightly' is read as: make plugins possible, not build a marketplace. Distribution, versioning, sandboxing, and developer marketing are downstream work — they wait until at least one external plugin exists and is asking for the surface.",
  },
  {
    number: 2,
    title: "Service-as-a-Software",
    oneLiner:
      "Customers pay for the outcome — a correct, compliant, low-friction roster every week — not for access to a tool.",
    whyNow:
      "A tool is replaceable in 30 minutes. A managed service is sticky for years. The unit economics also favour us: software margin + service premium, and customers actually want the help.",
    whatItLooksLike: [
      "White-glove onboarding: we set up the first month's rosters with the customer, not for them. Builds the habit + reveals award nuances per business.",
      "Weekly accuracy report: automated email summarising hours, projected payroll, coverage gaps, and any compliance notes. Already 80% buildable from existing data.",
      "Pay-period review: we (humans) audit the roster against the award before payroll runs. Optional add-on initially. Becomes the support moat in practice.",
      "Pricing reflects this: tool tier (cheap, self-serve) + service tier (premium, includes review). Stop framing as \"subscription to software\".",
      "All copy on the site reframes — not \"build rosters fast\" but \"correct rosters, every week, with someone who picks up the phone.\"",
    ],
    whatWeWontDo:
      "We don't pretend to be a fully-managed service in 2026. We start with one premium customer, learn what \"managed\" actually costs in hours, then decide if it scales. If it doesn't, we keep it as a high-trust onboarding experience and not a recurring service.",
  },
  {
    number: 3,
    title: "Support is the moat",
    oneLiner:
      "Human reply within 1 business hour. Named contact per customer. Published response SLA. No chatbot.",
    whyNow:
      "Software is commoditised — Deputy, Tanda, RosterElf all do roughly the same thing, all hide behind a help-desk queue. \"Someone real, fast\" is a moat that scales linearly with customers but commands a premium and creates referrals. It's also the single thing competitors with 100+ employees structurally can't copy at our price point.",
    whatItLooksLike: [
      "Published SLA on the site: 1 business hour first reply, named contact, no offshore queue. We commit to it publicly.",
      "Every customer has a single point of contact (the founder, while we're small). Their email + direct number is in the app.",
      "Support inbox lives in front of the team — not buried behind a Zendesk wall. Read it daily. Reply same day.",
      "First-month customer reviews: scheduled check-in call at week 4 with every new customer. 30 minutes. We listen.",
      "Public response-time stats once we have enough data. Honesty over polish.",
    ],
    whatWeWontDo:
      "No AI chatbot first-line. No tiered support gates. No 'open a ticket' copy. The differentiator only holds if it isn't diluted with deflection layers — every layer between the customer and a real person erodes the moat the strategy depends on.",
  },
  {
    number: 4,
    title: "Compliance is table stakes",
    oneLiner:
      "Cost calculations have to be right. Wrong rates create underpayment claims. This is the floor, not the ceiling.",
    whyNow:
      "We can talk all we want about platform and service, but if a manager publishes a roster and discovers we underpaid by 12% on Sundays, none of it matters. Bucket A items 1, 4, and 7 are the items that make us trustworthy enough for the rest of the strategy to land.",
    whatItLooksLike: [
      "Public holiday multiplier ships first (Bucket A #1). Stops the silent-undercount on the highest-loaded days.",
      "State-specific holidays land before any marketing push beyond the local market (Bucket A #4).",
      "Licensed Fair Work award data — decision in Q3 between licensing and curating five priority awards manually (Bucket A #7).",
      "\"Indicative only\" disclaimer stays prominent until award data lands. Honest framing > optimistic framing.",
      "Every compliance change ships with an entry in /history so customers can audit when their cost basis changed.",
    ],
    whatWeWontDo:
      "We do not claim Fair Work compliance until we have licensed or curated data. The disclaimer goes everywhere it needs to go. We'd rather convert fewer prospects than face an underpayment claim.",
  },
];

function StrategicBets() {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Four strategic bets
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Baked in from now
        </span>
      </div>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-600">
        Each bet sets out the underlying reasoning, the operational changes
        starting from now, and what is deliberately excluded. The exclusions
        carry as much weight as the commitments — naming what the plan does
        not pursue is how the four bets stay coherent over a 12-month
        horizon.
      </p>
      <div className="space-y-5">
        {BETS.map((bet) => (
          <BetCard key={bet.number} bet={bet} />
        ))}
      </div>
    </section>
  );
}

function BetCard({ bet }: { bet: Bet }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {bet.number}
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">
          {bet.title}
        </h3>
      </div>
      <p className="mt-3 text-base leading-relaxed text-slate-800">
        {bet.oneLiner}
      </p>

      <FieldGroup label="Why now">
        <p className="text-sm leading-relaxed text-slate-700">{bet.whyNow}</p>
      </FieldGroup>

      <FieldGroup label="What it looks like">
        <ul className="space-y-1.5">
          {bet.whatItLooksLike.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span
                className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </FieldGroup>

      <FieldGroup label="What we won't do">
        <p className="text-sm leading-relaxed text-slate-700">
          {bet.whatWeWontDo}
        </p>
      </FieldGroup>
    </article>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function FrameworkDecision() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Decision: migrate to Svelte
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        SvelteKit was identified by leadership as the preferred long-term
        framework. After weighing the migration cost against the
        architectural fit, the call is to move off Next.js. This section
        locks the decision in writing so the migration plan, the 90-day
        plan, and the Bucket A schedule remain consistent with it.
      </p>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800">
            Decision
          </span>
          <h3 className="text-xl font-semibold text-slate-900">
            Migrate from Next.js to SvelteKit. Bake the plugin architecture in
            on the way over.
          </h3>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Why
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
                <span>
                  The framework recommendation arrived alongside the broader
                  &quot;think bigger&quot; and &quot;bake it in from the
                  beginning&quot; guidance. The two are mutually reinforcing
                  — migrating before the codebase grows further is both
                  cheaper than retrofitting and consistent with the
                  architectural posture leadership has set.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
                <span>
                  Smaller bundle, simpler reactivity model, and lighter runtime
                  match a tool that runs on small-business phones with patchy
                  connections.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
                <span>
                  Cleaner separation between server endpoints (SvelteKit
                  +form actions / +server.ts) and the UI — easier to expose
                  the same endpoints to plugins later.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
                <span>
                  Most of our value lives in src/lib (award engine, types,
                  public holidays, auth, leave categories) and the Drizzle
                  schema — all framework-agnostic. The rewrite is largely
                  porting the UI shell, not re-doing the brain.
                </span>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Honest cost
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                <span>
                  Bucket A items 1 (public-holiday multiplier) and 2 (junior
                  rate) — the biggest payroll-accuracy fixes — get pushed
                  ~30–60 days while the foundation ports. Manager keeps the
                  &quot;indicative only&quot; disclaimer for that window.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                <span>
                  Hiring narrows: more devs can ship Next.js than Svelte. Not
                  a 2026 problem at one engineer, but worth noting.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                <span>
                  Risk: rewrites always take longer than planned. The 90-day
                  plan below assumes the optimistic path. Add ~30% buffer for
                  reality.
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 border-t border-amber-200 pt-5">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              What ports cleanly
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>src/lib/* — award engine, types, public holidays, auth, leave categories</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Drizzle schema and migrations (better-sqlite3 driver works in any Node runtime)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Tailwind classes — same utility CSS works in Svelte</span>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              What gets re-implemented
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span>All React components (manager dashboard, staff portal, dialogs, notifications bell)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span>Server actions → SvelteKit form actions / +server.ts endpoints (signature kept stable for plugin layer)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span>Middleware → SvelteKit hooks.server.ts (same cookie-based session check)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span>Polling, useTransition, useState patterns → Svelte stores + reactive statements</span>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-5 border-t border-amber-200 pt-4 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">In short: </span>
          the migration cost is paid now in order to avoid a more expensive
          retrofit later. The &quot;bake it in from the beginning&quot;
          principle applies to the framework as much as to the architecture,
          and acting on it before the team scales is the lowest-cost moment
          to do so. Bucket A accuracy work resumes the moment the staff
          portal and manager dashboard render on Svelte.
        </p>
      </div>
    </section>
  );
}

type Phase = {
  label: string;
  title: string;
  goal: string;
  ships: string[];
};

const PHASES: Phase[] = [
  {
    label: "Days 1–30",
    title: "Foundation port (Svelte migration begins)",
    goal: "Stand up SvelteKit alongside Next.js. Port the framework-agnostic core. No new customer-facing features ship in this window.",
    ships: [
      "Initialise SvelteKit project, share the same SQLite database with the running Next.js install",
      "Port src/lib/* (award engine, types, public holidays, auth, leave categories) — these are TypeScript modules, no React",
      "Port Drizzle schema + migration runner. better-sqlite3 driver is identical in both frameworks",
      "Render the manager dashboard read-only on Svelte (week grid, staff list, KPI cards) — proves the foundation",
      "Define API contract layer (src/lib/api-contracts/) before any new endpoint is written. Plugin-ready by construction",
      "Honest accept: no Bucket A items ship in this phase. 'Indicative only' disclaimer remains visible.",
    ],
  },
  {
    label: "Days 31–60",
    title: "Feature parity port + first Svelte feature",
    goal: "Reach feature parity with the live product on Svelte. Cut customers over. Ship the first new accuracy fix on the new stack.",
    ships: [
      "Port the staff portal (token auth, request submission, attachment upload, notifications polling) — this is the highest-traffic surface",
      "Port the manager request flows: notifications bell, popover, approve/decline, partner handshake, time-change deltas",
      "Port login, manager session middleware → SvelteKit hooks.server.ts",
      "Cutover: live customers move to the Svelte build, Next.js retired. /history gets an entry locking the date",
      "Bucket A #1 — public-holiday multiplier ships on Svelte (first new feature on the new stack)",
    ],
  },
  {
    label: "Days 61–90",
    title: "Bucket A catch-up + first external API",
    goal: "Resume Bucket A on Svelte. Ship the first plugin-ready endpoint for an external caller. Catch up on accuracy work delayed by the migration.",
    ships: [
      "Bucket A #2 — junior rate override",
      "Bucket A #3 — email notifications on request resolution",
      "Bucket A #4 — state-specific public holidays",
      "Read-only REST endpoint for current-week roster, scoped by API key — first plugin contract in production",
      "API key management UI in business settings",
      "Service tier pricing draft — review with one prospective premium customer",
    ],
  },
];

function NinetyDayPlan() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Next 90 days
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Three phases, each releasable on its own. Every phase advances at least
        one of the four strategic bets so we don&apos;t drift into pure
        feature work.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PHASES.map((p) => (
          <PhaseCard key={p.label} phase={p} />
        ))}
      </div>
    </section>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold text-white">
        {phase.label}
      </span>
      <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900">
        {phase.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{phase.goal}</p>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          What ships
        </div>
        <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
          {phase.ships.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NotDoing() {
  const items = [
    {
      title: "Public plugin SDK / marketplace",
      why: "Build the contract layer first. Marketplace requires distribution, versioning, sandboxing, and developer marketing — none of which we need until at least one external plugin exists.",
    },
    {
      title: "Native mobile app",
      why: "PWA delivers ~95% of the value at ~10% of the cost. App store presence isn't a commercial blocker for our segment. Even more true on Svelte where bundle size is smaller.",
    },
    {
      title: "AI features",
      why: "Fabrication risk on award compliance. The optimizer is honestly framed as rule-based on /about — keep it that way until we have a model we'd stake an underpayment claim on.",
    },
    {
      title: "Multi-site / enterprise WFM",
      why: "Bucket B item. Pushes us into Deputy's product shape. Only on clear market signal — not as a roadmap line item.",
    },
    {
      title: "Built-in time clock",
      why: "Bucket B item. Doubles the product surface (timesheets, sign-offs, exceptions). Belongs to a different company until we hear it from customers repeatedly.",
    },
  ];
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        What we&apos;re not doing (and why)
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Strategy is mostly the &quot;no&quot; list. These are the things we
        could plausibly build but won&apos;t — at least not in 2026.
      </p>
      <ul className="mt-5 space-y-3">
        {items.map((it) => (
          <li
            key={it.title}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="text-sm font-semibold text-slate-800">
              {it.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {it.why}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OpenQuestions() {
  const questions = [
    {
      q: "What is the operational definition of 'plugin integration'?",
      detail:
        "Two readings of the leadership prompt are in play: (a) RosterMate plugs into other systems (Xero, Square POS, accountant tooling), or (b) third parties plug into RosterMate. The architectural work handles both, but the first plugin we ship signals which direction we lead with. Worth a focused alignment session with leadership before phase 3 begins.",
    },
    {
      q: "Service tier — do we have someone who'd actually pay for it?",
      detail:
        "Bet 2 is hypothesis until we have a paying premium customer. Need to identify one prospect by day 30 and get a pricing conversation by day 60.",
    },
    {
      q: "Award data: license or curate?",
      detail:
        "License = ~AUD$2–5k/year, faster, lower risk. Curate = free, slower, higher liability. Decision needed by day 60. Worth getting an accountant to review either path before commit.",
    },
    {
      q: "Who's the named-contact when the founder isn't available?",
      detail:
        "Bet 3 (support moat) breaks the moment the SLA breaks. Need a backup plan — co-founder, contractor, or capped-hours agreement — before we publish the SLA externally.",
    },
    {
      q: "What if the Svelte migration slips past day 60?",
      detail:
        "The 90-day plan assumes Svelte parity by day 60. Realistically rewrites slip ~30%. If we hit day 60 still mid-port, do we (a) push Bucket A to days 91–120, (b) ship the highest-value Bucket A items on the legacy Next.js build to keep customer momentum, or (c) cut scope on what gets ported. Pick the rule before we hit the wall, not after.",
    },
  ];
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Open questions
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Calls we haven&apos;t made yet. Each needs an owner and a deadline
        before it becomes a blocker.
      </p>
      <ol className="mt-5 space-y-4">
        {questions.map((it, i) => (
          <li
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {it.q}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {it.detail}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Footer() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-xs leading-relaxed text-slate-600">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="font-semibold text-slate-700">Last updated:</span>{" "}
          {LAST_UPDATED}
        </div>
        <div className="text-slate-500">
          Living document — revisited at the end of each 30-day phase.
        </div>
      </div>
      <p className="mt-3 border-t border-slate-200 pt-3">
        This plan replaces ad-hoc feature decisions for the next 12 months.
        Anything not on this plan needs to map to one of the four strategic
        bets, or it&apos;s out of scope.
      </p>
    </section>
  );
}
