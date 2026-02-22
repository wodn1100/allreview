/* ============================================================
   main.js – App Entry, Onboarding, Navigation
   ============================================================ */
import { supabase, setUser, getUser, countryFlag, showToast } from './config.js';
import { initWorldcup } from './worldcup.js';
import { loadHallOfFame } from './review.js';

// ─── DOM References ───────────────────────────────────────────
const splashScreen = document.getElementById('splash-screen');
const onboardScreen = document.getElementById('onboarding-screen');
const appScreen = document.getElementById('app-screen');
const countrySelect = document.getElementById('country-select');
const nicknameInput = document.getElementById('nickname-input');
const startBtn = document.getElementById('start-btn');
const userBadge = document.getElementById('user-badge');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const navHall = document.getElementById('nav-hall');

// ─── Splash → Onboarding Transition ──────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        splashScreen.classList.remove('active');

        const { nickname, country } = getUser();
        if (nickname && nickname !== 'Anonymous' && country && country !== 'GL') {
            // Returning user → straight to app
            showApp();
        } else {
            onboardScreen.classList.add('active');
            loadCountries();
        }
    }, 2200);
});

// ─── Load Countries via REST Countries API ────────────────────
async function loadCountries() {
    try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
        const data = await res.json();

        const sorted = data
            .map(c => ({ name: c.name.common, code: c.cca2 }))
            .sort((a, b) => a.name.localeCompare(b.name));

        sorted.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = `${countryFlag(c.code)} ${c.name}`;
            countrySelect.appendChild(opt);
        });
    } catch {
        // Fallback: manual list of key countries
        const fallback = [
            { code: 'KR', name: '한국' },
            { code: 'US', name: 'United States' },
            { code: 'JP', name: 'Japan' },
            { code: 'CN', name: 'China' },
            { code: 'GB', name: 'United Kingdom' },
            { code: 'DE', name: 'Germany' },
            { code: 'FR', name: 'France' },
            { code: 'BR', name: 'Brazil' },
            { code: 'IN', name: 'India' },
            { code: 'AU', name: 'Australia' },
        ];
        fallback.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = `${countryFlag(c.code)} ${c.name}`;
            countrySelect.appendChild(opt);
        });
    }
}

// ─── Validate Form ────────────────────────────────────────────
function validateForm() {
    const hasCountry = countrySelect.value !== '';
    const hasNickname = nicknameInput.value.trim().length >= 1;
    startBtn.disabled = !(hasCountry && hasNickname);
}
countrySelect.addEventListener('change', validateForm);
nicknameInput.addEventListener('input', validateForm);

// ─── Start Button → App Entry ─────────────────────────────────
startBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim() || 'Anonymous';
    const country = countrySelect.value;
    setUser(nickname, country);
    showApp();
});

// ─── Show Main App ────────────────────────────────────────────
function showApp() {
    splashScreen.classList.remove('active');
    onboardScreen.classList.remove('active');
    appScreen.classList.add('active');

    const { nickname, country } = getUser();
    userBadge.textContent = `${countryFlag(country)} ${nickname}`;

    // Boot the worldcup engine
    initWorldcup();
}

// ─── Tab Navigation ───────────────────────────────────────────
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');

        // Lazy-load hall of fame
        if (btn.dataset.tab === 'tab-hall') {
            loadHallOfFame();
        }

        // Lazy-load keyword board
        if (btn.dataset.tab === 'tab-board') {
            import('./worldcup.js').then(module => {
                const activeKw = module.activeKeyword;
                import('./review.js').then(reviewModule => {
                    if (activeKw) {
                        reviewModule.loadKeywordBoard(activeKw.id, activeKw.keyword_name);
                    } else {
                        document.getElementById('board-list').innerHTML = '<p style="color:var(--text-muted);text-align:center;">토론할 키워드를 먼저 월드컵 탭에서 선택해주세요.</p>';
                    }
                });
            });
        }
    });
});

navHall.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="tab-hall"]').classList.add('active');
    document.getElementById('tab-hall').classList.add('active');
    loadHallOfFame();
});
