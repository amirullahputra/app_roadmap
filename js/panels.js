// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PANELS â€” all tab panels + render + window globals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
import {
  S, APP_PEP, APP_EXERCISE,
  TARGET_BF_LO, TARGET_BF_HI, TARGET_LBM,
  RACES, Q_COLORS, DOC_TYPES, DOC_ICONS, TABS,
  daysUntil, fmtDate, fmtMonthShort, getWeekNum,
  quarterRollup, getAllPeriodIds, getMilestonesForPeriod, getDocContent, renderMd,
} from './state.js?v=24';
import { supa, updateTimelineRow } from './supabase.js?v=24';

// â”€â”€ RENDER â”€â”€
function renderTabNav(){
  document.getElementById('tab-nav').innerHTML = TABS.map((t,i)=>
    `<button class="tab-btn${S.tab===i?' act':''}" onclick="setTab(${i})">${t}</button>`
  ).join('');
}

function renderQuarterCardsContainer(){
  const el = document.getElementById('quarter-cards-row');
  if(!el) return;
  if(S.tab === 1){ el.style.display = 'none'; el.innerHTML = ''; return; }
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
      `<div class="card"><div class="empty-state"><div class="empty-ico">âš ï¸</div><div class="empty-txt">Error: ${e.message}</div></div></div>`;
  }
}

export function render(){ renderTabNav(); renderPanel(); }

// â”€â”€ WINDOW GLOBALS (called from HTML onclick) â”€â”€
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

// â”€â”€ EDIT HANDLERS â”€â”€
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

// â”€â”€ MILESTONE INLINE EDIT â”€â”€
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
  if(msg) msg.textContent = `${Object.keys(_msPending).length} quarter diubah â€” belum disimpan`;
};

window.saveMsChanges = async function(){
  const msg = document.getElementById('ms-save-msg');
  const entries = Object.entries(_msPending);
  if(!entries.length) return;
  if(msg){ msg.textContent = `â³ Menyimpan ${entries.length} quarter...`; msg.style.color='var(--t3)'; }
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
    if(msg){ msg.textContent = 'âŒ ' + errs.join(' | '); msg.style.color='var(--warn)'; }
  } else {
    if(msg){ msg.textContent = 'âœ… Semua tersimpan!'; msg.style.color='var(--f3)'; }
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
  if(msg) msg.textContent = 'â³ Menyimpan...';

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
    if(msg) { msg.textContent = 'âœ… Tersimpan!'; msg.style.color = 'var(--f3)'; }
    setTimeout(()=>{
      S.editingPeriod = null;
      render();
    }, 800);
  } catch(e){
    if(msg) { msg.textContent = 'âŒ Error: ' + e.message; msg.style.color = 'var(--warn)'; }
  }
};

