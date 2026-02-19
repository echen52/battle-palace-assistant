// app.js
// All DOM interaction: search autocomplete, card rendering,
// custom set form, saved sets (localStorage), reset.
// Depends on: pokemon-data.js, pokemon-sprites.js, logic.js

// ── Derived lookups ───────────────────────────────────────────────────────

const byName    = {};   // "latios 1" -> palace set object
const bySpecies = {};   // "Latios"   -> [set, set, ...]

PALACE_DATA.forEach(p => {
  byName[p.name.toLowerCase()] = p;
  if (!bySpecies[p.species]) bySpecies[p.species] = [];
  bySpecies[p.species].push(p);
});

const ALL_MOVES   = Object.keys(MOVE_CLASS).sort();
const ALL_NATURES = Object.keys(NATURE_TABLE).sort();

// ── Saved sets (localStorage) ─────────────────────────────────────────────

const STORAGE_KEY = 'palace_custom_sets_v1';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveToDisk(sets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

let savedSets = loadSaved();

// ── HP toggle state (per card instance) ──────────────────────────────────

const hpStates = {};   // hpKey -> boolean (true = below 50%)

// ── Render helpers ────────────────────────────────────────────────────────

function moveCat(cls) {
  if (!cls || cls === 'nan' || cls === '#N/A' || cls === '---') return 'NA';
  const u = cls.toUpperCase();
  if (u.includes('ATK')) return 'ATK';
  if (u.includes('DEF')) return 'DEF';
  if (u.includes('SPT')) return 'SPT';
  return 'NA';
}

function pct(v)  { return Math.round((v || 0) * 100) + '%'; }
function pctF(v) { return ((v || 0) * 100).toFixed(1) + '%'; }

function barRow(label, cls, val) {
  return `<div class="bar-row">
    <span class="bar-label">${label}</span>
    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct(val)}"></div></div>
    <span class="bar-pct">${pctF(val)}</span>
  </div>`;
}

function probBarsHTML(ai_atk, ai_def, ai_spt, r_atk, r_def, r_nomove) {
  return `<div class="prob-cols">
    <div>
      <div class="prob-group-title">AI Category Probabilities</div>
      ${barRow('ATK',  'atk',  ai_atk)}
      ${barRow('DEF',  'def',  ai_def)}
      ${barRow('SPT',  'spt',  ai_spt)}
    </div>
    <div>
      <div class="prob-group-title">Random Move Probabilities</div>
      ${barRow('R_ATK',  'ratk', r_atk)}
      ${barRow('R_DEF',  'rdef', r_def)}
      ${barRow('NOMOVE', 'rno',  r_nomove)}
    </div>
  </div>`;
}

// ── Search autocomplete ───────────────────────────────────────────────────

function buildSuggestions(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set(), out = [];

  // Custom saved sets come first
  savedSets.forEach(s => {
    const label = s.species + ' (Custom)';
    if (label.toLowerCase().includes(q) && !seen.has('c:' + s.id)) {
      seen.add('c:' + s.id);
      out.push({
        label, sub: s.nature, type: 'custom', key: s.id,
        alarm: hasAlarm(s.moves, s.item),
      });
    }
  });

  // Exact palace name matches ("Latios 8")
  PALACE_DATA.forEach(p => {
    if (p.name.toLowerCase().startsWith(q) && !seen.has(p.name)) {
      seen.add(p.name);
      out.push({ label: p.name, sub: p.species, type: 'name', key: p.name });
    }
  });

  // Species groupings ("Latios" -> all Latios sets)
  if (!/\d/.test(q)) {
    Object.keys(bySpecies).sort().forEach(sp => {
      if (sp.toLowerCase().startsWith(q) && !seen.has('sp:' + sp)) {
        seen.add('sp:' + sp);
        const n = bySpecies[sp].length;
        out.push({ label: sp, sub: n + ' set' + (n > 1 ? 's' : ''), type: 'species', key: sp });
      }
    });
    // Partial palace name matches
    PALACE_DATA.forEach(p => {
      if (p.name.toLowerCase().includes(q) && !seen.has(p.name)) {
        seen.add(p.name);
        out.push({ label: p.name, sub: p.species, type: 'name', key: p.name });
      }
    });
  }

  return out.slice(0, 16);
}

// ── DOM elements ──────────────────────────────────────────────────────────

const searchEl = document.getElementById('search');
const acEl     = document.getElementById('ac');
const resultEl = document.getElementById('result');

// Populate nature dropdown
const natSel = document.getElementById('f-nature');
ALL_NATURES.forEach(n => {
  const o = document.createElement('option');
  o.value = o.textContent = n;
  natSel.appendChild(o);
});

// ── Autocomplete wiring ───────────────────────────────────────────────────

let acIdx = -1;

function hlAC(items, idx) {
  items.forEach((el, i) => el.classList.toggle('hi', i === idx));
}

function closeAC() {
  acEl.classList.remove('open');
  acEl.innerHTML = '';
  acIdx = -1;
}

searchEl.addEventListener('input', () => {
  acIdx = -1;
  const sug = buildSuggestions(searchEl.value);
  if (!sug.length) { closeAC(); return; }

  acEl.innerHTML = sug.map(s => {
    const alarm = s.alarm
      ?? (s.type === 'name' && (byName[s.key.toLowerCase()]?.alarm || byName[s.key.toLowerCase()]?.alarmItem));
    return `<div class="ac-item" data-key="${s.key}" data-type="${s.type}">
      <span>${s.label}</span>
      ${s.type === 'custom' ? '<span class="ac-custom">custom</span>' : ''}
      ${alarm ? '<span class="ac-alarm">⚠</span>' : ''}
      <span class="ac-sub">${s.sub}</span>
    </div>`;
  }).join('');

  acEl.querySelectorAll('.ac-item').forEach(el =>
    el.addEventListener('mousedown', e => { e.preventDefault(); pick(el.dataset.key, el.dataset.type); })
  );
  acEl.classList.add('open');
});

searchEl.addEventListener('keydown', e => {
  const items = acEl.querySelectorAll('.ac-item');
  if      (e.key === 'ArrowDown')  { e.preventDefault(); acIdx = Math.min(acIdx + 1, items.length - 1); hlAC(items, acIdx); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); acIdx = Math.max(acIdx - 1, -1); hlAC(items, acIdx); }
  else if (e.key === 'Enter')      { e.preventDefault(); const t = items[acIdx] || items[0]; if (t) pick(t.dataset.key, t.dataset.type); }
  else if (e.key === 'Escape')     closeAC();
});

