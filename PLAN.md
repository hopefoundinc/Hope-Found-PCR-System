# Hope Found PCR Audit-Readiness System — Architecture & Build Plan (v1)

Built for Hope Found, Inc. (DC DDA Person-Centered Review readiness) by Isaac and Co. Consulting.
Engine/content separation is the governing principle: the app shell is provider-agnostic; everything
Hope Found-specific lives in `PROVIDER_CONFIG` at the top of the script.

## 1. Deliverable shape

One self-contained file: `index.html`. Zero network dependencies for core operation.

- Fonts: `Georgia, 'Times New Roman', serif` headings; system sans stack body. No font imports.
- No inline event handler attributes; one defensive IIFE with `addEventListener` + event delegation.
- Explicit background colors on `html` and `body`.
- No localStorage dependency: a **storage adapter** tries, in order:
  1. `window.storage` (claude.ai artifact runtime) with `{ shared: true }` — single-tenant shared dataset for 1–2 QA staff
  2. `localStorage` (plain browser / file:// use)
  3. In-memory (session only) — banner warns, export/import JSON always available
  Every call is async + try/catch. Data is keyed compactly (one key per client bundling all their
  compliance records; one key each for rubric, clients, staff, org, fire, census, settings).
- Mobile-first: horizontal-scroll wrappers on every table, no hover-only affordances, flat squared corners.

## 2. Dual mode (offline logic + Anthropic API)

Every feature works fully offline with deterministic logic. AI mode is optional and additive:

- Settings panel stores an Anthropic API key (via the storage adapter, with a plain-language warning)
  and model id (default `claude-opus-5`).
- Calls: browser `fetch` → `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`,
  `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`.
- AI features and their offline fallbacks:
  | Feature | Online | Offline fallback |
  |---|---|---|
  | CAP draft (per service line) | Claude writes a systemic corrective-action narrative from the not-met indicator list | Structured template CAP generated from the same data |
  | Readiness briefing (dashboard) | Claude narrates risk areas and priorities | Computed plain-language summary |
- Errors (no network, bad key, refusal stop reason) degrade to the offline output with a notice. Never blocks scoring.

## 3. Data model (storage keys → shapes)

- `pcr:rubric` — array of rubric items: `id, serviceLine ('org'|'staff' allowed), domain, weight (0|3|5|10),
  type (QA|QI|GATE), alert, gateParent, flagKey (client-flag that defaults a gate), questionText, intentText,
  appliesTo (living arrangements or 'all'), hcbsSettings (bool), effectiveDate, active`.
  Retiring an item sets `active:false` — never hard-delete; history preserved.
- `pcr:clients` — `id, name, serviceLine, livingArrangement, flags {hasBSP, hasRestrictiveComponents, takesMedications, ...}
  , priorPCRParticipant, sampled, activeStatus`.
- `pcr:rec:<clientId>` — one bundle per client: `{ indicatorId: { rating: met|not_met|na, gateAnswer, verifiedBy,
  verifiedDate, evidenceLocation, notes } }`.
- `pcr:staff` — staff roster + per-requirement records (requirement type, status, completed, expires, evidenceLocation).
- `pcr:org` — per-org-tool item records (three mandatory tools; HCBS Org Assessment exclusions come from config).
- `pcr:fire` — fire/emergency module: drill log entries + recurring checklist item completions.
- `pcr:census` — per-service-line census numbers for the sampling calculator.
- `pcr:settings` — AI key/model/mode, misc preferences.
- `pcr:qtr` — `qtr["<clientId>|<ispDate>|<periodKey>"] = { done, doneDate, notes, scheduledDate,
  scheduledBy, scheduledAt, confirmedBy, confirmedById, confirmedAt }`. `scheduledDate` is the annual
  ISP *meeting* booking (only the `kind: "annual"` period uses it); `done` is the filed/held receipt.
  Look-ahead windows in `PROVIDER_CONFIG.qidp`: `ispWindowDays` (30) drives the "ISP dates in the next
  30 days" list; `ispBookingOpensDays` (45) and `ispBookingDeadlineDays` (30) express the rule that the
  renewal meeting is booked 45–30 days before the ISP date — the first also drives the annual "due soon"
  badge, since that is the point staff can act, and the second gives each person a computed **book-by**
  date (ISP date − 30). `quarterlyWindowDays` (15) drives the quarterly checklist and its badges. Each list prints alone via a `body.print-only-isp` / `body.print-only-quarterly`
  class that the print stylesheet uses to hide the other `.qidp-block`s.
- `pcr:users` — accounts: `id, name, role (admin|staff), active, cred {salt, hash, algo},
  pwVersion, mustChange, createdAt, lastSignIn`. Shared, so credentials work on every device.
  `PROVIDER_CONFIG.meta.requirePassword` gates the password step end to end: when false the gate is a
  name picker, `cred` is null, `signIn` skips verification, and the password fields disappear from the
  add/manage-user modal and Settings. Roles, the activity log and every stamp behave identically either
  way, so turning it on later needs no data migration — only a password set per person.
  There is no username: `name` is the credential and the stamp both, looked up case- and
  whitespace-insensitively, and enforced unique on create and on rename — a duplicate name would make
  the audit trail ambiguous about who did what.
  `cred.algo` is `pbkdf2` (PBKDF2-HMAC-SHA256, 150k iterations, Web Crypto) or `sha256x` (iterated
  pure-JS SHA-256) — recorded per account so verification always uses the algorithm the hash was made
  with. `pwVersion` increments on every password change and is carried in the session, so a reset
  invalidates sessions still open elsewhere.
- `pcr:audit` — append-only activity log, capped at the last 400 entries:
  `{ ts, uid, name, action, detail }`. Persisted debounced (800 ms) so a burst of ratings is one write.
- `pcr:session` — **never** goes through the storage adapter. Written straight to this browser's
  `localStorage` as `{ uid, pwv, exp }` with a sliding 12-hour expiry, because in the shared
  `window.storage` runtime one person's session must never become everyone's.

Attribution: every rating carries `verifiedBy` (display name), `verifiedById` (account id, blank when
the name was typed by hand or predates sign-in) and `verifiedAt` (ISO timestamp) alongside the existing
`verifiedDate`. Clicking a rating stamps all four; un-rating clears them. The equivalent fields on other
records are `gateBy/gateAt`, `loggedBy/loggedAt` (drills), `ackBy/ackById/ackAt` (policy),
`confirmedBy/confirmedAt` (QIDP quarterlies), `createdBy` (runs, people), `uploadedBy` (QA document).

## 4. Scoring engine (Qlarant 2022 rules, implemented as pure functions)

- Applicability: indicator applies to a client if service line matches, `active`, and `appliesTo` covers the
  client's living arrangement.
- Gate logic: GATE items (weight 0) carry Yes/No. Client flags pre-answer gates (`flagKey`), QA can override.
  Gate = No ⇒ every indicator with that `gateParent` is forced N/A, excluded from scores, controls disabled.
- Total % = earned weight / possible weight across active, applicable, non-N/A **QA** indicators.
  Critical % = same restricted to weight-5 items. Computed per service line, independently.
- Tier from `m = min(total, critical)`: ≥90 + 100% HCBS-settings indicators + ≥80% satisfaction ⇒ Excellent
  (biannual cert); ≥80 ⇒ Satisfactory (annual); 70–79 ⇒ Needs Improvement (Do Not Refer, CAP + follow-up
  30–60d); 51–69 ⇒ Unsatisfactory (6-month provisional at best); ≤50 ⇒ Failed (Enhanced Monitoring / panel).
- Any Alert indicator rated Not Met anywhere overrides tier display: "ALERT — mandatory Follow-Up PCR ≤30 days",
  plus the always-visible top banner.
- Sampling: matrix (1→1, 2–24→2, … 95+→10); for census <10 also `ceil(10% + 1)`; sample =
  min(census, max(matrix, formula)); oversample flagged; prior-PCR participants flagged, never excluded.

## 5. Screens (six views + settings modal)

1. **Readiness Dashboard** — per-service-line cards: total/critical bars with 70/80/90 markers, tier, alert and
   not-met counts, minimum sample size. Standing measures: record-retrieval rate, org-tools score, staff-records
   compliance, fire/emergency readiness. Global alert banner. AI/offline readiness briefing + CAP timing info.
2. **Client Review** — client picker; full rubric walkthrough with Met/Not Met/N/A buttons, gate Yes/No controls,
   auto-N/A of gated children, verified-by/date, evidence location, collapsible surveyor-intent text, sticky
   live score summary (total %, critical %, alerts, projected tier). Client add/edit with flags.
3. **Sampling Exposure Calculator** — editable census per line, live matrix+formula computation, oversample,
   running totals, prior-PCR flags, 2-hour rule framing.
4. **Document Locator** — searchable table across client compliance records, staff records, org and fire items;
   verified location vs. "NO VERIFIED LOCATION" flag; filters; 2-hour / 4:00 PM day-one rule banner.
5. **Organization & Staff** — three mandatory org tools (with config-driven HCBS Org Assessment service-line
   exclusion note) with open-item tracking; staff roster and requirement records with expiration flags
   (OK / expiring ≤60 days / expired / missing); **fire & emergency module**: drill log per site/shift and
   recurring safety checklist with due-date logic.
6. **Rubric Manager** — the editable master rubric: filter/search, edit every field, add items, retire
   (soft-delete) items, JSON import/export so each audit cycle's criteria load without a rebuild.

Settings modal: AI mode configuration, full-data JSON export/import (backup + agency onboarding path), demo-data reset.

## 6. Seed data

Ships with a clearly-labeled **starter rubric** (representative PCR-style indicators per service line, incl.
gate families for BSP and medications, alert-flagged rights indicators, HCBS-settings and satisfaction items),
the three org tools, staff requirement types, fire checklist items, and three demo clients. The official
Qlarant-extracted rubric replaces it via Rubric Manager → Import JSON (same schema) — no rebuild.

## 7. Resale path

New agency = new `PROVIDER_CONFIG` (branding/theme CSS variables, service lines, living arrangements, flags,
org-tool applicability, requirement types) + rubric/roster JSON import. No logic edits.
