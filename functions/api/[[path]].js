// Backend: Cloudflare Pages Function + D1 (binding bernama DB)
// Identitas user diambil dari header yang dipasang Cloudflare Access setelah login.

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });

export async function onRequest({ request, env, params }) {
  const email = (request.headers.get('Cf-Access-Authenticated-User-Email') || env.DEV_EMAIL || '')
    .trim()
    .toLowerCase();
  if (!email) return json({ error: 'Belum login. Buka lewat alamat yang dilindungi Cloudflare Access.' }, 401);

  const allowed = (env.ALLOWED_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(email)) return json({ error: 'Email ini tidak diizinkan.' }, 403);

  const db = env.DB;
  const [res, id] = [].concat(params.path || []);
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};

  try {
    // Semua data untuk dashboard
    if (res === 'state' && method === 'GET') {
      const since = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
      const items = (
        await db
          .prepare('SELECT * FROM items ORDER BY in_date DESC, id DESC LIMIT 500')
          .all()
      ).results;
      const habits = (
        await db.prepare("SELECT * FROM habits WHERE owner IN ('*', ?) ORDER BY id").bind(email).all()
      ).results;
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

    // Stok
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

    // Kebiasaan (umum atau custom)
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
      const h = await db
        .prepare("SELECT id FROM habits WHERE id = ? AND owner IN ('*', ?)")
        .bind(Number(id), email)
        .first();
      if (!h) return json({ error: 'Tidak ditemukan.' }, 404);
      await db.batch([
        db.prepare('DELETE FROM logs WHERE habit_id = ?').bind(Number(id)),
        db.prepare('DELETE FROM habits WHERE id = ?').bind(Number(id)),
      ]);
      return json({ ok: true });
    }

    // Catatan harian (selalu atas nama user yang login)
    if (res === 'logs' && method === 'POST') {
      const h = await db
        .prepare("SELECT id FROM habits WHERE id = ? AND owner IN ('*', ?)")
        .bind(Number(body.habit_id), email)
        .first();
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
