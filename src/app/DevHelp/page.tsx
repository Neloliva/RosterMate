import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RosterMate · DevHelp — what to build next",
  description:
    "Internal planning doc: Bucket A (ship now, preserves product shape) and Bucket B (deferred, would change positioning).",
  robots: { index: false, follow: false },
};

type Priority = "quick-win" | "medium" | "large";
type Risk = "low" | "medium" | "high";

type BucketAItem = {
  order: number;
  title: string;
  priority: Priority;
  effort: string;
  risk: Risk;
  what: string;
  why: string[];
  how: string[];
  dependencies: string;
};

const BUCKET_A: BucketAItem[] = [
  {
    order: 1,
    title: "Automatic public holiday multiplier",
    priority: "quick-win",
    effort: "3–5 days",
    risk: "low",
    what: "When a shift falls on a public holiday, apply the configured multiplier (default 2.5×) to the cost calculation instead of only displaying the holiday badge on the grid.",
    why: [
      "Currently the 🎉 holiday tag is decorative — it doesn't change cost. Manager has to override base rate by hand on those days, or the weekly total understates reality.",
      "Public holiday penalty is the single largest multiplier in most awards (200–250%). Missing it silently is a material payroll risk.",
      "Deputy, Tanda, and RosterElf all apply this automatically — it's table stakes, not a differentiator.",
    ],
    how: [
      "Extend src/lib/award.ts · calculateShiftCost to check if the shift date matches an entry in the public-holiday map.",
      "Data is already loaded in src/lib/public-holidays.ts — just wire it into the cost path.",
      "Add public_holiday_multiplier REAL DEFAULT 2.5 to business_settings (idempotent migration, same pattern as coverage_rules).",
      "Surface a \"Public holiday loading\" line item in the shift editor breakdown so the manager sees the math.",
      "Remove the existing \"does not yet include public-holiday multiplier\" disclaimer from the shift editor once this ships.",
      "Edge case: shifts that span midnight into/out of a holiday — pro-rate the hours within the holiday day.",
    ],
    dependencies: "None. Can ship immediately.",
  },
  {
    order: 2,
    title: "Junior rate override per staff",
    priority: "quick-win",
    effort: "2–3 days",
    risk: "low",
    what: "Add an optional per-staff \"junior rate %\" field. When set, the cost engine multiplies the base rate by that percent before applying loadings.",
    why: [
      "Today the is_junior flag exists but is only a warning label — the manager manually lowers the base rate to approximate junior pay.",
      "Per-award junior tables are complex (e.g., Fast Food Award: 16yo = 50%, 17yo = 60%, 18yo = 70%, 19yo = 80%, 20yo = 90%). A simple per-staff override covers the common case without waiting for licensed award data.",
      "Full age-indexed junior tables can come later when Bucket A #7 (award data) ships.",
    ],
    how: [
      "Add junior_rate_percent INTEGER column to the staff table (nullable, valid range 1–99).",
      "Idempotent migration: ALTER TABLE staff ADD COLUMN junior_rate_percent INTEGER.",
      "StaffEditor: show a \"Rate %\" input directly under the is_junior checkbox when that's ticked.",
      "Cost engine: if junior_rate_percent is set, replace base_rate with base_rate * junior_rate_percent/100 at the start of the calculation (before loadings).",
      "Add a \"Junior rate (70%)\" line to the shift cost breakdown when applied so the manager can see it.",
    ],
    dependencies: "None.",
  },
  {
    order: 3,
    title: "Email notifications on request resolution",
    priority: "medium",
    effort: "1–2 days",
    risk: "low",
    what: "Send a transactional email to the staff member when their swap or time-off request is approved or declined.",
    why: [
      "Current state: staff portal polls every 15 seconds when open. If the staff isn't looking at the portal, they don't know their request was actioned.",
      "Phone-native email notifications reach staff wherever they are — no app install, no permission prompt.",
      "Lower friction than SMS (per-message cost) or Web Push (needs PWA install on iOS).",
      "Closes the #1 loop-closing gap the staff side has today.",
    ],
    how: [
      "Add email TEXT column to staff table (optional, nullable). Idempotent migration.",
      "Add Email field to StaffEditor, next to existing staff details.",
      "Use Resend or Postmark — both have AU-friendly pricing and generous transactional free tiers (Resend: 100 emails/day free, $20/mo for 50k).",
      "Add one env var for the API key (RESEND_API_KEY). Don't hard-code.",
      "Trigger from approveStaffRequest and declineStaffRequest in src/app/actions.ts, after the DB update succeeds.",
      "Template: \"Hi [firstName], your time-off request for [dayLabel] was [approved|declined]. [Manager's reason if declined.] — RosterMate\".",
      "Graceful degradation: if staff.email is null, skip sending. No error, no retry noise.",
      "Respect the staff's existing view-token URL in the email body so they can click through to the portal.",
    ],
    dependencies: "Sign up for Resend (free tier to start). No architectural change.",
  },
  {
    order: 4,
    title: "State/territory-specific public holidays",
    priority: "medium",
    effort: "3–5 days",
    risk: "medium",
    what: "Extend the public-holiday set beyond national holidays to include state-specific observances (Labour Day, Melbourne Cup Day, Queen's Birthday variants, Show Day, ACT Family & Community Day, etc.).",
    why: [
      "Today we show 7 national holidays. A real business observes 10–13 depending on state.",
      "Missing state holidays = understated payroll cost on those days, same risk category as missing the PH multiplier.",
      "Business Settings already has a businessType — adding a state field is a natural extension.",
    ],
    how: [
      "Add state TEXT column to business_settings (enum: NSW, VIC, QLD, WA, SA, TAS, ACT, NT).",
      "Extend src/lib/public-holidays.ts with state-keyed tables (nested map: state → year → [{date, name}]).",
      "Curate 2026–2028 dates manually, or use the 'date-holidays' npm package (maintained, supports AU with state disambiguation). Recommend the package — less maintenance burden.",
      "UI: add state dropdown in BusinessSettingsModal. Holiday cells on the grid can get a subtext like \"Labour Day (VIC)\" when shown.",
      "Re-check annually — some dates shift (Labour Day is first Monday in October for NSW, second Monday in March for VIC, etc.).",
    ],
    dependencies: "Public holiday multiplier (item 1) should ship first so the new holidays actually affect cost.",
  },
  {
    order: 5,
    title: "PWA (installable staff portal)",
    priority: "quick-win",
    effort: "1–2 days",
    risk: "low",
    what: "Make the staff portal an installable Progressive Web App — manifest, icons, service worker. Enables \"Add to Home Screen\" on iOS/Android with native-app feel.",
    why: [
      "Today \"Add to Home Screen\" works but RosterMate isn't a real PWA (no manifest, no service worker). Icons fall back to a screenshot of the page.",
      "PWA installation is a prerequisite for Web Push on iOS 16.4+. Can't skip this if #6 is to work on iPhones.",
      "Visual parity with native apps: custom app icon, splash screen, fullscreen display without the browser chrome.",
      "Cheap win — sets up the foundation for notifications without the React Native rebuild.",
    ],
    how: [
      "Create public/manifest.json: name, short_name, icons (192×192 and 512×512 PNGs), theme_color: \"#14b8a6\" (teal-500), display: \"standalone\", start_url: \"/staff/[token]\" won't work universally — use /staff/[token] only on the deep-linked install, else fall back to / or a picker page.",
      "Add <link rel=\"manifest\" href=\"/manifest.json\" /> to the layout.",
      "Simple service worker at public/sw.js: cache-first for static assets, network-first for everything else.",
      "Icons: commission or Figma — we need at least 192px and 512px PNGs, maskable for Android.",
      "Test installation on both real iPhone (iOS 16.4+) and Android Chrome.",
    ],
    dependencies: "App icons (design task). No other code dependencies.",
  },
  {
    order: 6,
    title: "Web Push notifications",
    priority: "medium",
    effort: "2–3 days",
    risk: "medium",
    what: "Browser-native push notifications when a request is resolved, delivered to the staff's phone/desktop even when RosterMate isn't open.",
    why: [
      "Closes the \"tell me to check\" gap fully. Email is a good first step but push is lower-latency and higher-engagement.",
      "Zero per-message cost (unlike SMS).",
      "Works on iOS 16.4+ (if PWA installed), all Android Chrome/Firefox/Edge, desktop browsers.",
      "Industry standard for transactional alerts.",
    ],
    how: [
      "Generate a VAPID keypair once (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Store privately; surface the public key to the client.",
      "Backend: new push_subscriptions table keyed by staff_id, storing the subscription JSON blob returned by the browser's subscribe() call.",
      "Backend: install web-push npm library for dispatching. Add a sendPushForRequest helper called from approveStaffRequest/declineStaffRequest after the DB write.",
      "Frontend: add a \"Notify me on request updates\" toggle on the staff portal. When toggled on, call Notification.requestPermission() then pushManager.subscribe().",
      "Service worker: listen for 'push' event, show notification with the decision + reason.",
      "Graceful: subscription expiry is common — mark dead subscriptions and prompt re-subscribe.",
    ],
    dependencies: "Item 5 (PWA + service worker) must ship first.",
  },
  {
    order: 7,
    title: "Licensed Fair Work award data",
    priority: "large",
    effort: "2–4 weeks",
    risk: "high",
    what: "Replace the generic weekend/night/casual loading model with actual award-specific rate tables for Modern Awards, starting with the five most common ones for our target market.",
    why: [
      "Biggest single accuracy jump we can make.",
      "Closes the table-stakes gap versus Deputy, Tanda, and RosterElf on compliance. Until this ships, the \"indicative only\" disclaimer stays visible.",
      "Enables proper age-indexed junior tables (superseding the per-staff override from item 2 for supported awards), overtime rules per award, and correct penalty stacking.",
      "Biggest risk if mishandled — a wrong rate can result in an underpayment claim. Must be treated with care.",
    ],
    how: [
      "Decision point first: (a) license from an existing data provider, or (b) manually curate.",
      "Path (a) — licensed: candidates include KeyPay/Employment Hero, e2u, or aggregator APIs. Typical cost is a few thousand AUD per year. Pros: maintained updates, accurate edge cases. Cons: cost + vendor lock-in.",
      "Path (b) — manual: start with MA000119 Restaurant, MA000004 Retail, MA000009 Hospitality General, MA000002 Clerks, MA000003 Fast Food. Encode as JSON tables (rates by classification, overtime thresholds, penalty time windows, junior age percentages). Quarterly refresh cadence.",
      "Schema: new award_templates table (code, name, role → classification map, junior_ages, overtime_threshold_hrs, penalty_time_blocks). Add primary_award_code to business_settings.",
      "Cost engine: when a business has primary_award_code set and the staff role maps to a classification, use the award's rate + rules. Fall back to the current generic model for anything unmapped.",
      "Keep the existing disclaimer but soften it for supported awards: \"Using Fair Work rates for the [Award name] award, last updated [YYYY-MM-DD].\"",
    ],
    dependencies: "Business decision on licensing vs manual curation (cost-to-value). Ideally after items 1–6 land so the baseline is correct.",
  },
];

