// Backend: Cloudflare Worker + D1 (binding: DB)
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

async function handleApi(request, env, pathParts) {
  const users = parseUsers(env.USERS);
  const rawUsers = env.USERS || 'default';
  const secret = env.AUTH_SECRET || ('tr-secret-' + rawUsers);
  const isHttps = new URL(request.url).protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  const [res, id] = pathParts;
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  const db = env.DB;

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

    const date = cleanDate(body.date);
    const title = String(body.title || 'Strength Training').trim() || 'Strength Training';
    const durationMin = cleanNum(body.duration_min ?? body.duration);
    const calories = cleanNum(body.calories);
    const source = String(body.source || 'Hevy').trim() || 'Hevy';
    const startTime = String(body.start_time || '').trim();
    const extId = startTime ? (date + '_' + startTime) : (date + '_' + title.toLowerCase() + '_' + durationMin);

    try {
      await ensureWorkoutsTable(db);
      await db
        .prepare(
          `INSERT INTO workouts (email, date, title, duration_min, calories, source, ext_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(email, ext_id) DO UPDATE SET
             title = excluded.title,
             duration_min = excluded.duration_min,
             calories = excluded.calories,
             source = excluded.source`
        )
        .bind(email, date, title, durationMin, calories, source, extId)
        .run();

      const matchedHabits = (
        await db
          .prepare(
            `SELECT id, kind, target FROM habits
             WHERE owner IN ('*', ?)
               AND (LOWER(name) LIKE '%olahraga%' OR LOWER(name) LIKE '%workout%' OR LOWER(name) LIKE '%gym%' OR LOWER(name) LIKE '%latihan%')`
          )
          .bind(email)
          .all()
      ).results;

      for (const h of matchedHabits) {
        const val = h.kind === 'count' ? Math.max(h.target || 1, durationMin || 1) : 1;
        await db
          .prepare(
            'INSERT INTO logs (habit_id, email, date, value) VALUES (?,?,?,?) ON CONFLICT(habit_id, email, date) DO UPDATE SET value = excluded.value'
          )
          .bind(h.id, email, date, val)
          .run();
      }

      return json({ ok: true, synced: { email, date, title, duration_min: durationMin, calories }, auto_checked: matchedHabits.length });
    } catch (e) {
      return json({ error: 'Gagal menyimpan data olahraga.' }, 500);
    }
  }

  if (res === 'login' && method === 'POST') {
    if (!users.size) {
      return json({ error: 'Variabel USERS belum diatur di Cloudflare.' }, 500);
    }
    const email = (body.email || '').trim().toLowerCase();
    const pin = String(body.pin || '').trim();
    if (!email || !pin) return json({ error: 'Email dan PIN wajib diisi.' }, 400);

    const expectedPin = users.get(email);
    if (!expectedPin || expectedPin !== pin) {
      return json({ error: 'Email atau PIN salah.' }, 401);
    }

    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const token = await signToken({ email, exp }, secret);
    const cookie = 'tr_session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (30 * 86400) + secureFlag;
    return json({ ok: true, me: email }, 200, { 'Set-Cookie': cookie });
  }

  if (res === 'logout' && method === 'POST') {
    const cookie = 'tr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + secureFlag;
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }

  const session = await verifyToken(getCookie(request, 'tr_session'), secret);
  const email = session?.email || '';
  if (!email || !users.has(email)) {
    return json({ error: 'Silakan login terlebih dahulu.' }, 401);
  }

  try {
    if (res === 'state' && method === 'GET') {
      await ensureWorkoutsTable(db);
      const since = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
      const items = (await db.prepare('SELECT * FROM items ORDER BY in_date DESC, id DESC LIMIT 500').all()).results;
      const habits = (await db.prepare("SELECT * FROM habits WHERE owner IN ('*', ?) ORDER BY id").bind(email).all()).results;
      const logs = (
        await db
          .prepare(
            "SELECT l.habit_id, l.email, l.date, l.value FROM logs l JOIN habits h ON h.id = l.habit_id WHERE l.date >= ? AND (h.owner = '*' OR l.email = ?)"
          )
          .bind(since, email)
          .all()
      ).results;
      const workouts = (await db.prepare('SELECT * FROM workouts ORDER BY date DESC, id DESC LIMIT 30').all()).results;
      return json({ me: email, items, habits, logs, workouts });
    }

    if (res === 'workouts' && id && method === 'DELETE') {
      await db.prepare('DELETE FROM workouts WHERE id = ?').bind(Number(id)).run();
      return json({ ok: true });
    }

    if (res === 'items' && method === 'POST') {
      const name = (body.name || '').trim();
      if (!name) return json({ error: 'Nama barang wajib diisi.' }, 400);
      await db
        .prepare('INSERT INTO items (name, unit, qty, in_date, note, created_by) VALUES (?,?,?,?,?,?)')
        .bind(name, (body.unit || '').trim(), Number(body.qty) || 1, body.in_date, (body.note || '').trim(), email)
        .run();
      return json({ ok: true });
    }
    if (res === 'items' && id && method === 'PATCH') {
      await db.prepare('UPDATE items SET out_date = ? WHERE id = ?').bind(body.out_date || null, Number(id)).run();
      return json({ ok: true });
    }
    if (res === 'items' && id && method === 'DELETE') {
      await db.prepare('DELETE FROM items WHERE id = ?').bind(Number(id)).run();
      return json({ ok: true });
    }

    if (res === 'habits' && method === 'POST') {
      const name = (body.name || '').trim();
      if (!name) return json({ error: 'Nama wajib diisi.' }, 400);
      const kind = body.kind === 'count' ? 'count' : 'check';
      await db
        .prepare('INSERT INTO habits (owner, name, kind, target, unit) VALUES (?,?,?,?,?)')
        .bind(body.shared ? '*' : email, name, kind, kind === 'count' ? Number(body.target) || 1 : 1, (body.unit || '').trim())
        .run();
      return json({ ok: true });
    }
    if (res === 'habits' && id && method === 'DELETE') {
      const h = await db.prepare("SELECT id FROM habits WHERE id = ? AND owner IN ('*', ?)").bind(Number(id), email).first();
      if (!h) return json({ error: 'Tidak ditemukan.' }, 404);
      await db.batch([
        db.prepare('DELETE FROM logs WHERE habit_id = ?').bind(Number(id)),
        db.prepare('DELETE FROM habits WHERE id = ?').bind(Number(id)),
      ]);
      return json({ ok: true });
    }

    if (res === 'logs' && method === 'POST') {
      const h = await db.prepare("SELECT id FROM habits WHERE id = ? AND owner IN ('*', ?)").bind(Number(body.habit_id), email).first();
      if (!h) return json({ error: 'Kebiasaan tidak ditemukan.' }, 404);
      await db
        .prepare(
          'INSERT INTO logs (habit_id, email, date, value) VALUES (?,?,?,?) ON CONFLICT(habit_id, email, date) DO UPDATE SET value = excluded.value'
        )
        .bind(h.id, email, body.date, Math.max(0, Number(body.value) || 0))
        .run();
      return json({ ok: true });
    }

    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}

export async function onRequest({ request, env, params }) {
  const slug = [].concat(params?.path || []).filter(Boolean);
  return handleApi(request, env, slug);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const slug = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
      return handleApi(request, env, slug);
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not Found', { status: 404 });
  },
};
