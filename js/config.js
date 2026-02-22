/* ============================================================
   config.js – Supabase Client & App Constants
   ============================================================ */

// ─── Supabase Configuration ───────────────────────────────────
// Replace these with your actual Supabase project credentials
const SUPABASE_URL  = 'https://kuerhbrvgkfubnxkydsi.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1ZXJoYnJ2Z2tmdWJueGt5ZHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDE2MTEsImV4cCI6MjA4NzMxNzYxMX0.D1DcReSlJfi1kaDtiiuV3EJ8_znhEpDk6bxyMGASz-w';

// Initialize the Supabase client (loaded via CDN in index.html)
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── App Constants ────────────────────────────────────────────
export const APP_NAME   = 'Allreview';
export const POOL_SIZE  = 16;   // Images per tournament
export const ROUND_MAP  = {
  16: '16강',
  8:  '8강',
  4:  '4강',
  2:  '결승',
};

// Country code → flag emoji conversion
export function countryFlag(code) {
  if (!code || code === 'GL') return '🌍';
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

// ─── Toast Utility ────────────────────────────────────────────
let toastTimer = null;
export function showToast(msg) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ─── Storage Helpers ──────────────────────────────────────────
export function getUser() {
  const nickname = localStorage.getItem('ar_nickname') || 'Anonymous';
  const country  = localStorage.getItem('ar_country')  || 'GL';
  return { nickname, country };
}

export function setUser(nickname, country) {
  localStorage.setItem('ar_nickname', nickname);
  localStorage.setItem('ar_country', country);
}
