// ══════════════════════════════════════════════════════════
// AMIR'S ROADMAP — Core Hub
// ══════════════════════════════════════════════════════════
const SUPA_URL = 'https://guhhoqpvwzzrlwgfugsb.supabase.co';
const SUPA_KEY = 'sb_publishable_yu8KTS5mId2hV7kVjScvZA_-geYqKHv';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

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

const S = {
  tab: 0,
  user: null,
  quarters: [],
  milestones: [],
  contentCache: {},
  activeDoc: 'TARGET',
  selectedQ: null,
  // live data
  latestBodyComp: null,
  bodyCompLog: [],
  activeGymSessions: [],   // sesi gym minggu ini
  activeCardioLog: [],     // cardio minggu ini
  activePeptides: [],      // dari pep_fl compounds (public)
  currentQuarter: null,
  currentWeek: 0,
};

// ── UTILS ──
function daysUntil(d){ return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }

function sortQuarters(arr){
  return [...arr].sort((a,b)=>{
    const parse = q => {
      const m = q.quarter_id.match(/^(Q[13]Q[24])_(\d{4})$/);
      if(!m) return 0;
      const year = parseInt(m[2]);
      const half = m[1].startsWith('Q1') ? 0 : 1;
      return year * 10 + half;
    };
    return parse(a) - parse(b);
  });
}
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
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

// ── MARKDOWN ──
function renderMd(md){
  if(!md) return `<div class="empty-state"><div class="empty-ico">📄</div><div class="empty-txt">Belum ada konten untuk quarter ini.</div></div>`;
  const html = md
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/^---$/gm,'<hr>')
    .replace(/^\- (.+)$/gm,'<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm,'<li><strong>$1.</strong> $2</li>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/(<li>.*?<\/li>\n?)+/gs, m=>`<ul>${m}</ul>`);
  return `<p>${html}</p>`.replace(/<p><\/p>/g,'');
}

// ── RENDER ──
function renderTabNav(){
  document.getElementById('tab-nav').innerHTML = TABS.map((t,i)=>
    `<button class="tab-btn${S.tab===i?' act':''}" onclick="setTab(${i})">${t}</button>`
  ).join('');
}

function renderPanel(){
  let html = '';
  if(S.tab===0)      html = pOverview();
  else if(S.tab===1) html = pMilestones();
  else if(S.tab===2) html = pDocs();
  else if(S.tab===3) html = pBodyComp();
  else               html = pRaceGoals();
  document.getElementById('panels-root').innerHTML = html;
}

function render(){ renderTabNav(); renderPanel(); }

window.setTab = function(i){ S.tab=i; render(); };
window.selectQ = function(qid){ S.selectedQ=qid; S.tab=1; render(); };
window.selectQDoc = function(qid){ S.selectedQ=qid; loadContentForQ(qid).then(render); };
window.setActiveDoc = function(doc){ S.activeDoc=doc; renderPanel(); };

