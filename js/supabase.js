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
