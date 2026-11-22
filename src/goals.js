const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const okDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const cleanSteps = (v) => (Array.isArray(v) ? v : []).slice(0, 30).map((s) => ({ t: String(s?.t || '').trim().slice(0, 120), d: s?.d ? 1 : 0 })).filter((s) => s.t);
const parse = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };

export async function handleGoals(request, env, parts, email) {
  const db = env.DB;
  const id = Number(parts[1]) || 0;
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, title TEXT NOT NULL, horizon TEXT NOT NULL DEFAULT 'pendek', target_date TEXT DEFAULT '', note TEXT DEFAULT '', steps TEXT DEFAULT '[]', done INTEGER DEFAULT 0, done_at TEXT DEFAULT '')`).run();

    if (method === 'GET') {
      const rows = (await db.prepare("SELECT * FROM goals WHERE owner IN ('*', ?) ORDER BY done, (target_date = ''), target_date, id").bind(email).all()).results;
      return json({ goals: rows.map((r) => ({ ...r, steps: parse(r.steps) })) });
    }
    if (method === 'POST') {
      const title = String(body.title || '').trim();
      if (!title) return json({ error: 'Judul wajib diisi.' }, 400);
      const horizon = body.horizon === 'panjang' ? 'panjang' : 'pendek';
      await db.prepare('INSERT INTO goals (owner, title, horizon, target_date, note, steps) VALUES (?,?,?,?,?,?)')
        .bind(body.shared ? '*' : email, title.slice(0, 160), horizon, okDate(body.target_date), String(body.note || '').trim().slice(0, 500), JSON.stringify(cleanSteps(body.steps))).run();
      return json({ ok: true });
    }
    if ((method === 'PATCH' || method === 'DELETE') && id) {
      const mine = await db.prepare("SELECT id FROM goals WHERE id = ? AND owner IN ('*', ?)").bind(id, email).first();
      if (!mine) return json({ error: 'Tidak ditemukan.' }, 404);
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM goals WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
      const sets = [], vals = [];
      if (body.title !== undefined) {
        const t = String(body.title).trim();
        if (!t) return json({ error: 'Judul wajib diisi.' }, 400);
        sets.push('title = ?'); vals.push(t.slice(0, 160));
      }
      if (body.note !== undefined) { sets.push('note = ?'); vals.push(String(body.note).trim().slice(0, 500)); }
      if (body.target_date !== undefined) { sets.push('target_date = ?'); vals.push(okDate(body.target_date)); }
      if (body.horizon !== undefined) { sets.push('horizon = ?'); vals.push(body.horizon === 'panjang' ? 'panjang' : 'pendek'); }
      if (body.steps !== undefined) { sets.push('steps = ?'); vals.push(JSON.stringify(cleanSteps(body.steps))); }
      if (body.done !== undefined) { sets.push('done = ?', 'done_at = ?'); vals.push(body.done ? 1 : 0, body.done ? today() : ''); }
      if (sets.length) await db.prepare('UPDATE goals SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
      return json({ ok: true });
    }
    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