// â”€â”€ QUARTER CARD ROW â”€â”€
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
      <div style="font-size:13px;font-weight:800;color:var(--acc)">âœï¸ Edit â€” ${p.label_short}</div>
      <button onclick="cancelEdit()" style="background:var(--bg3);border:1px solid var(--bdr);color:var(--t2);padding:4px 10px;border-radius:var(--r);font-size:11px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">âœ• Batal</button>
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
      ${ta(`ef-content_target_md`,  'ðŸŽ¯ Target MD',  p.content_target_md)}
      ${ta(`ef-content_peptide_md`, 'ðŸ’‰ Peptide MD', p.content_peptide_md)}
      ${ta(`ef-content_gym_md`,     'ðŸ‹ï¸ Gym MD',     p.content_gym_md)}
      ${ta(`ef-content_cardio_md`,  'ðŸƒ Cardio MD',  p.content_cardio_md)}
      ${ta(`ef-content_nutrisi_md`, 'ðŸ½ï¸ Nutrisi MD', p.content_nutrisi_md)}
      ${ta(`ef-content_vitamin_md`, 'ðŸ’Š Vitamin MD', p.content_vitamin_md)}
    </div>

    <div style="display:flex;gap:8px;align-items:center">
      <button onclick="saveEdit('${pid}')"
        style="padding:8px 20px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">
        ðŸ’¾ Simpan ke DB
      </button>
      <span id="ef-msg" style="font-size:11px;color:var(--t3)"></span>
    </div>
  </div>`;
}

function renderQuarterCardRow(){
  if(!S.timeline?.length) return '<div style="color:var(--t3);font-size:11px;padding:10px">Loading periodsâ€¦</div>';

  const editing = S.editingPeriod ? renderEditForm(S.byPeriod[S.editingPeriod] || {}) : '';

  const activeIdx = pickActivePeriodIdx(S.timeline);
  const startIdx  = Math.max(0, Math.min(activeIdx, S.timeline.length - 4));
  const visible   = S.timeline.slice(startIdx, startIdx + 4);

  const cards = visible.map(p => {
    const sel = S.selectedQ === p.period_id;
    const isEditing = S.editingPeriod === p.period_id;
    const hasBB = p.bb_start_kg != null;
    const hasBF = p.bf_start_pct != null;
    const bbRange = hasBB ? `${p.bb_start_kg}â†’${p.bb_end_kg} kg` : 'â€”';
    const bfRange = hasBF ? `${p.bf_start_pct}â†’${p.bf_end_pct}%` : 'â€”';
    const phase = p.focus_roadmap || '';
    const dotColor = hasBB ? 'var(--acc)' : 'var(--t3)';
    const weeks   = (p.week_start && p.week_end) ? `W${p.week_start}â€“W${p.week_end}` : 'pre-protokol';
    const dateRange = `${fmtMonthShort(p.date_start)} â€“ ${fmtMonthShort(p.date_end)}`;
    const phaseShort = phase ? (phase.length > 70 ? phase.slice(0, 67) + '...' : phase) : '';

    return `<div class="ph-card${sel?' sel-all':''}" onclick="selectQ('${p.period_id}')" style="cursor:pointer">
      <div class="ph-tag" style="color:${dotColor}">
        <div class="ph-dot" style="background:${dotColor}"></div>
        ${p.label_short}
      </div>
      <div class="ph-name">${p.label_short}</div>
      <div class="ph-desc" style="font-size:10.5px">${weeks} Â· ${dateRange}</div>
      <div class="ph-grid" style="grid-template-columns:1fr 1fr">
        <div class="ph-stat"><div class="ph-stat-l">BB Target</div><div class="ph-stat-v" style="color:${hasBB?'var(--acc)':'var(--t3)'};font-size:13px">${bbRange}</div></div>
        <div class="ph-stat"><div class="ph-stat-l">BF Target</div><div class="ph-stat-v" style="color:${hasBF?'var(--acc)':'var(--t3)'};font-size:13px">${bfRange}</div></div>
        <div class="ph-stat" style="grid-column:1/-1">
          <div class="ph-stat-l">Phase</div>
          <div class="ph-stat-v" style="font-size:11px;line-height:1.35" title="${(phase||'').replace(/"/g,'&quot;')}">${phaseShort || '<span style="color:var(--t3)">â€”</span>'}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
    ${editing}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1rem">${cards}</div>`;
}

