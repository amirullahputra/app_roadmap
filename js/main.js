// ══════════════════════════════════════════════════════════
// AMIR'S ROADMAP — Core Hub (master_timeline single source)
// ══════════════════════════════════════════════════════════

// Global error catcher
window.addEventListener('error', e => {
  const root = document.getElementById('panels-root');
  if(root) root.innerHTML = `<div style="padding:1.5rem;border:2px solid #EF4444;border-radius:8px;background:#FEE2E2;margin:1rem">
    <div style="font-size:14px;font-weight:800;color:#991B1B;margin-bottom:8px">🔥 JS Error</div>
    <div style="font-family:monospace;font-size:11.5px;color:#1A2140;white-space:pre-wrap;background:white;padding:10px;border-radius:6px">${e.message}\n  at ${e.filename||'?'}:${e.lineno||'?'}:${e.colno||'?'}</div>
  </div>`;
});
window.addEventListener('unhandledrejection', e => {
  const root = document.getElementById('panels-root');
  if(root) root.innerHTML = `<div style="padding:1.5rem;border:2px solid #EF4444;border-radius:8px;background:#FEE2E2;margin:1rem">
    <div style="font-size:14px;font-weight:800;color:#991B1B;margin-bottom:8px">🔥 Promise Rejection</div>
    <div style="font-family:monospace;font-size:11.5px;color:#1A2140;white-space:pre-wrap;background:white;padding:10px;border-radius:6px">${e.reason?.message||e.reason||'unknown'}</div>
  </div>`;
});

const SUPA_URL = 'https://guhhoqpvwzzrlwgfugsb.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGhvcXB2d3p6cmx3Z2Z1Z3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMTg5NTgsImV4cCI6MjA5Mzg5NDk1OH0.KDkDqrsbburSAsaKgNUh2QK5YbFCxqM6aDF-DIqGQaU';
console.log('[roadmap] module start, window.supabase=', typeof window.supabase);
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
console.log('[roadmap] supa created');

// ── REST FETCH HELPER ──
async function restFetch(table, query=''){
  const url = `${SUPA_URL}/rest/v1/${table}${query?'?'+query:''}`;
  const res = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if(!res.ok){
    const body = await res.text().catch(()=>'');
    throw new Error(`${table}: HTTP ${res.status} ${body.slice(0,200)}`);
  }
  return res.json();
}

const APP_PEP      = 'https://amirullahputra.github.io/app_pep/';
const APP_EXERCISE = 'https://amirullahputra.github.io/app_exercise/';

const TARGET_BF_LO = 10, TARGET_BF_HI = 15;
const TARGET_LBM   = 55;

const RACES = [
  { name:'HM JAKIM', date:'2026-06-14', icon:'🏃', dist:'21.1 km' },
  { name:'70.3 Ironman', date:'2029-01-01', icon:'🏊🚴🏃', dist:'113 km' },
];
const Q_COLORS = ['var(--f1)','var(--acc)','var(--f3)','var(--hor)','var(--f2)','var(--cns)','var(--inf)','var(--f1)'];
const DOC_TYPES = ['TARGET','PEPTIDE','GYM','CARDIO','NUTRISI','VITAMIN'];
const DOC_ICONS = { TARGET:'🎯', PEPTIDE:'💉', GYM:'🏋️', CARDIO:'🏃', NUTRISI:'🍽️', VITAMIN:'💊' };

const TABS = ['🏠 Overview','📅 Milestones','📄 Docs','📊 Body Comp','🏁 Race Goals'];

// ── STATE: master_timeline single source ──
const S = {
  tab: 0,
  user: null,
  timeline: [],        // raw rows dari master_timeline (20 row)
  byPeriod: {},        // {Q3_2026: row, ...}
  bySemester: {},      // {Q3Q4_2026: [row Q3_2026, row Q4_2026], ...}
  activeDoc: 'TARGET',
  selectedQ: null,     // semester_id (Q3Q4_2026..)
  // live data
  latestBodyComp: null,
  bodyCompLog: [],
  activeGymSessions: [],
  activeCardioLog: [],
  currentQuarter: null, // semester rollup object
  currentWeek: 0,
};

