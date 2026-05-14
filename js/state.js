// ══════════════════════════════════════════════════════════
// STATE — constants, S object, utils, derivations, markdown
// ══════════════════════════════════════════════════════════

export const APP_PEP      = 'https://amirullahputra.github.io/app_pep/';
export const APP_EXERCISE = 'https://amirullahputra.github.io/app_exercise/';

export const TARGET_BF_LO = 10, TARGET_BF_HI = 15;
export const TARGET_LBM   = 55;

export const RACES = [
  { name:'HM JAKIM', date:'2026-06-14', icon:'🏃', dist:'21.1 km' },
  { name:'70.3 Ironman', date:'2029-01-01', icon:'🏊🚴🏃', dist:'113 km' },
];
export const Q_COLORS  = ['var(--f1)','var(--acc)','var(--f3)','var(--hor)','var(--f2)','var(--cns)','var(--inf)','var(--f1)'];
export const DOC_TYPES = ['MACROCYCLE','TARGET','PEPTIDE','GYM','CARDIO','NUTRISI','VITAMIN'];
export const DOC_ICONS = { TARGET:'🎯', PEPTIDE:'💉', GYM:'🏋️', CARDIO:'🏃', NUTRISI:'🍽️', VITAMIN:'💊', MACROCYCLE:'📖' };
export const TABS = ['🏠 Overview','📅 Milestones','📄 Docs','📊 Body Comp','🏁 Race Goals'];

export const S = {
  tab: 0,
  user: null,
  timeline: [],
  milestones: [],
  byPeriod: {},
  activeDoc: 'MACROCYCLE',
  selectedQ: null,
  latestBodyComp: null,
  bodyCompLog: [],
  activeGymSessions: [],
  activeCardioLog: [],
  currentQuarter: null,
  currentWeek: 0,
  editingPeriod: null,
  docCache: {},
};

// ── UTILS ──
export function daysUntil(d){ return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }
export function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
export function fmtMonthShort(dateStr){
  if(!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', { month:'short', year:'2-digit' });
}
export function getWeekNum(){
  const now = new Date(), start = new Date('2026-07-06');
  const diff = Math.floor((now-start)/(1000*60*60*24));
  return diff >= 0 ? Math.min(Math.floor(diff/7)+1, 56) : 0;
}
export function getWeekStart(){
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day===0?-6:1);
  const mon = new Date(now.setDate(diff));
  return mon.toISOString().split('T')[0];
}

// ── DERIVATIONS ──
export function buildIndexes(){
  S.byPeriod = Object.fromEntries(S.timeline.map(r => [r.period_id, r]));
}

function fmtDateID(d){ if(!d) return ''; return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }); }

export function quarterRollup(periodId){
  const r = S.byPeriod[periodId];
  if(!r) return null;
  const weeks = (r.week_start && r.week_end) ? (r.week_end - r.week_start + 1) : null;
  return {
    quarter_id: periodId,
    phase_type: r.focus_roadmap || '',
    window_raw: (r.date_start && r.date_end)
                ? `${fmtDateID(r.date_start)} → ${fmtDateID(r.date_end)}${weeks ? ` (${weeks} minggu)` : ''}`
                : '',
    total_weeks: weeks,
    bb_start: r.bb_start_kg,
    bb_end:   r.bb_end_kg,
    bf_start: r.bf_start_pct,
    bf_end:   r.bf_end_pct,
  };
}

export function getAllPeriodIds(){
  return S.timeline.map(r => r.period_id).filter(Boolean);
}

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

export function getMilestonesForPeriod(periodId){
  const row = S.byPeriod[periodId];
  if(!row) return [];
  return parseMilestones(row);
}

export function getDocContent(qid, docType){
  const col = 'content_' + docType.toLowerCase() + '_md';
  const row = S.byPeriod[qid];
  return row?.[col] || '';
}

// ── MARKDOWN ──
function renderInline(text){
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank">$1</a>');
}

export function renderMd(md){
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
