// ══════════════════════════════════════════════════════════
// MAIN — entry point, error boundary, init
// ══════════════════════════════════════════════════════════

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

import { S, buildIndexes, getWeekNum, getWeekStart, quarterRollup, getAllPeriodIds } from './state.js?v=27';
import { supa, restFetch, updateAuthUI, closeAuthModal, onAuthBtnClick, doLogin } from './supabase.js?v=27';
import { render } from './panels.js?v=27';

// Bind auth handlers to window (called from HTML onclick)
window.closeAuthModal = closeAuthModal;
window.onAuthBtnClick = onAuthBtnClick;
window.doLogin = doLogin;

// ── INIT ──
(async () => {
  document.getElementById('panels-root').innerHTML = '<div style="padding:1rem;color:grey;font-size:12px">Loading…</div>';

  // Load master_timeline + milestones in parallel
  try {
    const [timeline, milestones] = await Promise.all([
      restFetch('master_timeline', 'select=*&order=sort_order.asc'),
      restFetch('milestones', 'select=*&order=date_target.asc').catch(()=>[]),
    ]);
    S.timeline = timeline;
    S.milestones = milestones || [];
    buildIndexes();
  } catch(e) {
    console.error('[roadmap] init load threw:', e);
    S.timeline = []; S.byPeriod = {}; S.bySemester = {}; S.milestones = [];
  }

  S.currentWeek = getWeekNum();

  // Default selectedQ = active period today
  const periodIds = getAllPeriodIds();
  if(periodIds.length){
    const today = new Date();
    const active = S.timeline.find(p => today >= new Date(p.date_start) && today <= new Date(p.date_end));
    S.selectedQ = active?.period_id || periodIds[0];
    S.currentQuarter = quarterRollup(S.selectedQ);
  }

  // Event listeners
  document.getElementById('auth-modal')?.addEventListener('click', e => {
    if(e.target === e.currentTarget) window.closeAuthModal();
  });
  document.getElementById('auth-pass')?.addEventListener('keydown', e => {
    if(e.key === 'Enter') window.doLogin();
  });

  // Auth listener — loads user-specific data on login
  supa.auth.onAuthStateChange(async (event, session) => {
    S.user = session?.user || null;
    updateAuthUI(S.user);
    if(S.user){
      const weekStart = getWeekStart();
      try {
        const [{ data:bcAll }, { data:gymWeek }, { data:cardioWeek }] = await Promise.all([
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
        S.bodyCompLog       = bcAll || [];
        S.latestBodyComp    = bcAll?.length ? bcAll[bcAll.length-1] : null;
        S.activeGymSessions = gymWeek || [];
        S.activeCardioLog   = cardioWeek || [];
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
})();
