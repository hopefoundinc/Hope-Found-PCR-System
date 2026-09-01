# ManyChat Replacement — Self-Hosted DM Autoresponder

A free, self-hosted replacement for ManyChat for **@theaiincomegirl** on Instagram, plus the
honest playbook for TikTok (which no tool — including ManyChat — can fully automate via
official APIs).

**What it replaces:**

| ManyChat feature | This system |
|---|---|
| Comment a keyword → auto-DM with link | ✅ Comment trigger rules |
| Keyword auto-replies in DMs | ✅ DM trigger rules |
| Story reply → auto-DM | ✅ Story-reply trigger rules |
| Public "Sent! Check your DMs" comment reply | ✅ Optional per-rule |
| Send once per person / cooldowns | ✅ Built in |
| Fallback reply for unmatched DMs | ✅ Built in |
| Broadcasts to subscriber lists | ❌ Not possible — Meta only allows replies within 24h of a person messaging you. ManyChat broadcasts outside that window ride on special message tags; if you rely on broadcasts, keep an email list instead. |
| TikTok DMs | ❌ No public API exists — see the TikTok section below |

**Cost:** $0 on Render's free tier, or $7/mo for always-on hosting — vs. ManyChat Pro at
$15+/mo and climbing with your contact count. No contact limits here, ever.

Everything runs on Meta's **official Instagram API** — no password sharing, no gray-area
automation, no ban risk from unofficial tools.

---

## How it works

```
Someone comments "GUIDE" on your reel
        │
        ▼
Meta sends a webhook → your server (this app)
        │
        ▼
Rule engine matches the keyword
        │
        ▼
Server calls the Instagram API → they get your link in their DMs
        + optional public reply: "Sent! Check your DMs 📩"
```

You manage rules in a password-protected web dashboard (no code, no redeploys).

---

## Setup — about 30 minutes, one time

### Part 1: Instagram requirements (5 min)

1. Your Instagram account must be a **Professional account** (Creator or Business).
   Instagram app → Settings → Account type and tools → Switch to professional account.
   (If you used ManyChat, this is already done.)
2. In the Instagram app: **Settings → Messages and story replies → Message controls →
   Allow access to messages** — make sure connected-tool access is on.

### Part 2: Create the Meta app (10 min)

1. Go to <https://developers.facebook.com> and log in (create a developer account if
   asked — it's free and instant).
2. **My Apps → Create App**. Pick **Other → Business** if asked for a type. Name it
   anything, e.g. `AI Income Girl DMs`.
3. On the app dashboard, find the **Instagram** product and click **Set up**
   ("Instagram API setup with Instagram login").
4. Under **Generate access tokens**, click **Add account** and log in with the
   @theaiincomegirl Instagram account. Approve everything.
5. Click **Generate token** next to the account. Approve the permissions
   (`instagram_business_basic`, `instagram_business_manage_messages`,
   `instagram_business_manage_comments`). **Copy the long token** somewhere safe — this is
   your `IG_ACCESS_TOKEN`.
6. On that same Instagram setup page, copy the **Instagram app secret** — this is your
   `IG_APP_SECRET`. (Not the one under Settings → Basic; use the Instagram-specific one.)
7. Invent a random string (e.g. `aig-webhook-2026-xyz`) — this is your `IG_VERIFY_TOKEN`.

> Because you're automating **your own account**, the app can stay in development mode
> forever. App Review is only required if you ever run this for other people's accounts.

### Part 3: Deploy the server (10 min)

Any Node 18+ host works. Render is the easiest:

1. Go to <https://render.com> → sign up free → **New → Web Service**.
2. Connect this GitHub repo, set **Root Directory** to `manychat-replacement`.
3. Runtime: Node. Build command: *(leave empty)*. Start command: `npm start`.
4. Add environment variables:
   - `IG_APP_SECRET` — from Part 2 step 6
   - `IG_VERIFY_TOKEN` — from Part 2 step 7
   - `IG_ACCESS_TOKEN` — from Part 2 step 5
   - `ADMIN_PASSWORD` — invent a strong password for your dashboard
5. Deploy. Note your URL, e.g. `https://aig-dms.onrender.com`.

**Free tier caveat:** Render's free tier sleeps after 15 idle minutes. Meta retries failed
webhook deliveries, and this app also uses a keep-alive-friendly `/health` endpoint — but
for instant replies during a launch, the **$7/mo Starter plan** (always-on) is worth it.
Still less than half of ManyChat. Alternatives: Railway, Fly.io, a $4 VPS, or any host
that runs Node. If the host has a persistent disk option, point `DATA_DIR` at it so your
rules survive redeploys (on Render: add a Disk, mount at `/data`, set `DATA_DIR=/data`).
Without a disk, rules live in the app's filesystem and reset on redeploy — the dashboard
makes them quick to re-enter, but a disk is strongly recommended.

