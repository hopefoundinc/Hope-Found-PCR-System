# Hope Found PCR Audit-Readiness System

A full digital compliance system replacing paper binders for the annual DC DDA Person-Centered
Review (PCR, conducted by Qlarant). Built for Hope Found, Inc. by Isaac and Co. Consulting, with
the engine fully separated from Hope Found-specific content so the same app can be resold to other
DC waiver providers by swapping configuration.

**Everything is one file: [`index.html`](index.html).** No build step, no server, no network
dependencies for core operation. Open it in any modern browser, or host it as a claude.ai artifact.

## The nine screens

1. **Readiness Dashboard** — per-service-line total % and critical % against the 70/80/90 tier
   thresholds, projected tier and its consequence, alert/not-met counts, minimum sample size, plus
   standing measures (record retrieval rate, org tools, staff records, fire & emergency) and a
   global Alert banner.
2. **Client Review** — the full rubric per person with Met / Not Met / N/A rating, gate questions
   that default from the person's attribute flags (QA can override), auto-N/A of gated indicator
   families, verification fields, evidence location, inline "what the surveyor looks for" text, and
   a sticky live score summary with **Next unanswered / Open all / Collapse all** controls.
   Categories collapse to an overview showing answered counts, not-met and alert chips, and a
   progress bar per domain. People carry a **home/location**: pick a home to see resident chips
   with per-person progress and switch between housemates in one click, and any answered indicator
   offers **Copy answer to household**, pushing the rating, verification, and evidence location to
   housemates in the same service line (with confirmation; overwrites that indicator only). **Import roster** adds people in bulk: a CSV or pasted spreadsheet
   rows parse fully offline (header row auto-detected, service lines and living arrangements
   fuzzy-matched, Yes/No columns become flags); a PDF or photo roster extracts via AI mode. Every
   import lands in an editable preview with duplicate-name flagging before anything is saved.
3. **QIDP Monthly Reviews** — the monthly progress review generator (org indicator: QIDP
   oversight current for every person served). A per-month tracking grid shows every active person
   as Not started / Draft / Signed; the editor gives structured sections (ISP outcome progress with
   a progress rating, health/medical, BSP data review — shown only for people with a BSP, service
   delivery, incidents, community integration, concerns, follow-up actions), with last month's
   follow-ups carried forward automatically and the QIDP name pre-filled from the prior review.
   Signing by name locks the review and marks the month current (reopenable); printing renders a
   clean document — single review or the whole month's signed batch. Section labels are provider
   config. "Draft / polish narrative" assembles the formatted review offline, or in AI mode turns
   shorthand notes into professional person-centered narrative without inventing facts. The
   Dashboard shows signed-this-month as a standing measure.
4. **Sampling Exposure Calculator** — editable census per service line; minimum sample recomputes
   live (Qlarant matrix, plus ceiling(10% + 1) for services under 10); oversample suggestion;
   prior-PCR participants flagged, never excluded.
5. **Document Locator** — every rated record across clients, staff, and org tools with its verified
   location, or a flagged **NO VERIFIED LOCATION**; searchable and filterable. Framed around the
   2-hour production rule and the 4:00 PM day-one deadline.
6. **Audit Run** — the 2-hour scramble, operationalized. When the PCR reviewers deliver the
   sample key, check off the selected people (pre-checked from the "In sample" flag) and generate a
   **record production pack**: a cover sheet with the start time, the records-due deadline
   (start + 2 hours) and the 4:00 PM off-site deadline, readiness stats, and a homes-to-visit list —
   then one printable page per person listing every applicable requirement with its rating,
   verification, and document location (missing locations flagged), plus the staff records due in
   the same window. A **preparation drill** pulls the same number of people a real PCR would
   (census → sampling matrix, per service line) at random, producing the identical pack for
   rehearsal. Runs are saved and reprintable; a dedicated print stylesheet strips the chrome and
   breaks one person per page. Filter the pack to all / rated only / missing-location only.
