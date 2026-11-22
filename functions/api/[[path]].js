// Backend: Cloudflare Pages Function + D1 (binding: DB)
// Login Email + PIN: USERS="ariiramaadhan@gmail.com:060125"
// Webhook Hevy / Apple Health: WEBHOOK_SECRET="hevy-apps"

const json = (d, s = 200, headers = {}) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'content-type': 'application/json', ...headers },
  });

function parseUsers(raw) {
  const map = new Map();
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const idx = entry.indexOf(':');
      if (idx > 0) {
        const email = entry.slice(0, idx).trim().toLowerCase();
        const pin = entry.slice(idx + 1).trim();
        if (email && pin) map.set(email, pin);
      }
    });
  return map;
}

function getCookie(req, name) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

async function signToken(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = enc.encode(JSON.stringify(payload));
  const data = btoa(String.fromCharCode(...bytes));
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return data + '.' + sig;
}

async function verifyToken(token, secret) {
  try {
    if (!token || !token.includes('.')) return null;
    const [data, sig] = token.split('.');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
    if (!ok) return null;
    const bin = atob(data);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function cleanNum(v) {
  const n = parseFloat(String(v ?? '0').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function cleanDate(v) {
  const s = String(v || '').trim();
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

async function ensureWorkoutsTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        duration_min INTEGER DEFAULT 0,
        calories INTEGER DEFAULT 0,
        source TEXT DEFAULT 'Hevy',
        ext_id TEXT NOT NULL,
        UNIQUE(email, ext_id)
      )`
    )
    .run();
}

export async function onRequest({ request, env, params }) {
  const users = parseUsers(env.USERS);
  const rawUsers = env.USERS || 'default';
  const secret = env.AUTH_SECRET || ('tr-secret-' + rawUsers);
  const isHttps = new URL(request.url).protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  const [res, id] = [].concat(params.path || []);
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  const db = env.DB;

  // 0. Webhook Apple Health / iOS Shortcuts: POST /api/workout-sync
  if (res === 'workout-sync' && method === 'POST') {
    const authHdr = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const urlToken = new URL(request.url).searchParams.get('token') || '';
    const token = authHdr || urlToken || String(body.token || '').trim();
    const expectedSecret = String(env.WEBHOOK_SECRET || '').trim();

    if (!expectedSecret) {
      return json({ error: 'Variabel WEBHOOK_SECRET belum diatur di Cloudflare.' }, 500);
    }
    if (!token || token !== expectedSecret) {
      return json({ error: 'Token webhook tidak valid.' }, 401);
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !users.has(email)) {
      return json({ error: 'Email tidak terdaftar di USERS.' }, 400);
    }

    const date = cleanDate(
