// ══════════════════════════════════════════════════════════
// PANELS — all tab panels + render + window globals
// ══════════════════════════════════════════════════════════
import {
  S, APP_PEP, APP_EXERCISE,
  TARGET_BF_LO, TARGET_BF_HI, TARGET_LBM,
  RACES, Q_COLORS, DOC_TYPES, DOC_ICONS, TABS,
  daysUntil, fmtDate, fmtMonthShort, getWeekNum,
  quarterRollup, getAllPeriodIds, getMilestonesForPeriod, getDocContent, renderMd,
} from './state.js?v=31';
import { supa, updateTimelineRow } from './supabase.js?v=31';

// ── RENDER ──
function renderTabNav(){
  document.getElementById('tab-nav').innerHTML = TABS.map((t,i)=>
    `<button class="tab-btn${S.tab===i?' act':''}" onclick="setTab(${i})">${t}</button>`
  ).join('');
}

function renderQuarterCardsContainer(){
  const el = document.getElementById('quarter-cards-row');
  if(!el) return;
  el.style.display = 'block';
  el.innerHTML = renderQuarterCardRow();
}

function renderPanel(){
  try {
    renderQuarterCardsContainer();
    let html = '';
    if(S.tab===0)      html = pOverview();
    else if(S.tab===1) html = pMilestones();
    else if(S.tab===2) html = pDocs();
    else if(S.tab===3) html = pBodyComp();
    else               html = pRaceGoals();
    document.getElementById('panels-root').innerHTML = html;
  } catch(e) {
    console.error('renderPanel error:', e);
    document.getElementById('panels-root').innerHTML =
      `<div class="card"><div class="empty-state"><div class="empty-ico">⚠️</div><div class="empty-txt">Error: ${e.message}</div></div></div>`;
  }
}

export function render(){ renderTabNav(); renderPanel(); }

// ── WINDOW GLOBALS (called from HTML onclick) ──
window.setTab = function(i){ S.tab=i; render(); };
window.selectQ = function(qid){
  S.selectedQ = qid;
  try { localStorage.setItem('vhm.activeQuarter', qid); } catch(e){}
  render();
};
window.setActiveDoc = function(doc){
  S.activeDoc = doc;
  renderPanel();
};
window.selectQDoc = window.selectQ;