searchEl.addEventListener('blur', () => setTimeout(closeAC, 150));

// ── Pick a result ─────────────────────────────────────────────────────────

let current = null;

function pick(key, type) {
  closeAC();
  if (type === 'custom') {
    const s = savedSets.find(x => x.id === key);
    if (!s) return;
    const probs = calcPalaceProbs(s.nature, s.moves);
    searchEl.value = s.species + ' (Custom)';
    current = null;
    hpStates['main'] = false;
    renderCustomCard(probs, s.species, s.nature, s.item, s.speed50, s.speed100, s.moves, resultEl, 'main');
  } else {
    current = type === 'name' ? byName[key.toLowerCase()] : bySpecies[key][0];
    searchEl.value = current.name;
    hpStates['main'] = false;
    renderPalaceCard();
  }
}

// ── Palace card renderer ──────────────────────────────────────────────────

function renderPalaceCard() {
  if (!current) return;
  const p    = current;
  const lHP  = hpStates['main'] || false;

  const ai_atk   = lHP ? p.ai_atk50   : p.ai_atk;
  const ai_def   = lHP ? p.ai_def50   : p.ai_def;
  const ai_spt   = lHP ? p.ai_spt50   : p.ai_spt;
  const r_atk    = lHP ? p.r_atk50    : p.r_atk;
  const r_def    = lHP ? p.r_def50    : p.r_def;
  const r_nomove = lHP ? p.r_nomove50 : p.r_nomove;

  const alarms    = [...(p.alarm ? ['alarm move'] : []), ...(p.alarmItem ? ['alarm item'] : [])];
  const movesHTML = p.moves.map((m, i) => {
    const c = moveCat(p.moveClasses[i]);
    return `<div class="move-row"><span class="cat-pill cat-${c}">${c}</span><span>${(!m || m === 'nan' || m === '---') ? '—' : m}</span></div>`;
  }).join('');

  resultEl.innerHTML = `<div class="card">
    <div class="card-header">
      <span class="card-title">${p.name}</span>
      <span class="card-sub">${p.species}</span>
      ${alarms.length ? `<span class="alarm-badge">⚠ ${alarms.join(' + ')}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="sprite-col">
        ${getSpriteHTML(p.species)}
        <div class="species-label">${p.species.toUpperCase()}</div>
      </div>
      <div class="info-col">
        <table class="info-table">
          <tr><td>Nature</td><td>${p.nature}</td></tr>
          <tr><td>Item</td><td>${p.item}</td></tr>
          <tr><td>Ability</td><td>${p.ability}</td></tr>
          <tr><td>Speed</td><td>
            <div class="speed-both">
              <span class="speed-chip"><span>Lv50 </span>${p.speed50}</span>
              <span class="speed-chip"><span>Lv100 </span>${p.speed100}</span>
            </div>
          </td></tr>
        </table>
        <div class="moves-label">Moves</div>
        <div class="moves-grid">${movesHTML}</div>
      </div>
    </div>
    <div class="prob-section">
      <div class="hp-tabs">
        <button class="hp-tab main-hp-tab ${!lHP ? 'active' : ''}" data-hp="high">▲ Above 50% HP</button>
        <button class="hp-tab main-hp-tab ${lHP  ? 'active low-hp' : ''}" data-hp="low">▼ Below 50% HP</button>
      </div>
      ${probBarsHTML(ai_atk, ai_def, ai_spt, r_atk, r_def, r_nomove)}
    </div>
  </div>`;

  resultEl.querySelectorAll('.main-hp-tab').forEach(btn =>
    btn.addEventListener('click', () => { hpStates['main'] = btn.dataset.hp === 'low'; renderPalaceCard(); })
  );
}

// ── Custom card renderer ──────────────────────────────────────────────────

function renderCustomCard(data, species, nature, item, speed50, speed100, moves, container, hpKey) {
  if (!hpStates[hpKey]) hpStates[hpKey] = false;
  const lHP = hpStates[hpKey];

  const { ai_atk, ai_def, ai_spt, r_atk, r_def, r_nomove,
          ai_atk50, ai_def50, ai_spt50, r_atk50, r_def50, r_nomove50, cats } = data;

  const A  = lHP ? ai_atk50   : ai_atk;
  const D  = lHP ? ai_def50   : ai_def;
  const S  = lHP ? ai_spt50   : ai_spt;
  const RA = lHP ? r_atk50    : r_atk;
  const RD = lHP ? r_def50    : r_def;
  const RN = lHP ? r_nomove50 : r_nomove;

  const alarms    = getAlarms(moves, item);
  const movesHTML = moves.map((m, i) => {
    const c = cats[i] || 'NA';
    return `<div class="move-row"><span class="cat-pill cat-${c}">${c}</span><span>${m || '—'}</span></div>`;
  }).join('');

  const speedRow = (speed50 || speed100) ? `<tr><td>Speed</td><td><div class="speed-both">
    ${speed50  ? `<span class="speed-chip"><span>Lv50 </span>${speed50}</span>`   : ''}
    ${speed100 ? `<span class="speed-chip"><span>Lv100 </span>${speed100}</span>` : ''}
  </div></td></tr>` : '';

  container.innerHTML = `<div class="card">
    <div class="card-header">
      <span class="card-title">${species} (Custom)</span>
      ${nature ? `<span class="card-sub">${nature}</span>` : ''}
      ${alarms.length ? `<span class="alarm-badge">⚠ ${alarms.join(' + ')}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="sprite-col">
        ${getSpriteHTML(species)}
        <div class="species-label">${species.toUpperCase()}</div>
      </div>
      <div class="info-col">
        <table class="info-table">
          <tr><td>Nature</td><td>${nature || '—'}</td></tr>
          <tr><td>Item</td><td>${item || '—'}</td></tr>
          ${speedRow}
        </table>
        <div class="moves-label">Moves</div>
        <div class="moves-grid">${movesHTML}</div>
      </div>
    </div>
    <div class="prob-section">
      <div class="hp-tabs">
        <button class="hp-tab chp-tab ${!lHP ? 'active' : ''}" data-hp="high">▲ Above 50% HP</button>
        <button class="hp-tab chp-tab ${lHP  ? 'active low-hp' : ''}" data-hp="low">▼ Below 50% HP</button>
      </div>
      ${probBarsHTML(A, D, S, RA, RD, RN)}
    </div>
  </div>`;

  container.querySelectorAll('.chp-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      hpStates[hpKey] = btn.dataset.hp === 'low';
      renderCustomCard(data, species, nature, item, speed50, speed100, moves, container, hpKey);
    })
  );
}

