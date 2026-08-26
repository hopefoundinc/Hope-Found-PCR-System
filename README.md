# Hope Found PCR Audit-Readiness System

A full digital compliance system replacing paper binders for the annual DC DDA Person-Centered
Review (PCR, conducted by Qlarant). Built for Hope Found, Inc. by Isaac and Co. Consulting, with
the engine fully separated from Hope Found-specific content so the same app can be resold to other
DC waiver providers by swapping configuration.

**Everything is one file: [`index.html`](index.html).** No build step, no server, no network
dependencies for core operation. Open it in any modern browser, or host it as a claude.ai artifact.

## The six screens

1. **Readiness Dashboard** — per-service-line total % and critical % against the 70/80/90 tier
   thresholds, projected tier and its consequence, alert/not-met counts, minimum sample size, plus
   standing measures (record retrieval rate, org tools, staff records, fire & emergency) and a
   global Alert banner.
2. **Client Review** — the full rubric per person with Met / Not Met / N/A rating, gate questions
   that default from the person's attribute flags (QA can override), auto-N/A of gated indicator
   families, verification fields, evidence location, inline "what the surveyor looks for" text, and
   a sticky live score summary.
3. **Sampling Exposure Calculator** — editable census per service line; minimum sample recomputes
   live (Qlarant matrix, plus ceiling(10% + 1) for services under 10); oversample suggestion;
   prior-PCR participants flagged, never excluded.
4. **Document Locator** — every rated record across clients, staff, and org tools with its verified
   location, or a flagged **NO VERIFIED LOCATION**; searchable and filterable. Framed around the
   2-hour production rule and the 4:00 PM day-one deadline.
5. **Organization & Staff** — the three mandatory org tools (HCBS Org Assessment exclusions are
   config, not code), staff roster with requirement/expiration tracking (expired and ≤60-day
   expirations flagged), and the fire & emergency module (quarterly drill log per site/shift plus a
   recurring safety checklist with due-date logic).
6. **Rubric Manager** — the editable master rubric. Edit any field, add indicators, retire items
   (soft delete — history is preserved), export/import the whole rubric as JSON so each audit
   cycle's criteria load without a rebuild.

## Scoring rules implemented

- Total % = earned weight / possible weight over active, applicable, non-N/A QA indicators;
  Critical % = the same restricted to weight-5 indicators. Both per service line, independently.
- Tiers: ≥90 (plus 100% HCBS-settings indicators and ≥80% satisfaction) Excellent → biannual cert;
  ≥80 Satisfactory → annual; 70–79 Needs Improvement; 51–69 Unsatisfactory; ≤50 Failed.
- Any Alert-flagged indicator scored Not Met overrides the tier display and fires the site-wide
  banner: mandatory Follow-Up PCR within 30 days.
- Gate questions (weight 0): answered No, every child indicator is auto-N/A, excluded from scoring,
  and disabled in the UI. Defaults come from the person's flags (BSP, restrictive components,
  medications); QA can override per review.

## Dual mode: offline logic + optional AI

Everything works fully offline with deterministic logic. Optionally, **Settings** accepts an
Anthropic API key (from console.anthropic.com) to add AI-written output for two features, each of
which also has an offline draft button:

- **CAP draft** per service line (systemic corrective-action plan from the Not Met list)
- **Readiness briefing** on the dashboard

Calls go directly from the browser to the Anthropic Messages API (default model `claude-opus-5`).
If the network or key fails, the app falls back to the offline draft and keeps working.

## Storage

The app adapts to its runtime, in order of preference:

1. **claude.ai artifact runtime** — `window.storage` with `shared: true`: one shared dataset for
   the 1–2 QA staff, same records on every device.
2. **Plain browser** — `localStorage` (per browser; use Export/Import to move between devices).
3. **No storage available** — in-memory with a warning banner; Export/Import still works.

Data is keyed compactly (one key per client bundling all their compliance records). Settings has a
full JSON backup export/import.

## Replacing the starter rubric with the official one

The app ships with a clearly-labeled representative starter rubric. To load the official
Qlarant-extracted indicators: **Rubric Manager → Import JSON** with an array of items shaped like:

```json
{
  "id": "CQ.A.2", "serviceLine": "hh", "domain": "Service Planning",
  "weight": 5, "type": "QA", "alert": false,
  "gateParent": null, "flagKey": null,
  "questionText": "…", "intentText": "…",
  "appliesTo": "all", "hcbsSettings": false,
  "effectiveDate": "2026-01-01", "active": true
}
```

`type` is `QA` (scored), `QI` (unweighted quality measure), or `GATE` (Yes/No applicability
control). `weight` is 0, 3, 5 (critical), or 10. `serviceLine` is one of `ihs`, `hh`, `sl`, `ids`,
`comp` (or `org`). `appliesTo` is `"all"` or an array of living arrangements. Existing ratings stay
attached by indicator ID across imports.

## Onboarding another agency (resale)

Edit `PROVIDER_CONFIG` at the top of the script in `index.html`: provider name, theme colors
(CSS variables), service lines, living arrangements, client flags, org tools and their service-line
exclusions, staff roles/requirements, and fire checklist. Then import that agency's rubric and
roster. No engine logic changes.

See [`PLAN.md`](PLAN.md) for the full architecture.
