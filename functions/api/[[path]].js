// Backend: Cloudflare Pages Function + D1 (binding: DB)
// Login menggunakan Email + PIN dari Environment Variable: USERS="email@kamu.com:123456"

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
  return `${data}.${sig}`;
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

export async function onRequest({ request, env, params }) {
  const users = parseUsers(env.USERS);
  const secret = env.AUTH_SECRET || `tr-secret-${env.USERS || 'default'}`;
  const isHttps = new URL(request.url).protocol === 'https:';
  const [res, id] = [].concat(params.path || []);
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};

  // 1. Login: POST /api/login
  if (res === 'login' && method === 'POST') {
    if (!users.size) {
      return json({ error: 'Variabel USERS belum diatur di Cloudflare Pages Settings.' }, 500);
    }
    const email = (body.email || '').trim().toLowerCase();
    const pin = String(body.pin || '').trim();
    if (!email || !pin) return json({ error: 'Email dan PIN wajib diisi.' }, 400);

    const expectedPin = users.get(email);
    if (!expectedPin || expectedPin !== pin) {
      return json({ error: 'Email atau PIN salah.' }, 401);
    }

    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // Sesi berlaku 30 hari
    const token = await signToken({ email, exp }, secret);
    const cookie = `tr_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${isHttps ? '; Secure' : ''}`;
    return json({ ok: true, me: email }, 200, { 'Set-Cookie': cookie });
  }

  // 2. Logout: POST /api/logout
  if (res === 'logout' && method === 'POST') {
    const cookie = `tr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps ? '; Secure' : ''}`;
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }

  // 3. Validasi sesi untuk semua request data
  const session = await verifyToken(getCookie(request, 'tr_session'), secret);
  const email = session?.email || '';
  if (!email || !users.has(email)) {
    return json({ error: 'Silakan login terlebih dahulu.' }, 401);
  }

  const db = env.DB;

  try {
    if (res === 'state' && method === 'GET') {
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
      return json({ me: email, items, habits, logs });
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
