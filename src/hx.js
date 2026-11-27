const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const txt = (v, n) => String(v ?? '').trim().slice(0, n);
const SLOTS = ['pagi', 'kapan', 'malam'];
const HEX = /^#[0-9a-f]{6}$/i;

// Kustomisasi habit (ikon, warna, waktu) + riwayat panjang untuk heatmap. Memakai tabel habits dan logs yang sudah ada.
export async function handleHx(request, env, parts, email) {
  const db = env.DB;
  const id = Number(parts[1]) || 0;
  const method = request.method;
  const body = method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {};
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS habit_meta (habit_id INTEGER PRIMARY KEY, color TEXT DEFAULT '', icon TEXT DEFAULT '', slot TEXT DEFAULT 'kapan')`).run();
    const upsert = (hid, b) => db.prepare('INSERT INTO habit_meta (habit_id, color, icon, slot) VALUES (?,?,?,?) ON CONFLICT(habit_id) DO UPDATE SET color = excluded.color, icon = excluded.icon, slot = excluded.slot')
      .bind(hid, HEX.test(b.color || '') ? b.color : '', txt(b.icon, 8), SLOTS.includes(b.slot) ? b.slot : 'kapan');
    const core = (b) => { const kind = b.kind === 'count' ? 'count' : 'check'; return [txt(b.name, 80), kind, kind === 'count' ? Math.max(1, Math.round(Number(b.target) || 1)) : 1, txt(b.unit, 20)]; };

    if (method === 'GET') {
      const days = Math.min(400, Math.max(7, Number(new URL(request.url).searchParams.get('days')) || 150));
      const since = new Date(Date.now() + 7 * 3600e3 - days * 864e5).toISOString().slice(0, 10);
      const meta = (await db.prepare("SELECT m.* FROM habit_meta m JOIN habits h ON h.id = m.habit_id WHERE h.owner IN ('*', ?)").bind(email).all()).results;
      const logs = (await db.prepare('SELECT habit_id, date, value FROM logs WHERE email = ? AND date >= ?').bind(email, since).all()).results;
      return json({ meta, logs });
    }
    if (method === 'POST') {
      const c = core(body);
      if (!c[0]) return json({ error: 'Nama habit wajib diisi.' }, 400);
      const r = await db.prepare('INSERT INTO habits (owner, name, kind, target, unit) VALUES (?,?,?,?,?)').bind(body.shared ? '*' : email, ...c).run();
      const hid = r?.meta?.last_row_id;
      if (hid) await upsert(hid, body).run();
      return json({ ok: true, id: hid || 0 });
    }
    if ((method === 'PATCH' || method === 'DELETE') && id) {
      const h = await db.prepare("SELECT id FROM habits WHERE id = ? AND owner IN ('*', ?)").bind(id, email).first();
      if (!h) return json({ error: 'Habit tidak ditemukan.' }, 404);
      if (method === 'DELETE') {
        await db.batch([db.prepare('DELETE FROM logs WHERE habit_id = ?').bind(id), db.prepare('DELETE FROM habit_meta WHERE habit_id = ?').bind(id), db.prepare('DELETE FROM habits WHERE id = ?').bind(id)]);
        return json({ ok: true });
      }
      const c = core(body);
      if (!c[0]) return json({ error: 'Nama habit wajib diisi.' }, 400);
      await db.prepare('UPDATE habits SET name = ?, kind = ?, target = ?, unit = ? WHERE id = ?').bind(...c, id).run();
      await upsert(id, body).run();
      return json({ ok: true });
    }
    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
