/* Kartu habit: kalender bulanan, tombol selesai penuh, dan catat hari lalu. Dimuat setelah script utama. */
(() => {
  const css = document.createElement('style');
  css.textContent = `
.hgrid{grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}
.hc3{background:var(--card);border:1px solid var(--line);border-radius:26px;padding:14px;box-shadow:0 6px 18px rgba(0,0,0,.12)}
.hc3 .hh{display:flex;align-items:center;gap:12px}
.hc3 .hi{width:46px;height:46px;border-radius:14px;background:rgba(128,138,160,.16);display:grid;place-items:center;font-size:24px;flex:none}
.hc3 .ht{font-size:18px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hc3.dn .ht{text-decoration:line-through;opacity:.65}
.hc3 .hs{display:flex;gap:12px;flex-wrap:wrap;font-size:14px;font-weight:700;opacity:1}
.hc3 .hs .g{color:#30c75e}.hc3 .hs .f{color:#ff6b57}.hc3 .hs .t{color:var(--mut);font-weight:500}
.hc3 .ed{width:34px;height:34px;padding:0;border:0;background:rgba(128,138,160,.16);color:var(--mut);border-radius:50%;display:grid;place-items:center;min-height:0;flex:none}
.wk{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:14px 0 4px;text-align:center;font-size:12px;color:var(--mut)}
.cal3{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px}
.c3{height:34px;border-radius:9px;background:rgba(128,138,160,.16);display:grid;place-items:center;font-style:normal;font-size:13px;color:var(--mut);cursor:pointer}
.c3.e{background:none;cursor:default}
.c3.ok{color:#fff;font-weight:700}.c3.tt{font-weight:700;color:var(--ink)}.c3.ok.tt{color:#fff}
.c3.fu{background:rgba(128,138,160,.06);color:rgba(128,138,160,.5);cursor:default}
.c3.td{outline:2px solid var(--ink);outline-offset:1px}
.cbtn,.cpill{width:100%;min-height:50px;border-radius:99px;background:var(--c);color:#fff;font-weight:700;font-size:17px;border:0}
.cbtn{display:flex;align-items:center;justify-content:center;gap:8px}
.cpill{display:flex;align-items:center;justify-content:space-between;padding:4px}
.cpill button{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;padding:0;min-height:0;font-size:22px}
.cpill b{font-size:17px}
.mh{display:flex;align-items:center;gap:10px;margin:18px 0 4px}.mh b{text-align:center}.mh button{width:42px;padding:0}.mh button[disabled]{opacity:.35}
.card.back{border-color:var(--acc);margin-top:4px}`;
  document.head.appendChild(css);

  let calMonth = selDate.slice(0, 7);
  const thisMonth = () => today().slice(0, 7);
  const monthLabel = m => new Date(m + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const relDay = d => (d === today() ? 'Hari ini' : d === addDays(today(), -1) ? 'Kemarin' : dayLbl(d));
  const longDate = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  // ambil riwayat 400 hari (bukan 150) supaya bulan-bulan lama ikut terlihat
  const _api = api;
  api = (m, p, b) => _api(m, String(p).replace('hx?days=150', 'hx?days=400'), b);

  hDate = d => { selDate = d; calMonth = d.slice(0, 7); render(); };
  window.hMonth = n => {
    const [y, m] = calMonth.split('-').map(Number);
    const nm = new Date(y, m - 1 + n, 1).toLocaleDateString('sv-SE').slice(0, 7);
    if (nm > thisMonth() || nm < addDays(today(), -400).slice(0, 7)) return;
    calMonth = nm; render();
  };

  const cal = h => {
    const first = `${calMonth}-01`, [y, m] = calMonth.split('-').map(Number), dim = new Date(y, m, 0).getDate();
    const lead = (new Date(first + 'T00:00:00').getDay() + 6) % 7, t = today();
    let c = '<i class="c3 e"></i>'.repeat(lead);
    for (let n = 1; n <= dim; n++) {
      const d = `${calMonth}-${String(n).padStart(2, '0')}`, v = Lval(h.id, d), fut = d > t, p = Math.min(1, v / target(h)) * 100;
      const st = !fut && v > 0 ? `background:linear-gradient(to top,var(--c) ${p}%,rgba(128,138,160,.16) ${p}%)` : '';
      c += `<i class="c3${fut ? ' fu' : ''}${d === selDate ? ' td' : ''}${d === t ? ' tt' : ''}${v >= target(h) ? ' ok' : ''}" style="${st}" title="${fmt(d)}"${fut ? '' : ` onclick="hDate('${d}')"`}>${n}</i>`;
    }
    return `<div class="wk">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal3">${c}</div>`;
  };

  hcard = h => {
    const col = colorOf(h)[0], m = meta(h), v = Lval(h.id, selDate), t = target(h), dn = v >= t;
    const other = h.owner === '*' ? S.logs.find(l => l.habit_id === h.id && l.email !== S.me && l.date === selDate) : null;
    const sfx = selDate === today() ? '' : ` (${fmt(selDate)})`;
    const act = h.kind === 'count'
      ? `<div class="cpill"><button aria-label="Kurangi" onclick="hSet(${h.id},${Math.max(0, v - 1)})">−</button><b>${v}/${t} ${esc(h.unit)}${sfx}</b><button aria-label="Tambah" onclick="hSet(${h.id},${v + 1})">+</button></div>`
      : `<button class="cbtn" onclick="hSet(${h.id},${dn ? 0 : 1})">${dn ? icon('check', 20) + ' Selesai' : 'Tandai selesai'}${sfx}</button>`;
    return `<div class="hc3 ${dn ? 'dn' : ''}" style="--c:${col}"><div class="hh"><span class="hi">${esc(m.icon || '⭐')}</span>
      <div class="sp"><b class="ht">${esc(h.name)}</b><div class="hs"><span class="g">${total(h)} ✓</span><span class="f">${streak(h)} 🔥</span>${h.owner === '*' ? '<span class="t">Bersama</span>' : ''}${other ? `<span class="t">Pasangan ${other.value}</span>` : ''}</div></div>
      <button class="ed" aria-label="Ubah habit" onclick="habitForm(${h.id})">${icon('pencil', 15)}</button></div>${cal(h)}${act}</div>`;
  };

  drawHabit = () => {
    const hs = S.habits, d = selDate, t = today(), n = hs.filter(h => isDone(h, d)).length, pct = hs.length ? n / hs.length * 100 : 0;
    const Name = S.me.split('@')[0].replace(/^./, c => c.toUpperCase());
    const strip = [...Array(21)].map((_, i) => addDays(t, i - 20)).map(x => {
      const c = hs.filter(h => isDone(h, x)).length;
      return `<button class="dp ${x === d ? 'on' : ''}" onclick="hDate('${x}')"><span>${relDay(x)}</span><b>${+x.slice(8)}</b><i style="width:${hs.length ? c / hs.length * 100 : 0}%"></i></button>`;
    }).join('');
    const flt = hs.filter(h => !slotFilter || (meta(h).slot || 'kapan') === slotFilter);
    const groups = SLOTS_H.map(([k, l]) => { const a = flt.filter(h => (meta(h).slot || 'kapan') === k && !isDone(h, d)); return a.length ? `<div class="gl">${l}</div><div class="hgrid">${a.map(h => hcard(h)).join('')}</div>` : ''; }).join('');
    const dn = flt.filter(h => isDone(h, d));
    const prev = $('#dstrip'); if (prev && prev.scrollLeft != null) stripLeft = prev.scrollLeft;
    const back = d === t ? '' : `<div class="card back"><div class="row"><div class="sp">Mencatat untuk <b>${d === addDays(t, -1) ? 'Kemarin, ' + fmt(d) : longDate(d)}</b></div><button class="p" onclick="hDate('${t}')">Hari ini</button></div></div>`;
    $('#app').innerHTML = `<h1>Halo, ${esc(Name)}</h1><div class="mut">${longDate(d)}</div>
    <div class="dstrip" id="dstrip">${strip}</div>${back}
    <div class="card"><div class="row"><b class="sp">${n} dari ${hs.length} habit selesai</b><span class="mut">${Math.round(pct)}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="fil">${[['', 'Semua'], ...SLOTS_H].map(([k, l]) => `<button class="${slotFilter === k ? 'on' : ''}" onclick="hSlot('${k}')">${l}</button>`).join('')}</div>
    <div class="mh"><button aria-label="Bulan sebelumnya" onclick="hMonth(-1)">‹</button><b class="sp">${monthLabel(calMonth)}</b><button aria-label="Bulan berikutnya" onclick="hMonth(1)" ${calMonth >= thisMonth() ? 'disabled' : ''}>›</button></div>
    ${hs.length ? '' : '<div class="card" style="margin-top:14px"><b>Belum ada habit</b><div class="mut" style="margin-top:4px">Tekan tombol + di pojok kanan bawah untuk membuat, misalnya minum kreatin.</div></div>'}
    ${groups}${dn.length ? `<div class="gl">Selesai</div><div class="hgrid">${dn.map(h => hcard(h)).join('')}</div>` : ''}
    <h2 style="margin-top:28px">Olahraga</h2><div class="duo">${workoutChart()}</div>${workoutTable(5)}`;
    const st = $('#dstrip'); if (st) st.scrollLeft = stripLeft == null ? st.scrollWidth : stripLeft;
  };

  if (S.me) load();
})();
