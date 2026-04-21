# Deferred — things we intentionally aren't shipping yet

This file lists the gaps between what the RosterMate demo does today and a
production-grade Australian award-compliance product. Each item is left out
because the app would have to fabricate data it doesn't legitimately have.
Items here should NOT be implemented without licensing / sourcing the data
they depend on.

## Australian award data (single biggest gap)

- **Live Fair Work award rates.** The role catalogs in
  `src/lib/mock-data.ts` (`ROLE_CATALOG`) use plausible demo values, not the
  Fair Work Commission's published Modern Award rates. Real rates change on
  1 July every year and differ per classification within each award (the
  Restaurant Industry Award alone has 20+ classifications across F&B / Cook /
  Kitchen / Clerical / Manager bands). Safe coverage needs a **licensed award
  data feed** — e.g. Employment Hero's Wage Easy library, Smartpayroll, or
  NoahAI. These providers also handle the July 1 annual-increase pipeline.
- **Per-award penalty engines.** `src/lib/award.ts` implements one generic
  ruleset (Sat ×1.25, Sun ×1.5, night ×1.15 in 7pm–7am, casual ×1.25). Real
  awards differ — e.g. the Nurses Award has 12h-shift accumulators, Aged Care
  has different night-shift bands, Retail has late-night loadings that vary by
  state. None of that is modelled.
- **Junior rate percentages.** The "Junior employee" checkbox is a tag only.
  Each award's junior percentages (e.g. 16yo = 50%, 17yo = 60%) are real data
  that changes per award. The user must set the base rate manually.
- **Apprentice progression tables.** Years-of-service percentages exist in
  the demo role catalog (Hair/Beauty template) as hardcoded examples, but
  they're not wired into any automatic calculation.
- **Public holidays.** The `shifts` table has no "is public holiday" flag and
  the award engine has no `publicHoliday` branch. Public holiday loading in
  `src/lib/award.ts` (`AwardRules.penalty.publicHoliday`) is defined but never
  applied.
- **State-specific overlays.** RSA scope, food-safety requirements, and
  shift-differential rules vary per state (NSW / VIC / QLD / etc.). Nothing
  in the app is state-aware.

## Third-party integrations

- **AHPRA registration validation.** The staff editor captures a registration
  number as free text. There's no lookup against AHPRA's database.
- **training.gov.au qualification verification.** Qualification checkboxes
  are tags — no check that the staff member actually holds the cert.
- **Payroll export/import.** MYOB / Xero / KeyPay integrations are not built.
  The CSV export is the only way data leaves the app.
- **POS integration.** The spec mentions Square / Tyro for sales-data-driven
  demand forecasting. None of that is implemented.

## UX features that require the above data

- **Award wizard** ("what industry → what role → what experience → here's your
  classification"). This only makes sense on top of a real award database.
- **Onboarding flow** (multi-step setup). Deferred pending the award data.
- **Compliance validation** ("RSA required for alcohol service",
  "First aid recommended"). Needs jurisdictional rules we don't have.

## Other honest limits worth knowing

- **Industry benchmarks** (cost/hour vs industry average, labor % of revenue).
  The app doesn't have benchmark or revenue data and won't invent it.
- **Compliance score / audit date** (as in the earlier report spec). No audit
  mechanism exists; fabricating a score would undermine the footer disclaimer.
- **ROI calculator** (time saved / dollars saved / ROI %). No pricing, no
  usage telemetry. Out of scope.