// ── PANEL: OVERVIEW (Feed-style) ─────────────────────────
function pOverview(){
  const wk = S.currentWeek;
  const q  = S.currentQuarter;
  const bc = S.latestBodyComp;

  // ── 1. STATUS BAR ──
  const bf    = bc?.bf_pct ?? null;
  const lbm   = bc?.lbm_kg ?? null;
  const bb    = bc?.weight_kg ?? null;
  const bfOk  = bf !== null && bf >= TARGET_BF_LO && bf <= TARGET_BF_HI;
  const lbmOk = lbm !== null && lbm >= TARGET_LBM;

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

  // ── 2. APP LINKS ──
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

  // ── 3. GYM MINGGU INI ──
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

  // ── 4. CARDIO MINGGU INI ──
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

  // ── 5. RACE COUNTDOWN ──
  const raceHtml = `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">🏁 Race Countdown</div>
      ${RACES.map(r=>{
        const days = daysUntil(r.date);
        const pct  = Math.max(0, Math.min(100, Math.round((1 - days/1200)*100)));
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

  // ── 6. QUARTER PROGRESS ──
  const qProgress = q ? `
    <div class="card">
      <div class="card-title">📋 Quarter Aktif: ${q.quarter_id.replace('_',' ')}</div>
      <div style="font-size:11px;color:var(--t2);margin-bottom:.75rem">${q.window_raw||''} · ${q.phase_type||''}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:.875rem">
        <div style="background:var(--bg2);border-radius:var(--r);padding:.625rem .75rem;border:1px solid var(--bdr)">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">BB Target</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--t0);margin-top:2px">${q.bb_start} → ${q.bb_end} kg</div>
        </div>
        <div style="background:var(--bg2);border-radius:var(--r);padding:.625rem .75rem;border:1px solid var(--bdr)">
          <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">BF% Target</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--f3);margin-top:2px">${q.bf_start} → ${q.bf_end}%</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--t2);margin-bottom:5px">Progress W${wk} dari ${q.total_weeks} weeks</div>
      <div class="ph-bar">
        <div class="ph-bar-fill" style="width:${Math.round((wk/q.total_weeks)*100)}%;background:var(--acc)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:9px;color:var(--t3)">W1</span>
        <span style="font-size:9px;color:var(--acc);font-weight:700">${Math.round((wk/q.total_weeks)*100)}%</span>
        <span style="font-size:9px;color:var(--t3)">W${q.total_weeks}</span>
      </div>
    </div>` : '';

  return statusBar + appLinks + gymHtml + cardioHtml + raceHtml + qProgress;
}

// ── PANEL: MILESTONES ────────────────────────────────────
function pMilestones(){
  const q = S.quarters.find(x=>x.quarter_id===S.selectedQ) || S.quarters[0];
  if(!q) return `<div class="card"><div class="empty-state"><div class="empty-ico">📍</div><div class="empty-txt">Data belum tersedia</div></div></div>`;
  const ms = S.milestones.filter(m=>m.quarter_id===q.quarter_id);

  return `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem">
      ${S.quarters.map((qq,i)=>`
        <button class="tab-btn${S.selectedQ===qq.quarter_id?' act':''}" onclick="selectQ('${qq.quarter_id}')" style="flex:none">
          ${qq.quarter_id.replace('_',' ')}
        </button>`).join('')}
    </div>
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">📋 ${q.quarter_id.replace('_',' ')} — ${q.window_raw||''}</div>
      <div class="vial-summary-strip" style="margin-bottom:0">
        <div class="vs-card"><div class="vs-l">BB Start</div><div class="vs-v">${q.bb_start||'?'}<span style="font-size:13px"> kg</span></div></div>
        <div class="vs-card"><div class="vs-l">BB Target</div><div class="vs-v" style="color:var(--f2)">${q.bb_end||'?'}<span style="font-size:13px"> kg</span></div></div>
        <div class="vs-card"><div class="vs-l">BF Start</div><div class="vs-v">${q.bf_start||'?'}<span style="font-size:13px">%</span></div></div>
        <div class="vs-card"><div class="vs-l">BF Target</div><div class="vs-v" style="color:var(--f3)">${q.bf_end||'?'}<span style="font-size:13px">%</span></div></div>
      </div>
    </div>
    ${ms.length ? `
    <div class="card">
      <div class="card-title">📍 Checkpoints</div>
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
    </div>` : `<div class="card"><div class="empty-state"><div class="empty-ico">📍</div><div class="empty-txt">Belum ada checkpoint data</div></div></div>`}`;
}

// ── PANEL: DOCS ──────────────────────────────────────────
async function loadContentForQ(qid){
  if(S.contentCache[qid]) return;
  const { data } = await supa.from('quarter_content').select('doc_type,content_md').eq('quarter_id',qid);
  S.contentCache[qid] = {};
  if(data) data.forEach(r=>{ S.contentCache[qid][r.doc_type]=r.content_md; });
}

function pDocs(){
  const qid = S.selectedQ || S.quarters[0]?.quarter_id;
  if(!qid) return `<div class="card"><div class="empty-state"><div class="empty-ico">📄</div><div>Loading...</div></div></div>`;
  const cache = S.contentCache[qid] || {};
  return `
    <div class="doc-sel-row">
      <select class="doc-qsel" onchange="selectQDoc(this.value)">
        ${S.quarters.map(q=>`<option value="${q.quarter_id}" ${q.quarter_id===qid?'selected':''}>${q.quarter_id.replace('_',' ')}</option>`).join('')}
      </select>
      ${DOC_TYPES.map(d=>`
        <button class="doc-btn${S.activeDoc===d?' act':''}" onclick="setActiveDoc('${d}')">${DOC_ICONS[d]} ${d}</button>`).join('')}
    </div>
    <div class="card"><div class="md-content">${renderMd(cache[S.activeDoc])}</div></div>`;
}

// ── PANEL: BODY COMP ─────────────────────────────────────
function pBodyComp(){
  if(!S.user) return `
    <div class="card">
      <div class="card-title">📊 Body Composition Log</div>
      <div class="empty-state"><div class="empty-ico">🔒</div><div class="empty-txt">Login untuk melihat data body comp kamu</div></div>
    </div>`;

  const log = S.bodyCompLog;
  if(!log.length) return `
    <div class="card">
      <div class="card-title">📊 Body Composition Log</div>
      <div class="empty-state"><div class="empty-ico">📊</div><div class="empty-txt">Belum ada data. Mulai log setelah protokol dimulai.</div></div>
    </div>`;

  // mini progress bar per entry vs target
  return `
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-title">🎯 Progress vs Target</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${[
          { l:'BF% Saat Ini', v:log[log.length-1].bf_pct, target:TARGET_BF_HI, unit:'%', color:'var(--f3)', lower:true },
          { l:'LBM Saat Ini', v:log[log.length-1].lbm_kg, target:TARGET_LBM, unit:' kg', color:'var(--acc)', lower:false },
          { l:'BB Saat Ini', v:log[log.length-1].weight_kg, target:S.currentQuarter?.bb_end, unit:' kg', color:'var(--f2)', lower:true },
        ].map(x=>`
          <div style="background:var(--bg2);border-radius:var(--r);padding:.75rem;border:1px solid var(--bdr)">
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${x.l}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:${x.color}">${x.v??'—'}${x.v!=null?x.unit:''}</div>
            <div style="font-size:9px;color:var(--t3);margin-top:2px">Target: ${x.target??'?'}${x.unit}</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">📅 Log Riwayat</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>Week</th><th>BB</th><th>BF%</th><th>LBM</th><th>Pinggang</th><th>Notes</th></tr></thead>
          <tbody>
            ${[...log].reverse().map(r=>`<tr>
              <td style="font-weight:700">${fmtDate(r.logged_date)}</td>
              <td><span class="bdg bdg-acc">W${r.week_num||'?'}</span></td>
              <td class="mono cost-v">${r.weight_kg||'—'} kg</td>
              <td class="mono">${r.bf_pct||'—'}%</td>
              <td class="mono">${r.lbm_kg||'—'} kg</td>
              <td class="mono">${r.waist_cm||'—'} cm</td>
              <td style="color:var(--t2)">${r.notes||''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── PANEL: RACE GOALS ────────────────────────────────────
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
      <div class="card-title">📅 Protocol Timeline 2026–2029</div>
      ${S.quarters.map((q,i)=>`
        <div class="tl-row">
          <div class="tl-dot" style="background:${Q_COLORS[i]}"></div>
          <div class="tl-q">${q.quarter_id.replace('_',' ')}</div>
          <div class="tl-win">${q.window_raw||''}</div>
          <div class="tl-bb" style="color:${Q_COLORS[i]}">${q.bb_start||'?'}→${q.bb_end||'?'} kg · ${q.bf_start||'?'}→${q.bf_end||'?'}%</div>
        </div>`).join('')}
    </div>`;
}

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

document.getElementById('auth-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget) window.closeAuthModal(); });
document.getElementById('auth-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') window.doLogin(); });

// ── INIT ──
(async()=>{
  // Load quarters + milestones
  const [{ data:qData },{ data:msData }] = await Promise.all([
    supa.from('quarters').select('quarter_id,phase_type,window_raw,total_weeks,bb_start,bb_end,bf_start,bf_end'),
    supa.from('quarter_milestones').select('quarter_id,week_label,date_range,bb_target,bf_target,lab_tests,note').order('week_label'),
  ]);
  S.quarters   = sortQuarters(qData  || []);
  S.milestones = msData || [];

  // Determine current quarter & week
  S.currentWeek = getWeekNum();
  S.currentQuarter = S.quarters.find(q => {
    const start = new Date(q.window_raw?.split('–')[0]?.trim() + ' 2026' || '2026-07-06');
    return S.currentWeek > 0;
  }) || S.quarters[0] || null;

  if(S.quarters.length){
    S.selectedQ = S.quarters[0].quarter_id;
    await loadContentForQ(S.selectedQ);
  }

  // Auth listener — load live data on login
  supa.auth.onAuthStateChange(async(event, session)=>{
    S.user = session?.user || null;
    updateAuthUI(S.user);
    if(S.user){
      const weekStart = getWeekStart();
      const qid = S.currentQuarter?.quarter_id || S.quarters[0]?.quarter_id;

      const [{ data:bcAll },{ data:gymWeek },{ data:cardioWeek }] = await Promise.all([
        supa.from('body_comp_log')
          .select('logged_date,week_num,weight_kg,bf_pct,lbm_kg,waist_cm,notes')
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
    } else {
      S.bodyCompLog = []; S.latestBodyComp = null;
      S.activeGymSessions = []; S.activeCardioLog = [];
    }
    render();
  });

  render();
})();
