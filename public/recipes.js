/* Tab Resep: perpustakaan resep bersama. Dimuat setelah meal.js */
(() => {
  ICONS.book = 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z';
  NAV[0][1].push(['recipes', 'Resep', 'book']);
  const css = document.createElement('style');
  css.textContent = 'textarea{width:100%;border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:9px 12px;font:inherit;color:var(--ink);resize:vertical}textarea:focus-visible{outline:3px solid var(--acc);outline-offset:2px}';
  document.head.appendChild(css);
  const METHODS = ['Goreng', 'Tumis', 'Rebus', 'Sup & kuah', 'Kukus', 'Tim', 'Panggang oven', 'Bakar & grill', 'Air fryer', 'Pan-sear', 'Semur & braise', 'Presto & slow cooker', 'Tanpa masak', 'Blender'];
  const MAINS = ['Ayam', 'Daging sapi', 'Ikan & seafood', 'Telur', 'Tahu & tempe', 'Sayuran', 'Nasi, mi & roti', 'Buah & oat', 'Lainnya'];
  const KINDS = ['Sarapan', 'Makan utama', 'Camilan', 'Minuman'];
  const F0 = { q: '', method: '', main: '', kind: '', fast: false, light: false };
  let R = [], F = { ...F0 }, open = 0, editing = 0, showForm = false;

  async function loadR() {
    try { R = (await api('GET', 'recipes')).recipes || []; return true; }
    catch (e) { if (e.status === 401) { renderLogin(); return false; } throw e; }
  }
  async function refresh() { if (await loadR()) render(); }
  window.RC = {
    list: () => R, load: loadR,
    open: async id => {
      await loadR();
      if (!R.find(r => r.id === id)) { alert('Resep ini sudah dihapus.'); return; }
      F = { ...F0 }; open = id; tab = 'recipes'; render(); scrollTo(0, 0);
    },
  };

  const match = r => {
    const q = F.q.toLowerCase();
    return (!q || [r.title, r.ingredients, r.tags, r.method, r.main].join(' ').toLowerCase().includes(q))
      && (!F.method || r.method === F.method) && (!F.main || r.main === F.main) && (!F.kind || r.kind === F.kind)
      && (!F.fast || (r.time_min > 0 && r.time_min <= 20)) && (!F.light || (r.calories > 0 && r.calories <= 400));
  };
  const chip = t => t ? `<span class="tag" style="margin:0 6px 0 0">${esc(t)}</span>` : '';
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const detail = r => `<div style="margin-top:12px"><b>Bahan</b><ul style="margin:6px 0;padding-left:20px">${lines(r.ingredients).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="mut">Belum diisi</li>'}</ul>
    <b>Langkah</b><ol style="margin:6px 0;padding-left:20px">${lines(r.steps).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="mut">Belum diisi</li>'}</ol>
    ${/^https?:\/\//.test(r.source) ? `<div><a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">Sumber resep</a></div>` : (r.source ? `<div class="mut">Sumber: ${esc(r.source)}</div>` : '')}
    <div class="row" style="margin-top:8px"><span class="mut sp">Ditambahkan oleh ${esc(String(r.created_by || '').split('@')[0])}</span>${r.created_by === S.me ? `<button class="x" onclick="rcEdit(${r.id})">Ubah</button><button class="x" onclick="rcDel(${r.id})">Hapus</button>` : ''}</div></div>`;
  const card = r => `<div class="card"><div class="row"><div class="sp"><b>${esc(r.title)}</b><div style="margin-top:6px">${chip(r.method)}${chip(r.main)}${chip(r.kind)}</div>
    <div class="mut" style="margin-top:6px">${[r.time_min ? r.time_min + ' menit' : '', r.calories ? r.calories + ' kkal/porsi' : '', r.protein ? r.protein + ' g protein' : '', r.servings + ' porsi'].filter(Boolean).join(', ')}</div>
    ${r.tags ? `<div class="mut">${esc(r.tags)}</div>` : ''}</div><button onclick="rcOpen(${r.id})">${open === r.id ? 'Tutup' : 'Lihat'}</button></div>${open === r.id ? detail(r) : ''}</div>`;

  function rcList() {
    const a = R.filter(match);
    $('#rc-stats').innerHTML = stat('book', R.length, 'Total resep') + stat('user', R.filter(r => r.created_by === S.me).length, 'Resepmu') + stat('check', a.length, 'Sesuai filter');
    $('#rc-list').innerHTML = a.map(card).join('') || '<div class="empty">Belum ada resep yang cocok. Coba ubah filter atau tambah resep baru.</div>';
  }
  function rcFormDraw() {
    const el = $('#rc-form'); if (!el) return;
    if (!showForm) { el.innerHTML = ''; return; }
    const r = R.find(x => x.id === editing) || {};
    const sel = (id, arr, v, ph) => `<select id="${id}"><option value="">${ph}</option>${arr.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    el.innerHTML = `<div class="card"><b>${editing ? 'Ubah resep' : 'Resep baru'}</b><div class="grid" style="margin-top:10px">
      <input id="rf-title" class="wide" placeholder="Nama resep" value="${esc(r.title)}">
      ${sel('rf-method', METHODS, r.method, 'Cara masak')}${sel('rf-main', MAINS, r.main, 'Bahan utama')}
      ${sel('rf-kind', KINDS, r.kind, 'Jenis hidangan')}<input id="rf-tags" placeholder="Tag (high protein, pedas)" value="${esc(r.tags)}">
      <input id="rf-time" type="number" min="0" placeholder="Waktu (menit)" value="${r.time_min || ''}"><input id="rf-serv" type="number" min="1" placeholder="Jumlah porsi" value="${r.servings || ''}">
      <input id="rf-cal" type="number" min="0" placeholder="Kalori per porsi" value="${r.calories || ''}"><input id="rf-pro" type="number" min="0" placeholder="Protein per porsi (g)" value="${r.protein || ''}">
      <textarea id="rf-ing" class="wide" rows="5" placeholder="Bahan, satu per baris">${esc(r.ingredients)}</textarea>
      <textarea id="rf-steps" class="wide" rows="6" placeholder="Langkah memasak, satu per baris">${esc(r.steps)}</textarea>
      <input id="rf-src" class="wide" placeholder="Sumber atau link, boleh kosong" value="${esc(r.source)}"></div>
      <div class="row"><button class="p" onclick="rcSave()">Simpan resep</button><button onclick="rcForm()">Batal</button></div></div>`;
  }
  function drawRecipes() {
    const opt = (arr, v) => arr.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    $('#app').innerHTML = `<div class="ph"><h1>Resep</h1><div class="mut">Perpustakaan resep bersama. Siapa pun boleh menambah, semua orang bisa melihat.</div></div>
    <div class="stats" id="rc-stats"></div>
    <div class="card" style="margin-top:10px"><div class="grid">
      <input id="rc-q" class="wide" placeholder="Cari nama resep, bahan, atau tag" value="${esc(F.q)}" oninput="rcFilter()">
      <select id="rc-method" onchange="rcFilter()"><option value="">Semua cara masak</option>${opt(METHODS, F.method)}</select>
      <select id="rc-main" onchange="rcFilter()"><option value="">Semua bahan utama</option>${opt(MAINS, F.main)}</select>
      <select id="rc-kind" class="wide" onchange="rcFilter()"><option value="">Semua jenis hidangan</option>${opt(KINDS, F.kind)}</select>
      <div class="wide row" style="flex-wrap:wrap;gap:16px">
        <label class="row" style="gap:6px"><input type="checkbox" id="rc-fast" style="width:auto;min-height:0" ${F.fast ? 'checked' : ''} onchange="rcFilter()">Cepat (maks 20 menit)</label>
        <label class="row" style="gap:6px"><input type="checkbox" id="rc-light" style="width:auto;min-height:0" ${F.light ? 'checked' : ''} onchange="rcFilter()">Rendah kalori (maks 400 kkal)</label></div></div></div>
    <div class="row" style="margin-bottom:10px"><button class="p" onclick="rcForm()">Tambah resep</button></div>
    <div id="rc-form"></div><div id="rc-list" class="cards2"></div>`;
    rcList(); rcFormDraw();
  }

  window.rcFilter = () => { F = { q: $('#rc-q').value, method: $('#rc-method').value, main: $('#rc-main').value, kind: $('#rc-kind').value, fast: !!$('#rc-fast').checked, light: !!$('#rc-light').checked }; rcList(); };
  window.rcOpen = id => { open = open === id ? 0 : id; rcList(); };
  window.rcForm = () => { showForm = !showForm; editing = 0; rcFormDraw(); };
  window.rcEdit = id => { editing = id; showForm = true; rcFormDraw(); $('#rc-form').scrollIntoView?.({ behavior: 'smooth' }); };
  window.rcDel = async id => { if (confirm('Hapus resep ini?')) { await api('DELETE', 'recipes/' + id); open = 0; await refresh(); } };
  window.rcSave = async () => {
    const b = { title: $('#rf-title').value.trim(), method: $('#rf-method').value, main: $('#rf-main').value, kind: $('#rf-kind').value, tags: $('#rf-tags').value, time_min: $('#rf-time').value, servings: $('#rf-serv').value, calories: $('#rf-cal').value, protein: $('#rf-pro').value, ingredients: $('#rf-ing').value, steps: $('#rf-steps').value, source: $('#rf-src').value };
    if (!b.title) return;
    await api(editing ? 'PATCH' : 'POST', editing ? 'recipes/' + editing : 'recipes', b);
    showForm = false; editing = 0; await refresh();
  };

  const _go = go, _render = render;
  go = t => { if (t !== 'recipes') return _go(t); tab = 'recipes'; refresh().then(() => scrollTo(0, 0)); };
  render = () => { _render(); if (tab === 'recipes') drawRecipes(); };
  nav();
})();