// â”€â”€ PANEL: OVERVIEW â”€â”€
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
      <div class="card-title">ðŸ“Š Status Tubuh Saat Ini ${bc ? `<span style="font-size:9px;font-weight:600;color:var(--t3);margin-left:4px">${fmtDate(bc.logged_date)}</span>` : ''}</div>
      <div class="vial-summary-strip" style="grid-template-columns:repeat(4,1fr);margin-bottom:0">
        <div class="vs-card">
          <div class="vs-l">Body Weight</div>
          <div class="vs-v" style="color:var(--t0)">${bb ?? 'â€”'}<span style="font-size:13px;font-weight:600"> kg</span></div>
          <div class="vs-s">Target: ${q?.bb_end ?? '?'} kg</div>
        </div>
        <div class="vs-card">
          <div class="vs-l">Body Fat %</div>
          <div class="vs-v" style="color:${bfColor}">${bf ?? 'â€”'}<span style="font-size:13px;font-weight:600">${bf!==null?'%':''}</span></div>
          <div class="vs-s">Target: ${TARGET_BF_LO}â€“${TARGET_BF_HI}%</div>
        </div>
        <div class="vs-card">
          <div class="vs-l">Lean Mass</div>
          <div class="vs-v" style="color:${lbmColor}">${lbm ?? 'â€”'}<span style="font-size:13px;font-weight:600">${lbm!==null?' kg':''}</span></div>
          <div class="vs-s">Target: â‰¥${TARGET_LBM} kg</div>
        </div>
        <div class="vs-card">
          <div class="vs-l">Protocol Week</div>
          <div class="vs-v" style="color:var(--acc)">${wk > 0 ? 'W'+wk : 'â€”'}</div>
          <div class="vs-s">${q ? q.quarter_id.replace('_',' ') : 'Belum mulai'}</div>
        </div>
      </div>
      ${!S.user ? `<div style="font-size:11px;color:var(--t3);margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--bdr)">ðŸ’¡ Login untuk melihat data body comp aktual kamu</div>` : ''}
    </div>`;

  const appLinks = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:.75rem">
      <a href="${APP_PEP}" target="_blank" style="text-decoration:none">
        <div class="card" style="cursor:pointer;transition:all .2s;border:2px solid var(--bdr)" onmouseover="this.style.borderColor='var(--f2)'" onmouseout="this.style.borderColor='var(--bdr)'">
          <div style="font-size:1.75rem;margin-bottom:6px">ðŸ’‰</div>
          <div style="font-size:13px;font-weight:800;color:var(--t0)">Peptide Dashboard</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Compounds Â· Dose Â· Gantt Â· Budget</div>
          <div style="font-size:10px;color:var(--acc);font-weight:700;margin-top:8px">Buka App â†’</div>
        </div>
      </a>
      <a href="${APP_EXERCISE}" target="_blank" style="text-decoration:none">
        <div class="card" style="cursor:pointer;transition:all .2s;border:2px solid var(--bdr)" onmouseover="this.style.borderColor='var(--f3)'" onmouseout="this.style.borderColor='var(--bdr)'">
          <div style="font-size:1.75rem;margin-bottom:6px">ðŸ‹ï¸</div>
          <div style="font-size:13px;font-weight:800;color:var(--t0)">Exercise Dashboard</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Gym Log Â· Cardio Â· Progression</div>
          <div style="font-size:10px;color:var(--f3);font-weight:700;margin-top:8px">Buka App â†’</div>
        </div>
      </a>
    </div>`;

  const gymSessions = S.activeGymSessions;
  const gymHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title" style="justify-content:space-between">
        <span>ðŸ‹ï¸ Gym â€” Minggu Ini</span>
        <a href="${APP_EXERCISE}" target="_blank" style="font-size:10px;color:var(--acc);font-weight:700;text-decoration:none">Lihat semua â†’</a>
      </div>
      ${!S.user ? `<div style="font-size:11px;color:var(--t3)">Login untuk melihat log gym kamu</div>` :
        gymSessions.length ? `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:.75rem">
          <div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--f1)">${gymSessions.length}</div>
          <div style="font-size:11px;color:var(--t2)">sesi<br>minggu ini</div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:10px;color:var(--t3)">Terakhir</div>
            <div style="font-size:12px;font-weight:700;color:var(--t0)">${fmtDate(gymSessions[0].session_date)}</div>
            <div style="font-size:10px;color:var(--t2)">${gymSessions[0].duration_min||'â€”'} min</div>
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
        <span>ðŸƒ Cardio â€” Minggu Ini</span>
        <a href="${APP_EXERCISE}" target="_blank" style="font-size:10px;color:var(--acc);font-weight:700;text-decoration:none">Lihat semua â†’</a>
      </div>
      ${!S.user ? `<div style="font-size:11px;color:var(--t3)">Login untuk melihat log cardio kamu</div>` :
        cardioLog.length ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Sesi</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--f3)">${cardioLog.length}</div></div>
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Total</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--t0)">${totalMin}<span style="font-size:11px"> min</span></div></div>
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Jarak</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--t0)">${totalKm.toFixed(1)}<span style="font-size:11px"> km</span></div></div>
          <div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Zone</div>
            <div style="display:flex;gap:4px;margin-top:4px"><span class="bdg bdg-f3">Z1Ã—${z1Count}</span><span class="bdg bdg-acc">Z2Ã—${z2Count}</span></div></div>
        </div>` :
        `<div style="font-size:11px;color:var(--t3)">Belum ada cardio minggu ini</div>`
      }
    </div>`;

  const raceHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">ðŸ Race Countdown</div>
      ${RACES.map(r=>{
        const days = daysUntil(r.date);
        return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--bdr)">
          <div style="font-size:1.5rem">${r.icon}</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:800;color:var(--t0)">${r.name}</div>
            <div style="font-size:10px;color:var(--t2)">${r.date} Â· ${r.dist}</div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:${days<90?'var(--warn)':days<180?'var(--f2)':'var(--acc)'};white-space:nowrap">
            ${days>0 ? days+' hari' : 'ðŸŽ¯ RACE DAY'}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const qProgress = q ? `
    <div class="card">
      <div class="card-title">ðŸ“‹ Quarter Aktif: ${q.quarter_id.replace('_',' ')}</div>
      <div style="font-size:11px;color:var(--t2);margin-bottom:.75rem">${q.window_raw||''} Â· ${q.phase_type||''}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:.875rem">
        <div style="background:var(--bg2);border-radius:var(--r);padding:.625rem .75rem;border:1px solid var(--bdr)">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">BB Target</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--t0);margin-top:2px">${q.bb_start??'?'} â†’ ${q.bb_end??'?'} kg</div>
        </div>
        <div style="background:var(--bg2);border-radius:var(--r);padding:.625rem .75rem;border:1px solid var(--bdr)">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">BF% Target</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--f3);margin-top:2px">${q.bf_start??'?'} â†’ ${q.bf_end??'?'}%</div>
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

