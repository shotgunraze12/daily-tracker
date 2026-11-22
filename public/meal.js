/* Tab Meal plan: dimuat setelah script utama di index.html */
(() => {
  ICONS.utensils = 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7';
  NAV[0][1].push(['meal', 'Meal plan', 'utensils']);
  const SLOTS = [['sarapan', 'Sarapan'], ['siang', 'Makan siang'], ['malam', 'Makan malam'], ['camilan', 'Camilan']];
  const weekStart = d => addDays(d, -((new Date(d + 'T00:00:00').getDay() + 6) % 7));
  const rp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(n || 0);
  const longDay = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
  const parseRp = v => {
    const s = String(v || '').toLowerCase().trim();
    const m = s.match(/^([\d.,]+)\s*(rb|ribu|k|jt|juta)?$/);
    if (!m) return parseInt(s.replace(/\D/g, '')) || 0;
    if (!m[2]) return parseInt(m[1].replace(/\D/g, '')) || 0;
    return Math.round((parseFloat(m[1].replace(',', '.')) || 0) * (/^j/.test(m[2]) ? 1e6 : 1e3));
  };
  let M = [], wk = weekStart(today());

  async function loadMeals() {
    try { M = (await api('GET', `meals?from=${wk}&to=${addDays(wk, 6)}`)).meals || []; return true; }
    catch (e) { if (e.status === 401) { renderLogin(); return false; } throw e; }
  }
  async function refresh() { if (await loadMeals()) render(); }

  const mealRow = m => `<div class="row" style="margin-top:10px">
    <button class="x" aria-label="Tandai selesai" onclick="mealDone(${m.id},${m.done ? 0 : 1})"><span class="dot ${m.done ? 'on' : ''}" style="display:block"></span></button>
    <div class="sp"><div class="mut">${(SLOTS.find(s => s[0] === m.slot) || [0, m.slot])[1]}</div>
    <b style="${m.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(m.name)}</b>${m.note ? `<div class="mut">${esc(m.note)}</div>` : ''}</div>
    <button class="x" onclick="mealPrice(${m.id},${m.price || 0})">${rp(m.price)}</button><button class="x" onclick="mealDel(${m.id})">Hapus</button></div>`;

  function drawMeal() {
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(wk, i));
    const ord = m => SLOTS.findIndex(s => s[0] === m.slot);
    const by = d => M.filter(m => m.date === d).sort((a, b) => ord(a) - ord(b) || a.id - b.id);
    const sum = a => a.reduce((s, m) => s + (m.price || 0), 0);
    const total = sum(M), costs = days.map(d => sum(by(d))), max = Math.max(1, ...costs);
    const cur = wk === weekStart(today());
    $('#app').innerHTML = `<div class="ph"><h1>Meal plan</h1><div class="mut">Rencana makan mingguan beserta harganya, dilihat berdua.</div></div>
    <div class="row" style="margin-bottom:12px"><button aria-label="Minggu sebelumnya" onclick="mealWeek(-7)">‹</button><b class="sp" style="text-align:center">${fmt(wk)} sampai ${fmt(addDays(wk, 6))}</b><button aria-label="Minggu berikutnya" onclick="mealWeek(7)">›</button></div>
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap">${cur ? '' : '<button onclick="mealWeek(0)">Kembali ke minggu ini</button>'}<button onclick="mealCopy()">Salin dari minggu sebelumnya</button></div>
    <div class="stats">${stat('utensils', rp(total), 'Total minggu ini')}${stat('check', rp(Math.round(total / 7)), 'Rata-rata per hari')}${stat('home', M.length + ' menu', 'Terencana')}</div>
    <div class="cols rev"><section><h2>Tambah menu</h2><div class="card"><div class="grid">
      <select id="m-date" class="wide">${days.map(d => `<option value="${d}" ${d === today() ? 'selected' : ''}>${longDay(d)}</option>`).join('')}</select>
      <select id="m-slot">${SLOTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input id="m-price" placeholder="Harga (25000 atau 25rb)">
      <input id="m-name" class="wide" placeholder="Menu (nasi ayam, oatmeal, ...)"><input id="m-note" class="wide" placeholder="Catatan, boleh kosong"></div>
      <button class="p" onclick="addMeal()">Tambah ke rencana</button></div>
      <div class="card"><b>Biaya per hari</b><div class="plot">${costs.map(c => `<div class="cbs"><i class="cb me" style="height:${c / max * 100}%" title="${rp(c)}"></i></div>`).join('')}</div>
      <div class="lbls">${days.map(d => `<span>${dayLbl(d)}</span>`).join('')}</div></div></section>
    <section><h2>Rencana per hari</h2>${days.map(d => { const a = by(d); return `<div class="card"><div class="row"><b class="sp">${longDay(d)}${d === today() ? ' <span class="tag" style="margin:0">Hari ini</span>' : ''}</b><span class="mut">${rp(sum(a))}</span></div>${a.map(mealRow).join('') || '<div class="mut" style="margin-top:6px">Belum ada menu.</div>'}</div>`; }).join('')}</section></div>`;
  }

  window.mealWeek = async n => { wk = n === 0 ? weekStart(today()) : addDays(wk, n); await refresh(); };
  window.addMeal = async () => {
    const name = $('#m-name').value.trim(); if (!name) return;
    await api('POST', 'meals', { date: $('#m-date').value, slot: $('#m-slot').value, name, price: parseRp($('#m-price').value), note: $('#m-note').value });
    await refresh();
  };
  window.mealPrice = async (id, cur) => { const v = prompt('Harga (Rp)', cur || ''); if (v === null) return; await api('PATCH', 'meals/' + id, { price: parseRp(v) }); await refresh(); };
  window.mealDone = async (id, d) => { await api('PATCH', 'meals/' + id, { done: d }); await refresh(); };
  window.mealDel = async id => { if (confirm('Hapus menu ini?')) { await api('DELETE', 'meals/' + id); await refresh(); } };
  window.mealCopy = async () => {
    if (M.length && !confirm('Minggu ini sudah ada menu. Salinan akan ditambahkan di atasnya. Lanjut?')) return;
    try { await api('POST', 'meals/copy', { from_start: addDays(wk, -7), to_start: wk }); await refresh(); } catch (e) { alert(e.message); }
  };

  const _go = go, _render = render;
  go = t => { if (t !== 'meal') return _go(t); tab = 'meal'; refresh().then(() => scrollTo(0, 0)); };
  render = () => { _render(); if (tab === 'meal') drawMeal(); };
  nav();
})();
