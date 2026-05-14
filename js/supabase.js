// ══════════════════════════════════════════════════════════
// SUPABASE — client, data fetchers, auth helpers
// ══════════════════════════════════════════════════════════
const SUPA_URL = 'https://guhhoqpvwzzrlwgfugsb.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGhvcXB2d3p6cmx3Z2Z1Z3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMTg5NTgsImV4cCI6MjA5Mzg5NDk1OH0.KDkDqrsbburSAsaKgNUh2QK5YbFCxqM6aDF-DIqGQaU';
export const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

export async function restFetch(table, query=''){
  const url = `${SUPA_URL}/rest/v1/${table}${query?'?'+query:''}`;
  const res = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if(!res.ok){
    const body = await res.text().catch(()=>'');
    throw new Error(`${table}: HTTP ${res.status} ${body.slice(0,200)}`);
  }
  return res.json();
}

export function updateAuthUI(user){
  const lbl = document.getElementById('auth-user-label');
  const btn = document.getElementById('auth-action-btn');
  if(user){
    lbl.textContent = '👤 ' + user.email.replace('@peptideapp.local','');
    btn.textContent = 'Logout';
    btn.classList.add('logout');
  } else {
    lbl.textContent = '';
    btn.textContent = 'Login';
    btn.classList.remove('logout');
  }
}

export function closeAuthModal(){
  document.getElementById('auth-modal').classList.remove('open');
  document.getElementById('auth-err').textContent = '';
}

export function onAuthBtnClick(){
  const btn = document.getElementById('auth-action-btn');
  if(btn.classList.contains('logout')) supa.auth.signOut();
  else document.getElementById('auth-modal').classList.add('open');
}

// ── AUTH FETCH (untuk authed writes) ──
function readJwt(){
  try {
    const projectRef = SUPA_URL.match(/https:\/\/([^.]+)/)?.[1];
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch(_){ return null; }
}

export async function updateTimelineRow(periodId, fields){
  const jwt = readJwt();
  if(!jwt) throw new Error('Tidak ada session — login dulu');
  const url = `${SUPA_URL}/rest/v1/master_timeline?period_id=eq.${encodeURIComponent(periodId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(fields),
  });
  if(!res.ok){
    const body = await res.text().catch(()=>'');
    throw new Error(`PATCH master_timeline: HTTP ${res.status} ${body.slice(0,200)}`);
  }
  const data = await res.json().catch(()=>[]);
  return data[0] || null;
}

export async function doLogin(){
  const email = document.getElementById('auth-user').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-err');
  errEl.textContent = '';
  if(!email){ errEl.textContent = 'Email kosong.'; return; }
  const { error } = await supa.auth.signInWithPassword({ email, password: pass });
  if(error){ errEl.textContent = 'Email atau password salah.'; return; }
  closeAuthModal();
}
