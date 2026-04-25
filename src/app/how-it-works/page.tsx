import type { Metadata } from "next";
import Link from "next/link";
import { Swimlane, type Diagram } from "@/components/Swimlane";
import { PageNav } from "@/components/PageNav";

export const metadata: Metadata = {
  title: "RosterMate · How it works",
  description:
    "Process diagrams for the manager / staff / system flows. Brainstorming reference.",
  robots: { index: false, follow: false },
};

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
      <PageNav current="how-it-works" />
      <Header />
      <Legend />
      <FlowSection
        order={1}
        title="Manager first-run setup"
        status="built"
        bucketTag={null}
        summary="What happens the first time someone opens RosterMate. No staff exist, no manager password is set. The middleware detects no session and routes to /login, which itself detects no stored password and goes into first-run mode."
        diagram={DIAGRAM_FIRST_RUN}
        steps={[
          "Manager opens the app at /. No session cookie exists.",
          "Middleware sees no manager password is set on business_settings — redirects to /login in first-run mode.",
          "Manager picks a password. Form submits to setManagerPassword server action.",
          "Server hashes with scrypt (explicit maxmem to avoid the 32MB cap), stores hash + creates a session row, sets the session cookie.",
          "Manager lands on the empty dashboard, ready to add the first staff member.",
        ]}
        notes={[
          "First-run mode is one-shot — the moment a hash exists in business_settings, /login flips to sign-in mode.",
          "scrypt was deliberately chosen over bcrypt to avoid a native dep on Windows. Memory cap caused a 'memory limit exceeded' bug; fix lives in src/lib/auth.ts.",
        ]}
      />
      <FlowSection
        order={2}
        title="Staff onboarding via token"
        status="built"
        bucketTag={null}
        summary="Manager-side: add a staff member, get a tokenised URL. Staff-side: open the URL on a phone, the portal renders, no app install. The view token is the auth — there's no staff login."
        diagram={DIAGRAM_STAFF_ONBOARDING}
        steps={[
          "Manager fills out the staff editor (name, role, base rate, employment type, optional contact details).",
          "On save, the server generates a 32-char hex view_token and stores it on the staff row.",
          "Manager copies the URL /staff/{token} and shares it however they like — text, email, paper, NFC.",
          "Staff opens the URL on their phone. No login screen, no app to install.",
          "Server validates the token against the staff table. If active, renders the staff portal scoped to that staff.",
          "Staff sees their roster, their requests, and the request types they can submit.",
        ]}
        notes={[
          "Soft-delete on staff invalidates the token implicitly — page render checks isActive.",
          "Bucket A #5 (PWA) will let staff add this URL to their home screen and have it feel like an app.",
          "No way to rotate tokens today. If a phone is lost, deleting + re-adding the staff member is the workaround. Worth fixing before scale.",
        ]}
      />
      <FlowSection
        order={3}
        title="Roster lifecycle"
        status="built"
        bucketTag="Enhanced by Bucket A #1, #2, #4, #7"
        summary="The manager builds a week. Cost is calculated on every change. Coverage rules run server-side. Staff sees the live roster on their token URL — there is no separate 'publish' step; everything is live the moment the manager clicks save."
        diagram={DIAGRAM_ROSTER_LIFECYCLE}
        steps={[
          "Manager opens the dashboard. Current week (or whichever they navigated to) loads with shifts, staff, and coverage banner state.",
          "Manager assigns a shift (drag, dropdown, or shift editor). Server action persists the row.",
          "Server runs calculateShiftCost on the saved shift — base rate × hours, plus weekend / night / casual / public-holiday loadings. Result stored on the shift row.",
          "Server checks coverage rules: per-day minimum staff count, per-role minimum (e.g., at least 1 supervisor on duty).",
          "Decision: are coverage rules met for this day?",
          "If no — coverage banner shows on the manager dashboard with a description of the gap.",
          "If yes — staff visiting their portal sees the updated roster on their next 15-second poll.",
        ]}
        notes={[
          "Cost calc today is 'indicative only' — Bucket A #7 (licensed award data) is what removes that disclaimer.",
          "Bucket A #1 (public holiday multiplier) and #2 (junior rate) close the largest accuracy gaps inside this loop.",
          "There's no explicit publish — design choice. Reduces a step and matches the way small businesses actually plan (incremental edits, not big-bang releases).",
        ]}
      />
      <FlowSection
        order={4}
        title="Time-off request"
        status="built"
        bucketTag="Enhanced by Bucket A #3, #5, #6"
        summary="Staff submits an 'unavailable' request from the portal — pick a day, optional reason, optional file attachments (medical certs, etc.). Manager sees the request with full coverage impact, approves or declines, and the decision applies the right side-effects automatically."
        diagram={DIAGRAM_TIME_OFF}
        steps={[
          "Staff opens the portal on their phone.",
          "Staff taps 'I'm not available', picks a day, picks a reason category if the manager configured them, optionally attaches files (max 3, 5MB, allowlisted MIME types), optionally adds a note.",
          "Server creates the staff_request row with status=pending and saves attachment BLOBs in staff_request_attachments. Manager dashboard sees a new pending count via the bell.",
          "Manager opens the notifications popover. The card shows shift label, day, the impact analysis (who else is working, who could cover) and any attachments.",
          "Manager decides: approve or decline.",
          "Server applies the decision: approve = delete the at-risk shift and mark resolved; decline = mark resolved with the manager's note. Either way, the decision and timestamp are stored.",
          "Staff portal polls every 15 seconds when the tab is visible — they see the resolution banner without having to refresh.",
        ]}
        notes={[
          "Bucket A #3 (email) closes the loop for staff who aren't watching the portal.",
          "Bucket A #5 + #6 (PWA + Web Push) closes it lower-latency and home-screen-installable.",
          "Attachments are stored as BLOBs in SQLite for now. At scale this becomes a problem (DB bloat, backup cost) — switch to S3-compatible object storage when we have more than a few hundred attachments.",
        ]}
      />
      <FlowSection
        order={5}
        title="Swap request with partner handshake"
        status="built"
        bucketTag="Enhanced by Bucket A #3, #5, #6"
        summary="A staff member wants to swap a shift with a named coworker. The coworker has to confirm in-system before the manager can auto-move the shift. Three actors: requester, partner, manager. The partner confirmation step is the trust gate — without it, the manager would be acting on an unverified claim."
        diagram={DIAGRAM_SWAP}
        steps={[
          "Mike (the requester) opens the portal, hits 'request swap', picks the shift, picks James from the coworker dropdown, optionally adds a note. Server saves with type=swap, partner_confirmation_status=requested.",
          "James's portal now shows a 'Partner awaiting' card. He sees Mike's name, the shift, the day, the note.",
          "James decides: confirm or decline.",
          "Server updates partner_confirmation_status to agreed or declined. Both Mike and the manager see the change on next poll.",
          "Manager opens the notifications popover. The request shows a status chip — Waiting / Confirmed / Declined.",
          "Manager decides: approve and move? Approve button is disabled while status=requested. If James declined, manager sees that and can still approve a non-move outcome (e.g., as informational) but the auto-move path is gated.",
          "If approved with confirmation: server reassigns the shift's staff_id from Mike to James, recalculates cost (rate may differ), and marks the request resolved. The roster updates everywhere live.",
        ]}
        notes={[
          "The handshake exists because Mike could name James without James actually agreeing. Manager approval pre-handshake would mean acting on an unverified claim. The friction is the feature.",
          "Approve button label changes contextually — 'Approve & move to James' when proposedSwapWithIsFreeThatDay is true and the partner has agreed.",
          "Open question for future: what if James is also working that day? Today the dialog won't list him. Future: allow a 3-way swap.",
        ]}
      />
      <FlowSection
        order={6}
        title="Time-change request"
        status="built"
        bucketTag="Enhanced by Bucket A #3, #5, #6"
        summary="Staff wants to work different hours on the same day — e.g., 'I can do 11am–7pm instead of 9am–5pm'. The dialog is the swap dialog with an intent toggle ('change time' vs 'someone else covers'). Manager sees a before/after delta with hours and cost."
        diagram={DIAGRAM_TIME_CHANGE}
        steps={[
          "Staff opens the swap dialog. Toggle is set to 'Change time'. Two time pickers appear (start, end).",
          "Staff picks new hours, optional note, submits.",
          "Server calculates proposedCost using the same calculateShiftCost function, against the new hours. Stores type=time_change, proposedStartHour, proposedEndHour, currentStartHour, currentEndHour, currentCost, proposedCost.",
          "Manager opens the notifications popover. The card shows: original hours → proposed hours, original cost → proposed cost, hours diff, dollar diff. They can see the full impact before deciding.",
          "Manager decides: approve or decline.",
          "If approved: server updates the existing shift's startHour, endHour, and recomputes cost using the live function (not the stored proposedCost — guards against stale rates). Marks request resolved.",
          "Staff portal sees the resolution on next poll.",
        ]}
        notes={[
          "Same dialog as swap, by design — staff thinks 'I want to change something about this shift' as one mental action, not two.",
          "Cost re-computation on approval (rather than trusting proposedCost) is deliberate. If award rates change between request and approval, the manager and the payroll see the same number.",
          "Edge case: proposed hours overlap the manager's coverage rules in a way the request didn't. Today we don't pre-warn the manager. Worth adding.",
        ]}
      />
      <Footer />
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
            RosterMate · How it works
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Process flows · brainstorming reference
          </div>
        </div>
      </div>
      <h1 className="mt-7 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        How RosterMate actually works.
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
        Six flows that cover everything a manager and a staff member do. Each
        is shown as a swimlane — actor down the left, time across — followed
        by a numbered walk-through and the known gaps. Use this as the
        reference for product conversations: what already works, what changes
        with Bucket A, what we&apos;d need to build to get to Bucket B.
      </p>
      <p className="mt-3 max-w-3xl text-xs italic leading-relaxed text-slate-500">
        Implementation notes below reference Next.js terms (server actions,
        middleware, Drizzle). The flows themselves don&apos;t change after the
        Svelte migration — the same lanes, the same decisions, the same
        side-effects. Only the plumbing names shift (server actions →
        SvelteKit form actions, middleware → hooks.server.ts).
      </p>
    </header>
  );
}