// ── Move autocomplete (form inputs) ──────────────────────────────────────

function setupMoveAC(inputId, acId) {
  const inp   = document.getElementById(inputId);
  const acDiv = document.getElementById(acId);
  let idx = -1;

  inp.addEventListener('input', () => {
    idx = -1;
    const q = inp.value.trim().toLowerCase();
    if (!q) { acDiv.classList.remove('open'); acDiv.innerHTML = ''; return; }

    const matches = ALL_MOVES
      .filter(m => m.toLowerCase().startsWith(q))
      .concat(ALL_MOVES.filter(m => !m.toLowerCase().startsWith(q) && m.toLowerCase().includes(q)))
      .slice(0, 10);

    if (!matches.length) { acDiv.classList.remove('open'); acDiv.innerHTML = ''; return; }

    acDiv.innerHTML = matches.map(m => {
      const cat = MOVE_CLASS[m] || 'NA';
      return `<div class="move-ac-item" data-move="${m}">
        <span class="move-ac-cat cat-${cat}">${cat}</span>
        <span>${m}</span>
      </div>`;
    }).join('');

    acDiv.querySelectorAll('.move-ac-item').forEach(el =>
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        inp.value = el.dataset.move;
        acDiv.classList.remove('open');
        acDiv.innerHTML = '';
      })
    );
    acDiv.classList.add('open');
  });

  inp.addEventListener('keydown', e => {
    const items = acDiv.querySelectorAll('.move-ac-item');
    if      (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('hi', i === idx)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); idx = Math.max(idx - 1, -1); items.forEach((el, i) => el.classList.toggle('hi', i === idx)); }
    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); inp.value = items[idx].dataset.move; acDiv.classList.remove('open'); acDiv.innerHTML = ''; }
    else if (e.key === 'Escape')    { acDiv.classList.remove('open'); acDiv.innerHTML = ''; }
  });

  inp.addEventListener('blur', () => setTimeout(() => { acDiv.classList.remove('open'); acDiv.innerHTML = ''; }, 150));
}

