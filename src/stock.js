const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const txt = (v, n) => String(v ?? '').trim().slice(0, n);
const money = (v) => Math.max(0, Math.round(Number(v) || 0));
const okDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));

// Harga (IDR) dan kategori untuk tabel stok (items) yang sudah ada. Kolom ditambahkan otomatis.
export async function handleStock(request, env, parts, email) {
  const db = env.DB;
  const id = Number(parts[1]) || 0;
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  try {
    const cols = (await db.prepare('PRAGMA table_info(items)').all()).results.map((c) => c.name);
    if (!cols.length) return json({ error: 'Tabel stok belum ada.' }, 500);
    for (const [c, t] of [['price', 'INTEGER DEFAULT 0'], ['category', "TEXT DEFAULT ''"]]) {
      if (!cols.includes(c)) await db.prepare(`ALTER TABLE items ADD COLUMN ${c} ${t}`).run();
    }
    if (method === 'GET') return json({ items: (await db.prepare('SELECT id, price, category FROM items').all()).results });
    if (method === 'POST') {
      const name = txt(body.name, 80);
      if (!name) return json({ error: 'Nama barang wajib diisi.' }, 400);
      const r = await db.prepare('INSERT INTO items (name, unit, qty, in_date, note, created_by, price, category) VALUES (?,?,?,?,?,?,?,?)')
        .bind(name, txt(body.unit, 20), Number(body.qty) > 0 ? Number(body.qty) : 1, okDate(body.in_date), txt(body.note, 200), email, money(body.price), txt(body.category, 30)).run();
      return json({ ok: true, id: r?.meta?.last_row_id || 0 });
    }
    if (method === 'PATCH' && id) {
      const sets = [], vals = [];
      if (body.price !== undefined) { sets.push('price = ?'); vals.push(money(body.price)); }
      if (body.category !== undefined) { sets.push('category = ?'); vals.push(txt(body.category, 30)); }
      if (sets.length) await db.prepare('UPDATE items SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
      return json({ ok: true });
    }
    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