// â”€â”€ CHECKPOINTS â”€â”€
function renderCheckpoints(periodId){
  if(!periodId) return '';
  const ms = getMilestonesForPeriod(periodId);
  if(!ms.length){
    return `<div class="card" style="margin-bottom:.75rem">
      <div class="card-title">ðŸ“ Checkpoints â€” ${periodId.replace('_',' ')}</div>
      <div class="empty-state" style="padding:1.5rem 1rem">
        <div class="empty-ico">ðŸ“</div>
        <div class="empty-txt">Belum ada checkpoint data untuk quarter ini</div>
      </div>
    </div>`;
  }
  return `<div class="card" style="margin-bottom:.75rem">
    <div class="card-title">ðŸ“ Checkpoints â€” ${periodId.replace('_',' ')} Â· ${ms.length} milestone</div>
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

// â”€â”€ PANEL: MILESTONES â”€â”€
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

function pMilestones(){
  const canEdit = !!S.user;

  return `
    <div class="card">
      <div class="card-title" style="justify-content:space-between">
        <span>ðŸ—“ï¸ Full Quarter Timeline 2026â€“2030 Â· ${S.timeline?.length || 0} quarters</span>
        ${canEdit ? `<span style="font-size:10px;color:var(--f3);font-weight:700">âœï¸ Login â€” klik field untuk edit langsung</span>` : `<span style="font-size:10px;color:var(--t3)">Login untuk edit</span>`}
      </div>

      <div style="display:grid;grid-template-columns:auto 100px 1fr auto auto auto auto;gap:0;margin-bottom:4px;padding:0 6px 6px">
        <div></div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase">Quarter</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase">Phase / Focus</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;text-align:center;padding:0 6px">BB Start</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;text-align:center;padding:0 6px">BB End</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;text-align:center;padding:0 6px">BF Start</div>
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;text-align:center;padding:0 6px">BF End</div>
      </div>

      ${(S.timeline||[]).map((p,i)=>{
        const color = Q_COLORS[Math.floor(i/2) % Q_COLORS.length];
        const yearChange = i > 0 && p.year !== S.timeline[i-1].year;
        const weeks = (p.week_start && p.week_end) ? `W${p.week_start}â€“W${p.week_end}` : 'pre';
        const dateRange = `${fmtMonthShort(p.date_start)} â€“ ${fmtMonthShort(p.date_end)}`;
        const pid = p.period_id;

        const focusCell = canEdit ? `
          <div style="display:flex;flex-direction:column;gap:4px">
            ${msInp(pid,'focus_roadmap', p.focus_roadmap,'text','100%')}
            <div style="display:flex;gap:4px">
              <span style="font-size:9px;color:var(--f1);font-weight:700;white-space:nowrap;align-self:center">ðŸ’‰</span>
              ${msInp(pid,'focus_pep', p.focus_pep,'text','calc(50% - 12px)')}
              <span style="font-size:9px;color:var(--f3);font-weight:700;white-space:nowrap;align-self:center">ðŸ‹ï¸</span>
              ${msInp(pid,'focus_exercise', p.focus_exercise,'text','calc(50% - 12px)')}
            </div>
          </div>` : `
          <div>
            <div style="font-size:12px;color:var(--t1)">${p.focus_roadmap||'<span style="color:var(--t3)">â€”</span>'}</div>
            <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
              ${p.focus_pep?`<span style="background:var(--f1-bg);color:var(--f1);padding:2px 7px;border-radius:10px;font-size:10px">ðŸ’‰ ${p.focus_pep}</span>`:''}
              ${p.focus_exercise?`<span style="background:var(--f3-bg);color:var(--f3);padding:2px 7px;border-radius:10px;font-size:10px">ðŸ‹ï¸ ${p.focus_exercise}</span>`:''}
            </div>
          </div>`;

        const bbStartCell = canEdit ? msInp(pid,'bb_start_kg', p.bb_start_kg,'number','68px') : `<span style="font-size:12px;font-weight:700;color:${color}">${p.bb_start_kg??'â€”'}</span>`;
        const bbEndCell   = canEdit ? msInp(pid,'bb_end_kg',   p.bb_end_kg,  'number','68px') : `<span style="font-size:12px;font-weight:700;color:${color}">${p.bb_end_kg??'â€”'}</span>`;
        const bfStartCell = canEdit ? msInp(pid,'bf_start_pct',p.bf_start_pct,'number','56px') : `<span style="font-size:12px;color:var(--t1)">${p.bf_start_pct??'â€”'}</span>`;
        const bfEndCell   = canEdit ? msInp(pid,'bf_end_pct',  p.bf_end_pct,  'number','56px') : `<span style="font-size:12px;color:var(--f3)">${p.bf_end_pct??'â€”'}</span>`;

        return `
          ${yearChange ? `<div style="grid-column:1/-1;height:1px;background:var(--bdr);margin:4px 0"></div>` : ''}
          <div style="display:grid;grid-template-columns:auto 100px 1fr auto auto auto auto;gap:8px;align-items:center;padding:8px 6px;border-radius:6px;transition:background .15s"
            onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'">
            <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
            <div>
              <div style="font-weight:800;font-size:13px;color:var(--t0)">${p.label_short}</div>
              <div style="font-size:9.5px;color:var(--t3);margin-top:1px">${weeks}</div>
              <div style="font-size:9.5px;color:var(--t3)">${dateRange}</div>
            </div>
            <div style="min-width:0">${focusCell}</div>
            <div style="text-align:center;padding:0 4px">${bbStartCell}</div>
            <div style="text-align:center;padding:0 4px">${bbEndCell}</div>
            <div style="text-align:center;padding:0 4px">${bfStartCell}</div>
            <div style="text-align:center;padding:0 4px">${bfEndCell}</div>
          </div>`;
      }).join('')}

      <div id="ms-save-bar" style="display:none;position:sticky;bottom:0;background:var(--bg1);border-top:2px solid var(--acc);padding:.75rem 6px;margin-top:8px;display:flex;align-items:center;gap:10px">
        <button onclick="saveMsChanges()" style="padding:7px 18px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">ðŸ’¾ Simpan Semua Perubahan</button>
        <button onclick="discardMsChanges()" style="padding:7px 14px;background:var(--bg3);color:var(--t2);border:1px solid var(--bdr);border-radius:var(--r);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">âœ• Batal</button>
        <span id="ms-save-msg" style="font-size:11px;color:var(--t3)"></span>
      </div>
    </div>`;
}

// â”€â”€ PANEL: DOCS â”€â”€
// Baca langsung dari S.byPeriod (sudah di-load saat init dari master_timeline)
function pDocs(){
  const qid = S.selectedQ || getAllPeriodIds()[0];
  if(!qid) return `<div class="card"><div class="empty-state"><div class="empty-ico">ðŸ“„</div><div>Loading...</div></div></div>`;
  const col = S.activeDoc === 'MACROCYCLE'
    ? 'content_macrocycle_md'
    : 'content_' + S.activeDoc.toLowerCase() + '_md';
  const md = S.byPeriod[qid]?.[col] || '';
  return _docsHtml(qid, md);
}

function _docsHtml(qid, md){
  const isLoading = md === null;
  const content = isLoading
    ? `<div style="color:var(--t3);font-size:12px;padding:2rem;text-align:center">â³ Memuat...</div>`
    : `<div class="md-content">${renderMd(md)}</div>`;
  return `
    <div class="doc-sel-row">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--acc-bg);border:1px solid var(--acc-bdr);border-radius:var(--r);font-size:11px;font-weight:700;color:var(--acc)">
        ðŸ“… ${qid.replace('_',' ')}
      </div>
      ${DOC_TYPES.map(d=>`
        <button class="doc-btn${S.activeDoc===d?' act':''}" onclick="setActiveDoc('${d}')">${DOC_ICONS[d]} ${d}</button>`).join('')}
    </div>
    <div class="card">${content}</div>`;
}

// â”€â”€ PANEL: BODY COMP â”€â”€
function pBodyComp(){
  if(!S.user) return `
    <div class="card">
      <div class="card-title">ðŸ“Š Body Composition Log</div>
      <div class="empty-state"><div class="empty-ico">ðŸ”’</div><div class="empty-txt">Login untuk melihat dan input data body comp kamu</div></div>
    </div>`;

  const log  = S.bodyCompLog;
  const last = log.length ? log[log.length-1] : null;
  const today = new Date().toISOString().split('T')[0];

  const statsHtml = last ? `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">ðŸ“ Kondisi Terakhir <span style="font-size:9px;font-weight:600;color:var(--t3);margin-left:4px">${fmtDate(last.logged_date)}</span></div>
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
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:${clr}">${x.v??'â€”'}${x.v!=null?x.unit:''}</div>
            <div style="font-size:9px;color:var(--t3);margin-top:2px">${x.tgt!=null?'Target: '+x.tgt+x.unit:'â€”'}</div>
          </div>`;
        }).join('')}
      </div>
      ${log.length >= 2 ? (() => {
        const first = log[0];
        const dBB  = (last.weight_kg - first.weight_kg).toFixed(1);
        const dBF  = last.bf_pct && first.bf_pct ? (last.bf_pct - first.bf_pct).toFixed(1) : null;
        const dLBM = last.lbm_kg  && first.lbm_kg  ? (last.lbm_kg - first.lbm_kg).toFixed(1) : null;
        const arrow = v => parseFloat(v) < 0 ? 'â–¼' : parseFloat(v) > 0 ? 'â–²' : 'â†’';
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
      <div class="card-title">âž• Input Data Baru</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:.875rem">
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">TANGGAL</div>
          <input class="form-inp" type="date" id="bc-date" value="${today}" style="width:100%"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">BODY WEIGHT (kg)</div>
          <input class="form-inp" type="number" id="bc-bb" step="0.1" min="30" max="200" placeholder="misal: 79.5" style="width:100%" oninput="bcAutoLBM()"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">BODY FAT %</div>
          <input class="form-inp" type="number" id="bc-bf" step="0.1" min="3" max="60" placeholder="misal: 22.5" style="width:100%" oninput="bcAutoLBM()"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">LEAN MASS (kg) <span style="font-weight:400;color:var(--t3);font-size:9px">auto</span></div>
          <input class="form-inp" type="number" id="bc-lbm" step="0.1" min="20" max="150" placeholder="auto dari BBÃ—BF" style="width:100%"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">PINGGANG (cm)</div>
          <input class="form-inp" type="number" id="bc-waist" step="0.5" min="50" max="150" placeholder="opsional" style="width:100%"></div>
        <div><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px">NOTES</div>
          <input class="form-inp" type="text" id="bc-notes" placeholder="opsional..." style="width:100%"></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="submitBodyComp()" style="padding:8px 18px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">ðŸ’¾ Simpan</button>
        <span id="bc-msg" style="font-size:11px;color:var(--f3)"></span>
      </div>
    </div>`;

  const histHtml = log.length ? `
    <div class="card">
      <div class="card-title">ðŸ“… Riwayat Lengkap <span style="font-size:10px;font-weight:600;color:var(--t3);margin-left:4px">${log.length} entri</span></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>Week</th><th>BB</th><th>BF%</th><th>LBM</th><th>Pinggang</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${[...log].reverse().map(r=>`<tr>
              <td style="font-weight:700;white-space:nowrap">${fmtDate(r.logged_date)}</td>
              <td><span class="bdg bdg-acc">W${r.week_num||'?'}</span></td>
              <td class="mono" style="color:var(--f2);font-weight:700">${r.weight_kg??'â€”'} kg</td>
              <td class="mono" style="color:var(--f3)">${r.bf_pct??'â€”'}${r.bf_pct!=null?'%':''}</td>
              <td class="mono" style="color:var(--acc)">${r.lbm_kg??'â€”'}${r.lbm_kg!=null?' kg':''}</td>
              <td class="mono">${r.waist_cm??'â€”'}${r.waist_cm!=null?' cm':''}</td>
              <td style="color:var(--t2);font-size:10.5px">${r.notes||''}</td>
              <td><button onclick="deleteBodyComp(${r.id})" style="padding:3px 8px;background:var(--warn-bg);border:1px solid var(--warn-bdr);color:var(--warn);border-radius:var(--r);font-size:10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">âœ•</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` :
    `<div class="card"><div class="empty-state"><div class="empty-ico">ðŸ“Š</div><div class="empty-txt">Belum ada data. Input data pertama kamu di atas!</div></div></div>`;

  return statsHtml + formHtml + histHtml;
}

// â”€â”€ PANEL: RACE GOALS â”€â”€
function pRaceGoals(){
  return `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">ðŸ Race Goals</div>
      ${RACES.map(r=>{
        const days = daysUntil(r.date);
        return `<div class="race-card">
          <div class="race-ico">${r.icon}</div>
          <div>
            <div class="race-name">${r.name}</div>
            <div class="race-meta">${r.date} Â· ${r.dist}</div>
          </div>
          <div class="race-days" style="color:${days<90?'var(--warn)':days<180?'var(--f2)':'var(--acc)'}">
            ${days>0?days+' hari lagi':'ðŸŽ¯ RACE DAY'}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="card-title">ðŸ“… Protocol Timeline 2026â€“2030 Â· ${S.timeline?.length || 0} quarters</div>
      ${(S.timeline||[]).map((p,i)=>{
        const color = Q_COLORS[Math.floor(i/2) % Q_COLORS.length];
        const hasBB = p.bb_start_kg != null;
        const hasBF = p.bf_start_pct != null;
        const bbStr = hasBB ? `${p.bb_start_kg}â†’${p.bb_end_kg} kg` : 'â€”';
        const bfStr = hasBF ? `${p.bf_start_pct}â†’${p.bf_end_pct}%` : 'â€”';
        const dateRange = `${fmtMonthShort(p.date_start)} â€“ ${fmtMonthShort(p.date_end)}`;
        return `<div class="tl-row">
          <div class="tl-dot" style="background:${color}"></div>
          <div class="tl-q">${p.label_short}</div>
          <div class="tl-win">${dateRange}${p.week_start?` Â· W${p.week_start}-W${p.week_end}`:''}</div>
          <div class="tl-bb" style="color:${color}">${bbStr} Â· ${bfStr}</div>
        </div>`;
      }).join('')}
    </div>`;
}

// â”€â”€ BODY COMP ACTIONS â”€â”€
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
  msg.textContent='âœ“ Tersimpan!'; msg.style.color='var(--f3)';
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