### Part 4: Connect the webhook (5 min)

1. Back in the Meta app → **Instagram → API setup**, find **Configure webhooks**.
2. Callback URL: `https://YOUR-APP-URL/webhook` (e.g. `https://aig-dms.onrender.com/webhook`).
3. Verify token: the exact `IG_VERIFY_TOKEN` string you chose.
4. Click **Verify and save** — it should turn green. (If it fails, the server isn't up
   yet or the token doesn't match.)
5. **Subscribe** to the webhook fields: `messages` and `comments`.

### Part 5: Set up your rules and test

1. Open `https://YOUR-APP-URL/` and sign in with your `ADMIN_PASSWORD`.
2. The header should say **Connected to @theaiincomegirl**. If not, re-check the token.
3. Create a rule, e.g.:
   - Trigger: *Comment on my posts/reels*
   - Keywords: `guide, link, info`
   - Reply DM: `Hey! Here's the link you asked for 💛 https://...`
   - Public reply: `Just sent it — check your DMs! 📩`
   - Enabled: ✅
4. **Save all rules.**
5. From a *different* Instagram account (a friend's, or a test account), comment `guide`
   on one of your posts. Within a few seconds the DM should arrive, and the event shows
   in the dashboard's Recent activity log.

That's it. The access token auto-refreshes weekly, so there's nothing to maintain.

---

## TikTok — the honest answer

**TikTok has no public API for DM automation.** ManyChat's TikTok "support" runs on a
closed, invite-only TikTok program, and third-party tools that claim full TikTok DM
automation use unofficial methods that risk your account. There is no safe self-hosted
equivalent today. Instead, replicate the outcome for free:

1. **TikTok's built-in auto-replies (free, official).** On a TikTok Business account:
   Inbox → ⚙️ Settings → **Auto messaging / Suggested questions & auto-replies**. Set a
   welcome message and keyword-based FAQ replies — e.g. keyword "link" → your link-in-bio
   URL. This covers the core "keyword → link" use case natively.
   (Profile → Settings → Account → Switch to Business Account if you haven't.)
2. **Route TikTok traffic to Instagram or email.** In videos and your bio, send people to
   comment on IG ("comment GUIDE on my pinned IG post") or to a link-in-bio page. Your IG
   automation (this system) or your email list does the delivery. This is also just better
   funnel practice — TikTok DMs were always the weakest link.
3. **Pin a comment with the link** on each video as the zero-effort fallback.

## Migration checklist (before you cancel ManyChat)

- [ ] Deploy this system and confirm the test DM arrives (Part 5).
- [ ] Recreate each active ManyChat keyword/comment automation as a rule here.
- [ ] If you use ManyChat broadcasts: export your contacts (ManyChat → Contacts →
      export CSV) — you can't broadcast via the API, so move that job to email.
- [ ] Run both in parallel for a few days. Note: while both are connected, **both may
      reply**. Once this system looks good, disconnect Instagram inside ManyChat
      (ManyChat → Settings → Instagram → Disconnect) and keep watching the activity log.
- [ ] Set up TikTok native auto-replies (see above).
- [ ] Cancel the ManyChat subscription: manychat.com → Settings → Billing → Cancel.

## Limits to know (Meta's rules, not this app's)

- **Private replies to comments** work on comments up to 7 days old, one private reply
  per comment.
- **DM replies** must be within 24 hours of the person's last message to you (replying
  to an inbound DM instantly, as this app does, is always fine).
- Messaging rate limits are generous (thousands/day) — fine for creator-scale volume.

## Troubleshooting

- **Webhook verify fails:** server not deployed yet, wrong URL, or `IG_VERIFY_TOKEN`
  mismatch.
- **Comments trigger nothing:** confirm you subscribed to the `comments` webhook field,
  and remember your *own* comments are ignored on purpose.
- **"Not connected" in dashboard:** the token is bad/expired — generate a fresh one
  (Part 2, step 5) and paste it in the dashboard's Access token box.
- **Replies stopped after ~60 days:** token expired without refreshing (server was down
  for a long stretch). Same fix: paste a fresh token in the dashboard.
- Check **Recent activity** in the dashboard first — every send, skip, and error is logged.