7. **Policy Updates** — what changed since the last yearly PCR audit, made impossible to miss.
   Set the last audit date once and every rubric indicator with a newer effective date (plus
   retired items) is listed automatically — each cycle's rubric import feeds it with no extra work.
   DDA policy/requirement updates are logged with source, summary, and affected areas; each must be
   **acknowledged by name and date** (the audit trail that the agency noticed), and updates flagged
   as requiring a QA document revision stay marked "pending" until addressed. Unhandled updates
   show as a red count on the nav tab and a warning callout on the Dashboard. The **agency QA
   document** lives here as a version registry: upload each revision with a what-changed note and
   tick the policy updates it addresses; files up to ~2 MB are stored in-app and downloadable
   (the two newest versions keep their file; older ones keep metadata + location), larger files are
   tracked by version + storage location. "Suggest QA document updates" drafts revision guidance —
   offline as a structured worksheet, or via AI mode, which reads the stored QA document itself
   (PDF or text) and proposes section-by-section language.
8. **Organization & Staff** — the three mandatory org tools (HCBS Org Assessment exclusions are
   config, not code), staff roster with requirement/expiration tracking (expired and ≤60-day
   expirations flagged), and the fire & emergency module (quarterly drill log per site/shift plus a
   recurring safety checklist with due-date logic).
9. **Rubric Manager** — the editable master rubric. Edit any field, add indicators, retire items
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
Anthropic API key (from console.anthropic.com) to add AI-written output; every feature also has an
offline path:

- **CAP draft** per service line (systemic corrective-action plan from the Not Met list)
- **Readiness briefing** on the dashboard
- **Roster extraction** from PDF or photo rosters (Import roster)
- **QA document update suggestions** — reads the stored QA document (PDF/text) plus open policy
  changes and proposes section-by-section revisions
- **QIDP review narrative** — turns the QIDP's shorthand notes into a professional review draft

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

## The rubric

The app ships **pre-loaded with the official Qlarant-extracted rubric**
([`hopefound_pcr_rubric.json`](hopefound_pcr_rubric.json), 465 indicators, effective 2022-11-07
across all five service lines — Companion included; no version dates are hardcoded anywhere, the
`effectiveDate` field on each item is the only source). 30 indicators mapping directly to HCBS
Settings Rule provisions (lease/eviction protections, lockable space, roommate and visitor choice,
privacy, food access, own schedule, community activities of choice, day-activity autonomy) carry
`hcbsSettings: true` and gate the Excellent tier — Host Home, Supported Living, and IDS only,
mirroring the HCBS Org Assessment's exclusion of In-Home Supports and Companion; each flag is a
checkbox in the Rubric Manager. When criteria change next audit cycle:
**Rubric Manager → Import JSON** with the new set — no rebuild. The formal contract is
[`rubric.schema.json`](rubric.schema.json) (JSON Schema draft 2020-12) — validate your file with
`npx ajv-cli validate --spec=draft2020 -s rubric.schema.json -d your-rubric.json` before importing.
The import accepts a bare array of items, or the `{ "rubric": [...] }` object that Export produces.
Each item looks like:

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

Required fields: `id`, `serviceLine`, `questionText`, `weight`, `type` — everything else defaults
(see the schema for defaults and enums). `type` is `QA` (scored), `QI` (unweighted quality
measure), or `GATE` (Yes/No applicability control). `weight` is 0, 1, 3, 5 (critical), 10, or 15.
`serviceLine` is one of `ihs`, `hh`, `sl`, `ids`, `comp`. `appliesTo` is `"all"` or an array of
living arrangements matching the configured strings exactly. Gates are single-level: a GATE item's
own `gateParent` must be null — model a nested gate (e.g. restrictive components under BSP) as a
sibling gate with its own `flagKey`. Import replaces the whole rubric, so include retired items
with `"active": false` rather than omitting them; existing ratings stay attached by indicator ID
across imports.

## Onboarding another agency (resale)

Edit `PROVIDER_CONFIG` at the top of the script in `index.html`: provider name, theme colors
(CSS variables), service lines, living arrangements, client flags, org tools and their service-line
exclusions, staff roles/requirements, and fire checklist. Then import that agency's rubric and
roster. No engine logic changes.

See [`PLAN.md`](PLAN.md) for the full architecture.