// ── UTILS ──
function daysUntil(d){ return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
function fmtMonthShort(dateStr){
  if(!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', { month:'short', year:'2-digit' });
}
function getWeekNum(){
  const now = new Date(), start = new Date('2026-07-06');
  const diff = Math.floor((now-start)/(1000*60*60*24));
  return diff >= 0 ? Math.min(Math.floor(diff/7)+1, 56) : 0;
}
function getWeekStart(){
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day===0?-6:1);
  const mon = new Date(now.setDate(diff));
  return mon.toISOString().split('T')[0];
}

// ── DERIVATIONS from master_timeline ──
function buildIndexes(){
  S.byPeriod   = Object.fromEntries(S.timeline.map(r => [r.period_id, r]));
  S.bySemester = {};
  for(const r of S.timeline){
    if(!r.semester_id) continue;
    (S.bySemester[r.semester_id] ||= []).push(r);
  }
}

// Semester rollup — agregat 2 quarter dalam 1 semester
function semesterRollup(semId){
  const rows = S.bySemester[semId];
  if(!rows?.length) return null;
  const first = rows[0], last = rows[rows.length-1];
  return {
    quarter_id: semId,
    phase_type: first.semester_phase_type || '',
    window_raw: first.semester_window_raw || '',
    total_weeks: (last.week_end && first.week_start) ? (last.week_end - first.week_start + 1) : null,
    bb_start: first.bb_start_kg,
    bb_end:   last.bb_end_kg,
    bf_start: first.bf_start_pct,
    bf_end:   last.bf_end_pct,
  };
}

function getAllSemesterIds(){
  // preserve insertion order (sort_order udah ascending dari fetch)
  return Object.keys(S.bySemester);
}

// Parse pipe-separated milestone fields jadi array of milestone objects
function parseMilestones(row){
  if(!row || !row.milestone_week_labels) return [];
  const wk   = row.milestone_week_labels.split('|');
  const dr   = (row.milestone_date_ranges || '').split('|');
  const bb   = (row.milestone_bb_targets  || '').split('|');
  const bf   = (row.milestone_bf_targets  || '').split('|');
  const lab  = (row.milestone_lab_tests   || '').split('|');
  const note = (row.milestone_notes       || '').split('|');
  return wk.filter(w => w.trim()).map((w, i) => ({
    week_label: w.trim(),
    date_range: (dr[i]||'').trim(),
    bb_target:  (bb[i]||'').trim(),
    bf_target:  (bf[i]||'').trim(),
    lab_tests:  (lab[i]||'').trim(),
    note:       (note[i]||'').trim(),
  }));
}

// Aggregate milestones across all periods di 1 semester
function getMilestonesForSemester(semId){
  const rows = S.bySemester[semId] || [];
  const all = rows.flatMap(r => parseMilestones(r).map(m => ({...m, period_id: r.period_id})));
  return all.sort((a,b) => (parseInt(String(a.week_label).replace(/\D/g,''))||0) - (parseInt(String(b.week_label).replace(/\D/g,''))||0));
}

// Get Markdown doc content — try period match dulu, fallback ke semester
function getDocContent(qid, docType){
  const col = 'content_' + docType.toLowerCase() + '_md';
  let row = S.byPeriod[qid];
  if(!row){
    const rows = S.bySemester[qid] || [];
    row = rows.find(r => r[col]) || rows[0];
  }
  return row?.[col] || '';
}

// ── MARKDOWN ──
function renderMd(md){
  if(!md) return `<div class="empty-state"><div class="empty-ico">📄</div><div class="empty-txt">Belum ada konten untuk quarter ini.</div></div>`;
  try {
    const lines = md.split('\n');
    let html = '';
    let i = 0;
    while(i < lines.length){
      const line = lines[i];
      if(/^\|.+\|/.test(line)){
        let tableLines = [];
        while(i < lines.length && /^\|/.test(lines[i])){ tableLines.push(lines[i]); i++; }
        const rows = tableLines.filter(l => !/^\|[\s\-|:]+\|$/.test(l));
        if(rows.length){
          const parseRow = (r, tag) => {
            const cells = r.replace(/^\||\|$/g,'').split('|')
              .map(c=>`<${tag}>${renderInline(c.trim())}</${tag}>`).join('');
            return `<tr>${cells}</tr>`;
          };
          html += `<div class="tbl-wrap" style="margin:10px 0"><table><thead>${parseRow(rows[0],'th')}</thead><tbody>${rows.slice(1).map(r=>parseRow(r,'td')).join('')}</tbody></table></div>`;
        }
        continue;
      }
      if(/^### /.test(line)){ html += `<h3>${renderInline(line.slice(4))}</h3>`; i++; continue; }
      if(/^## /.test(line)){  html += `<h2>${renderInline(line.slice(3))}</h2>`; i++; continue; }
      if(/^# /.test(line)){   html += `<h1>${renderInline(line.slice(2))}</h1>`; i++; continue; }
      if(/^---+$/.test(line)){ html += '<hr>'; i++; continue; }
      if(/^- /.test(line)){
        let items = [];
        while(i < lines.length && /^- /.test(lines[i])){ items.push(`<li>${renderInline(lines[i].slice(2))}</li>`); i++; }
        html += `<ul>${items.join('')}</ul>`; continue;
      }
      if(/^\d+\. /.test(line)){
        let items = [];
        while(i < lines.length && /^\d+\. /.test(lines[i])){ items.push(`<li>${renderInline(lines[i].replace(/^\d+\. /,''))}</li>`); i++; }
        html += `<ol>${items.join('')}</ol>`; continue;
      }
      if(line.trim() === ''){ i++; continue; }
      let para = [];
      while(i < lines.length && lines[i].trim() !== '' && !/^[#\-|]/.test(lines[i]) && !/^\d+\. /.test(lines[i]) && !/^---/.test(lines[i])){
        para.push(lines[i]); i++;
      }
      if(para.length) html += `<p>${renderInline(para.join(' '))}</p>`;
      else i++;
    }
    return html;
  } catch(e) {
    console.error('renderMd error:', e);
    return `<pre style="white-space:pre-wrap;font-size:12px;color:var(--t1)">${md.replace(/</g,'&lt;')}</pre>`;
  }
}

function renderInline(text){
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank">$1</a>');
}

// ── RENDER ──
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
      `<div class="card"><div class="empty-state"><div class="empty-ico">⚠️</div><div class="empty-txt">Error: ${e.message}</div></div></div>`;
  }
}

function render(){ renderTabNav(); renderPanel(); }

window.setTab = function(i){ S.tab=i; render(); };
window.selectQ = function(qid){
  S.selectedQ = qid;
  try { localStorage.setItem('vhm.activeSemester', qid); } catch(e){}
  render();
};
window.selectQDoc = window.selectQ;
window.setActiveDoc = function(doc){ S.activeDoc=doc; renderPanel(); };

// ── QUARTER CARD ROW (4 period cards dari master_timeline) ──
function pickActivePeriodIdx(periods){
  const today = new Date();
  const idx = periods.findIndex(p => today >= new Date(p.date_start) && today <= new Date(p.date_end));
  if(idx >= 0) return idx;
  return Math.max(0, periods.findIndex(p => p.period_id === 'Q3_2026'));
}

function renderQuarterCardRow(){
  if(!S.timeline?.length) return '<div style="color:var(--t3);font-size:11px;padding:10px">Loading periods…</div>';
  const activeIdx = pickActivePeriodIdx(S.timeline);
  const startIdx  = Math.max(0, Math.min(activeIdx, S.timeline.length - 4));
  const visible   = S.timeline.slice(startIdx, startIdx + 4);

  const cards = visible.map(p => {
    const sel = S.selectedQ === p.semester_id;
    const hasBB = p.bb_start_kg != null;
    const hasBF = p.bf_start_pct != null;
    const bbRange = hasBB ? `${p.bb_start_kg}→${p.bb_end_kg} kg` : '—';
    const bfRange = hasBF ? `${p.bf_start_pct}→${p.bf_end_pct}%` : '—';
    const phase = p.semester_phase_type || p.phase_name || '';
    const dotColor = hasBB ? 'var(--acc)' : 'var(--t3)';
    const weeks   = (p.week_start && p.week_end) ? `W${p.week_start}–W${p.week_end}` : 'pre-protokol';
    const dateRange = `${fmtMonthShort(p.date_start)} – ${fmtMonthShort(p.date_end)}`;
    const semLabel = p.semester_id ? p.semester_id.replace('_',' ') : '—';
    const phaseShort = phase ? (phase.length > 70 ? phase.slice(0, 67) + '...' : phase) : '';

    return `<div class="ph-card${sel?' sel-all':''}" onclick="selectQ('${p.semester_id || p.period_id}')" style="cursor:pointer">
      <div class="ph-tag" style="color:${dotColor}">
        <div class="ph-dot" style="background:${dotColor}"></div>
        ${p.label_short}
      </div>
      <div class="ph-name">${p.label_short}</div>
      <div class="ph-desc" style="font-size:10.5px">${weeks} · ${dateRange} · <span style="color:var(--t3)">${semLabel}</span></div>
      <div class="ph-grid" style="grid-template-columns:1fr 1fr">
        <div class="ph-stat"><div class="ph-stat-l">BB Target</div><div class="ph-stat-v" style="color:${hasBB?'var(--acc)':'var(--t3)'};font-size:13px">${bbRange}</div></div>
        <div class="ph-stat"><div class="ph-stat-l">BF Target</div><div class="ph-stat-v" style="color:${hasBF?'var(--acc)':'var(--t3)'};font-size:13px">${bfRange}</div></div>
        <div class="ph-stat" style="grid-column:1/-1">
          <div class="ph-stat-l">Phase</div>
          <div class="ph-stat-v" style="font-size:11px;line-height:1.35" title="${(phase||'').replace(/"/g,'&quot;')}">${phaseShort || '<span style="color:var(--t3)">—</span>'}</div>
        </div>
        ${p.focus_roadmap ? `<div class="ph-stat" style="grid-column:1/-1">
          <div class="ph-stat-l">Focus</div>
          <div class="ph-stat-v" style="font-size:10.5px;color:var(--acc);font-weight:700">${p.focus_roadmap}</div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1rem">${cards}</div>`;
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
      <div class="vial-summary-strip" style="grid-template-columns:repeat(4,1fr);margin-bottom:0">
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
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
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

// ── CHECKPOINTS — milestones parsed dari master_timeline.milestone_* fields ──
function renderCheckpoints(semId){
  if(!semId) return '';
  const ms = getMilestonesForSemester(semId);
  if(!ms.length){
    return `<div class="card" style="margin-bottom:.75rem">
      <div class="card-title">📍 Checkpoints — ${semId.replace('_',' ')}</div>
      <div class="empty-state" style="padding:1.5rem 1rem">
        <div class="empty-ico">📍</div>
        <div class="empty-txt">Belum ada checkpoint data untuk quarter ini</div>
      </div>
    </div>`;
  }
  return `<div class="card" style="margin-bottom:.75rem">
    <div class="card-title">📍 Checkpoints — ${semId.replace('_',' ')} · ${ms.length} milestone</div>
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
function pMilestones(){
  const semId = S.selectedQ || getAllSemesterIds()[0];
  const q = semId ? semesterRollup(semId) : null;
  if(!q) return `<div class="card"><div class="empty-state"><div class="empty-ico">📍</div><div class="empty-txt">Data belum tersedia</div></div></div>`;

  return `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">📋 ${q.quarter_id.replace('_',' ')} — ${q.window_raw||''}</div>
      <div class="vial-summary-strip" style="margin-bottom:0">
        <div class="vs-card"><div class="vs-l">BB Start</div><div class="vs-v">${q.bb_start??'?'}<span style="font-size:13px"> kg</span></div></div>
        <div class="vs-card"><div class="vs-l">BB Target</div><div class="vs-v" style="color:var(--f2)">${q.bb_end??'?'}<span style="font-size:13px"> kg</span></div></div>
        <div class="vs-card"><div class="vs-l">BF Start</div><div class="vs-v">${q.bf_start??'?'}<span style="font-size:13px">%</span></div></div>
        <div class="vs-card"><div class="vs-l">BF Target</div><div class="vs-v" style="color:var(--f3)">${q.bf_end??'?'}<span style="font-size:13px">%</span></div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🗓️ Full Quarter Timeline 2026–2030 · ${S.timeline?.length || 0} quarters</div>
      ${(S.timeline||[]).map((p,i)=>{
        const color = Q_COLORS[Math.floor(i/2) % Q_COLORS.length];
        const yearChange = i > 0 && p.year !== S.timeline[i-1].year;
        const hasBB = p.bb_start_kg != null;
        const hasBF = p.bf_start_pct != null;
        const bbStr = hasBB ? `${p.bb_start_kg}→${p.bb_end_kg} kg` : '—';
        const bfStr = hasBF ? `${p.bf_start_pct}→${p.bf_end_pct}%` : '—';
        const weeks = (p.week_start && p.week_end) ? `W${p.week_start}-W${p.week_end}` : 'pre';
        const dateRange = `${fmtMonthShort(p.date_start)} – ${fmtMonthShort(p.date_end)}`;
        const phase = p.semester_phase_type || p.phase_name || '';
        const phaseShort = phase ? (phase.length > 90 ? phase.slice(0,87)+'...' : phase) : '';
        const phaseFull = phase.replace(/"/g,'&quot;');
        const focusTags = [
          p.focus_roadmap && `<span style="background:var(--acc-bg);color:var(--acc);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">${p.focus_roadmap}</span>`,
          p.focus_pep && `<span style="background:var(--f1-bg);color:var(--f1);padding:2px 7px;border-radius:10px;font-size:10px">💉 ${p.focus_pep}</span>`,
          p.focus_exercise && `<span style="background:var(--f3-bg);color:var(--f3);padding:2px 7px;border-radius:10px;font-size:10px">🏋️ ${p.focus_exercise}</span>`
        ].filter(Boolean).join(' ');
        const selected = p.semester_id === S.selectedQ;
        return `${yearChange ? `<div style="height:8px;border-top:1px dashed var(--bdr);margin:8px 0 4px"></div>` : ''}
        <div onclick="selectQ('${p.semester_id || p.period_id}')" style="display:grid;grid-template-columns:auto 90px 1fr 180px;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid var(--bdr);cursor:pointer;background:${selected?'var(--acc-bg)':'transparent'};border-radius:6px;padding-left:6px;padding-right:6px">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};margin-top:5px"></div>
          <div>
            <div style="font-weight:800;font-size:13px;color:var(--t0)">${p.label_short}</div>
            <div style="font-size:10.5px;color:var(--t3);margin-top:2px">${weeks} · ${dateRange}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--t1);line-height:1.4" title="${phaseFull}">${phaseShort || '<span style="color:var(--t3)">—</span>'}</div>
            ${focusTags ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${focusTags}</div>` : ''}
          </div>
          <div style="text-align:right;font-size:11.5px;font-weight:700;color:${color}">
            ${bbStr}<br><span style="font-weight:500">${bfStr}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ── PANEL: DOCS — content langsung dari master_timeline (no lazy fetch) ──
function pDocs(){
  const qid = S.selectedQ || getAllSemesterIds()[0];
  if(!qid) return `<div class="card"><div class="empty-state"><div class="empty-ico">📄</div><div>Loading...</div></div></div>`;
  const content = getDocContent(qid, S.activeDoc);
  return `
    <div class="doc-sel-row">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--acc-bg);border:1px solid var(--acc-bdr);border-radius:var(--r);font-size:11px;font-weight:700;color:var(--acc)">
        📅 ${qid.replace('_',' ')}
      </div>
      ${DOC_TYPES.map(d=>`
        <button class="doc-btn${S.activeDoc===d?' act':''}" onclick="setActiveDoc('${d}')">${DOC_ICONS[d]} ${d}</button>`).join('')}
    </div>
    <div class="card"><div class="md-content">${renderMd(content)}</div></div>`;
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
    <div class="card">
      <div class="card-title">📅 Protocol Timeline 2026–2030 · ${S.timeline?.length || 0} quarters</div>
      ${(S.timeline||[]).map((p,i)=>{
        const color = Q_COLORS[Math.floor(i/2) % Q_COLORS.length];
        const hasBB = p.bb_start_kg != null;
        const hasBF = p.bf_start_pct != null;
        const bbStr = hasBB ? `${p.bb_start_kg}→${p.bb_end_kg} kg` : '—';
        const bfStr = hasBF ? `${p.bf_start_pct}→${p.bf_end_pct}%` : '—';
        const dateRange = `${fmtMonthShort(p.date_start)} – ${fmtMonthShort(p.date_end)}`;
        return `<div class="tl-row">
          <div class="tl-dot" style="background:${color}"></div>
          <div class="tl-q">${p.label_short}</div>
          <div class="tl-win">${dateRange}${p.week_start?` · W${p.week_start}-W${p.week_end}`:''}</div>
          <div class="tl-bb" style="color:${color}">${bbStr} · ${bfStr}</div>
        </div>`;
      }).join('')}
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
  const msg = document.getElementById('bc-msg');
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

// ── AUTH ──
window.closeAuthModal = function(){ document.getElementById('auth-modal').classList.remove('open'); document.getElementById('auth-err').textContent=''; };
window.onAuthBtnClick = function(){
  const btn = document.getElementById('auth-action-btn');
  if(btn.classList.contains('logout')) supa.auth.signOut();
  else document.getElementById('auth-modal').classList.add('open');
};
window.doLogin = async function(){
  const email = document.getElementById('auth-user').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-err');
  errEl.textContent = '';
  if(!email){ errEl.textContent='Email kosong.'; return; }
  const { error } = await supa.auth.signInWithPassword({ email, password:pass });
  if(error){ errEl.textContent='Email atau password salah.'; return; }
  window.closeAuthModal();
};

function updateAuthUI(user){
  const lbl = document.getElementById('auth-user-label');
  const btn = document.getElementById('auth-action-btn');
  if(user){ lbl.textContent='👤 '+user.email.replace('@peptideapp.local',''); btn.textContent='Logout'; btn.classList.add('logout'); }
  else { lbl.textContent=''; btn.textContent='Login'; btn.classList.remove('logout'); }
}

document.getElementById('auth-modal')?.addEventListener('click',e=>{ if(e.target===e.currentTarget) window.closeAuthModal(); });
document.getElementById('auth-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') window.doLogin(); });

// ── INIT ──
(async()=>{
  console.log('[roadmap] init start');
  document.getElementById('panels-root').innerHTML = '<div style="padding:1rem;color:grey;font-size:12px">Loading…</div>';

  // 1 fetch ke master_timeline (single source of truth)
  try {
    S.timeline = await restFetch('master_timeline', 'select=*&order=sort_order.asc');
    console.log('[roadmap] master_timeline rows:', S.timeline.length);
    buildIndexes();
  } catch(e){
    console.error('[roadmap] init load threw:', e);
    S.timeline = []; S.byPeriod = {}; S.bySemester = {};
  }

  S.currentWeek = getWeekNum();
  // Pilih semester aktif sebagai default selectedQ
  const semIds = getAllSemesterIds();
  if(semIds.length){
    // Cari semester dari period yg current today, fallback first
    const today = new Date();
    const active = S.timeline.find(p => today >= new Date(p.date_start) && today <= new Date(p.date_end));
    S.selectedQ = active?.semester_id || semIds[0];
    S.currentQuarter = semesterRollup(S.selectedQ);
  }

  // Auth listener
  supa.auth.onAuthStateChange(async(event, session)=>{
    S.user = session?.user || null;
    updateAuthUI(S.user);
    if(S.user){
      const weekStart = getWeekStart();
      try {
        const [{ data:bcAll },{ data:gymWeek },{ data:cardioWeek }] = await Promise.all([
          supa.from('body_comp_log')
            .select('id,logged_date,week_num,weight_kg,bf_pct,lbm_kg,waist_cm,notes')
            .eq('user_id', S.user.id).order('logged_date', { ascending:true }),
          supa.from('gym_sessions')
            .select('id,session_date,week_num,duration_min,notes')
            .eq('user_id', S.user.id).gte('session_date', weekStart)
            .order('session_date', { ascending:false }),
          supa.from('cardio_log')
            .select('id,logged_date,week_num,slot,cardio_type,duration_min,distance_km,zone')
            .eq('user_id', S.user.id).gte('logged_date', weekStart)
            .order('logged_date', { ascending:false }),
        ]);
        S.bodyCompLog        = bcAll || [];
        S.latestBodyComp     = bcAll?.length ? bcAll[bcAll.length-1] : null;
        S.activeGymSessions  = gymWeek || [];
        S.activeCardioLog    = cardioWeek || [];
      } catch(e) {
        console.error('auth data load error:', e);
        S.bodyCompLog = []; S.latestBodyComp = null;
        S.activeGymSessions = []; S.activeCardioLog = [];
      }
    } else {
      S.bodyCompLog = []; S.latestBodyComp = null;
      S.activeGymSessions = []; S.activeCardioLog = [];
    }
    render();
  });

  render();
  console.log('[roadmap] render done');
})();
