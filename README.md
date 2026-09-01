# Hope Found PCR Audit-Readiness System

A full digital compliance system replacing paper binders for the annual DC DDA Person-Centered
Review (PCR, conducted by Qlarant). Built for Hope Found, Inc. by Isaac and Co. Consulting, with
the engine fully separated from Hope Found-specific content so the same app can be resold to other
DC waiver providers by swapping configuration.

**Everything is one file: [`index.html`](index.html).** No build step, no server, no network
dependencies for core operation. Open it in any modern browser, or host it as a claude.ai artifact.

## The shell

A fixed left sidebar carries the brand mark, the screen list with an icon per screen, and — at the
foot — who is signed in, Settings, and Sign out. It stays a left rail at every width: it narrows
below 1040px and drops to a 56px icon rail (labels on hover) below 760px, but it never becomes a
strip across the top. Cards are rounded and lightly shadowed; every visible date renders **MM-DD-YYYY** while stored data,
`<input type="date">` values, and JSON/CSV exports stay ISO, so nothing about the data model changes.

## The eleven screens

1. **Readiness Dashboard** — per-service-line total % and critical % against the 70/80/90 tier
   thresholds, projected tier and its consequence, alert/not-met counts, minimum sample size, plus
   standing measures (record retrieval rate, org tools, staff records, fire & emergency, review
   coverage, open corrections) and a global Alert banner. Scores are reported alongside the
   **coverage** they rest on — people reviewed, and how many applicable questions are answered — and
   any service line with people still unscored is labelled **provisional**, because a 100% score over
   1 of 20 people is not a 100% service line. Coverage is reported, never folded into the score.
2. **Client Review** — the full rubric per person with Met / Not Met / N/A / **Not Yet Scored**
   rating. *Not Yet Scored* is the standing default for every question and every person — an
   unanswered question is never counted as a failure — and clicking it returns a question to that
   state. A Not Met answer opens **corrections deadline** and **corrections completed** dates,
   mirroring what the agency already tracks by hand on every paper binder review; anything past its
   deadline and not completed lands on the Dashboard. Also: gate questions
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
3. **Residential Medical Review** — the nurse's record-completeness pass over each person's medical
   record for the residential service lines, in the same Satisfactory / Concern noted / N/A scheme as
   the paper tool it replaces, with comments and a corrections pair on every Concern. Deliberately
   separate from the weighted Qlarant rubric: it does not feed the certification tier. Which service
   lines it covers is `PROVIDER_CONFIG.medicalReview.serviceLines`.
4. **QIDP & ISP Tracking** — quarterly progress reports are authored by the QIDP and filed in
   MCIS (DC DDA's system of record), drawn from direct-care staff's daily notes; this system does **not** write or store
   that review. It tracks two dates per person — **QIDP (case manager)** and **ISP date** (the
   annual Medicaid-services planning meeting), both set on Edit person — and computes each
   quarterly report's due date (ISP + 3/6/9 months) plus the next annual ISP renewal (ISP + 12
   months), flagging Overdue / Due soon / On track. Two working lists sit at the top, each with its
   own print button that prints that list *alone* (with an agency header, the window, and who
   generated it):
   - **ISP dates in the next 30 days** — the ISP date is the annual date a person's plan concludes.
     The meeting that renews it has to be booked **45–30 days beforehand**, so every row carries a
     **book-by** date (ISP date − 30) alongside **Scheduled &lt;date&gt;** or **NOT SCHEDULED**;
     anything still unscheduled in this list is already past its booking deadline and is flagged as
     such. Behind it, **Booking window open — ISP dates 30–45 days out** is the preventive list:
     the people to schedule *right now*, each showing the days left before their book-by date. Set
     the meeting date inline in either table. People with no ISP date on file follow in their own
     flagged block — nothing can be computed for them at all, which is its own thing to chase
     before a PCR. Both blocks print together on one sheet.
   - **Quarterly report checklist — next 15 days** — every quarterly progress report falling due
     inside the window, plus anything past due and unfiled, as a tickable checklist. Ticking one
     records who confirmed it and when. A report filed before its due date drops off.

   The windows are deliberately different (all in `PROVIDER_CONFIG.qidp`: `ispWindowDays` 30,
   `ispBookingOpensDays` 45, `ispBookingDeadlineDays` 30, `quarterlyWindowDays` 15). An ISP meeting
   has to be booked with the team and the person, so it gets a booking window rather than a single
   deadline; a quarterly report is written from notes already in MCIS and needs no booking. Below the lists, the full grid still shows every person and
   every due date. Marking a period done records that it was confirmed in MCIS — a manual receipt
   check for now, and the intended hook for a future admin dashboard to update automatically once
   connected (see **Cross-system sync** below). Overdue items badge the nav tab and appear on the
   Dashboard, same pattern as Policy Updates.
5. **Sampling Exposure Calculator** — editable census per service line; minimum sample recomputes
   live (Qlarant matrix, plus ceiling(10% + 1) for services under 10); oversample suggestion;
   prior-PCR participants flagged, never excluded.
6. **Document Locator** — every rated record across clients, staff, and org tools with its verified
   location, or a flagged **NO VERIFIED LOCATION**; searchable and filterable. Framed around the
   2-hour production rule and the 4:00 PM day-one deadline.
