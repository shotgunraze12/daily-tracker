/* Kartu habit gaya Atomic: heatmap besar + tombol selesai penuh. Dimuat setelah script utama. */
(() => {
  const css = document.createElement('style');
  css.textContent = `
.hgrid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.hc3{background:var(--card);border:1px solid var(--line);border-radius:26px;padding:14px;box-shadow:0 6px 18px rgba(0,0,0,.12)}
.hc3 .hh{display:flex;align-items:center;gap:12px}
.hc3 .hi{width:46px;height:46px;border-radius:14px;background:rgba(128,138,160,.16);display:grid;place-items:center;font-size:24px;flex:none}
.hc3 .ht{font-size:18px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hc3.dn .ht{text-decoration:line-through;opacity:.65}
.hc3 .hs{display:flex;gap:12px;flex-wrap:wrap;font-size:14px;font-weight:700;opacity:1}
.hc3 .hs .g{color:#30c75e}.hc3 .hs .f{color:#ff6b57}.hc3 .hs .t{color:var(--mut);font-weight:500}
.hc3 .ed{width:34px;height:34px;padding:0;border:0;background:rgba(128,138,160,.16);color:var(--mut);border-radius:50%;display:grid;place-items:center;min-height:0;flex:none}
.heat3{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);grid-template-columns:repeat(13,1fr);gap:4px;margin:14px 0}
.c3{aspect-ratio:1;border-radius:6px;background:rgba(128,138,160,.16)}
.c3.fu{background:rgba(128,138,160,.06)}
.c3.td{outline:2px solid var(--ink);outline-offset:1px}
.cbtn,.cpill{width:100%;min-height:50px;border-radius:99px;background:var(--c);color:#fff;font-weight:700;font-size:18px;border:0}
.cbtn{display:flex;align-items:center;justify-content:center;gap:8px}
.cpill{display:flex;align-items:center;justify-content:space-between;padding:4px}
.cpill button{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;padding:0;min-height:0;font-size:22px}
.cpill b{font-size:17px}`;
  document.head.appendChild(css);

  heat = h => {
    const t = today(), W = 13, start = addDays(t, -((new Date(t + 'T00:00:00').getDay() + 6) % 7) - (W - 1) * 7);
    let c = '';
    for (let i = 0; i < W * 7; i++) {
      const d = addDays(start, i), v = Lval(h.id, d), fut = d > t;
      const st = !fut && v > 0 ? `background:var(--c);opacity:${Math.max(0.4, Math.min(1, v / target(h)))}` : '';
      c += `<i class="c3${fut ? ' fu' : ''}${d === selDate ? ' td' : ''}" style="${st}" title="${fmt(d)}"${fut ? '' : ` onclick="hDate('${d}')"`}></i>`;
    }
    return `<div class="heat3">${c}</div>`;
  };

  hcard = h => {
    const col = colorOf(h)[0], m = meta(h), v = Lval(h.id, selDate), t = target(h), dn = v >= t;
    const other = h.owner === '*' ? S.logs.find(l => l.habit_id === h.id && l.email !== S.me && l.date === selDate) : null;
    const act = h.kind === 'count'
      ? `<div class="cpill"><button aria-label="Kurangi" onclick="hSet(${h.id},${Math.max(0, v - 1)})">−</button><b>${v}/${t} ${esc(h.unit)}</b><button aria-label="Tambah" onclick="hSet(${h.id},${v + 1})">+</button></div>`
      : `<button class="cbtn" onclick="hSet(${h.id},${dn ? 0 : 1})">${dn ? icon('check', 20) + ' Selesai' : 'Tandai selesai'}</button>`;
    return `<div class="hc3 ${dn ? 'dn' : ''}" style="--c:${col}"><div class="hh"><span class="hi">${esc(m.icon || '⭐')}</span>
      <div class="sp"><b class="ht">${esc(h.name)}</b><div class="hs"><span class="g">${total(h)} ✓</span><span class="f">${streak(h)} 🔥</span>${h.owner === '*' ? '<span class="t">Bersama</span>' : ''}${other ? `<span class="t">Pasangan ${other.value}</span>` : ''}</div></div>
      <button class="ed" aria-label="Ubah habit" onclick="habitForm(${h.id})">${icon('pencil', 15)}</button></div>${heat(h)}${act}</div>`;
  };

  if (S.me) render();
})();
