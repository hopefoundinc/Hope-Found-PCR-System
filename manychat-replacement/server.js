#!/usr/bin/env node
/**
 * Self-hosted Instagram DM autoresponder — a ManyChat replacement.
 *
 * Zero npm dependencies. Node 18+ (uses built-in fetch).
 *
 * What it does:
 *  - Receives Instagram webhooks (DMs, comments, story replies) from Meta
 *  - Matches them against keyword rules you manage in a web dashboard
 *  - Sends the reply DM (or private reply to a comment) via the official
 *    Instagram API with Instagram Login
 *  - Auto-refreshes the long-lived access token so it never expires
 *
 * Required environment variables:
 *  IG_APP_SECRET    - Instagram app secret (Meta app > Instagram > API setup)
 *  IG_VERIFY_TOKEN  - any string you invent; entered again in the Meta webhook config
 *  IG_ACCESS_TOKEN  - long-lived Instagram user access token (only needed on first
 *                     boot; after that the refreshed token is persisted in DATA_DIR)
 *  ADMIN_PASSWORD   - password for the web dashboard
 * Optional:
 *  PORT             - default 3000
 *  DATA_DIR         - where rules/state are stored, default ./data
 *  GRAPH_VERSION    - default v21.0
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;
const APP_SECRET = process.env.IG_APP_SECRET || '';
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

if (!APP_SECRET || !VERIFY_TOKEN || !ADMIN_PASSWORD) {
  console.error(
    'Missing required env vars. Set IG_APP_SECRET, IG_VERIFY_TOKEN and ADMIN_PASSWORD ' +
    '(and IG_ACCESS_TOKEN on first boot). See README.md.'
  );
  process.exit(1);
}

// ---------------------------------------------------------------- storage

const DEFAULT_DATA = {
  settings: {
    // Reply sent for DMs that match no rule. Empty string = stay silent.
    fallbackDmReply: '',
    // Hours before the same rule will fire again for the same person.
    cooldownHours: 24,
    // Account info cache (filled after first successful API call).
    accountId: '',
    accountUsername: '',
  },
  token: { value: process.env.IG_ACCESS_TOKEN || '', refreshedAt: 0, expiresAt: 0 },
  rules: [
    {
      id: 'example-1',
      enabled: false,
      name: 'Example: comment "GUIDE" -> DM the link',
      trigger: 'comment', // 'dm' | 'comment' | 'story_reply'
      match: 'contains',  // 'contains' | 'exact' | 'any'
      keywords: ['guide'],
      reply: 'Hey! Here is the guide you asked for: https://example.com/guide 💛',
      publicReply: 'Just sent it to your DMs! 📩',
      oncePerUser: true,
    },
  ],
  sent: {},   // "ruleId:userId" -> last-fired timestamp (cooldown tracking)
  seen: {},   // event id -> timestamp (webhook dedupe)
  log: [],    // recent activity, newest first
};

let data;

function loadData() {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Fill in any keys added since the file was written.
    data.settings = Object.assign({}, DEFAULT_DATA.settings, data.settings);
    for (const k of ['token', 'rules', 'sent', 'seen', 'log']) {
      if (data[k] === undefined) data[k] = DEFAULT_DATA[k];
    }
  } catch {
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  // A fresh env token always wins over a stale persisted one.
  if (process.env.IG_ACCESS_TOKEN && !data.token.value) {
    data.token = { value: process.env.IG_ACCESS_TOKEN, refreshedAt: 0, expiresAt: 0 };
  }
}

let saveTimer = null;
function saveData() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      console.error('Failed to persist data:', e.message);
    }
  }, 250);
}

function logEvent(type, detail) {
  data.log.unshift({ ts: Date.now(), type, detail });
  if (data.log.length > 300) data.log.length = 300;
  saveData();
}

// ---------------------------------------------------------------- Graph API

async function graphGet(pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${pathAndQuery}${sep}access_token=${encodeURIComponent(data.token.value)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${pathAndQuery.split('?')[0]}: ${JSON.stringify(body.error || body)}`);
  return body;
}

async function graphPost(pathName, payload) {
  const res = await fetch(`${GRAPH}${pathName}?access_token=${encodeURIComponent(data.token.value)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${pathName}: ${JSON.stringify(body.error || body)}`);
  return body;
}

function sendDm(igsid, text) {
  return graphPost('/me/messages', { recipient: { id: igsid }, message: { text } });
}

function sendPrivateReplyToComment(commentId, text) {
  return graphPost('/me/messages', { recipient: { comment_id: commentId }, message: { text } });
}

function sendPublicCommentReply(commentId, text) {
  return graphPost(`/${commentId}/replies`, { message: text });
}

async function refreshAccountInfo() {
  try {
    const me = await graphGet('/me?fields=user_id,username');
    data.settings.accountId = String(me.user_id || me.id || data.settings.accountId);
    data.settings.accountUsername = me.username || data.settings.accountUsername;
    saveData();
  } catch (e) {
    logEvent('error', `Could not load account info (bad/expired token?): ${e.message}`);
  }
}

// Long-lived Instagram tokens last 60 days and can be refreshed once they are
// older than 24h. Refresh whenever the stored one is 7+ days old.
async function maybeRefreshToken() {
  const age = Date.now() - (data.token.refreshedAt || 0);
  if (data.token.refreshedAt && age < 7 * 864e5) return;
  if (!data.token.refreshedAt && !process.env.IG_ACCESS_TOKEN) return;
  try {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(data.token.value)}`
    );
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.access_token) {
      data.token = {
        value: body.access_token,
        refreshedAt: Date.now(),
        expiresAt: Date.now() + (body.expires_in || 0) * 1000,
      };
      saveData();
      logEvent('token', 'Access token refreshed');
    } else if (!data.token.refreshedAt) {
      // First boot with a token younger than 24h: Meta refuses to refresh it
      // yet. Mark it so we retry on the next cycle instead of every request.
      data.token.refreshedAt = Date.now() - 6.5 * 864e5;
      saveData();
    } else {
      logEvent('error', `Token refresh failed: ${JSON.stringify(body.error || body)}`);
    }
  } catch (e) {
    logEvent('error', `Token refresh failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------- rule engine

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function ruleMatches(rule, triggerType, text) {
  if (!rule.enabled || rule.trigger !== triggerType) return false;
  if (rule.match === 'any') return true;
  const t = normalize(text);
  if (!t) return false;
  const keywords = (rule.keywords || []).map(normalize).filter(Boolean);
  if (rule.match === 'exact') return keywords.includes(t);
  return keywords.some((k) => t.includes(k));
}

function underCooldown(rule, userId) {
  const key = `${rule.id}:${userId}`;
  const last = data.sent[key] || 0;
  if (rule.oncePerUser && last) return true;
  const hours = Number(data.settings.cooldownHours) || 0;
  return hours > 0 && Date.now() - last < hours * 3600e3;
}

function markSent(rule, userId) {
  data.sent[`${rule.id}:${userId}`] = Date.now();
  // Prune entries older than 90 days so the file stays small.
  const cutoff = Date.now() - 90 * 864e5;
  for (const [k, v] of Object.entries(data.sent)) if (v < cutoff) delete data.sent[k];
  saveData();
}

function alreadySeen(eventId) {
  if (!eventId) return false;
  if (data.seen[eventId]) return true;
  data.seen[eventId] = Date.now();
  const cutoff = Date.now() - 3 * 864e5;
  for (const [k, v] of Object.entries(data.seen)) if (v < cutoff) delete data.seen[k];
  saveData();
  return false;
}

async function handleIncomingDm(ownId, ev) {
  const msg = ev.message || {};
  const senderId = ev.sender && ev.sender.id;
  if (!senderId || msg.is_echo || String(senderId) === String(ownId)) return;
  if (alreadySeen(msg.mid)) return;

  const isStoryReply = !!(msg.reply_to && msg.reply_to.story);
  const triggerType = isStoryReply ? 'story_reply' : 'dm';
  const text = msg.text || '';

  let rule = data.rules.find((r) => ruleMatches(r, triggerType, text));
  // A story reply that matches no story rule can still match DM rules — it IS a DM.
  if (!rule && isStoryReply) rule = data.rules.find((r) => ruleMatches(r, 'dm', text));

  if (rule) {
    if (underCooldown(rule, senderId)) {
      logEvent('skip', `"${rule.name}" matched but is on cooldown for this user`);
      return;
    }
    try {
      await sendDm(senderId, rule.reply);
      markSent(rule, senderId);
      logEvent('reply', `${isStoryReply ? 'Story reply' : 'DM'} matched "${rule.name}" — replied`);
    } catch (e) {
      logEvent('error', `Send failed for "${rule.name}": ${e.message}`);
    }
    return;
  }

  const fallback = (data.settings.fallbackDmReply || '').trim();
  if (fallback && !isStoryReply) {
    const pseudo = { id: '__fallback__', oncePerUser: false };
    if (underCooldown(pseudo, senderId)) return;
    try {
      await sendDm(senderId, fallback);
      markSent(pseudo, senderId);
      logEvent('reply', 'DM matched no rule — sent fallback reply');
    } catch (e) {
      logEvent('error', `Fallback send failed: ${e.message}`);
    }
  }
}

async function handleComment(ownId, value) {
  const commentId = value.id;
  const from = value.from || {};
  if (!commentId || alreadySeen(`c:${commentId}`)) return;
  if (String(from.id) === String(ownId)) return; // our own comments/replies

  const rule = data.rules.find((r) => ruleMatches(r, 'comment', value.text));
  if (!rule) return;
  if (underCooldown(rule, from.id || commentId)) {
    logEvent('skip', `Comment matched "${rule.name}" but is on cooldown for @${from.username || from.id}`);
    return;
  }
  try {
    await sendPrivateReplyToComment(commentId, rule.reply);
    markSent(rule, from.id || commentId);
    logEvent('reply', `Comment by @${from.username || from.id} matched "${rule.name}" — DM sent`);
  } catch (e) {
    logEvent('error', `Private reply failed for "${rule.name}": ${e.message}`);
    return;
  }
  if ((rule.publicReply || '').trim()) {
    try {
      await sendPublicCommentReply(commentId, rule.publicReply.trim());
    } catch (e) {
      logEvent('error', `Public comment reply failed: ${e.message}`);
    }
  }
}

async function processWebhook(payload) {
  if (payload.object !== 'instagram' || !Array.isArray(payload.entry)) return;
  for (const entry of payload.entry) {
    const ownId = entry.id || data.settings.accountId;
    if (ownId && !data.settings.accountId) {
      data.settings.accountId = String(ownId);
      saveData();
    }
    for (const ev of entry.messaging || []) {
      if (ev.message) await handleIncomingDm(ownId, ev).catch((e) => logEvent('error', e.message));
    }
    for (const change of entry.changes || []) {
      if (change.field === 'comments' || change.field === 'live_comments') {
        await handleComment(ownId, change.value || {}).catch((e) => logEvent('error', e.message));
      }
    }
  }
}

// ---------------------------------------------------------------- HTTP server

function timingSafeEq(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function validSignature(rawBody, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  return timingSafeEq(header.slice(7), expected);
}

function isAdmin(req) {
  return timingSafeEq(req.headers['x-admin-key'] || '', ADMIN_PASSWORD);
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body);
}

function sanitizeRules(input) {
  if (!Array.isArray(input)) throw new Error('rules must be an array');
  return input.slice(0, 200).map((r, i) => ({
    id: String(r.id || `rule-${Date.now()}-${i}`).slice(0, 64),
    enabled: !!r.enabled,
    name: String(r.name || 'Untitled rule').slice(0, 120),
    trigger: ['dm', 'comment', 'story_reply'].includes(r.trigger) ? r.trigger : 'dm',
    match: ['contains', 'exact', 'any'].includes(r.match) ? r.match : 'contains',
    keywords: (Array.isArray(r.keywords) ? r.keywords : []).map((k) => String(k).slice(0, 80)).filter(Boolean).slice(0, 30),
    reply: String(r.reply || '').slice(0, 1000),
    publicReply: String(r.publicReply || '').slice(0, 300),
    oncePerUser: !!r.oncePerUser,
  }));
}

const ADMIN_HTML = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  try {
    // --- Meta webhook verification handshake
    if (req.method === 'GET' && url.pathname === '/webhook') {
      if (url.searchParams.get('hub.mode') === 'subscribe' &&
          url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(url.searchParams.get('hub.challenge') || '');
      } else {
        res.writeHead(403); res.end();
      }
      return;
    }

    // --- Webhook deliveries
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const raw = await readBody(req);
      if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
        res.writeHead(401); res.end();
        return;
      }
      res.writeHead(200); res.end('OK'); // ack fast; Meta times out at ~20s
      let payload;
      try { payload = JSON.parse(raw.toString('utf8')); } catch { return; }
      processWebhook(payload).catch((e) => logEvent('error', `Webhook processing: ${e.message}`));
      return;
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }

    // --- Admin dashboard
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(ADMIN_HTML);
      return;
    }

    // --- Admin API
    if (url.pathname.startsWith('/api/')) {
      if (!isAdmin(req)) { json(res, 401, { error: 'unauthorized' }); return; }

      if (req.method === 'GET' && url.pathname === '/api/state') {
        json(res, 200, {
          account: {
            id: data.settings.accountId,
            username: data.settings.accountUsername,
          },
          token: {
            present: !!data.token.value,
            refreshedAt: data.token.refreshedAt,
            expiresAt: data.token.expiresAt,
          },
          settings: {
            fallbackDmReply: data.settings.fallbackDmReply,
            cooldownHours: data.settings.cooldownHours,
          },
          rules: data.rules,
          log: data.log.slice(0, 100),
        });
        return;
      }

      if (req.method === 'PUT' && url.pathname === '/api/rules') {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        data.rules = sanitizeRules(body.rules);
        saveData();
        logEvent('admin', 'Rules updated');
        json(res, 200, { ok: true, rules: data.rules });
        return;
      }

      if (req.method === 'PUT' && url.pathname === '/api/settings') {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        if (body.fallbackDmReply !== undefined) {
          data.settings.fallbackDmReply = String(body.fallbackDmReply).slice(0, 1000);
        }
        if (body.cooldownHours !== undefined) {
          const h = Number(body.cooldownHours);
          data.settings.cooldownHours = Number.isFinite(h) && h >= 0 ? Math.min(h, 8760) : 24;
        }
        saveData();
        logEvent('admin', 'Settings updated');
        json(res, 200, { ok: true });
        return;
      }

      if (req.method === 'PUT' && url.pathname === '/api/token') {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        if (!body.token) { json(res, 400, { error: 'token required' }); return; }
        data.token = { value: String(body.token), refreshedAt: 0, expiresAt: 0 };
        saveData();
        await refreshAccountInfo();
        logEvent('admin', 'Access token replaced');
        json(res, 200, { ok: true, username: data.settings.accountUsername });
        return;
      }

      json(res, 404, { error: 'not found' });
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  } catch (e) {
    try { json(res, 500, { error: e.message }); } catch { /* headers already sent */ }
  }
});

loadData();
server.listen(PORT, () => {
  console.log(`DM autoresponder listening on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/  |  Webhook path: /webhook`);
  refreshAccountInfo();
  maybeRefreshToken();
  setInterval(maybeRefreshToken, 12 * 3600e3);
});
