/* Tab Dreams and goals: dimuat setelah script utama di index.html */
(() => {
  ICONS.target = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z';
  NAV[0][1].push(['dreams', 'Dreams and goals', 'target']);
  const css = document.createElement('style');
  css.textContent = '#bottom-nav{overflow-x:auto;scrollbar-width:none}#bottom-nav::-webkit-scrollbar{display:none}.bl{flex:0 0 auto;min-width:72px}';
  document.head.appendChild(css);
  let G = [];

  async function loadGoals() {
    try { G = (await api('GET', 'goals')).goals || []; return true; }
    catch (e) { if (e.status === 401) { renderLogin(); return false; } throw e; }
  }
  async function refresh() { if (await loadGoals()) render(); }
  const patch = async (id, b) => { await api('PATCH', 'goals/' + id, b); await refresh(); };
  const steps = id => (G.find(g => g.id === id)?.steps || []).map(s => ({ ...s }));

  window.goalDone = (id, d) => patch(id, { done: d });
  window.goalDel = async id => { if (confirm('Hapus target ini?')) { await api('DELETE', 'goals/' + id); await refresh(); } };
  window.goalToggle = (id, i) => { const s = steps(id); s[i].d = s[i].d ? 0 : 1; return patch(id, { steps: s }); };
  window.goalStepDel = (id, i) => { const s = steps(id); s.splice(i, 1); return patch(id, { steps: s }); };
  window.goalStep = id => { const v = $('#gs-' + id).value.trim(); if (!v) return; const s = steps(id); s.push({ t: v, d: 0 }); return patch(id, { steps: s }); };
  window.goalAdd = async () => {
    const title = $('#g-title').value.trim(); if (!title) return;
    await api('POST', 'goals', { title, horizon: $('#g-horizon').value, shared: $('#g-scope').value === 'bersama', target_date: $('#g-date').value, note: $('#g-note').value });
    await refresh();
  };

  const card = g => {
    const st = g.steps || [], n = st.length, dn = st.filter(s => s.d).length, pct = n ? Math.round(dn / n * 100) : 0;
    const left = g.target_date ? diff(today(), g.target_date) : null;
    const when = left == null ? '' : left < 0 ? `<span class="tag warn">Terlewat ${-left} hari</span>` : `<span class="tag">${fmt(g.target_date)}, ${left} hari lagi</span>`;
    return `<div class="card"><div class="row"><div class="sp"><b>${esc(g.title)}</b>
      <div><span class="tag" style="margin-right:6px">${g.owner === '*' ? 'Bersama' : 'Pribadi'}</span>${when}</div>${g.note ? `<div class="mut" style="margin-top:6px">${esc(g.note)}</div>` : ''}</div></div>
      ${n ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="mut" style="margin-top:4px">${dn} dari ${n} langkah selesai</div>` : ''}
      ${st.map((s, i) => `<div class="row" style="margin-top:8px"><button class="x" aria-label="Tandai langkah" onclick="goalToggle(${g.id},${i})"><span class="dot ${s.d ? 'on' : ''}" style="display:block"></span></button>
        <span class="sp" style="${s.d ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(s.t)}</span><button class="x" onclick="goalStepDel(${g.id},${i})">Hapus</button></div>`).join('')}
      <div class="row" style="margin-top:10px"><input id="gs-${g.id}" placeholder="Langkah berikutnya" onkeydown="if(event.key==='Enter')goalStep(${g.id})"><button onclick="goalStep(${g.id})">Tambah</button></div>
      <div class="row" style="margin-top:10px"><button class="p" onclick="goalDone(${g.id},1)">Tandai tercapai</button><span class="sp"></span><button class="x" onclick="goalDel(${g.id})">Hapus</button></div></div>`;
  };

  function drawGoals() {
    const act = G.filter(g => !g.done), fin = G.filter(g => g.done);
    const sec = (h, label, hint) => `<h2>${label} <span class="mut">${hint}</span></h2>${act.filter(g => g.horizon === h).map(card).join('') || '<div class="empty">Belum ada. Tambahkan lewat form.</div>'}`;
    $('#app').innerHTML = `<div class="ph"><h1>Dreams and goals</h1><div class="mut">Target dekat dan mimpi besar, pribadi atau berdua.</div></div>
    <div class="stats">${stat('target', act.filter(g => g.horizon === 'pendek').length, 'Jangka pendek aktif')}${stat('target', act.filter(g => g.horizon === 'panjang').length, 'Jangka panjang aktif')}${stat('check', fin.length, 'Sudah tercapai')}</div>
    <div class="cols rev"><section><h2>Tambah target</h2><div class="card"><div class="grid">
      <input id="g-title" class="wide" placeholder="Apa targetmu? (misal beli rumah, tabungan darurat)">
      <select id="g-horizon"><option value="pendek">Jangka pendek</option><option value="panjang">Jangka panjang</option></select>
      <select id="g-scope"><option value="pribadi">Pribadi</option><option value="bersama">Bersama</option></select>
      <input id="g-date" class="wide" type="date" aria-label="Tanggal target, boleh kosong">
      <input id="g-note" class="wide" placeholder="Catatan atau alasan, boleh kosong"></div>
      <button class="p" onclick="goalAdd()">Tambah target</button></div></section>
    <section>${sec('pendek', 'Jangka pendek', 'target dekat')}<div style="height:12px"></div>${sec('panjang', 'Jangka panjang', 'mimpi besar')}
      <h2 style="margin-top:22px">Sudah tercapai</h2>${fin.map(g => `<div class="card"><div class="row"><div class="sp"><b style="text-decoration:line-through;opacity:.7">${esc(g.title)}</b>
        <div class="mut">${g.horizon === 'panjang' ? 'Jangka panjang' : 'Jangka pendek'}${g.done_at ? ', tercapai ' + fmt(g.done_at) : ''}</div></div>
        <button class="x" onclick="goalDone(${g.id},0)">Buka lagi</button><button class="x" onclick="goalDel(${g.id})">Hapus</button></div></div>`).join('') || '<div class="empty">Target yang tercapai muncul di sini.</div>'}</section></div>`;
  }

  const _go = go, _render = render;
  go = t => { if (t !== 'dreams') return _go(t); tab = 'dreams'; refresh().then(() => scrollTo(0, 0)); };
  render = () => { _render(); if (tab === 'dreams') drawGoals(); };
  nav();
})();