type BucketBItem = {
  title: string;
  why: string;
};

const BUCKET_B: BucketBItem[] = [
  {
    title: "Built-in time clock / geofencing",
    why: "Adds a whole product surface (timesheets, no-shows, early clock-in exceptions, sign-off flows). Pushes RosterMate from planning tool into operations tool. Deputy's UI complexity is largely driven by this. Worth considering only if customers start asking for it repeatedly.",
  },
  {
    title: "Native payroll integrations (Xero, MYOB, QuickBooks)",
    why: "Requires a timesheet model we don't have, period-end reconciliation, mapping from roster to payable hours. We currently export CSV/PDF/Word — enough for the accountant. Deep integration is a product-shape change.",
  },
  {
    title: "Multi-site / multi-business",
    why: "Biggest architectural change. Every page needs a site selector, permissions become per-site, copy-week becomes scoped, manager hierarchies, etc. Turns RosterMate into an enterprise WFM tool — directly competes with Deputy's top tiers. Only make this move on clear market signal.",
  },
  {
    title: "Full React Native mobile app",
    why: "The PWA (item 5 in Bucket A) gives us 95% of what a native app delivers for much less engineering cost. Only pursue a real native app if App Store presence becomes a commercial blocker.",
  },
];

export default function DevHelpPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
      <Header />
      <Intro />
      <Tldr />
      <BucketASection />
      <Sequencing />
      <BucketBSection />
      <OutOfScope />
    </main>
  );
}

