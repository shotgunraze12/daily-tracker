const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const SLOTS = ['sarapan', 'siang', 'malam', 'camilan'];
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const okDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
const money = (v) => Math.max(0, Math.round(Number(v) || 0));

export async function handleMeals(request, env, parts, email) {
  const db = env.DB;
  const sub = parts[1];
  const id = Number(sub) || 0;
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, slot TEXT NOT NULL DEFAULT 'siang', name TEXT NOT NULL, price INTEGER DEFAULT 0, note TEXT DEFAULT '', done INTEGER DEFAULT 0, created_by TEXT)`).run();
    const ins = 'INSERT INTO meals (date, slot, name, price, note, created_by) VALUES (?,?,?,?,?,?)';

    if (method === 'GET') {
      const q = new URL(request.url).searchParams;
      const from = okDate(q.get('from'));
      const rows = (await db.prepare('SELECT * FROM meals WHERE date >= ? AND date <= ? ORDER BY date, id').bind(from, okDate(q.get('to') || shift(from, 6))).all()).results;
      return json({ meals: rows });
    }
    if (method === 'POST' && sub === 'copy') {
      const from = okDate(body.from_start), to = okDate(body.to_start);
      const rows = (await db.prepare('SELECT date, slot, name, price, note FROM meals WHERE date >= ? AND date <= ?').bind(from, shift(from, 6)).all()).results;
      if (!rows.length) return json({ error: 'Minggu sebelumnya belum punya menu.' }, 400);
      const off = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5);
      await db.batch(rows.map((r) => db.prepare(ins).bind(shift(r.date, off), r.slot, r.name, r.price, r.note, email)));
      return json({ ok: true, copied: rows.length });
    }
    if (method === 'POST') {
      const name = String(body.name || '').trim();
      if (!name) return json({ error: 'Nama menu wajib diisi.' }, 400);
      const slot = SLOTS.includes(body.slot) ? body.slot : 'siang';
      await db.prepare(ins).bind(okDate(body.date), slot, name, money(body.price), String(body.note || '').trim(), email).run();
      return json({ ok: true });
    }
    if (method === 'PATCH' && id) {
      const sets = [], vals = [];
      if (body.name !== undefined) {
        const n = String(body.name).trim();
        if (!n) return json({ error: 'Nama menu wajib diisi.' }, 400);
        sets.push('name = ?'); vals.push(n);
      }
      if (body.price !== undefined) { sets.push('price = ?'); vals.push(money(body.price)); }
      if (body.done !== undefined) { sets.push('done = ?'); vals.push(body.done ? 1 : 0); }
      if (sets.length) await db.prepare('UPDATE meals SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE' && id) {
      await db.prepare('DELETE FROM meals WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