['1', '2', '3', '4'].forEach(n => setupMoveAC('f-move' + n, 'ac-move' + n));

// ── Smogon parse button ───────────────────────────────────────────────────

document.getElementById('parseSmogon').addEventListener('click', () => {
  const errEl  = document.getElementById('parseError');
  const parsed = parseSmogon(document.getElementById('smogonInput').value);
  if (!parsed) { errEl.textContent = 'Could not parse — check format.'; return; }
  errEl.textContent = '';

  document.getElementById('f-species').value = parsed.species;
  document.getElementById('f-item').value    = parsed.item;
  document.getElementById('f-spdev').value   = parsed.spdEV || '';

  const natMatch = ALL_NATURES.find(n => n.toLowerCase() === parsed.nature.toLowerCase());
  if (natMatch) document.getElementById('f-nature').value = natMatch;

  ['1', '2', '3', '4'].forEach((n, i) => {
    document.getElementById('f-move' + n).value = parsed.moves[i] || '';
  });
});

// ── Calculate button ──────────────────────────────────────────────────────

document.getElementById('calcCustom').addEventListener('click', () => {
  const errEl   = document.getElementById('calcError');
  const species = document.getElementById('f-species').value.trim();
  const nature  = document.getElementById('f-nature').value;
  const item    = document.getElementById('f-item').value.trim();
  const spdEV   = parseInt(document.getElementById('f-spdev').value) || 0;
  const moves   = ['1', '2', '3', '4'].map(n => document.getElementById('f-move' + n).value.trim()).filter(Boolean);

  if (!nature)       { errEl.textContent = 'Please select a nature.'; return; }
  if (!moves.length) { errEl.textContent = 'Please enter at least one move.'; return; }

  const unknown = moves.filter(m => m && m !== '---' && !MOVE_CLASS[m]);
  if (unknown.length) { errEl.textContent = 'Unknown move(s): ' + unknown.join(', ') + '. Check spelling.'; return; }
  errEl.textContent = '';

  const padded = [...moves]; while (padded.length < 4) padded.push('');
  const result = calcPalaceProbs(nature, padded);
  if (!result) { errEl.textContent = 'Error computing probabilities.'; return; }

  const speed50  = species ? calcSpeed(species, nature, spdEV, 50)  : null;
  const speed100 = species ? calcSpeed(species, nature, spdEV, 100) : null;

  hpStates['customPanel'] = false;
  renderCustomCard(result, species || 'Custom', nature, item, speed50, speed100, padded,
    document.getElementById('customResult'), 'customPanel');
});