function Header() {
  return (
    <header className="mb-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white">
          R
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            RosterMate · DevHelp
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Internal planning · not shipped
          </div>
        </div>
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        What we can ship next, in priority order
      </h1>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
        A planning doc to take to Hannah. Covers the two buckets we&apos;ve
        separated in our roadmap discussions: Bucket A (invisible-to-user
        accuracy improvements + reach) and Bucket B (product-shape changes that
        shift our positioning).{" "}
        <span className="font-semibold text-slate-800">
          Recommendation is ship all of Bucket A before we even discuss
          Bucket B.
        </span>
      </p>
    </header>
  );
}

function Intro() {
  return (
    <section className="mb-10 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        How we picked the buckets
      </div>
      <p>
        <span className="font-semibold">Bucket A</span> items are the ones where{" "}
        RosterMate stops being less accurate than Deputy / Tanda / RosterElf on
        the things they all treat as table stakes —{" "}
        <em>without</em> changing what kind of product RosterMate is. The manager
        still sees one dashboard, the staff still opens one URL.
      </p>
      <p className="mt-2">
        <span className="font-semibold">Bucket B</span> items are the features
        that <em>made Deputy Deputy</em>. Shipping them turns RosterMate from a
        focused small-business planning tool into a smaller version of enterprise
        WFM. That&apos;s a strategic direction, not a feature backlog.
      </p>
    </section>
  );
}

