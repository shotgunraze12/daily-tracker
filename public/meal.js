/* Tab Meal plan + Recipe Library: dimuat setelah script utama di index.html */
(() => {
  /* ── icons ── */
  ICONS.utensils = 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7';
  ICONS.book = 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z';
  NAV[0][1].push(['meal', 'Meal plan', 'utensils']);
  NAV[0][1].push(['recipe', 'Resep', 'book']);

  const SLOTS = [['sarapan', 'Sarapan'], ['siang', 'Makan siang'], ['malam', 'Makan malam'], ['camilan', 'Camilan']];
  const weekStart = d => addDays(d, -((new Date(d + 'T00:00:00').getDay() + 6) % 7));
  const longDay = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

  /* ── Kategori resep preset ── */
  const CAT_GROUPS = {
    'Cara masak': ['Goreng', 'Rebus', 'Kukus', 'Panggang', 'Tumis', 'Bakar', 'Mentah/Segar'],
    'Bahan utama': ['Ayam', 'Daging sapi', 'Ikan', 'Udang', 'Telur', 'Tahu/Tempe', 'Sayuran', 'Nasi', 'Mie'],
    'Waktu': ['Sarapan', 'Makan siang', 'Makan malam', 'Camilan'],
    'Diet': ['Rendah kalori', 'Tinggi protein', 'Vegetarian', 'Tanpa gluten']
  };

  let M = [], R = [], wk = weekStart(today());

  /* ── API helpers ── */
  async function loadMeals() {
    try { M = (await api('GET', `meals?from=${wk}&to=${addDays(wk, 6)}`)).meals || []; return true; }
    catch (e) { if (e.status === 401) { renderLogin(); return false; } throw e; }
  }
  async function loadRecipes() {
    try { R = (await api('GET', 'recipes')).recipes || []; return true; }
    catch (e) { if (e.status === 401) { renderLogin(); return false; } throw e; }
  }
  async function refreshMeal() { if (await loadMeals() && await loadRecipes()) render(); }
  async function refreshRecipe() { if (await loadRecipes()) render(); }

  /* ── helpers ── */
  const recipeName = id => { const r = R.find(x => x.id === id); return r ? r.name : ''; };
  const parseCats = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

  /* ═══════════════════════════════════════════
     MEAL PLAN TAB
     ═══════════════════════════════════════════ */
  const mealRow = m => {
    const linked = m.recipe_id && recipeName(m.recipe_id);
    return `<div class="row" style="margin-top:10px">
    <button class="x" aria-label="Tandai selesai" onclick="mealDone(${m.id},${m.done ? 0 : 1})"><span class="dot ${m.done ? 'on' : ''}" style="display:block"></span></button>
    <div class="sp"><div class="mut">${(SLOTS.find(s => s[0] === m.slot) || [0, m.slot])[1]}</div>
    <b style="${m.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(m.name)}</b>${m.calories ? `<span class="mut"> · ${m.calories} kkal</span>` : ''}${linked ? `<div class="mut" style="font-size:13px">📖 Resep: ${esc(linked)}</div>` : ''}${m.note ? `<div class="mut">${esc(m.note)}</div>` : ''}</div>
    <button class="x" onclick="mealCal(${m.id},${m.calories || 0})">🔥${m.calories || 0}</button><button class="x" onclick="mealDel(${m.id})">Hapus</button></div>`;
  };

  function drawMeal() {
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(wk, i));
    const ord = m => SLOTS.findIndex(s => s[0] === m.slot);
    const by = d => M.filter(m => m.date === d).sort((a, b) => ord(a) - ord(b) || a.id - b.id);
    const sumCal = a => a.reduce((s, m) => s + (m.calories || 0), 0);
    const totalCal = sumCal(M);
    const cals = days.map(d => sumCal(by(d)));
    const maxCal = Math.max(1, ...cals);
    const cur = wk === weekStart(today());

    const recipeOpts = R.map(r => `<option value="${r.id}">${esc(r.name)}${r.serves ? ' (' + r.serves + ' porsi)' : ''}</option>`).join('');

    $('#app').innerHTML = `<div class="ph"><h1>Meal plan</h1><div class="mut">Rencana makan mingguan beserta kalorinya, dilihat berdua.</div></div>
    <div class="row" style="margin-bottom:12px"><button aria-label="Minggu sebelumnya" onclick="mealWeek(-7)">‹</button><b class="sp" style="text-align:center">${fmt(wk)} sampai ${fmt(addDays(wk, 6))}</b><button aria-label="Minggu berikutnya" onclick="mealWeek(7)">›</button></div>
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap">${cur ? '' : '<button onclick="mealWeek(0)">Kembali ke minggu ini</button>'}<button onclick="mealCopy()">Salin dari minggu sebelumnya</button></div>
    <div class="stats">${stat('utensils', totalCal + ' kkal', 'Total kalori minggu')}${stat('check', Math.round(totalCal / 7) + ' kkal', 'Rata-rata per hari')}${stat('home', M.length + ' menu', 'Terencana')}</div>
    <div class="cols rev"><section><h2>Tambah menu</h2><div class="card"><div class="grid">
      <select id="m-date" class="wide">${days.map(d => `<option value="${d}" ${d === today() ? 'selected' : ''}>${longDay(d)}</option>`).join('')}</select>
      <select id="m-slot">${SLOTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input id="m-cal" type="number" min="0" placeholder="Kalori per serving">
      <select id="m-recipe" onchange="mealPickRecipe()"><option value="">— Pilih dari resep (opsional) —</option>${recipeOpts}</select>
      <input id="m-name" class="wide" placeholder="Menu (nasi ayam, oatmeal, ...)"><input id="m-note" class="wide" placeholder="Catatan, boleh kosong"></div>
      <button class="p" onclick="addMeal()">Tambah ke rencana</button></div>
      <div class="card"><b>Kalori per hari</b><div class="plot">${cals.map(c => `<div class="cbs"><i class="cb me" style="height:${c / maxCal * 100}%" title="${c} kkal"></i></div>`).join('')}</div>
      <div class="lbls">${days.map(d => `<span>${dayLbl(d)}</span>`).join('')}</div></div></section>
    <section><h2>Rencana per hari</h2>${days.map(d => { const a = by(d); return `<div class="card"><div class="row"><b class="sp">${longDay(d)}${d === today() ? ' <span class="tag" style="margin:0">Hari ini</span>' : ''}</b><span class="mut">${sumCal(a)} kkal</span></div>${a.map(mealRow).join('') || '<div class="mut" style="margin-top:6px">Belum ada menu.</div>'}</div>`; }).join('')}</section></div>`;
  }

  window.mealWeek = async n => { wk = n === 0 ? weekStart(today()) : addDays(wk, n); await refreshMeal(); };
  window.addMeal = async () => {
    const name = $('#m-name').value.trim(); if (!name) return;
    await api('POST', 'meals', { date: $('#m-date').value, slot: $('#m-slot').value, name, calories: Number($('#m-cal').value) || 0, recipe_id: Number($('#m-recipe').value) || 0, note: $('#m-note').value });
    await refreshMeal();
  };
  window.mealPickRecipe = () => {
    const rid = Number($('#m-recipe').value) || 0;
    const r = R.find(x => x.id === rid);
    if (r) { $('#m-name').value = r.name; }
  };
  window.mealCal = async (id, cur) => { const v = prompt('Kalori per serving', cur || ''); if (v === null) return; await api('PATCH', 'meals/' + id, { calories: Number(v) || 0 }); await refreshMeal(); };
  window.mealDone = async (id, d) => { await api('PATCH', 'meals/' + id, { done: d }); await refreshMeal(); };
  window.mealDel = async id => { if (confirm('Hapus menu ini?')) { await api('DELETE', 'meals/' + id); await refreshMeal(); } };
  window.mealCopy = async () => {
    if (M.length && !confirm('Minggu ini sudah ada menu. Salinan akan ditambahkan di atasnya. Lanjut?')) return;
    try { await api('POST', 'meals/copy', { from_start: addDays(wk, -7), to_start: wk }); await refreshMeal(); } catch (e) { alert(e.message); }
  };

  /* ═══════════════════════════════════════════
     RECIPE TAB
     ═══════════════════════════════════════════ */
  let recipeFilter = '';

  function catCheckboxes(selected) {
    const sel = new Set(selected || []);
    return Object.entries(CAT_GROUPS).map(([group, items]) =>
      `<div style="margin-bottom:8px"><div class="mut" style="font-size:13px;margin-bottom:4px"><b>${group}</b></div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${items.map(c =>
        `<label style="display:inline-flex;align-items:center;gap:4px;font-size:13px;padding:3px 8px;border-radius:99px;background:${sel.has(c) ? 'var(--acc)' : 'var(--accsoft)'};color:${sel.has(c) ? 'var(--onacc)' : 'var(--ink)'};cursor:pointer">
          <input type="checkbox" class="rc-cat" value="${esc(c)}" ${sel.has(c) ? 'checked' : ''} style="display:none">${esc(c)}</label>`
      ).join('')}</div></div>`
    ).join('');
  }

  function getCheckedCats(prefix) {
    return [...document.querySelectorAll((prefix || '') + '.rc-cat:checked')].map(c => c.value);
  }

  const recipeCard = r => {
    const cats = parseCats(r.categories);
    return `<div class="card"><div class="row"><div class="sp"><b>${esc(r.name)}</b>
      ${cats.length ? `<div style="margin-top:4px">${cats.map(c => `<span class="tag" style="margin-right:4px;margin-bottom:2px">${esc(c)}</span>`).join('')}</div>` : ''}
      ${r.serves ? `<div class="mut">Porsi: ${r.serves}</div>` : ''}
      ${r.instructions ? `<div class="mut" style="margin-top:6px;white-space:pre-wrap">${esc(r.instructions)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="x" onclick="recipeDel(${r.id})">Hapus</button>
        <button class="x" onclick="recipeEdit(${r.id})">Edit</button>
      </div>
    </div></div>`;
  };

  function filterCatBtns() {
    const all = new Set();
    R.forEach(r => parseCats(r.categories).forEach(c => all.add(c)));
    const cats = [...all].sort();
    return cats.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
      <button class="${!recipeFilter ? 'p' : ''}" onclick="recipeFilterCat('')" style="font-size:13px;padding:4px 10px">Semua</button>
      ${cats.map(c => `<button class="${recipeFilter === c ? 'p' : ''}" onclick="recipeFilterCat('${esc(c)}')" style="font-size:13px;padding:4px 10px">${esc(c)}</button>`).join('')}
    </div>` : '';
  }

  function drawRecipe() {
    const filtered = recipeFilter ? R.filter(r => parseCats(r.categories).includes(recipeFilter)) : R;
    $('#app').innerHTML = `<div class="ph"><h1>Resep</h1><div class="mut">Koleksi resep bersama. Semua user bisa menambahkan dan melihat.</div></div>
    <div class="stats">${stat('book', R.length, 'Total resep')}${stat('utensils', [...new Set(R.flatMap(r => parseCats(r.categories)))].length, 'Kategori terpakai')}</div>
    <div class="cols rev"><section><h2>Tambah resep baru</h2><div class="card"><div class="grid">
      <input id="r-name" class="wide" placeholder="Nama resep (misal: nasi goreng spesial)">
      <input id="r-serves" type="number" min="1" value="1" placeholder="Porsi">
      <div class="wide">${catCheckboxes([])}</div>
      <textarea id="r-instructions" class="wide" placeholder="Langkah-langkah memasak (boleh kosong)" rows="4" style="width:100%;border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:9px 12px;font:inherit;color:var(--ink);resize:vertical"></textarea></div>
      <button class="p" onclick="addRecipe()">Simpan resep</button></div></section>
    <section><h2>Daftar resep</h2>${filterCatBtns()}
      ${filtered.map(recipeCard).join('') || '<div class="empty">Belum ada resep. Tambahkan lewat form di samping.</div>'}</section></div>`;
  }

  window.addRecipe = async () => {
    const name = $('#r-name').value.trim(); if (!name) return;
    const cats = getCheckedCats('#');
    await api('POST', 'recipes', {
      name, shared: true,
      categories: JSON.stringify(cats),
      instructions: $('#r-instructions').value.trim(),
      serves: Number($('#r-serves').value) || 1
    });
    await refreshRecipe();
  };
  window.recipeDel = async id => { if (confirm('Hapus resep ini?')) { await api('DELETE', 'recipes/' + id); await refreshRecipe(); } };
  window.recipeEdit = async id => {
    const r = R.find(x => x.id === id); if (!r) return;
    const name = prompt('Nama resep', r.name); if (name === null) return;
    const serves = prompt('Porsi', r.serves || 1); if (serves === null) return;
    const instructions = prompt('Langkah memasak', r.instructions || ''); if (instructions === null) return;
    await api('PATCH', 'recipes/' + id, { name, serves: Number(serves) || 1, instructions });
    await refreshRecipe();
  };
  window.recipeFilterCat = c => { recipeFilter = c; drawRecipe(); };

  /* ── override go & render ── */
  const _go = go, _render = render;
  go = t => {
    if (t === 'meal') { tab = 'meal'; refreshMeal().then(() => scrollTo(0, 0)); return; }
    if (t === 'recipe') { tab = 'recipe'; refreshRecipe().then(() => scrollTo(0, 0)); return; }
    return _go(t);
  };
  render = () => {
    _render();
    if (tab === 'meal') drawMeal();
    if (tab === 'recipe') drawRecipe();
  };
  nav();
})();