// ── EDIT HANDLERS ──
window.startEdit = function(periodId){
  S.editingPeriod = S.editingPeriod === periodId ? null : periodId;
  renderQuarterCardsContainer();
  // scroll ke form
  if(S.editingPeriod){
    setTimeout(()=>{
      const el = document.getElementById(`edit-form-${periodId}`);
      if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 50);
  }
};

// ── MILESTONE INLINE EDIT ──
const _msPending = {};  // { period_id: { field: value, ... } }

window.msFieldChange = function(el){
  const pid   = el.dataset.pid;
  const field = el.dataset.field;
  const type  = el.type;
  let val = el.value;
  if(type === 'number') val = val === '' ? null : parseFloat(val);
  if(!_msPending[pid]) _msPending[pid] = {};
  _msPending[pid][field] = val;
  // Show save bar
  const bar = document.getElementById('ms-save-bar');
  if(bar) bar.style.display = 'flex';
  const msg = document.getElementById('ms-save-msg');
  if(msg) msg.textContent = `${Object.keys(_msPending).length} quarter diubah — belum disimpan`;
};

window.saveMsChanges = async function(){
  const msg = document.getElementById('ms-save-msg');
  const entries = Object.entries(_msPending);
  if(!entries.length) return;
  if(msg){ msg.textContent = `⏳ Menyimpan ${entries.length} quarter...`; msg.style.color='var(--t3)'; }
  const errs = [];
  for(const [pid, fields] of entries){
    try {
      const updated = await updateTimelineRow(pid, fields);
      const idx = S.timeline.findIndex(r => r.period_id === pid);
      if(idx >= 0){
        const merged = updated ? { ...S.timeline[idx], ...updated } : { ...S.timeline[idx], ...fields };
        S.timeline[idx] = merged;
        S.byPeriod[pid]  = merged;
      }
      delete _msPending[pid];
    } catch(e){ errs.push(`${pid}: ${e.message}`); }
  }
  if(errs.length){
    if(msg){ msg.textContent = '❌ ' + errs.join(' | '); msg.style.color='var(--warn)'; }
  } else {
    if(msg){ msg.textContent = '✅ Semua tersimpan!'; msg.style.color='var(--f3)'; }
    setTimeout(()=>render(), 800);
  }
};

window.discardMsChanges = function(){
  Object.keys(_msPending).forEach(k => delete _msPending[k]);
  render();
};

window.cancelEdit = function(){
  S.editingPeriod = null;
  renderQuarterCardsContainer();
};

window.saveEdit = async function(periodId){
  const msg = document.getElementById('ef-msg');
  if(msg) msg.textContent = '⏳ Menyimpan...';

  const g = id => document.getElementById(id)?.value ?? null;
  const num = id => { const v = g(id); return (v===''||v===null) ? null : parseFloat(v); };
  const int = id => { const v = g(id); return (v===''||v===null) ? null : parseInt(v); };

  const fields = {
    label_short:          g('ef-label_short')   || null,
    date_start:           g('ef-date_start')    || null,
    date_end:             g('ef-date_end')      || null,
    week_start:           int('ef-week_start'),
    week_end:             int('ef-week_end'),
    bb_start_kg:          num('ef-bb_start_kg'),
    bb_end_kg:            num('ef-bb_end_kg'),
    bf_start_pct:         num('ef-bf_start_pct'),
    bf_end_pct:           num('ef-bf_end_pct'),
    focus_roadmap:        g('ef-focus_roadmap') || null,
    focus_pep:            g('ef-focus_pep')     || null,
    focus_exercise:       g('ef-focus_exercise')|| null,
    content_target_md:    g('ef-content_target_md')  || null,
    content_peptide_md:   g('ef-content_peptide_md') || null,
    content_gym_md:       g('ef-content_gym_md')     || null,
    content_cardio_md:    g('ef-content_cardio_md')  || null,
    content_nutrisi_md:   g('ef-content_nutrisi_md') || null,
    content_vitamin_md:   g('ef-content_vitamin_md') || null,
  };

  // Remove null values yang tidak perlu di-update (biarkan DB value existing)
  // Tapi tetap kirim explicit null kalau user kosongkan field
  try {
    const updated = await updateTimelineRow(periodId, fields);
    // Patch in-memory S.timeline + S.byPeriod
    const idx = S.timeline.findIndex(r => r.period_id === periodId);
    if(idx >= 0 && updated){
      S.timeline[idx] = { ...S.timeline[idx], ...updated };
      S.byPeriod[periodId] = S.timeline[idx];
    } else if(idx >= 0){
      S.timeline[idx] = { ...S.timeline[idx], ...fields };
      S.byPeriod[periodId] = S.timeline[idx];
    }
    if(msg) { msg.textContent = '✅ Tersimpan!'; msg.style.color = 'var(--f3)'; }
    setTimeout(()=>{
      S.editingPeriod = null;
      render();
    }, 800);
  } catch(e){
    if(msg) { msg.textContent = '❌ Error: ' + e.message; msg.style.color = 'var(--warn)'; }
  }
};

// ── QUARTER CARD ROW ──
function pickActivePeriodIdx(periods){
  const today = new Date();
  const idx = periods.findIndex(p => today >= new Date(p.date_start) && today <= new Date(p.date_end));
  if(idx >= 0) return idx;
  return Math.max(0, periods.findIndex(p => p.period_id === 'Q3_2026'));
}

function inp(id, label, val, type='text', placeholder=''){
  return `<div>
    <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">${label}</div>
    <input id="${id}" type="${type}" value="${val??''}" placeholder="${placeholder}"
      style="width:100%;background:var(--bg0);border:1.5px solid var(--bdr2);border-radius:var(--r);color:var(--t0);padding:5px 8px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;outline:none;box-sizing:border-box"
      onfocus="this.style.borderColor='var(--acc)'" onblur="this.style.borderColor='var(--bdr2)'">
  </div>`;
}

function ta(id, label, val){
  return `<div style="grid-column:1/-1">
    <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">${label}</div>
    <textarea id="${id}" rows="3"
      style="width:100%;background:var(--bg0);border:1.5px solid var(--bdr2);border-radius:var(--r);color:var(--t0);padding:5px 8px;font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;resize:vertical;box-sizing:border-box"
      onfocus="this.style.borderColor='var(--acc)'" onblur="this.style.borderColor='var(--bdr2)'">${(val||'').replace(/</g,'&lt;')}</textarea>
  </div>`;
}

function renderEditForm(p){
  const pid = p.period_id;
  return `
  <div id="edit-form-${pid}" style="background:var(--bg2);border:2px solid var(--acc);border-radius:var(--r2);padding:1rem;margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
      <div style="font-size:13px;font-weight:800;color:var(--acc)">✏️ Edit — ${p.label_short}</div>
      <button onclick="cancelEdit()" style="background:var(--bg3);border:1px solid var(--bdr);color:var(--t2);padding:4px 10px;border-radius:var(--r);font-size:11px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">✕ Batal</button>
    </div>

    <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Identitas</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:1rem">
      ${inp(`ef-label_short`,   'Label Short',   p.label_short)}
      ${inp(`ef-date_start`,    'Date Start',    p.date_start, 'date')}
      ${inp(`ef-date_end`,      'Date End',      p.date_end,   'date')}
      ${inp(`ef-week_start`,    'Week Start',    p.week_start, 'number')}
      ${inp(`ef-week_end`,      'Week End',      p.week_end,   'number')}
    </div>

    <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Target Body</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:1rem">
      ${inp(`ef-bb_start_kg`,   'BB Start (kg)', p.bb_start_kg, 'number', '86')}
      ${inp(`ef-bb_end_kg`,     'BB End (kg)',   p.bb_end_kg,   'number', '75')}
      ${inp(`ef-bf_start_pct`,  'BF Start (%)',  p.bf_start_pct,'number', '24')}
      ${inp(`ef-bf_end_pct`,    'BF End (%)',    p.bf_end_pct,  'number', '18')}
    </div>

    <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Focus & Phase</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:1rem">
      ${inp(`ef-focus_roadmap`, 'Focus Roadmap', p.focus_roadmap, 'text', 'misal: Metabolic Reset')}
      ${inp(`ef-focus_pep`,     'Focus Peptide', p.focus_pep,     'text', 'misal: Retatrutide')}
      ${inp(`ef-focus_exercise`,'Focus Exercise',p.focus_exercise,'text', 'misal: Hypertrophy')}
    </div>

    <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Content Docs (Markdown)</div>
    <div style="display:grid;gap:8px;margin-bottom:1rem">
      ${ta(`ef-content_target_md`,  '🎯 Target MD',  p.content_target_md)}
      ${ta(`ef-content_peptide_md`, '💉 Peptide MD', p.content_peptide_md)}
      ${ta(`ef-content_gym_md`,     '🏋️ Gym MD',     p.content_gym_md)}
      ${ta(`ef-content_cardio_md`,  '🏃 Cardio MD',  p.content_cardio_md)}
      ${ta(`ef-content_nutrisi_md`, '🍽️ Nutrisi MD', p.content_nutrisi_md)}
      ${ta(`ef-content_vitamin_md`, '💊 Vitamin MD', p.content_vitamin_md)}
    </div>

    <div style="display:flex;gap:8px;align-items:center">
      <button onclick="saveEdit('${pid}')"
        style="padding:8px 20px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">
        💾 Simpan ke DB
      </button>
      <span id="ef-msg" style="font-size:11px;color:var(--t3)"></span>
    </div>
  </div>`;
}

function renderQuarterCardRow(){
  if(!S.timeline?.length) return '<div style="color:var(--t3);font-size:11px;padding:10px">Loading periods…</div>';

  const editing = S.editingPeriod ? renderEditForm(S.byPeriod[S.editingPeriod] || {}) : '';

  const activeIdx = pickActivePeriodIdx(S.timeline);
  const startIdx  = Math.max(0, Math.min(activeIdx, S.timeline.length - 4));
  const visible   = S.timeline.slice(startIdx, startIdx + 4);

  const cards = visible.map(p => {
    const sel = S.selectedQ === p.period_id;
    const isEditing = S.editingPeriod === p.period_id;
    const hasBB = p.bb_start_kg != null;
    const hasBF = p.bf_start_pct != null;
    const bbRange = hasBB ? `${p.bb_start_kg}→${p.bb_end_kg} kg` : '—';
    const bfRange = hasBF ? `${p.bf_start_pct}→${p.bf_end_pct}%` : '—';
    const phase = p.focus_roadmap || '';
    const dotColor = hasBB ? 'var(--acc)' : 'var(--t3)';
    const weeks   = (p.week_start && p.week_end) ? `W${p.week_start}–W${p.week_end}` : 'pre-protokol';
    const dateRange = `${fmtMonthShort(p.date_start)} – ${fmtMonthShort(p.date_end)}`;
    const phaseShort = phase ? (phase.length > 70 ? phase.slice(0, 67) + '...' : phase) : '';

    return `<div class="ph-card${sel?' sel-all':''}" onclick="selectQ('${p.period_id}')" style="cursor:pointer">
      <div class="ph-tag" style="color:${dotColor}">
        <div class="ph-dot" style="background:${dotColor}"></div>
        ${p.label_short}
      </div>
      <div class="ph-name">${p.label_short}</div>
      <div class="ph-desc" style="font-size:10.5px">${weeks} · ${dateRange}</div>
      <div class="ph-grid" style="grid-template-columns:1fr 1fr">
        <div class="ph-stat"><div class="ph-stat-l">BB Target</div><div class="ph-stat-v" style="color:${hasBB?'var(--acc)':'var(--t3)'};font-size:13px">${bbRange}</div></div>
        <div class="ph-stat"><div class="ph-stat-l">BF Target</div><div class="ph-stat-v" style="color:${hasBF?'var(--acc)':'var(--t3)'};font-size:13px">${bfRange}</div></div>
        <div class="ph-stat" style="grid-column:1/-1">
          <div class="ph-stat-l">Phase</div>
          <div class="ph-stat-v" style="font-size:11px;line-height:1.35" title="${(phase||'').replace(/"/g,'&quot;')}">${phaseShort || '<span style="color:var(--t3)">—</span>'}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
    ${editing}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:1rem;overflow-x:auto">${cards}</div>`;
}

// ── PANEL: OVERVIEW ──
function pOverview(){
  const wk = S.currentWeek;
  const q  = S.currentQuarter;
  const bc = S.latestBodyComp;

  const bf    = bc?.bf_pct ?? null;
  const lbm   = bc?.lbm_kg ?? null;
  const bb    = bc?.weight_kg ?? null;
  const bfColor  = bf===null ? 'var(--t3)' : bf<=TARGET_BF_LO ? 'var(--f3)' : bf<=TARGET_BF_HI ? 'var(--acc)' : 'var(--warn)';
  const lbmColor = lbm===null ? 'var(--t3)' : lbm>=TARGET_LBM ? 'var(--f3)' : 'var(--f2)';

  const statusBar = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">📊 Status Tubuh Saat Ini ${bc ? `<span style="font-size:9px;font-weight:600;color:var(--t3);margin-left:4px">${fmtDate(bc.logged_date)}</span>` : ''}</div>
      <div class="vial-summary-strip" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));margin-bottom:0">
        <div class="vs-card">
          <div class="vs-l">Body Weight</div>
          <div class="vs-v" style="color:var(--t0)">${bb ?? '—'}<span style="font-size:13px;font-weight:600"> kg</span></div>
          <div class="vs-s">Target: ${q?.bb_end ?? '?'} kg</div>
        </div>
        <div class="vs-card">
          <div class="vs-l">Body Fat %</div>
          <div class="vs-v" style="color:${bfColor}">${bf ?? '—'}<span style="font-size:13px;font-weight:600">${bf!==null?'%':''}</span></div>
          <div class="vs-s">Target: ${TARGET_BF_LO}–${TARGET_BF_HI}%</div>
        </div>
        <div class="vs-card">
          <div class="vs-l">Lean Mass</div>
          <div class="vs-v" style="color:${lbmColor}">${lbm ?? '—'}<span style="font-size:13px;font-weight:600">${lbm!==null?' kg':''}</span></div>
          <div class="vs-s">Target: ≥${TARGET_LBM} kg</div>
        </div>
        <div class="vs-card">
          <div class="vs-l">Protocol Week</div>
          <div class="vs-v" style="color:var(--acc)">${wk > 0 ? 'W'+wk : '—'}</div>
          <div class="vs-s">${q ? q.quarter_id.replace('_',' ') : 'Belum mulai'}</div>
        </div>
      </div>
      ${!S.user ? `<div style="font-size:11px;color:var(--t3);margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--bdr)">💡 Login untuk melihat data body comp aktual kamu</div>` : ''}
    </div>`;

  const appLinks = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:.75rem">
      <a href="${APP_PEP}" target="_blank" style="text-decoration:none">
        <div class="card" style="cursor:pointer;transition:all .2s;border:2px solid var(--bdr)" onmouseover="this.style.borderColor='var(--f2)'" onmouseout="this.style.borderColor='var(--bdr)'">
          <div style="font-size:1.75rem;margin-bottom:6px">💉</div>
          <div style="font-size:13px;font-weight:800;color:var(--t0)">Peptide Dashboard</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Compounds · Dose · Gantt · Budget</div>
          <div style="font-size:10px;color:var(--acc);font-weight:700;margin-top:8px">Buka App →</div>
        </div>
      </a>
      <a href="${APP_EXERCISE}" target="_blank" style="text-decoration:none">
        <div class="card" style="cursor:pointer;transition:all .2s;border:2px solid var(--bdr)" onmouseover="this.style.borderColor='var(--f3)'" onmouseout="this.style.borderColor='var(--bdr)'">
          <div style="font-size:1.75rem;margin-bottom:6px">🏋️</div>
          <div style="font-size:13px;font-weight:800;color:var(--t0)">Exercise Dashboard</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Gym Log · Cardio · Progression</div>
          <div style="font-size:10px;color:var(--f3);font-weight:700;margin-top:8px">Buka App →</div>
        </div>
      </a>
    </div>`;

  const gymSessions = S.activeGymSessions;
  const gymHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title" style="justify-content:space-between">
        <span>🏋️ Gym — Minggu Ini</span>
        <a href="${APP_EXERCISE}" target="_blank" style="font-size:10px;color:var(--acc);font-weight:700;text-decoration:none">Lihat semua →</a>
      </div>
      ${!S.user ? `<div style="font-size:11px;color:var(--t3)">Login untuk melihat log gym kamu</div>` :
        gymSessions.length ? `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:.75rem">
          <div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--f1)">${gymSessions.length}</div>
          <div style="font-size:11px;color:var(--t2)">sesi<br>minggu ini</div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:10px;color:var(--t3)">Terakhir</div>
            <div style="font-size:12px;font-weight:700;color:var(--t0)">${fmtDate(gymSessions[0].session_date)}</div>
            <div style="font-size:10px;color:var(--t2)">${gymSessions[0].duration_min||'—'} min</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${gymSessions.map(s=>`<span class="bdg bdg-f1">${fmtDate(s.session_date)}</span>`).join('')}
        </div>` :
        `<div style="font-size:11px;color:var(--t3)">Belum ada sesi gym minggu ini</div>`
      }
    </div>`;

  const cardioLog = S.activeCardioLog;
  const totalMin  = cardioLog.reduce((a,r)=>a+(r.duration_min||0),0);
  const totalKm   = cardioLog.reduce((a,r)=>a+parseFloat(r.distance_km||0),0);
  const z1Count   = cardioLog.filter(r=>r.zone==='Z1').length;
  const z2Count   = cardioLog.filter(r=>r.zone==='Z2').length;
  const cardioHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title" style="justify-content:space-between">
        <span>🏃 Cardio — Minggu Ini</span>
        <a href="${APP_EXERCISE}" target="_blank" style="font-size:10px;color:var(--acc);font-weight:700;text-decoration:none">Lihat semua →</a>
      </div>
      ${!S.user ? `<div style="font-size:11px;color:var(--t3)">Login untuk melihat log cardio kamu</div>` :
        cardioLog.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Sesi</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--f3)">${cardioLog.length}</div></div>
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Total</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--t0)">${totalMin}<span style="font-size:11px"> min</span></div></div>
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Jarak</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--t0)">${totalKm.toFixed(1)}<span style="font-size:11px"> km</span></div></div>
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Zone</div>
            <div style="display:flex;gap:4px;margin-top:4px"><span class="bdg bdg-f3">Z1×${z1Count}</span><span class="bdg bdg-acc">Z2×${z2Count}</span></div></div>
        </div>` :
        `<div style="font-size:11px;color:var(--t3)">Belum ada cardio minggu ini</div>`
      }
    </div>`;

  const raceHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">🏁 Race Countdown</div>
      ${RACES.map(r=>{
        const days = daysUntil(r.date);
        return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--bdr)">
          <div style="font-size:1.5rem">${r.icon}</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:800;color:var(--t0)">${r.name}</div>
            <div style="font-size:10px;color:var(--t2)">${r.date} · ${r.dist}</div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:${days<90?'var(--warn)':days<180?'var(--f2)':'var(--acc)'};white-space:nowrap">
            ${days>0 ? days+' hari' : '🎯 RACE DAY'}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const qProgress = q ? `
    <div class="card">
      <div class="card-title">📋 Quarter Aktif: ${q.quarter_id.replace('_',' ')}</div>
      <div style="font-size:11px;color:var(--t2);margin-bottom:.75rem">${q.window_raw||''} · ${q.phase_type||''}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:.875rem">
        <div style="background:var(--bg2);border-radius:var(--r);padding:.625rem .75rem;border:1px solid var(--bdr)">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">BB Target</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--t0);margin-top:2px">${q.bb_start??'?'} → ${q.bb_end??'?'} kg</div>
        </div>
        <div style="background:var(--bg2);border-radius:var(--r);padding:.625rem .75rem;border:1px solid var(--bdr)">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">BF% Target</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--f3);margin-top:2px">${q.bf_start??'?'} → ${q.bf_end??'?'}%</div>
        </div>
      </div>
      ${q.total_weeks ? `
      <div style="font-size:10px;color:var(--t2);margin-bottom:5px">Progress W${wk} dari ${q.total_weeks} weeks</div>
      <div class="ph-bar"><div class="ph-bar-fill" style="width:${Math.round((wk/q.total_weeks)*100)}%;background:var(--acc)"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:9px;color:var(--t3)">W1</span>
        <span style="font-size:9px;color:var(--acc);font-weight:700">${Math.round((wk/q.total_weeks)*100)}%</span>
        <span style="font-size:9px;color:var(--t3)">W${q.total_weeks}</span>
      </div>` : ''}
    </div>` : '';

  const selectedQid = S.selectedQ || S.currentQuarter?.quarter_id;
  const checkpointsHtml = selectedQid ? renderCheckpoints(selectedQid) : '';

  return statusBar + checkpointsHtml + appLinks + gymHtml + cardioHtml + raceHtml + qProgress;
}

// ── CHECKPOINTS ──
function renderCheckpoints(periodId){
  if(!periodId) return '';
  const ms = getMilestonesForPeriod(periodId);
  if(!ms.length){
    return `<div class="card" style="margin-bottom:.75rem">
      <div class="card-title">📍 Checkpoints — ${periodId.replace('_',' ')}</div>
      <div class="empty-state" style="padding:1.5rem 1rem">
        <div class="empty-ico">📍</div>
        <div class="empty-txt">Belum ada checkpoint data untuk quarter ini</div>
      </div>
    </div>`;
  }
  return `<div class="card" style="margin-bottom:.75rem">
    <div class="card-title">📍 Checkpoints — ${periodId.replace('_',' ')} · ${ms.length} milestone</div>
    ${ms.map((m,i)=>`
      <div class="ms-row">
        <div class="ms-dot" style="background:hsl(${200+i*25},65%,55%)"></div>
        <div class="ms-week">${m.week_label}</div>
        <div class="ms-date">${m.date_range||''}</div>
        <div class="ms-chips">
          <div class="ms-chip"><div class="ms-chip-l">BB</div><div class="ms-chip-v">${m.bb_target||'?'} kg</div></div>
          <div class="ms-chip"><div class="ms-chip-l">BF%</div><div class="ms-chip-v">${m.bf_target||'?'}%</div></div>
          ${m.lab_tests ? `<div class="ms-chip"><div class="ms-chip-l">Lab</div><div class="ms-chip-v" style="font-size:10px">${m.lab_tests}</div></div>` : ''}
        </div>
        ${m.note ? `<div class="ms-note">${m.note}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

// ── PANEL: MILESTONES ──
function msInp(pid, field, val, type='text', w='80px'){
  const esc = (v) => String(v??'').replace(/"/g,'&quot;');
  return `<input
    data-pid="${pid}" data-field="${field}" type="${type}"
    value="${esc(val)}"
    style="width:${w};background:var(--bg2);border:1.5px solid var(--bdr2);border-radius:5px;color:var(--t0);padding:3px 6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;outline:none;box-sizing:border-box"
    onfocus="this.style.borderColor='var(--acc)'"
    onblur="this.style.borderColor='var(--bdr2)'"
    onchange="msFieldChange(this)">`;
}

// Category config for milestone badges
const MS_CAT = {
  lab:       { icon:'🧪', label:'Lab',       color:'var(--f2)',  bg:'var(--f2-bg)',  bdr:'var(--f2-bdr)' },
  race:      { icon:'🏁', label:'Race',      color:'var(--f1)',  bg:'var(--f1-bg)',  bdr:'var(--f1-bdr)' },
  body_comp: { icon:'⚖️', label:'Body Comp', color:'var(--acc)', bg:'var(--acc-bg)', bdr:'var(--acc-bdr)' },
  nutrition: { icon:'🍽️', label:'Nutrition', color:'var(--hor)', bg:'rgba(234,88,12,.08)', bdr:'rgba(234,88,12,.22)' },
  hormone:   { icon:'🔬', label:'Hormone',   color:'var(--cns)', bg:'rgba(124,58,237,.08)', bdr:'rgba(124,58,237,.2)' },
  fitness:   { icon:'📊', label:'Fitness',   color:'var(--f3)',  bg:'var(--f3-bg)',  bdr:'var(--f3-bdr)' },
  training:  { icon:'🏋️', label:'Training',  color:'var(--f3)',  bg:'var(--f3-bg)',  bdr:'var(--f3-bdr)' },
};
const MC_COLORS = { MC1:'var(--f1)', MC2:'var(--acc)', MC3:'var(--f3)', MC4:'var(--hor)', MC5:'var(--f2)' };

function pMilestones(){
  const ms = S.milestones || [];

  if(!ms.length) return `<div class="card"><div class="empty-state">
    <div class="empty-ico">📋</div>
    <div class="empty-txt">Belum ada milestone data. Upload milestones_upload.sql ke Supabase dulu.</div>
  </div></div>`;

  const today = new Date();

  // ── Dashboard stats ──
  const totalMs = ms.length;
  const doneMs  = ms.filter(m => m.status === 'done').length;
  const failMs  = ms.filter(m => m.status === 'failed').length;
  const overdueMs = ms.filter(m => {
    if(m.status === 'done' || m.status === 'failed') return false;
    if(!m.date_target) return false;
    return new Date(m.date_target) < today;
  }).length;
  const pendingMs = totalMs - doneMs - failMs - overdueMs;
  const pct = totalMs ? Math.round((doneMs / totalMs) * 100) : 0;

  // Next upcoming milestone (not done/failed, future date, nearest)
  const upcoming = ms
    .filter(m => m.status !== 'done' && m.status !== 'failed' && m.date_target && new Date(m.date_target) >= today)
    .sort((a,b) => new Date(a.date_target) - new Date(b.date_target))[0] || null;
  const upDays = upcoming ? Math.ceil((new Date(upcoming.date_target) - today) / (1000*60*60*24)) : null;

  // Per-MC progress
  const MC_LABELS = { MC1:'MC1', MC2:'MC2', MC3:'MC3', MC4:'MC4', MC5:'MC5' };
  const byMC_stats = {};
  ms.forEach(m => {
    const mc = m.macrocycle_id || 'MC?';
    if(!byMC_stats[mc]) byMC_stats[mc] = { total:0, done:0 };
    byMC_stats[mc].total++;
    if(m.status === 'done') byMC_stats[mc].done++;
  });

  const mcProgBars = Object.entries(byMC_stats).map(([mc, s]) => {
    const p = s.total ? Math.round((s.done/s.total)*100) : 0;
    const c = MC_COLORS[mc] || 'var(--t2)';
    return `<div style="min-width:80px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:9px;font-weight:800;color:${c}">${mc}</span>
        <span style="font-size:9px;color:var(--t3)">${s.done}/${s.total}</span>
      </div>
      <div style="height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${p}%;background:${c};border-radius:2px;transition:width .4s"></div>
      </div>
    </div>`;
  }).join('');

  const dashCard = `<div class="card" style="margin-bottom:.875rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:14px;font-weight:800;color:var(--t0)">🏆 Protocol Milestones</div>
        <div style="font-size:11px;color:var(--t3);margin-top:2px">${totalMs} gate milestones · 2026–2030</div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--acc)">${pct}<span style="font-size:14px">%</span></div>
    </div>

    <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:.875rem">
      <div style="height:100%;width:${pct}%;background:var(--acc);border-radius:3px;transition:width .4s"></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:.875rem">
      <div style="background:var(--f3-bg);border:1px solid var(--f3-bdr);border-radius:var(--r);padding:.625rem .75rem;text-align:center">
        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--f3)">${doneMs}</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-top:2px">Done</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r);padding:.625rem .75rem;text-align:center">
        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--t2)">${pendingMs}</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-top:2px">Pending</div>
      </div>
      <div style="background:var(--warn-bg);border:1px solid var(--warn-bdr);border-radius:var(--r);padding:.625rem .75rem;text-align:center">
        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--warn)">${overdueMs}</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-top:2px">Overdue</div>
      </div>
      <div style="background:var(--f2-bg);border:1px solid var(--f2-bdr);border-radius:var(--r);padding:.625rem .75rem;text-align:center">
        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--f2)">${failMs}</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-top:2px">Failed</div>
      </div>
    </div>

    ${upcoming ? `<div style="background:var(--bg2);border:1px solid var(--bdr2);border-radius:var(--r);padding:.75rem;margin-bottom:.875rem;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="font-size:1.5rem">${(MS_CAT[upcoming.category]||{icon:'📌'}).icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Next Milestone</div>
        <div style="font-size:12px;font-weight:800;color:var(--t0);margin-top:2px">${upcoming.label}</div>
        <div style="font-size:10px;color:var(--t2);margin-top:1px">${upcoming.milestone_id} · ${upcoming.date_target}</div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:${upDays<=90?'var(--warn)':'var(--f2)'};white-space:nowrap">${upDays}d</div>
    </div>` : ''}

    <div style="display:flex;gap:12px;flex-wrap:wrap">
      ${mcProgBars}
    </div>
  </div>`;

  // Group by macrocycle
  const byMC = {};
  ms.forEach(m => {
    const mc = m.macrocycle_id || 'MC?';
    if(!byMC[mc]) byMC[mc] = [];
    byMC[mc].push(m);
  });

  const mcBlocks = Object.entries(byMC).map(([mc, items]) => {
    const mcColor = MC_COLORS[mc] || 'var(--t2)';
    const mcLabel = { MC1:'MC1 — Reset Metabolisme', MC2:'MC2 — Recovery Sprint', MC3:'MC3 — Aerobic Base', MC4:'MC4 — 70.3 Race Build', MC5:'MC5 — Full Ironman' }[mc] || mc;
    const doneCount = items.filter(m => m.status === 'done').length;

    const cards = items.map((m) => {
      const cat = MS_CAT[m.category] || { icon:'📌', label:m.category, color:'var(--t2)', bg:'var(--bg3)', bdr:'var(--bdr)' };
      const dateTarget = m.date_target ? new Date(m.date_target) : null;
      const days = dateTarget ? Math.ceil((dateTarget - today) / (1000*60*60*24)) : null;
      const isPast = days !== null && days < 0;
      const isDone = m.status === 'done';
      const isFailed = m.status === 'failed';

      let statusCls, statusTxt, cardBdr;
      if(isDone){
        statusCls='done'; statusTxt='✓ Done'; cardBdr='var(--f3)';
      } else if(isFailed){
        statusCls='failed'; statusTxt='✕ Failed'; cardBdr='var(--warn)';
      } else if(isPast){
        statusCls='overdue'; statusTxt='⚠ Overdue'; cardBdr='var(--warn)';
      } else if(days !== null && days <= 90){
        statusCls='soon'; statusTxt=`${days}d`; cardBdr='var(--f2)';
      } else {
        statusCls='pending'; statusTxt='Pending'; cardBdr='var(--bdr)';
      }

      const mo = dateTarget ? dateTarget.toLocaleDateString('id-ID',{month:'short',year:'numeric'}) : '—';
      const qShort = m.quarter_ref ? m.quarter_ref.replace('_',' ') : '';

      return `<div style="background:var(--bg1);border:1.5px solid ${cardBdr};border-radius:var(--r2);padding:1rem;margin-bottom:.75rem;opacity:${isDone?'.65':'1'}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:.625rem;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="background:${cat.bg};border:1px solid ${cat.bdr};color:${cat.color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px">${cat.icon} ${cat.label}</span>
            <span style="font-size:10px;font-weight:700;color:var(--t3)">${m.milestone_id}</span>
            <span style="font-size:10px;color:var(--t3)">${qShort} · ${mo}</span>
          </div>
          <span class="ms-status ${statusCls}">${statusTxt}</span>
        </div>
        <div style="font-size:14px;font-weight:800;color:var(--t0);margin-bottom:4px">${m.label}</div>
        <div style="font-size:11px;color:var(--t2);line-height:1.5;margin-bottom:.75rem">${m.description || ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div style="background:var(--f3-bg);border:1px solid var(--f3-bdr);border-radius:var(--r);padding:.5rem .75rem">
            <div style="font-size:9px;font-weight:700;color:var(--f3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">✓ Gate Pass</div>
            <div style="font-size:11px;color:var(--t1)">${m.gate_pass || '—'}</div>
          </div>
          <div style="background:var(--warn-bg);border:1px solid var(--warn-bdr);border-radius:var(--r);padding:.5rem .75rem">
            <div style="font-size:9px;font-weight:700;color:var(--warn);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">✕ Gate Fail</div>
            <div style="font-size:11px;color:var(--t1)">${m.gate_fail || '—'}</div>
          </div>
        </div>
        ${m.verification ? `<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r);padding:.5rem .75rem">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">Verifikasi</div>
          <div style="font-size:11px;color:var(--t2)">${m.verification}</div>
        </div>` : ''}
      </div>`;
    }).join('');

    return `<div class="ms-mc-block">
      <div class="ms-mc-header">
        <div class="ms-mc-dot" style="background:${mcColor}"></div>
        <div class="ms-mc-label" style="color:${mcColor}">${mcLabel}</div>
        <div class="ms-mc-prog">${doneCount}/${items.length} done</div>
      </div>
      ${cards}
    </div>`;
  }).join('');

  return `<div class="ms-page">
    ${dashCard}
    <div class="ms-page-hd">
      <div>
        <div class="ms-page-title">📋 Timeline</div>
        <div class="ms-page-sub">${ms.length} milestones · grouped by macrocycle</div>
      </div>
      <div class="ms-legend">
        <span class="ms-status done">✓ Done</span>
        <span class="ms-status soon">≤90d</span>
        <span class="ms-status overdue">Overdue</span>
        <span class="ms-status pending">Pending</span>
      </div>
    </div>
    ${mcBlocks}
  </div>`;
}

// ── PANEL: DOCS ──
// Baca langsung dari S.byPeriod (sudah di-load saat init dari master_timeline)
function pDocs(){
  const qid = S.selectedQ || getAllPeriodIds()[0];
  if(!qid) return `<div class="card"><div class="empty-state"><div class="empty-ico">📄</div><div>Loading...</div></div></div>`;
  const col = S.activeDoc === 'MACROCYCLE' ? 'content_macrocycle_md' : 'content_' + S.activeDoc.toLowerCase() + '_md';
  const md = S.byPeriod[qid]?.[col] || '';
  return _docsHtml(qid, md);
}

function _docsHtml(qid, md){
  const isLoading = md === null;
  const content = isLoading
    ? `<div style="color:var(--t3);font-size:12px;padding:2rem;text-align:center">⏳ Memuat...</div>`
    : `<div class="md-content">${renderMd(md)}</div>`;
  return `
    <div class="doc-sel-row">
      ${DOC_TYPES.map(d=>`
        <button class="doc-btn${S.activeDoc===d?' act':''}" onclick="setActiveDoc('${d}')">${DOC_ICONS[d]} ${d}</button>`).join('')}
    </div>
    <div class="card">${content}</div>`;
}

// ── PANEL: BODY COMP ──
function pBodyComp(){
  if(!S.user) return `
    <div class="card">
      <div class="card-title">📊 Body Composition Log</div>
      <div class="empty-state"><div class="empty-ico">🔒</div><div class="empty-txt">Login untuk melihat dan input data body comp kamu</div></div>
    </div>`;

  const log  = S.bodyCompLog;
  const last = log.length ? log[log.length-1] : null;
  const today = new Date().toISOString().split('T')[0];

  const statsHtml = last ? `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">📍 Kondisi Terakhir <span style="font-size:9px;font-weight:600;color:var(--t3);margin-left:4px">${fmtDate(last.logged_date)}</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${[
          { l:'Body Weight', v:last.weight_kg, tgt:S.currentQuarter?.bb_end, unit:' kg', color:'var(--f2)', lower:true },
          { l:'Body Fat %',  v:last.bf_pct,    tgt:TARGET_BF_HI,             unit:'%',   color:'var(--f3)', lower:true },
          { l:'Lean Mass',   v:last.lbm_kg,    tgt:TARGET_LBM,               unit:' kg', color:'var(--acc)', lower:false },
          { l:'Pinggang',    v:last.waist_cm,  tgt:null,                     unit:' cm', color:'var(--t1)', lower:true },
        ].map(x=>{
          const ok = x.tgt==null ? null : x.lower ? x.v<=x.tgt : x.v>=x.tgt;
          const clr = ok===null ? x.color : ok ? 'var(--f3)' : 'var(--warn)';
          return `<div style="background:var(--bg2);border-radius:var(--r);padding:.75rem;border:1px solid var(--bdr)">
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${x.l}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:${clr}">${x.v??'—'}${x.v!=null?x.unit:''}</div>
            <div style="font-size:9px;color:var(--t3);margin-top:2px">${x.tgt!=null?'Target: '+x.tgt+x.unit:'—'}</div>
          </div>`;
        }).join('')}
      </div>
      ${log.length >= 2 ? (() => {
        const first = log[0];
        const dBB  = (last.weight_kg - first.weight_kg).toFixed(1);
        const dBF  = last.bf_pct && first.bf_pct ? (last.bf_pct - first.bf_pct).toFixed(1) : null;
        const dLBM = last.lbm_kg  && first.lbm_kg  ? (last.lbm_kg - first.lbm_kg).toFixed(1) : null;
        const arrow = v => parseFloat(v) < 0 ? '▼' : parseFloat(v) > 0 ? '▲' : '→';
        return `<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--bdr);display:flex;gap:16px;flex-wrap:wrap">
          <div style="font-size:10px;color:var(--t3)">Perubahan dari awal log (${fmtDate(first.logged_date)}):</div>
          <span style="font-size:11px;font-weight:700;color:${parseFloat(dBB)<0?'var(--f3)':'var(--warn)'}">${arrow(dBB)} BB ${dBB} kg</span>
          ${dBF!=null?`<span style="font-size:11px;font-weight:700;color:${parseFloat(dBF)<0?'var(--f3)':'var(--warn)'}">${arrow(dBF)} BF% ${dBF}%</span>`:''}
          ${dLBM!=null?`<span style="font-size:11px;font-weight:700;color:${parseFloat(dLBM)>0?'var(--f3)':'var(--warn)'}">${arrow(dLBM)} LBM ${dLBM} kg</span>`:''}
        </div>`;
      })() : ''}
    </div>` : '';

  const formHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">➕ Input Data Baru</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:.875rem">
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">TANGGAL</div>
          <input class="form-inp" type="date" id="bc-date" value="${today}" style="width:100%"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">BODY WEIGHT (kg)</div>
          <input class="form-inp" type="number" id="bc-bb" step="0.1" min="30" max="200" placeholder="misal: 79.5" style="width:100%" oninput="bcAutoLBM()"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">BODY FAT %</div>
          <input class="form-inp" type="number" id="bc-bf" step="0.1" min="3" max="60" placeholder="misal: 22.5" style="width:100%" oninput="bcAutoLBM()"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">LEAN MASS (kg) <span style="font-weight:400;color:var(--t3);font-size:9px">auto</span></div>
          <input class="form-inp" type="number" id="bc-lbm" step="0.1" min="20" max="150" placeholder="auto dari BB×BF" style="width:100%"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">PINGGANG (cm)</div>
          <input class="form-inp" type="number" id="bc-waist" step="0.5" min="50" max="150" placeholder="opsional" style="width:100%"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">NOTES</div>
          <input class="form-inp" type="text" id="bc-notes" placeholder="opsional..." style="width:100%"></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="submitBodyComp()" style="padding:8px 18px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">💾 Simpan</button>
        <span id="bc-msg" style="font-size:11px;color:var(--f3)"></span>
      </div>
    </div>`;

  const histHtml = log.length ? `
    <div class="card">
      <div class="card-title">📅 Riwayat Lengkap <span style="font-size:10px;font-weight:600;color:var(--t3);margin-left:4px">${log.length} entri</span></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>Week</th><th>BB</th><th>BF%</th><th>LBM</th><th>Pinggang</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${[...log].reverse().map(r=>`<tr>
              <td style="font-weight:700;white-space:nowrap">${fmtDate(r.logged_date)}</td>
              <td><span class="bdg bdg-acc">W${r.week_num||'?'}</span></td>
              <td class="mono" style="color:var(--f2);font-weight:700">${r.weight_kg??'—'} kg</td>
              <td class="mono" style="color:var(--f3)">${r.bf_pct??'—'}${r.bf_pct!=null?'%':''}</td>
              <td class="mono" style="color:var(--acc)">${r.lbm_kg??'—'}${r.lbm_kg!=null?' kg':''}</td>
              <td class="mono">${r.waist_cm??'—'}${r.waist_cm!=null?' cm':''}</td>
              <td style="color:var(--t2);font-size:10.5px">${r.notes||''}</td>
              <td><button onclick="deleteBodyComp(${r.id})" style="padding:3px 8px;background:var(--warn-bg);border:1px solid var(--warn-bdr);color:var(--warn);border-radius:var(--r);font-size:10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` :
    `<div class="card"><div class="empty-state"><div class="empty-ico">📊</div><div class="empty-txt">Belum ada data. Input data pertama kamu di atas!</div></div></div>`;

  return statsHtml + formHtml + histHtml;
}

// ── PANEL: RACE GOALS ──
function pRaceGoals(){
  return `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">🏁 Race Goals</div>
      ${RACES.map(r=>{
        const days = daysUntil(r.date);
        return `<div class="race-card">
          <div class="race-ico">${r.icon}</div>
          <div>
            <div class="race-name">${r.name}</div>
            <div class="race-meta">${r.date} · ${r.dist}</div>
          </div>
          <div class="race-days" style="color:${days<90?'var(--warn)':days<180?'var(--f2)':'var(--acc)'}">
            ${days>0?days+' hari lagi':'🎯 RACE DAY'}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="card-title" style="padding:1rem 1.25rem .75rem">📅 Protocol Timeline 2026–2030 · ${S.timeline?.length || 0} quarters</div>
      <div style="overflow-x:auto">
        <table class="tl-table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Periode</th>
              <th>Weeks</th>
              <th>BB (kg)</th>
              <th>BF%</th>
              <th>LBM floor</th>
              <th>Phase / Focus</th>
              <th>Peptide</th>
              <th>Exercise</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
          ${(S.timeline||[]).map((p,i)=>{
            const color = Q_COLORS[Math.floor(i/2) % Q_COLORS.length];
            const dateRange = `${fmtMonthShort(p.date_start)} – ${fmtMonthShort(p.date_end)}`;
            const wkRange = p.week_start ? `W${p.week_start}–W${p.week_end}` : '—';
            const bbStr = p.bb_start_kg != null ? `${p.bb_start_kg}→${p.bb_end_kg}` : '—';
            const bfStr = p.bf_start_pct != null ? `${p.bf_start_pct}→${p.bf_end_pct}` : '—';
            const lbm   = p.lbm_floor_kg != null ? `≥${p.lbm_floor_kg} kg` : '—';
            const phase = p.focus_roadmap || p.phase_type || '—';
            const pep   = p.focus_pep || '—';
            const ex    = p.focus_exercise || '—';
            const notes = p.period_notes || '—';
            return `<tr>
              <td><span class="tl-dot" style="background:${color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle"></span><strong style="color:var(--t0)">${p.label_short}</strong></td>
              <td style="color:var(--t2);white-space:nowrap">${dateRange}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--acc);white-space:nowrap">${wkRange}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${color};white-space:nowrap">${bbStr}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${color};white-space:nowrap">${bfStr}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--t1)">${lbm}</td>
              <td style="font-size:11px;font-weight:700;color:var(--t0);max-width:160px">${phase}</td>
              <td style="font-size:10px;color:var(--t2);max-width:180px">${pep}</td>
              <td style="font-size:10px;color:var(--t2);max-width:180px">${ex}</td>
              <td style="font-size:10px;color:var(--t3);max-width:200px">${notes}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── BODY COMP ACTIONS ──
window.bcAutoLBM = function(){
  const bb = parseFloat(document.getElementById('bc-bb')?.value);
  const bf = parseFloat(document.getElementById('bc-bf')?.value);
  const lbmEl = document.getElementById('bc-lbm');
  if(lbmEl && bb > 0 && bf > 0) lbmEl.value = (bb * (1 - bf/100)).toFixed(1);
};

window.submitBodyComp = async function(){
  const msg  = document.getElementById('bc-msg');
  const date  = document.getElementById('bc-date').value;
  const bb    = parseFloat(document.getElementById('bc-bb').value) || null;
  const bf    = parseFloat(document.getElementById('bc-bf').value) || null;
  const lbm   = parseFloat(document.getElementById('bc-lbm').value) || null;
  const waist = parseFloat(document.getElementById('bc-waist').value) || null;
  const notes = document.getElementById('bc-notes').value.trim() || null;
  if(!date){ msg.textContent='Tanggal wajib diisi.'; msg.style.color='var(--warn)'; return; }
  if(!bb && !bf){ msg.textContent='Minimal isi BB atau BF%.'; msg.style.color='var(--warn)'; return; }
  msg.textContent='Menyimpan...'; msg.style.color='var(--t3)';
  const wk = getWeekNum();
  const { error } = await supa.from('body_comp_log').upsert({
    user_id: S.user.id, logged_date: date, week_num: wk > 0 ? wk : null,
    weight_kg: bb, bf_pct: bf, lbm_kg: lbm, waist_cm: waist, notes
  }, { onConflict: 'user_id,logged_date' });
  if(error){ msg.textContent='Error: '+error.message; msg.style.color='var(--warn)'; return; }
  msg.textContent='✓ Tersimpan!'; msg.style.color='var(--f3)';
  const { data } = await supa.from('body_comp_log')
    .select('id,logged_date,week_num,weight_kg,bf_pct,lbm_kg,waist_cm,notes')
    .eq('user_id', S.user.id).order('logged_date', { ascending:true });
  S.bodyCompLog    = data || [];
  S.latestBodyComp = data?.length ? data[data.length-1] : null;
  renderPanel();
  setTimeout(()=>{ const m=document.getElementById('bc-msg'); if(m) m.textContent=''; }, 3000);
};

window.deleteBodyComp = async function(id){
  if(!confirm('Hapus entri ini?')) return;
  const { error } = await supa.from('body_comp_log').delete().eq('id', id).eq('user_id', S.user.id);
  if(error){ alert('Error: '+error.message); return; }
  const { data } = await supa.from('body_comp_log')
    .select('id,logged_date,week_num,weight_kg,bf_pct,lbm_kg,waist_cm,notes')
    .eq('user_id', S.user.id).order('logged_date', { ascending:true });
  S.bodyCompLog    = data || [];
  S.latestBodyComp = data?.length ? data[data.length-1] : null;
  renderPanel();
};