function Tldr() {
  return (
    <section className="mb-12 rounded-xl border border-teal-200 bg-teal-50/70 p-5 text-sm leading-relaxed text-slate-800">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-teal-700">
        TL;DR for Hannah
      </div>
      <ul className="space-y-1.5">
        <li>
          •{" "}
          <span className="font-semibold">Total Bucket A effort:</span> ~6–9 weeks
          of focused development for one engineer.
        </li>
        <li>
          • <span className="font-semibold">Cheapest first wins:</span> public
          holiday multiplier + junior rate override. Under a week each. Ship
          before week 2.
        </li>
        <li>
          •{" "}
          <span className="font-semibold">Biggest open decision:</span> license
          Fair Work award data from a provider, or manually curate the 5 most
          common awards. Affects weeks 5–9.
        </li>
        <li>
          •{" "}
          <span className="font-semibold">No Bucket B work proposed.</span> Each
          item there changes RosterMate&apos;s product shape — treat as a
          separate business decision, not a sprint.
        </li>
      </ul>
    </section>
  );
}

function BucketASection() {
  return (
    <section className="mb-14">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Bucket A · in priority order
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Ship these first
        </span>
      </div>

      <PriorityIndex items={BUCKET_A} />

      <div className="mt-8 space-y-6">
        {BUCKET_A.map((item) => (
          <BucketACard key={item.order} item={item} />
        ))}
      </div>
    </section>
  );
}

function PriorityIndex({ items }: { items: BucketAItem[] }) {
  return (
    <ol className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {items.map((it, idx) => (
        <li
          key={it.order}
          className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
            idx < items.length - 1 ? "border-b border-slate-100" : ""
          }`}
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {it.order}
          </span>
          <a
            href={`#item-${it.order}`}
            className="flex-1 text-sm font-medium text-slate-800 hover:text-teal-700"
          >
            {it.title}
          </a>
          <PriorityBadge kind={it.priority} />
          <span className="text-xs text-slate-500">{it.effort}</span>
        </li>
      ))}
    </ol>
  );
}