function Legend() {
  return (
    <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        Legend
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Lanes
          </div>
          <div className="flex flex-wrap gap-2">
            <LaneSwatch tone="manager" label="Manager" />
            <LaneSwatch tone="staff" label="Staff" />
            <LaneSwatch tone="partner" label="Partner (named coworker)" />
            <LaneSwatch tone="system" label="System (server / DB)" />
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Shapes
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-emerald-500 bg-white" />
              Start
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-600 bg-slate-600" />
              End
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-5 rounded border border-slate-900 bg-white" />
              Task
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rotate-45 border border-amber-600 bg-amber-100"
              />
              Decision
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function LaneSwatch({
  tone,
  label,
}: {
  tone: "manager" | "staff" | "partner" | "system";
  label: string;
}) {
  const bg: Record<typeof tone, string> = {
    manager: "bg-slate-900",
    staff: "bg-cyan-700",
    partner: "bg-amber-800",
    system: "bg-slate-600",
  };
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white text-xs">
      <span className={`px-2 py-0.5 font-semibold text-white ${bg[tone]}`}>
        {label}
      </span>
    </span>
  );
}

type Status = "built" | "building" | "planned";

function FlowSection({
  order,
  title,
  status,
  bucketTag,
  summary,
  diagram,
  steps,
  notes,
}: {
  order: number;
  title: string;
  status: Status;
  bucketTag: string | null;
  summary: string;
  diagram: Diagram;
  steps: string[];
  notes: string[];
}) {
  return (
    <section className="mb-16">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {order}
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h2>
        <StatusBadge status={status} />
        {bucketTag && (
          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800">
            {bucketTag}
          </span>
        )}
      </div>
      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-slate-600">
        {summary}
      </p>

      <Swimlane diagram={diagram} />

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Step by step
          </div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Notes &amp; gaps
          </div>
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"
                  aria-hidden
                />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    built: "bg-emerald-100 text-emerald-800",
    building: "bg-amber-100 text-amber-800",
    planned: "bg-slate-200 text-slate-700",
  };
  const labels: Record<Status, string> = {
    built: "Built",
    building: "Building",
    planned: "Planned",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function Footer() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-sm leading-relaxed text-slate-700">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Where to go next
      </div>
      <ul className="space-y-1.5">
        <li>
          •{" "}
          <Link href="/projectplan" className="font-semibold text-teal-700 hover:underline">
            /projectplan
          </Link>{" "}
          — strategic plan, boss feedback, four bets, 90-day plan.
        </li>
        <li>
          •{" "}
          <Link href="/DevHelp" className="font-semibold text-teal-700 hover:underline">
            /DevHelp
          </Link>{" "}
          — Bucket A roadmap (7 items, in priority order) and Bucket B
          deferred decisions.
        </li>
        <li>
          •{" "}
          <Link href="/history" className="font-semibold text-teal-700 hover:underline">
            /history
          </Link>{" "}
          — chronological log of what&apos;s actually shipped.
        </li>
      </ul>
    </section>
  );
}

// ─── Diagram definitions ──────────────────────────────────────────────────

const DIAGRAM_FIRST_RUN: Diagram = {
  lanes: [
    { id: "manager", label: "Manager", tone: "manager" },
    { id: "system", label: "System", tone: "system" },
  ],
  cols: 5,
  nodes: [
    { id: "m1", lane: "manager", col: 1, kind: "start", label: "Visit /", step: 1 },
    { id: "s1", lane: "system", col: 2, kind: "task", label: "No password\n→ /login", step: 2 },
    { id: "m2", lane: "manager", col: 3, kind: "task", label: "Set password", step: 3 },
    { id: "s2", lane: "system", col: 4, kind: "task", label: "Hash + create session", step: 4 },
    { id: "m3", lane: "manager", col: 5, kind: "end", label: "Dashboard ready", step: 5 },
  ],
  edges: [
    { from: "m1", to: "s1", routing: "h-v" },
    { from: "s1", to: "m2", routing: "h-v" },
    { from: "m2", to: "s2", routing: "h-v" },
    { from: "s2", to: "m3", routing: "h-v" },
  ],
};

const DIAGRAM_STAFF_ONBOARDING: Diagram = {
  lanes: [
    { id: "manager", label: "Manager", tone: "manager" },
    { id: "system", label: "System", tone: "system" },
    { id: "staff", label: "Staff", tone: "staff" },
  ],
  cols: 6,
  nodes: [
    { id: "m1", lane: "manager", col: 1, kind: "start", label: "Add staff", step: 1 },
    { id: "s1", lane: "system", col: 2, kind: "task", label: "Generate viewToken", step: 2 },
    { id: "m2", lane: "manager", col: 3, kind: "task", label: "Share /staff/{token}", step: 3 },
    { id: "t1", lane: "staff", col: 4, kind: "task", label: "Open URL on phone", step: 4 },
    { id: "s2", lane: "system", col: 5, kind: "task", label: "Validate token", step: 5 },
    { id: "t2", lane: "staff", col: 6, kind: "end", label: "See own roster", step: 6 },
  ],
  edges: [
    { from: "m1", to: "s1", routing: "h-v" },
    { from: "s1", to: "m2", routing: "h-v" },
    { from: "m2", to: "t1", routing: "h-v" },
    { from: "t1", to: "s2", routing: "h-v" },
    { from: "s2", to: "t2", routing: "h-v" },
  ],
};

const DIAGRAM_ROSTER_LIFECYCLE: Diagram = {
  lanes: [
    { id: "manager", label: "Manager", tone: "manager" },
    { id: "system", label: "System", tone: "system" },
    { id: "staff", label: "Staff", tone: "staff" },
  ],
  cols: 6,
  nodes: [
    { id: "m1", lane: "manager", col: 1, kind: "start", label: "Open dashboard", step: 1 },
    { id: "m2", lane: "manager", col: 2, kind: "task", label: "Assign shifts", step: 2 },
    { id: "s1", lane: "system", col: 3, kind: "task", label: "Calculate cost", step: 3 },
    { id: "s2", lane: "system", col: 4, kind: "task", label: "Check coverage rules", step: 4 },
    { id: "s3", lane: "system", col: 5, kind: "decision", label: "Coverage met?", step: 5 },
    { id: "m3", lane: "manager", col: 6, kind: "task", label: "Coverage banner", step: 6, variant: "alert" },
    { id: "t1", lane: "staff", col: 6, kind: "end", label: "See live roster", step: 7 },
  ],
  edges: [
    { from: "m1", to: "m2", routing: "straight" },
    { from: "m2", to: "s1", routing: "h-v" },
    { from: "s1", to: "s2", routing: "straight" },
    { from: "s2", to: "s3", routing: "straight" },
    { from: "s3", to: "m3", routing: "v-h", branch: "no", label: "No" },
    { from: "s3", to: "t1", routing: "v-h", branch: "yes", label: "Yes" },
  ],
};

const DIAGRAM_TIME_OFF: Diagram = {
  lanes: [
    { id: "staff", label: "Staff", tone: "staff" },
    { id: "system", label: "System", tone: "system" },
    { id: "manager", label: "Manager", tone: "manager" },
  ],
  cols: 7,
  nodes: [
    { id: "t1", lane: "staff", col: 1, kind: "start", label: "Open portal", step: 1 },
    { id: "t2", lane: "staff", col: 2, kind: "task", label: "Submit unavailable + files", step: 2 },
    { id: "s1", lane: "system", col: 3, kind: "task", label: "Save pending request", step: 3 },
    { id: "m1", lane: "manager", col: 4, kind: "task", label: "Review impact", step: 4 },
    { id: "m2", lane: "manager", col: 5, kind: "decision", label: "Approve?", step: 5 },
    { id: "s2", lane: "system", col: 6, kind: "task", label: "Apply decision", step: 6 },
    { id: "t3", lane: "staff", col: 7, kind: "end", label: "See resolution", step: 7 },
  ],
  edges: [
    { from: "t1", to: "t2", routing: "straight" },
    { from: "t2", to: "s1", routing: "h-v" },
    { from: "s1", to: "m1", routing: "h-v" },
    { from: "m1", to: "m2", routing: "straight" },
    { from: "m2", to: "s2", routing: "h-v", label: "Approve / Decline" },
    { from: "s2", to: "t3", routing: "h-v" },
  ],
};

const DIAGRAM_SWAP: Diagram = {
  lanes: [
    { id: "mike", label: "Mike (requester)", tone: "staff" },
    { id: "system", label: "System", tone: "system" },
    { id: "james", label: "James (partner)", tone: "partner" },
    { id: "manager", label: "Manager", tone: "manager" },
  ],
  cols: 8,
  nodes: [
    { id: "mk1", lane: "mike", col: 1, kind: "task", label: "Submit swap, name James", step: 1 },
    { id: "sy1", lane: "system", col: 2, kind: "task", label: "partner_status = requested", step: 2 },
    { id: "jm1", lane: "james", col: 3, kind: "task", label: "Sees Partner awaiting card", step: 3 },
    { id: "jm2", lane: "james", col: 4, kind: "decision", label: "Confirm?", step: 4 },
    { id: "sy2", lane: "system", col: 5, kind: "task", label: "Update partner_status", step: 5 },
    { id: "mn1", lane: "manager", col: 6, kind: "task", label: "Sees request + chip", step: 6 },
    { id: "mn2", lane: "manager", col: 7, kind: "decision", label: "Approve & move?", step: 7 },
    { id: "sy3", lane: "system", col: 8, kind: "task", label: "Move shift to James", step: 8 },
  ],
  edges: [
    { from: "mk1", to: "sy1", routing: "h-v" },
    { from: "sy1", to: "jm1", routing: "h-v" },
    { from: "jm1", to: "jm2", routing: "straight" },
    { from: "jm2", to: "sy2", routing: "h-v", label: "Confirm / Decline" },
    { from: "sy2", to: "mn1", routing: "h-v" },
    { from: "mn1", to: "mn2", routing: "straight" },
    { from: "mn2", to: "sy3", routing: "h-v", branch: "yes", label: "Yes (agreed)" },
  ],
};

const DIAGRAM_TIME_CHANGE: Diagram = {
  lanes: [
    { id: "staff", label: "Staff", tone: "staff" },
    { id: "system", label: "System", tone: "system" },
    { id: "manager", label: "Manager", tone: "manager" },
  ],
  cols: 7,
  nodes: [
    { id: "t1", lane: "staff", col: 1, kind: "start", label: "Toggle 'Change time'", step: 1 },
    { id: "t2", lane: "staff", col: 2, kind: "task", label: "Pick new hours", step: 2 },
    { id: "s1", lane: "system", col: 3, kind: "task", label: "Calculate proposed cost", step: 3 },
    { id: "m1", lane: "manager", col: 4, kind: "task", label: "See cost delta", step: 4 },
    { id: "m2", lane: "manager", col: 5, kind: "decision", label: "Approve?", step: 5 },
    { id: "s2", lane: "system", col: 6, kind: "task", label: "Update shift hours + cost", step: 6 },
    { id: "t3", lane: "staff", col: 7, kind: "end", label: "See update", step: 7 },
  ],
  edges: [
    { from: "t1", to: "t2", routing: "straight" },
    { from: "t2", to: "s1", routing: "h-v" },
    { from: "s1", to: "m1", routing: "h-v" },
    { from: "m1", to: "m2", routing: "straight" },
    { from: "m2", to: "s2", routing: "h-v", branch: "yes", label: "Yes" },
    { from: "s2", to: "t3", routing: "h-v" },
  ],
};