7. **Audit Run** — the 2-hour scramble, operationalized. When the PCR reviewers deliver the
   sample key, check off the selected people (pre-checked from the "In sample" flag) and generate a
   **record production pack**: a cover sheet with the start time, the records-due deadline
   (start + 2 hours) and the 4:00 PM off-site deadline, readiness stats, and a homes-to-visit list —
   then one printable page per person listing every applicable requirement with its rating,
   verification, and document location (missing locations flagged), plus the staff records due in
   the same window. A **preparation drill** pulls the same number of people a real PCR would
   (census → sampling matrix, per service line) at random, producing the identical pack for
   rehearsal. Runs are saved and reprintable; a dedicated print stylesheet strips the chrome and
   breaks one person per page. Filter the pack to all / rated only / missing-location only.
8. **Policy Updates** — what changed since the last yearly PCR audit, made impossible to miss.
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
9. **Organization & Staff** — the three mandatory org tools (HCBS Org Assessment exclusions are
   config, not code), staff roster with requirement/expiration tracking (expired and ≤60-day
   expirations flagged), and the fire & emergency module (quarterly drill log per site/shift plus a
   recurring safety checklist with due-date logic).
10. **Users & Activity** — who is allowed in and the running record of who did what: the account
   list (add people, change roles, reset passwords, deactivate without erasing anyone's history),
   a **Verifications on record** tally counted straight from the answers themselves, and the
   **Activity log** (last 400 actions, filterable by person, exportable as CSV).
11. **Rubric Manager** — the editable master rubric. Edit any field, add indicators, retire items
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

Calls go directly from the browser to the Anthropic Messages API (default model `claude-opus-5`).
If the network or key fails, the app falls back to the offline draft and keeps working.

## Sign-in and attribution

The tool is behind a sign-in — **full name and password, no username** — and that sign-in is what
makes the audit trail automatic: **click Met / Not Met / N/A and the system stamps your name and the exact moment onto
that answer** — nobody types a verifier name by hand any more, and when several people split the
checks it is always clear who did which.

- **First run** — with no accounts yet, the app opens on *Create the first administrator account*.
  That person then adds the rest of the team under **Users & Activity**.
- **The full name is the account.** It is what you sign in with and what gets stamped on every
  answer, so no one keeps a separate username in their head and the two can never drift apart.
  Matching ignores capitals and stray spaces. Because a name has to identify one person, the system
  refuses a second account under a name already in use — otherwise the audit trail could not say who
  did what. Renaming an account changes how that person signs in; answers they already verified keep
  the name they were stamped with.
- **Roles** — *Administrator* (adds users, resets passwords, deactivates accounts, restores or
  clears data) and *QA staff* (everything else). New users get a temporary password and are made to
  choose their own at first sign-in.
- **Sessions** are browser-local and last 12 hours; the *session* is deliberately never written to
  the shared dataset, so one person signing in never signs in for everybody. Sign out from the
  header or from Settings.
- **Passwords** are salted per account and stretched with PBKDF2-HMAC-SHA256 (150,000 iterations)
  through the Web Crypto API, falling back to an iterated pure-JS SHA-256 where Web Crypto is
  unavailable. No password is stored, exported, or recoverable in readable form — an administrator
  resets a forgotten one rather than looking it up.
- **What gets stamped** — client indicator ratings and gate answers, org tool items, staff
  requirement records, fire drills and safety checks, policy acknowledgments (your name is
  pre-filled), QIDP quarterly confirmations, generated audit-run packs, QA document versions, and
  person records added or imported. The stamp travels with the record, so the Document Locator and
  the printed production pack show the verifier without any extra step. *Copy answer to household*
  stamps the person doing the copying — they are the one asserting it holds for the housemate.
- **Deactivate, don't delete.** Revoking an account leaves every stamp and log entry it produced
  intact.
- Accounts and the activity log ride along in **Settings → Export full backup**, so a restore keeps
  everyone's sign-in and the record of who verified what. The backup carries password *hashes*
  only, never passwords — still, keep the file where the agency keeps its other personnel data.

## Storage

The app adapts to its runtime, in order of preference:

1. **claude.ai artifact runtime** — `window.storage` with `shared: true`: one shared dataset for
   the 1–2 QA staff, same records on every device.
2. **Plain browser** — `localStorage` (per browser; use Export/Import to move between devices).
3. **No storage available** — in-memory with a warning banner; Export/Import still works.

Data is keyed compactly (one key per client bundling all their compliance records). Accounts live in
the shared dataset (`pcr:users`) so the same credentials work on every device; the activity log is
`pcr:audit`. The signed-in *session* is the one thing kept out of shared storage — it lives in this
browser's `localStorage` under `pcr:session` and expires after 12 hours. Settings has a full JSON
backup export/import.

## Cross-system sync (interim, until a second Hope Found build exists)

Person records (name, service line, living arrangement, home/location, flags, QIDP name, ISP date,
plus each period's scheduled/confirmed state in `qtr`)
are meant to be the single source of truth for a person across every Hope Found tool — this PCR
system today, and an admin dashboard planned for later that will read and write the same fields
(e.g. QIDP quarterly/ISP status, updated from MCIS). No live connection exists yet — nothing here
calls out to another app. Until it does, **Settings → Export/Import full backup** is the interim
sync path: it's plain JSON keyed by the same client `id`s used throughout the app (`clients`,
`records`, `qtr` for QIDP/ISP status, etc.), so the second build can read this export or produce a
compatible one without a data-model change on either side. When that connection is built, swap the
manual export/import for it — the person-record shape shouldn't need to change.

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