function BucketACard({ item }: { item: BucketAItem }) {
  return (
    <article
      id={`item-${item.order}`}
      className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {item.order}
        </span>
        <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
        <PriorityBadge kind={item.priority} />
        <RiskBadge kind={item.risk} />
        <span className="ml-auto text-xs font-medium text-slate-500">
          Effort: {item.effort}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-700">{item.what}</p>

      <FieldGroup label="Why we need it">
        <ul className="space-y-1.5">
          {item.why.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span
                className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </FieldGroup>

      <FieldGroup label="How to implement">
        <ol className="space-y-1.5">
          {item.how.map((line, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-slate-700"
            >
              <span className="mt-0.5 inline-block w-4 shrink-0 text-right font-mono text-[11px] text-slate-400">
                {i + 1}.
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </FieldGroup>

      <FieldGroup label="Dependencies">
        <p className="text-sm text-slate-700">{item.dependencies}</p>
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

function PriorityBadge({ kind }: { kind: Priority }) {
  const styles: Record<Priority, string> = {
    "quick-win": "bg-emerald-100 text-emerald-800",
    medium: "bg-amber-100 text-amber-800",
    large: "bg-rose-100 text-rose-800",
  };
  const labels: Record<Priority, string> = {
    "quick-win": "Quick win",
    medium: "Medium",
    large: "Large / strategic",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}

function RiskBadge({ kind }: { kind: Risk }) {
  const styles: Record<Risk, string> = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-amber-50 text-amber-800",
    high: "bg-rose-50 text-rose-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[kind]}`}
    >
      Risk: {kind}
    </span>
  );
}

function Sequencing() {
  const phases = [
    {
      label: "Weeks 1–2",
      title: "Quick-win accuracy improvements",
      items: [
        "Public holiday multiplier (item 1)",
        "Junior rate override (item 2)",
        "State holidays (item 4)",
      ],
      outcome:
        "RosterMate now correctly handles public-holiday pay, junior rates, and state-observed holidays. Quiet accuracy improvements, no user-visible UX change.",
    },
    {
      label: "Weeks 3–4",
      title: "Loop-closing: tell staff their request was resolved",
      items: [
        "Email notifications (item 3)",
        "PWA conversion (item 5)",
        "Web Push notifications (item 6)",
      ],
      outcome:
        "Staff get notified when requests are resolved — no more \"did they see it?\" uncertainty. Staff portal becomes installable as a home-screen app.",
    },
    {
      label: "Weeks 5–9",
      title: "The big one: licensed award data",
      items: [
        "Decision: license vs. manually curate the 5 priority awards",
        "Schema + engine integration (item 7)",
        "Internal testing + accountant review before rollout",
      ],
      outcome:
        "\"Indicative only\" disclaimer can be softened for supported awards. Accuracy parity with Deputy/Tanda on the core calculation. Opens the door to credible compliance claims on the landing page.",
    },
  ];
  return (
    <section className="mb-14">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Proposed sequencing
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        If Bucket A is treated as one quarter of work for a single engineer,
        these are natural phase boundaries. Each phase is releasable on its own.
      </p>
      <div className="mt-6 space-y-4">
        {phases.map((p) => (
          <div
            key={p.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold text-white">
                {p.label}
              </span>
              <h3 className="text-lg font-semibold text-slate-900">
                {p.title}
              </h3>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {p.items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                    aria-hidden
                  />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Outcome: </span>
              {p.outcome}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BucketBSection() {
  return (
    <section className="mb-14">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Bucket B · defer, don&apos;t schedule
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Strategic decisions, not sprints
        </span>
      </div>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-600">
        Listed here for completeness. Each of these would push RosterMate into
        Deputy / Tanda&apos;s product shape — fine to do eventually, but only on
        clear market signal and as deliberate positioning choices. Not planned
        work.
      </p>
      <ul className="space-y-3">
        {BUCKET_B.map((item) => (
          <li
            key={item.title}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="text-sm font-semibold text-slate-800">
              {item.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {item.why}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OutOfScope() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Not on either list
      </div>
      <ul className="space-y-1.5 text-sm text-slate-700">
        <li>
          • <span className="font-semibold">Staff-visible preferences.</span>{" "}
          Already shipped — manager owns them now, staff side removed.
        </li>
        <li>
          • <span className="font-semibold">SOC 2 / enterprise security.</span>{" "}
          Too early. Revisit once we have paying customers.
        </li>
        <li>
          • <span className="font-semibold">AI-powered anything.</span> Fabrication
          risk. The current optimizer is rule-based and that&apos;s the honest
          framing on the landing page. Don&apos;t rebrand.
        </li>
        <li>
          •{" "}
          <span className="font-semibold">
            AHPRA / training.gov.au integrations.
          </span>{" "}
          We capture registration numbers as free text. Verification against
          external registries is a separate product conversation.
        </li>
      </ul>
    </section>
  );
}