// ── Save set ──────────────────────────────────────────────────────────────

document.getElementById('saveSet').addEventListener('click', () => {
  const errEl   = document.getElementById('calcError');
  const species = document.getElementById('f-species').value.trim();
  const nature  = document.getElementById('f-nature').value;
  const item    = document.getElementById('f-item').value.trim();
  const spdEV   = parseInt(document.getElementById('f-spdev').value) || 0;
  const moves   = ['1', '2', '3', '4'].map(n => document.getElementById('f-move' + n).value.trim());

  if (!species) { errEl.textContent = 'Please enter a species name to save.'; return; }
  if (!nature)  { errEl.textContent = 'Please select a nature to save.'; return; }
  errEl.textContent = '';

  const set = {
    id:      Date.now().toString(),
    species, nature, item, spdEV,
    speed50:  calcSpeed(species, nature, spdEV, 50)  || null,
    speed100: calcSpeed(species, nature, spdEV, 100) || null,
    moves,
  };

  savedSets.push(set);
  saveToDisk(savedSets);
  renderSavedList();

  errEl.style.color = '#00d9ff';
  errEl.textContent = `Set saved! Search "${species} (Custom)" to look it up.`;
  setTimeout(() => { errEl.style.color = ''; errEl.textContent = ''; }, 3000);
});

// ── Saved sets list ───────────────────────────────────────────────────────

function renderSavedList() {
  const container = document.getElementById('savedList');
  if (!savedSets.length) {
    container.innerHTML = '<span class="no-saved">No saved sets yet.</span>';
    return;
  }

  container.innerHTML = savedSets.map(s => `
    <div class="saved-chip" data-id="${s.id}">
      <span class="chip-label">${s.species} <span style="color:#888;font-size:11px;">${s.nature}</span></span>
      <span class="del-btn" data-del="${s.id}" title="Delete">✕</span>
    </div>`).join('');

  container.querySelectorAll('.saved-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.dataset.del) return;
      const s = savedSets.find(x => x.id === chip.dataset.id);
      if (!s) return;

      const probs = calcPalaceProbs(s.nature, s.moves);
      if (!probs) return;

      // Open the panel, fill the form, show the result
      document.getElementById('customBody').classList.add('open');
      document.getElementById('customChevron').classList.add('open');
      document.getElementById('f-species').value = s.species;
      document.getElementById('f-nature').value  = s.nature;
      document.getElementById('f-item').value    = s.item || '';
      document.getElementById('f-spdev').value   = s.spdEV || '';
      ['1', '2', '3', '4'].forEach((n, i) => document.getElementById('f-move' + n).value = s.moves[i] || '');

      hpStates['customPanel'] = false;
      renderCustomCard(probs, s.species, s.nature, s.item, s.speed50, s.speed100, s.moves,
        document.getElementById('customResult'), 'customPanel');
      document.getElementById('customResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    chip.querySelector('.del-btn').addEventListener('click', e => {
      e.stopPropagation();
      savedSets = savedSets.filter(x => x.id !== e.target.dataset.del);
      saveToDisk(savedSets);
      renderSavedList();
    });
  });
}

// ── Custom panel toggle ───────────────────────────────────────────────────

document.getElementById('customToggle').addEventListener('click', () => {
  document.getElementById('customBody').classList.toggle('open');
  document.getElementById('customChevron').classList.toggle('open');
});

// ── Reset ─────────────────────────────────────────────────────────────────

document.getElementById('resetBtn').addEventListener('click', () => {
  searchEl.value = ''; current = null; resultEl.innerHTML = ''; closeAC();
  hpStates['main'] = false; hpStates['customPanel'] = false;

  document.getElementById('f-species').value = '';
  document.getElementById('f-nature').value  = '';
  document.getElementById('f-item').value    = '';
  document.getElementById('f-spdev').value   = '';
  ['1', '2', '3', '4'].forEach(n => document.getElementById('f-move' + n).value = '');
  document.getElementById('smogonInput').value = '';
  document.getElementById('parseError').textContent = '';
  document.getElementById('calcError').textContent  = '';
  document.getElementById('customResult').innerHTML = '';
  document.getElementById('customBody').classList.remove('open');
  document.getElementById('customChevron').classList.remove('open');
});

// ── Init ──────────────────────────────────────────────────────────────────

renderSavedList();
