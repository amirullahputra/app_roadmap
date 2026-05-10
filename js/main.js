// ══════════════════════════════════════════════════════════
// ROADMAP DASHBOARD
// ══════════════════════════════════════════════════════════
const SUPA_URL = 'https://guhhoqpvwzzrlwgfugsb.supabase.co';
const SUPA_KEY = 'sb_publishable_yu8KTS5mId2hV7kVjScvZA_-geYqKHv';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

// ── STATE ──
const S = {
  tab: 0,
  quarters: [],
  milestones: [],
  bodyComp: [],
  contentCache: {},
  activeDoc: 'TARGET',
  selectedQ: null,
  user: null,
};

const TABS = ['🗺 Overview','📍 Milestones','📄 Roadmap Docs','📊 Body Comp','🏁 Race Goals'];
const DOC_TYPES = ['TARGET','PEPTIDE','GYM','CARDIO','NUTRISI','VITAMIN'];
const DOC_ICONS = {TARGET:'🎯',PEPTIDE:'💉',GYM:'🏋️',CARDIO:'🏃',NUTRISI:'🍽️',VITAMIN:'💊'};
const RACES = [
  {name:'HM JAKIM',date:'2026-06-14',icon:'🏃',dist:'21.1 km'},
  {name:'70.3 Ironman',date:'2029-01-01',icon:'🏊🚴🏃',dist:'113 km'},
];
const Q_COLORS = ['var(--f1)','var(--acc)','var(--f3)','var(--hor)','var(--f2)','var(--cns)','var(--inf)','var(--f1)'];

function daysUntil(d){ return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }

// ── MARKDOWN RENDER ──
function renderMd(md){
  if(!md) return `<div class="empty-state"><div class="empty-ico">📄</div><div class="empty-txt">Belum ada konten untuk quarter ini.</div></div>`;
  const html = md
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,  '<h1>$1</h1>')
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
  let html='';
  if(S.tab===0) html=pOverview();
  else if(S.tab===1) html=pMilestones();
  else if(S.tab===2) html=pDocs();
  else if(S.tab===3) html=pBodyComp();
  else html=pRaceGoals();
  document.getElementById('panels-root').innerHTML=html;
}

function render(){ renderTabNav(); renderPanel(); }

function setTab(i){ S.tab=i; render(); }
window.setTab=setTab;

window.selectQ = function(qid){ S.selectedQ=qid; S.tab=1; render(); };
window.selectQDoc = function(qid){ S.selectedQ=qid; loadContentForQ(qid).then(render); };
window.setActiveDoc = function(doc){ S.activeDoc=doc; renderPanel(); };

