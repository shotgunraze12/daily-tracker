/* Dashboard, Housing (grafik, tabel, harga IDR) dan Ringkasan Food. Taruh paling akhir di index.html, setelah script Food. */
(() => {
  const css = document.createElement('style');
  css.textContent = `
.dgrid{display:grid;gap:12px}
@media(min-width:860px){.dgrid{grid-template-columns:1fr 1fr}}
.pv{margin:0}
.dr{display:flex;align-items:center;gap:10px;padding:8px 0}.dr+.dr{border-top:1px solid var(--line)}
.hi2{width:38px;height:38px;border-radius:12px;background:rgba(128,138,160,.16);display:grid;place-items:center;font-size:20px;flex:none}
.rb{width:38px;height:38px;border-radius:50%;border:2px solid var(--c);background:transparent;color:var(--c);display:grid;place-items:center;padding:0;min-height:0;font-size:20px;flex:none}
.rb.on{background:var(--c);color:#fff}
.hb .hn{width:110px}.hb.w b{width:92px}
.pg{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:12px}.pg b{font:700 20px/1.2 'Bricolage Grotesque',sans-serif;display:block}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 12px;align-items:center}.toolbar input{flex:1;min-width:140px}.toolbar select{width:auto;flex:none}.toolbar .seg{margin:0}
.sgrid{display:grid;grid-template-columns:96px repeat(7,1fr);gap:8px 4px;align-items:center;font-size:13px}.sgrid .dot{margin:auto}`;
  document.head.appendChild(css);

  ICONS.dash = 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z';
  TOP.unshift(['dash', 'Dashboard', 'dash']);
  const CATS = ['Makanan', 'Minuman', 'Bumbu & dapur', 'Kebersihan', 'Perawatan diri', 'Kesehatan', 'Rumah tangga', 'Lainnya'];
  const SLN = { sarapan: 'Sarapan', siang: 'Makan siang', malam: 'Makan malam', camilan: 'Camilan' };
  const X = { p: {}, meals: [], recipes: [], goals: [], loaded: false, loading: false };
  const HS = { q: '', cat: '', view: 'tabel' };

  const idr = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
  const rpParse = v => {
    const s = String(v || '').toLowerCase().trim(), m = s.match(/^([\d.,]+)\s*(rb|ribu|k|jt|juta)?$/);
    if (!m) return parseInt(s.replace(/\D/g, '')) || 0;
    if (!m[2]) return parseInt(m[1].replace(/\D/g, '')) || 0;
    return Math.round((parseFloat(m[1].replace(',', '.')) || 0) * (/^j/.test(m[2]) ? 1e6 : 1e3));
  };
  const weekStart = d => addDays(d, -((new Date(d + 'T00:00:00').getDay() + 6) % 7));
  const mlab = m => new Date(m + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short' });
  const months6 = () => [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d.toLocaleDateString('sv-SE').slice(0, 7); });
  const colChart = (vals, labels, f) => { const m = Math.max(1, ...vals); return `<div class="plot">${vals.map(v => `<div class="cbs"><i class="cb me" style="height:${v / m * 100}%" title="${f(v)}"></i></div>`).join('')}</div><div class="lbls">${labels.map(l => `<span>${l}</span>`).join('')}</div>`; };
  const barRows = (arr, f, w) => { const m = Math.max(1, ...arr.map(r => r[1])); return arr.map(([n, v]) => `<div class="hb${w ? ' w' : ''}"><span class="hn">${esc(n)}</span><div class="bar sp"><i style="width:${v / m * 100}%"></i></div><b>${f(v)}</b></div>`).join(''); };
  const pv = (ic, title, k, body) => `<div class="card pv"><div class="row" style="margin-bottom:12px"><span class="ic">${icon(ic, 20)}</span><b class="sp" style="font-size:17px">${title}</b><button class="x" onclick="go('${k}')">Buka</button></div>${body}</div>`;

  /* data tambahan (harga stok, meal minggu ini, resep, target) */
  async function loadX() {
    X.loading = true;
    const wk = weekStart(today());
    const get = p => api('GET', p).catch(e => { if (e.status === 401) throw e; return {}; });
    try {
      const [st, ml, rc, gl] = await Promise.all([get('stock'), get(`meals?from=${wk}&to=${addDays(wk, 6)}`), get('recipes'), get('goals')]);
      X.p = {}; (st.items || []).forEach(i => { X.p[i.id] = i; });
      X.meals = ml.meals || []; X.recipes = rc.recipes || []; X.goals = gl.goals || [];
      return true;
    } catch (e) { if (e.status === 401) renderLogin(); return false; }
    finally { X.loaded = true; X.loading = false; }
  }
  const reloadX = () => { X.loaded = false; render(); };

  /* stok */
  const pr = i => X.p[i.id]?.price || i.price || 0;
  const ct = i => X.p[i.id]?.category || i.category || 'Lainnya';
  function stockInfo() {
    const act = S.items.filter(i => !i.out_date), fin = S.items.filter(i => i.out_date);
    const al = act.filter(i => { const a = avgLast(i.name); return a != null && diff(i.in_date, today()) >= a * .85; });
    const mo = today().slice(0, 7);
    return { act, fin, al, names: new Set(act.map(i => key(i.name))), value: act.reduce((s, i) => s + pr(i), 0), spend: S.items.filter(i => (i.in_date || '').slice(0, 7) === mo).reduce((s, i) => s + pr(i), 0) };
  }
  const byCat = act => CATS.map(c => [c, new Set(act.filter(i => ct(i) === c).map(i => key(i.name))).size]);

  window.stForm = (prefill) => {
    const last = S.items.filter(i => i.id === prefill)[0] || {};
    $('#panel').innerHTML = `<h2>${prefill ? 'Tambah stok' : 'Barang baru'}</h2>
    <input id="sf-name" list="sf-names" placeholder="Nama barang (galon, beras, telur)" value="${esc(last.name)}" autocomplete="off">
    <datalist id="sf-names">${[...new Set(S.items.map(i => i.name))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="lab">Kategori</div><select id="sf-cat">${CATS.map(c => `<option ${c === (last.id ? ct(last) : 'Makanan') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <div class="grid" style="margin-top:10px"><input id="sf-qty" type="number" step="any" min="0" value="1" aria-label="Jumlah"><input id="sf-unit" placeholder="Satuan (buah, kg)" value="${esc(last.unit)}"></div>
    <div class="lab">Tanggal masuk dan harga</div><div class="grid"><input id="sf-date" type="date" value="${today()}"><input id="sf-price" inputmode="text" placeholder="Harga total (IDR), misal 25000 atau 25rb"></div>
    <input id="sf-note" placeholder="Catatan, boleh kosong">
    <div class="row" style="margin-top:18px"><button class="p sp" onclick="stSave()">Simpan</button><button onclick="closeSheet()">Batal</button></div>`;
    $('#sheet').hidden = false; setTimeout(() => $('#sf-name').focus(), 60);
  };
  window.stSave = async () => {
    const name = $('#sf-name').value.trim(); if (!name) return;
    await api('POST', 'stock', { name, category: $('#sf-cat').value, qty: $('#sf-qty').value, unit: $('#sf-unit').value, in_date: $('#sf-date').value, price: rpParse($('#sf-price').value), note: $('#sf-note').value });
    closeSheet(); X.loaded = false; await load();
  };
  window.stPrice = async (id, cur) => {
    const v = prompt('Harga total (IDR), misal 25000 atau 25rb', cur || ''); if (v === null) return;
    await api('PATCH', 'stock/' + id, { price: rpParse(v) }); reloadX();
  };
  window.stFilter = () => { HS.q = $('#st-q').value; HS.cat = $('#st-cat').value; stBody(); };
  window.stView = v => { HS.view = v; drawHousing(); };

  const ncard = i => {
    const age = diff(i.in_date, today()), avg = avgLast(i.name);
    const est = avg == null ? '' : age >= avg ? '<span class="tag warn">Sekitar habis</span>' : `<span class="tag">Sekitar ${Math.round(avg - age)} hari lagi</span>`;
    return `<div class="card"><div class="row"><div class="sp"><b>${esc(i.name)}</b> <span class="mut">${i.qty} ${esc(i.unit)}</span>
      <div><span class="tag" style="margin-right:6px">${esc(ct(i))}</span>${est}</div><div class="mut" style="margin-top:6px">Masuk ${fmt(i.in_date)}, sudah ${age} hari</div>${i.note ? `<div class="mut">${esc(i.note)}</div>` : ''}</div>
      <div style="text-align:right"><button class="x" onclick="stPrice(${i.id},${pr(i)})">${pr(i) ? idr(pr(i)) : 'Isi harga'}</button><div><button class="p" onclick="markOut(${i.id},'${today()}')">Habis</button></div></div></div></div>`;
  };
  function stBody() {
    const el = $('#st-body'); if (!el) return;
    const q = HS.q.toLowerCase(), ok = i => (!q || i.name.toLowerCase().includes(q)) && (!HS.cat || ct(i) === HS.cat);
    const act = S.items.filter(i => !i.out_date && ok(i)), fin = S.items.filter(i => i.out_date && ok(i)).sort((a, b) => b.out_date.localeCompare(a.out_date)).slice(0, 30);
    let main;
    if (!act.length) main = '<div class="card mut">Belum ada barang yang cocok. Tekan Tambah barang untuk mencatat stok pertamamu.</div>';
    else if (HS.view === 'kartu') main = `<div class="cards2">${act.slice().sort((a, b) => a.name.localeCompare(b.name)).map(ncard).join('')}</div>`;
    else {
      const g = {};
      act.forEach(i => (g[key(i.name)] || (g[key(i.name)] = { n: i.name, u: i.unit, c: ct(i), it: [] })).it.push(i));
      const trs = Object.values(g).sort((a, b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n)).map(x => {
        const s = x.it.sort((a, b) => a.in_date.localeCompare(b.in_date) || a.id - b.id), o = s[0], age = diff(o.in_date, today()), avg = avgLast(x.n);
        const qty = s.reduce((a, i) => a + (+i.qty || 0), 0), val = s.reduce((a, i) => a + pr(i), 0);
        const est = avg == null ? '<span class="mut">Belum ada data</span>' : age >= avg ? '<span class="tag warn" style="margin:0">Sekitar habis</span>' : `<span class="mut">sekitar ${Math.round(avg - age)} hari lagi</span>`;
        return `<tr><td><b>${esc(x.n)}</b><div class="mut">${esc(x.c)}</div></td><td>${+qty.toFixed(2)} ${esc(x.u)}<div class="mut">${s.length} batch</div></td><td>${age} hari</td><td>${est}</td><td>${val ? idr(val) : '<span class="mut">-</span>'}</td>
          <td style="white-space:nowrap"><button class="x" onclick="stForm(${s[s.length - 1].id})">Tambah</button><button class="x" onclick="markOut(${o.id},'${today()}')">Habis</button></td></tr>`;
      }).join('');
      main = `<div class="card"><div class="tw"><table><thead><tr><th>Barang</th><th>Stok</th><th>Umur tertua</th><th>Perkiraan</th><th>Nilai</th><th></th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
    }
    const hist = fin.length ? `<div class="card"><div class="tw"><table><thead><tr><th>Barang</th><th>Periode</th><th>Bertahan</th><th>Harga</th><th></th></tr></thead><tbody>${fin.map(i => `<tr><td><b>${esc(i.name)}</b><div class="mut">${i.qty} ${esc(i.unit)}</div></td><td>${fmt(i.in_date)} sampai ${fmt(i.out_date)}</td><td>${diff(i.in_date, i.out_date)} hari</td><td>${pr(i) ? idr(pr(i)) : '-'}</td><td style="white-space:nowrap"><button class="x" onclick="markOut(${i.id},null)">Batalkan</button><button class="x" onclick="delItem(${i.id})">Hapus</button></td></tr>`).join('')}</tbody></table></div></div>` : '<div class="empty">Riwayat barang habis akan muncul di sini.</div>';
    el.innerHTML = main + '<h2 style="margin-top:22px">Sudah habis</h2>' + hist;
  }
  drawHousing = () => {
    const si = stockInfo(), ms = months6();
    const spendM = ms.map(m => S.items.filter(i => (i.in_date || '').slice(0, 7) === m).reduce((s, i) => s + pr(i), 0));
    $('#app').innerHTML = `<div class="row" style="margin-bottom:14px"><div class="sp"><h1>Housing</h1><div class="mut">Apa saja yang kamu punya, kapan habis, dan berapa belanjanya.</div></div><button class="p" onclick="stForm()">Tambah barang</button></div>
    <div class="stats">${stat('box', si.names.size, 'Jenis barang')}${stat('home', idr(si.value), 'Nilai stok')}${stat('utensils', idr(si.spend), 'Belanja bulan ini')}${stat('alert', si.al.length, 'Perlu dicek', si.al.length > 0)}</div>
    <div class="duo" style="margin-top:10px"><div class="card"><b>Stok per kategori</b><div class="mut" style="margin-bottom:4px">Jumlah jenis barang yang masih ada</div>${barRows(byCat(si.act), v => v)}</div>
      <div class="card"><b>Belanja per bulan</b><div class="mut">Total harga barang masuk (IDR)</div>${colChart(spendM, ms.map(mlab), idr)}</div></div>
    ${lastChart()}
    <div class="toolbar"><input id="st-q" placeholder="Cari barang" value="${esc(HS.q)}" oninput="stFilter()"><select id="st-cat" onchange="stFilter()"><option value="">Semua kategori</option>${CATS.map(c => `<option ${c === HS.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <div class="seg"><button class="${HS.view === 'tabel' ? 'on' : ''}" onclick="stView('tabel')">Tabel</button><button class="${HS.view === 'kartu' ? 'on' : ''}" onclick="stView('kartu')">Kartu</button></div></div>
    <div id="st-body"></div>`;
    stBody();
  };

  /* ringkasan food */
  function drawFood() {
    const t = today(), wd = [...Array(7)].map((_, i) => addDays(weekStart(t), i)), kc = m => (m.calories || 0) * (m.servings || 1);
    const per = wd.map(d => X.meals.filter(m => m.date === d).reduce((s, m) => s + kc(m), 0)), tot = per.reduce((a, b) => a + b, 0);
    const cnt = k => { const c = {}; X.recipes.forEach(r => { if (r[k]) c[r[k]] = (c[r[k]] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6); };
    const bars = (k, dflt) => { const r = cnt(k); return r.length ? barRows(r, v => v) : `<div style="opacity:.5">${barRows(dflt.map(n => [n, 0]), v => v)}</div><div class="mut">Grafik terisi setelah resep pertama ditambahkan.</div>`; };
    const cov = `<div class="sgrid"><span></span>${wd.map(d => `<span class="mut" style="text-align:center">${dayLbl(d)}</span>`).join('')}${Object.entries(SLN).map(([k, l]) => `<span>${l}</span>${wd.map(d => `<i class="dot ${X.meals.some(m => m.date === d && m.slot === k) ? 'on' : ''}"></i>`).join('')}`).join('')}</div>`;
    $('#app').innerHTML = `<div class="ph"><h1>Food</h1><div class="mut">Ringkasan rencana makan dan resepmu.</div></div>
    <div class="stats">${stat('utensils', X.meals.length + ' menu', 'Terencana minggu ini')}${stat('check', Math.round(tot) + ' kkal', 'Total minggu ini')}${stat('activity', Math.round(tot / 7) + ' kkal', 'Rata-rata per hari')}${stat('home', X.recipes.length, 'Resep tersimpan')}</div>
    <div class="duo" style="margin-top:10px"><div class="card"><b>Kalori per hari</b>${colChart(per, wd.map(dayLbl), v => Math.round(v) + ' kkal')}</div>
      <div class="card"><b>Slot makan terisi</b><div class="mut" style="margin-bottom:10px">Minggu ini</div>${cov}</div>
      <div class="card"><b>Resep per cara masak</b>${bars('method', ['Goreng', 'Tumis', 'Rebus', 'Kukus', 'Panggang oven'])}</div>
      <div class="card"><b>Resep per bahan utama</b>${bars('main', ['Ayam', 'Ikan & seafood', 'Telur', 'Tahu & tempe', 'Sayuran'])}</div></div>
    <div class="row" style="margin:14px 0 10px"><h2 class="sp" style="margin:0">Resep terbaru</h2><button onclick="go('meal')">Buka meal plan</button><button onclick="go('recipes')">Buka resep</button></div>
    <div class="cards2">${X.recipes.slice(0, 4).map(r => `<div class="card"><div class="row"><div class="sp"><b>${esc(r.title)}</b><div class="mut">${[r.method, r.main].filter(Boolean).map(esc).join(', ')}${r.calories ? ', ' + r.calories + ' kkal/porsi' : ''}</div></div><button onclick="RC.open(${r.id})">Lihat</button></div></div>`).join('') || '<div class="empty">Belum ada resep. Buka tab Resep untuk menambah yang pertama.</div>'}</div>`;
  }

  /* dashboard */
  window.dSet = async (id, v) => {
    const t = today();
    await api('POST', 'logs', { habit_id: id, date: t, value: v });
    (H.logs[id] || (H.logs[id] = {}))[t] = v;
    const sl = S.logs.find(l => l.habit_id === id && l.email === S.me && l.date === t);
    if (sl) sl.value = v; else S.logs.push({ habit_id: id, email: S.me, date: t, value: v });
    render();
  };
  function drawDash() {
    const t = today(), hs = S.habits, Name = S.me.split('@')[0].replace(/^./, c => c.toUpperCase());
    const dn = hs.filter(h => isDone(h, t)).length, pct = hs.length ? dn / hs.length * 100 : 0;
    const days = last7(), rate = days.map(d => hs.length ? hs.filter(h => isDone(h, d)).length / hs.length * 100 : 0);
    const order = [...hs.filter(h => !isDone(h, t)), ...hs.filter(h => isDone(h, t))].slice(0, 6);
    const best = hs.slice().sort((a, b) => streak(b) - streak(a))[0];
    const hrow = h => {
      const col = colorOf(h)[0], v = Lval(h.id, t), tg = target(h), d = v >= tg;
      const ctl = h.kind === 'count' ? `<button class="rb ${d ? 'on' : ''}" style="--c:${col}" aria-label="Tambah" onclick="dSet(${h.id},${v + 1})">+</button>` : `<button class="rb ${d ? 'on' : ''}" style="--c:${col}" aria-label="${d ? 'Batalkan' : 'Tandai selesai'}" onclick="dSet(${h.id},${d ? 0 : 1})">${icon('check', 18)}</button>`;
      return `<div class="dr"><span class="hi2">${esc(meta(h).icon || '⭐')}</span><div class="sp"><b>${esc(h.name)}</b><div class="mut">${h.kind === 'count' ? `${v}/${tg} ${esc(h.unit)}, ` : ''}${streak(h)} hari beruntun</div></div>${ctl}</div>`;
    };
    const habit = `<div class="row"><b class="sp">${dn} dari ${hs.length} habit selesai hari ini</b><span class="mut">${Math.round(pct)}%</span></div><div class="bar" style="margin-bottom:10px"><i style="width:${pct}%"></i></div>
      ${order.map(hrow).join('') || '<div class="empty">Belum ada habit. Buka tab Habit lalu tekan +.</div>'}
      <div class="mut" style="margin-top:12px">Penyelesaian 7 hari terakhir (persen)</div>${colChart(rate, days.map(dayLbl), v => Math.round(v) + '%')}
      ${best && streak(best) > 0 ? `<div class="mut" style="margin-top:8px">Streak terpanjang: ${esc(best.name)}, ${streak(best)} hari</div>` : ''}`;
    const si = stockInfo(), cats = byCat(si.act).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const housing = `<div class="pg"><div><b>${si.names.size}</b><span class="mut">jenis barang</span></div><div><b>${idr(si.value)}</b><span class="mut">nilai stok</span></div><div><b>${si.al.length}</b><span class="mut">perlu dicek</span></div></div>
      ${si.al.length ? si.al.slice(0, 3).map(i => `<div class="dr"><span class="hi2">📦</span><div class="sp"><b>${esc(i.name)}</b><div class="mut">Sudah ${diff(i.in_date, today())} hari, biasanya sekitar habis</div></div></div>`).join('') : '<div class="empty">Belum ada barang yang mendekati habis.</div>'}
      <div class="mut" style="margin:12px 0 6px">Stok per kategori</div>${cats.length ? barRows(cats, v => v) : '<div class="empty">Grafik muncul setelah stok pertama dicatat di tab Housing.</div>'}`;
    const wk = [...Array(7)].map((_, i) => addDays(weekStart(t), i)), kc = m => (m.calories || 0) * (m.servings || 1);
    const per = wk.map(d => X.meals.filter(m => m.date === d).reduce((s, m) => s + kc(m), 0)), tm = X.meals.filter(m => m.date === t);
    const food = `${tm.length ? tm.map(m => `<div class="dr"><span class="hi2">🍽️</span><div class="sp"><b>${esc(m.name)}</b><div class="mut">${SLN[m.slot] || m.slot}${m.calories ? ', ' + Math.round(kc(m)) + ' kkal' : ''}</div></div></div>`).join('') : '<div class="empty">Belum ada menu untuk hari ini.</div>'}
      <div class="mut" style="margin-top:12px">Kalori minggu ini</div>${colChart(per, wk.map(dayLbl), v => Math.round(v) + ' kkal')}<div class="mut" style="margin-top:8px">${X.recipes.length} resep tersimpan</div>`;
    const ga = X.goals.filter(g => !g.done), gp = g => { const s = g.steps || []; return s.length ? Math.round(s.filter(x => x.d).length / s.length * 100) : 0; };
    const dreams = ga.length ? barRows(ga.slice(0, 4).map(g => [g.title, gp(g)]), v => v + '%') + `<div class="mut" style="margin-top:8px">${ga.filter(g => g.horizon === 'pendek').length} jangka pendek, ${ga.filter(g => g.horizon === 'panjang').length} jangka panjang, ${X.goals.length - ga.length} tercapai</div>` : '<div class="empty">Belum ada target. Buka tab Dreams untuk menuliskan mimpi pertamamu.</div>';
    $('#app').innerHTML = `<h1>Halo, ${esc(Name)}</h1><div class="mut">${new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <div class="dgrid" style="margin-top:16px">${pv('habit', 'Habit', 'habit', habit)}${pv('home', 'Housing', 'housing', housing)}${pv('utensils', 'Food', 'foodsum', food)}${pv('target', 'Dreams', 'dreams', dreams)}</div>`;
  }

  /* kerangka: menu 5 item, ringkasan food di dalam Food, buka di Dashboard */
  const seg = () => `<div class="seg">${[['foodsum', 'Ringkasan'], ['meal', 'Meal plan'], ['recipes', 'Resep']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="go('${k}')">${l}</button>`).join('')}</div>`;
  const topOf2 = t => (t === 'meal' || t === 'recipes' || t === 'foodsum' ? 'food' : t);
  nav = () => {
    const on = k => topOf2(tab) === k;
    $('#side-nav').innerHTML = TOP.map(([k, l, ic]) => `<button class="sl ${on(k) ? 'on' : ''}" onclick="go('${k}')">${icon(ic)}<span>${l}</span></button>`).join('');
    $('#tabbar').innerHTML = TOP.map(([k, l, ic]) => `<button class="tb ${on(k) ? 'on' : ''}" onclick="go('${k}')">${icon(ic, 22)}<span>${l}</span></button>`).join('');
  };
  const _go = go, _render = render;
  go = t => { if (t === 'food') t = 'foodsum'; if (t === 'dash' || t === 'housing' || t === 'foodsum') X.loaded = false; return _go(t); };
  render = () => {
    _render();
    if (tab === 'dash' || tab === 'housing' || tab === 'foodsum') {
      if (!X.loaded && !X.loading) loadX().then(ok => ok && render());
      if (tab === 'dash') drawDash();
      else if (tab === 'foodsum') drawFood();
    }
    if (tab === 'meal' || tab === 'recipes' || tab === 'foodsum') {
      const h = $('#app').innerHTML;
      $('#app').innerHTML = /<div class="seg">/.test(h) ? h.replace(/<div class="seg">[\s\S]*?<\/div>/, seg()) : seg() + h;
    }
  };
  tab = 'dash';
  nav();
  if (S.me) render();
})();
