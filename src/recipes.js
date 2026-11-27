const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const txt = (v, n) => String(v ?? '').trim().slice(0, n);
const num = (v) => Math.max(0, Math.round(Number(v) || 0));
const FIELDS = ['title', 'method', 'main', 'kind', 'tags', 'time_min', 'servings', 'calories', 'protein', 'ingredients', 'steps', 'source'];
const clean = (b) => ({ title: txt(b.title, 120), method: txt(b.method, 40), main: txt(b.main, 40), kind: txt(b.kind, 40), tags: txt(b.tags, 120), time_min: num(b.time_min), servings: Math.max(1, num(b.servings)), calories: num(b.calories), protein: num(b.protein), ingredients: txt(b.ingredients, 3000), steps: txt(b.steps, 5000), source: txt(b.source, 300) });

export async function handleRecipes(request, env, parts, email) {
  const db = env.DB;
  const id = Number(parts[1]) || 0;
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS recipes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, method TEXT DEFAULT '', main TEXT DEFAULT '', kind TEXT DEFAULT '', tags TEXT DEFAULT '', time_min INTEGER DEFAULT 0, servings INTEGER DEFAULT 1, calories INTEGER DEFAULT 0, protein INTEGER DEFAULT 0, ingredients TEXT DEFAULT '', steps TEXT DEFAULT '', source TEXT DEFAULT '', created_by TEXT)`).run();

    if (method === 'GET') {
      const rows = (await db.prepare('SELECT * FROM recipes ORDER BY id DESC').all()).results;
      return json({ recipes: rows });
    }
    if (method === 'POST') {
      const r = clean(body);
      if (!r.title) return json({ error: 'Nama resep wajib diisi.' }, 400);
      await db.prepare(`INSERT INTO recipes (${FIELDS.join(', ')}, created_by) VALUES (${FIELDS.map(() => '?').join(', ')}, ?)`).bind(...FIELDS.map((k) => r[k]), email).run();
      return json({ ok: true });
    }
    if ((method === 'PATCH' || method === 'DELETE') && id) {
      const row = await db.prepare('SELECT created_by FROM recipes WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Resep tidak ditemukan.' }, 404);
      if (row.created_by !== email) return json({ error: 'Hanya pembuat resep yang bisa mengubah atau menghapusnya.' }, 403);
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
      const r = clean(body);
      if (!r.title) return json({ error: 'Nama resep wajib diisi.' }, 400);
      await db.prepare(`UPDATE recipes SET ${FIELDS.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).bind(...FIELDS.map((k) => r[k]), id).run();
      return json({ ok: true });
    }
    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