// ── PANEL: OVERVIEW ──────────────────────────────────────
function pOverview(){
  const now=new Date(), ps=new Date('2026-07-06');
  const diff=Math.floor((now-ps)/(1000*60*60*24));
  const curWeek = diff>=0 ? Math.min(Math.floor(diff/7)+1,56) : 0;
  const qs=S.quarters;
  const totalLoss = qs.length ? ((qs[0].bb_start||0)-(qs[qs.length-1].bb_end||0)).toFixed(1) : '—';

  return `
    <div class="vial-summary-strip" style="grid-template-columns:repeat(4,1fr)">
      <div class="vs-card">
        <div class="vs-l">Protocol Week</div>
        <div class="vs-v" style="color:var(--acc)">${curWeek>0?'W'+curWeek:'Belum Mulai'}</div>
        <div class="vs-s">Mulai 6 Jul 2026</div>
      </div>
      <div class="vs-card">
        <div class="vs-l">Fat Loss Target</div>
        <div class="vs-v" style="color:var(--f2)">${totalLoss} kg</div>
        <div class="vs-s">${qs[0]?.bb_start||'?'} → ${qs[qs.length-1]?.bb_end||'?'} kg</div>
      </div>
      <div class="vs-card">
        <div class="vs-l">BF% Target</div>
        <div class="vs-v" style="color:var(--f3)">${qs[0]?.bf_start||'?'}→${qs[qs.length-1]?.bf_end||'?'}%</div>
        <div class="vs-s">-${((qs[0]?.bf_start||0)-(qs[qs.length-1]?.bf_end||0)).toFixed(1)}% total</div>
      </div>
      <div class="vs-card">
        <div class="vs-l">Total Quarters</div>
        <div class="vs-v">${qs.length}</div>
        <div class="vs-s">2026 – 2029</div>
      </div>
    </div>
    <div class="q-grid">
      ${qs.map((q,i)=>{
        const bbDrop=q.bb_start&&q.bb_end?(q.bb_start-q.bb_end).toFixed(1):'—';
        const bfDrop=q.bf_start&&q.bf_end?(q.bf_start-q.bf_end).toFixed(1):'—';
        return `<div class="q-card${S.selectedQ===q.quarter_id?' act':''}" onclick="selectQ('${q.quarter_id}')">
          <div class="q-id" style="color:${Q_COLORS[i]}">${q.quarter_id.replace('_',' ')}</div>
          <div class="q-type">${q.phase_type||'—'} · ${q.total_weeks||'—'} weeks</div>
          <div class="q-stats">
            <div class="q-stat"><div class="q-stat-l">BB</div><div class="q-stat-v">${q.bb_start||'?'}→${q.bb_end||'?'} kg</div></div>
            <div class="q-stat"><div class="q-stat-l">BF%</div><div class="q-stat-v">${q.bf_start||'?'}→${q.bf_end||'?'}%</div></div>
            <div class="q-stat"><div class="q-stat-l">Fat Loss</div><div class="q-stat-v" style="color:var(--f2)">-${bbDrop} kg</div></div>
            <div class="q-stat"><div class="q-stat-l">BF Drop</div><div class="q-stat-v" style="color:var(--f3)">-${bfDrop}%</div></div>
          </div>
          <div class="ph-bar" style="margin-top:10px">
            <div class="ph-bar-fill" style="width:${q.bf_start?Math.round((1-q.bf_end/q.bf_start)*100):20}%;background:${Q_COLORS[i]}"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ── PANEL: MILESTONES ────────────────────────────────────
function pMilestones(){
  const q=S.quarters.find(x=>x.quarter_id===S.selectedQ)||S.quarters[0];
  if(!q) return `<div class="card"><div class="empty-state"><div class="empty-ico">📍</div><div class="empty-txt">Pilih quarter dari Overview</div></div></div>`;
  const ms=S.milestones.filter(m=>m.quarter_id===q.quarter_id);

  return `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">📍 ${q.quarter_id.replace('_',' ')} — ${q.window_raw||''}</div>
      <div class="vial-summary-strip" style="grid-template-columns:repeat(5,1fr)">
        <div class="vs-card"><div class="vs-l">BB Start</div><div class="vs-v">${q.bb_start||'?'} kg</div></div>
        <div class="vs-card"><div class="vs-l">BB Target</div><div class="vs-v" style="color:var(--f2)">${q.bb_end||'?'} kg</div></div>
        <div class="vs-card"><div class="vs-l">BF Start</div><div class="vs-v">${q.bf_start||'?'}%</div></div>
        <div class="vs-card"><div class="vs-l">BF Target</div><div class="vs-v" style="color:var(--f3)">${q.bf_end||'?'}%</div></div>
        <div class="vs-card"><div class="vs-l">Weeks</div><div class="vs-v">${q.total_weeks||'?'}</div></div>
      </div>
    </div>
    ${ms.length ? `
    <div class="card">
      <div class="card-title">📅 Checkpoints</div>
      ${ms.map((m,i)=>`
        <div class="ms-row">
          <div class="ms-dot" style="background:hsl(${200+i*25},65%,55%)"></div>
          <div class="ms-week">${m.week_label}</div>
          <div class="ms-date">${m.date_range||''}</div>
          <div class="ms-chips">
            <div class="ms-chip"><div class="ms-chip-l">BB Target</div><div class="ms-chip-v">${m.bb_target||'?'} kg</div></div>
            <div class="ms-chip"><div class="ms-chip-l">BF Target</div><div class="ms-chip-v">${m.bf_target||'?'}%</div></div>
          </div>
          <div class="ms-note">${m.note||m.lab_tests||''}</div>
        </div>`).join('')}
    </div>` : `<div class="card"><div class="empty-state"><div class="empty-ico">📍</div><div class="empty-txt">Belum ada milestone data untuk quarter ini</div></div></div>`}`;
}

// ── PANEL: ROADMAP DOCS ──────────────────────────────────
async function loadContentForQ(qid){
  if(S.contentCache[qid]) return;
  const{data}=await supa.from('quarter_content').select('doc_type,content_md').eq('quarter_id',qid);
  S.contentCache[qid]={};
  if(data) data.forEach(r=>{S.contentCache[qid][r.doc_type]=r.content_md;});
}

function pDocs(){
  const qid=S.selectedQ||(S.quarters[0]?.quarter_id);
  if(!qid) return `<div class="card"><div class="empty-state"><div class="empty-ico">📄</div><div>Loading...</div></div></div>`;
  const cache=S.contentCache[qid]||{};

  return `
    <div class="doc-sel-row">
      <select class="doc-qsel" onchange="selectQDoc(this.value)">
        ${S.quarters.map(q=>`<option value="${q.quarter_id}" ${q.quarter_id===qid?'selected':''}>${q.quarter_id.replace('_',' ')}</option>`).join('')}
      </select>
      ${DOC_TYPES.map(d=>`
        <button class="doc-btn${S.activeDoc===d?' act':''}" onclick="setActiveDoc('${d}')">
          ${DOC_ICONS[d]} ${d}
        </button>`).join('')}
    </div>
    <div class="card">
      <div class="md-content">${renderMd(cache[S.activeDoc])}</div>
    </div>`;
}

// ── PANEL: BODY COMP ─────────────────────────────────────
function pBodyComp(){
  if(!S.bodyComp.length) return `
    <div class="card">
      <div class="card-title">📊 Body Composition Log</div>
      <div class="empty-state"><div class="empty-ico">📊</div><div class="empty-txt">Login dan mulai log berat badan setelah protokol dimulai (6 Jul 2026)</div></div>
    </div>`;
  return `
    <div class="card">
      <div class="card-title">📊 Body Composition Log</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>Week</th><th>BB (kg)</th><th>BF%</th><th>LBM (kg)</th><th>Pinggang</th><th>Notes</th></tr></thead>
          <tbody>
            ${S.bodyComp.map(r=>`<tr>
              <td style="font-weight:700">${r.logged_date}</td>
              <td><span class="bdg bdg-acc">W${r.week_num||'?'}</span></td>
              <td class="mono cost-v">${r.weight_kg||'—'}</td>
              <td class="mono">${r.bf_pct||'—'}%</td>
              <td class="mono">${r.lbm_kg||'—'}</td>
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
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">🏁 Race Goals</div>
      ${RACES.map(r=>{
        const days=daysUntil(r.date);
        return `<div class="race-card">
          <div class="race-ico">${r.icon}</div>
          <div>
            <div class="race-name">${r.name}</div>
            <div class="race-meta">${r.date} · ${r.dist}</div>
          </div>
          <div class="race-days">${days>0?days+' hari lagi':'🎯 RACE DAY'}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="card-title">📅 Protocol Timeline</div>
      ${S.quarters.map((q,i)=>`
        <div class="tl-row">
          <div class="tl-dot" style="background:${Q_COLORS[i]}"></div>
          <div class="tl-q">${q.quarter_id.replace('_',' ')}</div>
          <div class="tl-win">${q.window_raw||''}</div>
          <div class="tl-bb" style="color:${Q_COLORS[i]}">${q.bb_start||'?'}→${q.bb_end||'?'} kg</div>
        </div>`).join('')}
    </div>`;
}

// ── AUTH ──
function usernameToEmail(u){return u.trim().toLowerCase().replace(/\s+/g,'_')+'@peptideapp.local';}
window.closeAuthModal=function(){document.getElementById('auth-modal').classList.remove('open');document.getElementById('auth-err').textContent='';};
window.onAuthBtnClick=function(){const btn=document.getElementById('auth-action-btn');if(btn.classList.contains('logout'))supa.auth.signOut();else document.getElementById('auth-modal').classList.add('open');};
window.doLogin=async function(){
  const user=document.getElementById('auth-user').value.trim();
  const pass=document.getElementById('auth-pass').value;
  const errEl=document.getElementById('auth-err');
  errEl.textContent='';
  if(!user){errEl.textContent='Username kosong.';return;}
  const{error}=await supa.auth.signInWithPassword({email:usernameToEmail(user),password:pass});
  if(error){errEl.textContent='Username atau password salah.';return;}
  window.closeAuthModal();
};

function updateAuthUI(user){
  const lbl=document.getElementById('auth-user-label');
  const btn=document.getElementById('auth-action-btn');
  if(user){lbl.textContent='👤 '+user.email.replace('@peptideapp.local','');btn.textContent='Logout';btn.classList.add('logout');}
  else{lbl.textContent='';btn.textContent='Login';btn.classList.remove('logout');}
}

document.getElementById('auth-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)window.closeAuthModal();});
document.getElementById('auth-pass').addEventListener('keydown',e=>{if(e.key==='Enter')window.doLogin();});

// ── INIT ──
(async()=>{
  const[{data:qData},{data:msData}]=await Promise.all([
    supa.from('quarters').select('quarter_id,phase_type,window_raw,total_weeks,bb_start,bb_end,bf_start,bf_end').order('quarter_id'),
    supa.from('quarter_milestones').select('quarter_id,week_label,date_range,bb_target,bf_target,lab_tests,note').order('quarter_id').order('week_label'),
  ]);
  S.quarters=qData||[];
  S.milestones=msData||[];
  if(S.quarters.length){
    S.selectedQ=S.quarters[0].quarter_id;
    await loadContentForQ(S.selectedQ);
  }

  supa.auth.onAuthStateChange(async(event,session)=>{
    S.user=session?.user||null;
    updateAuthUI(S.user);
    if(S.user){
      const{data}=await supa.from('body_comp_log')
        .select('logged_date,week_num,weight_kg,bf_pct,lbm_kg,waist_cm,notes')
        .eq('user_id',S.user.id).order('logged_date',{ascending:true});
      S.bodyComp=data||[];
    }else{S.bodyComp=[];}
    render();
  });

  render();
})();
