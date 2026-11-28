/* Tab Dreams and goals: ringkasan grafik + daftar target. Dimuat setelah script utama. */
(() => {
  let G = [];
  const rows = (arr, f) => { const m = Math.max(1, ...arr.map(r => r[1])); return arr.map(([n, v]) => `<div class="hb"><span class="hn">${esc(n)}</span><div class="bar sp"><i style="width:${v / m * 100}%"></i></div><b>${f(v)}</b></div>`).join(''); };
  const prog = g => { const s = g.steps || []; return s.length ? Math.round(s.filter(x => x.d).length / s.length * 100) : 0; };

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
  window.goalForm = () => {
    $('#panel').innerHTML = `<h2>Target baru</h2><input id="g-title" placeholder="Apa targetmu? (misal beli rumah, tabungan darurat)" autocomplete="off">
    <div class="grid" style="margin-top:8px"><select id="g-horizon"><option value="pendek">Jangka pendek</option><option value="panjang">Jangka panjang</option></select><select id="g-scope"><option value="pribadi">Pribadi</option><option value="bersama">Bersama</option></select></div>
    <div class="lab">Tanggal target (boleh kosong)</div><input id="g-date" type="date"><div class="lab">Catatan atau alasan</div><input id="g-note" placeholder="Boleh kosong">
    <div class="row" style="margin-top:18px"><button class="p sp" onclick="goalSave()">Simpan</button><button onclick="closeSheet()">Batal</button></div>`;
    $('#sheet').hidden = false; setTimeout(() => $('#g-title').focus(), 60);
  };
  window.goalSave = async () => {
    const title = $('#g-title').value.trim(); if (!title) return;
    await api('POST', 'goals', { title, horizon: $('#g-horizon').value, shared: $('#g-scope').value === 'bersama', target_date: $('#g-date').value, note: $('#g-note').value });
    closeSheet(); await refresh();
  };

  const card = g => {
    const st = g.steps || [], n = st.length, dn = st.filter(s => s.d).length;
    const left = g.target_date ? diff(today(), g.target_date) : null;
    const when = left == null ? '' : left < 0 ? `<span class="tag warn">Terlewat ${-left} hari</span>` : `<span class="tag">${fmt(g.target_date)}, ${left} hari lagi</span>`;
    return `<div class="card"><b>${esc(g.title)}</b>
      <div><span class="tag" style="margin-right:6px">${g.owner === '*' ? 'Bersama' : 'Pribadi'}</span>${when}</div>${g.note ? `<div class="mut" style="margin-top:6px">${esc(g.note)}</div>` : ''}
      ${n ? `<div class="bar"><i style="width:${prog(g)}%"></i></div><div class="mut" style="margin-top:4px">${dn} dari ${n} langkah selesai</div>` : ''}
      ${st.map((s, i) => `<div class="row" style="margin-top:8px"><button class="x" aria-label="Tandai langkah" onclick="goalToggle(${g.id},${i})"><span class="dot ${s.d ? 'on' : ''}" style="display:block"></span></button>
        <span class="sp" style="${s.d ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(s.t)}</span><button class="x" onclick="goalStepDel(${g.id},${i})">Hapus</button></div>`).join('')}
      <div class="row" style="margin-top:10px"><input id="gs-${g.id}" placeholder="Langkah berikutnya" onkeydown="if(event.key==='Enter')goalStep(${g.id})"><button onclick="goalStep(${g.id})">Tambah</button></div>
      <div class="row" style="margin-top:10px"><button class="p" onclick="goalDone(${g.id},1)">Tandai tercapai</button><span class="sp"></span><button class="x" onclick="goalDel(${g.id})">Hapus</button></div></div>`;
  };

  function drawGoals() {
    const act = G.filter(g => !g.done), fin = G.filter(g => g.done);
    const ms = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d.toLocaleDateString('sv-SE').slice(0, 7); });
    const per = ms.map(m => fin.filter(g => (g.done_at || '').slice(0, 7) === m).length), mx = Math.max(1, ...per);
    const soon = act.filter(g => g.target_date).sort((a, b) => a.target_date.localeCompare(b.target_date)).slice(0, 4);
    const sec = (h, label, hint) => `<div><h2>${label} <span class="mut">${hint}</span></h2>${act.filter(g => g.horizon === h).map(card).join('') || '<div class="empty">Belum ada.</div>'}</div>`;
    $('#app').innerHTML = `<div class="row" style="margin-bottom:14px"><div class="sp"><h1>Dreams and goals</h1><div class="mut">Target dekat dan mimpi besar, pribadi atau berdua.</div></div><button class="p" onclick="goalForm()">Tambah target</button></div>
    <div class="stats">${stat('target', act.filter(g => g.horizon === 'pendek').length, 'Jangka pendek aktif')}${stat('target', act.filter(g => g.horizon === 'panjang').length, 'Jangka panjang aktif')}${stat('check', fin.length, 'Sudah tercapai')}</div>
    <div class="duo" style="margin-top:10px">
      <div class="card"><b>Progres target aktif</b><div class="mut" style="margin-bottom:6px">Berdasarkan langkah yang sudah dicentang</div>${act.length ? rows(act.slice(0, 6).map(g => [g.title, prog(g)]), v => v + '%') : `<div style="opacity:.5">${rows([['Contoh target', 0], ['Contoh lainnya', 0]], v => v + '%')}</div><div class="mut">Grafik terisi setelah target pertama ditambahkan.</div>`}</div>
      <div class="card"><b>Tenggat terdekat</b>${soon.length ? soon.map(g => { const l = diff(today(), g.target_date); return `<div class="row" style="margin-top:10px"><div class="sp"><b>${esc(g.title)}</b><div class="mut">${fmt(g.target_date)}</div></div><span class="tag ${l < 0 ? 'warn' : ''}" style="margin:0">${l < 0 ? 'Terlewat ' + -l + ' hari' : l + ' hari lagi'}</span></div>`; }).join('') : '<div class="empty" style="margin-top:8px">Belum ada target dengan tanggal. Tambahkan tanggal target agar tenggatnya muncul di sini.</div>'}</div>
      <div class="card"><b>Tercapai per bulan</b><div class="plot">${per.map(v => `<div class="cbs"><i class="cb me" style="height:${v / mx * 100}%" title="${v} target"></i></div>`).join('')}</div>
        <div class="lbls">${ms.map(m => `<span>${new Date(m + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short' })}</span>`).join('')}</div></div></div>
    <div class="duo" style="margin-top:14px">${sec('pendek', 'Jangka pendek', 'target dekat')}${sec('panjang', 'Jangka panjang', 'mimpi besar')}</div>
    <h2 style="margin-top:22px">Sudah tercapai</h2>${fin.map(g => `<div class="card"><div class="row"><div class="sp"><b style="text-decoration:line-through;opacity:.7">${esc(g.title)}</b>
      <div class="mut">${g.horizon === 'panjang' ? 'Jangka panjang' : 'Jangka pendek'}${g.done_at ? ', tercapai ' + fmt(g.done_at) : ''}</div></div>
      <button class="x" onclick="goalDone(${g.id},0)">Buka lagi</button><button class="x" onclick="goalDel(${g.id})">Hapus</button></div></div>`).join('') || '<div class="empty">Target yang tercapai muncul di sini.</div>'}`;
  }

  const _go = go, _render = render;
  go = t => { if (t !== 'dreams') return _go(t); tab = 'dreams'; refresh().then(() => scrollTo(0, 0)); };
  render = () => { _render(); if (tab === 'dreams') drawGoals(); };
  nav();
})();
