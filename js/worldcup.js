/* ============================================================
   worldcup.js – 16-Round Tournament Engine
   Dynamic Pool, Supabase Integration, Battle Animations
   ============================================================ */
import { supabase, getUser, countryFlag, showToast, POOL_SIZE, ROUND_MAP } from './config.js';
import { showWinnerModal } from './review.js';

// ─── State ────────────────────────────────────────────────────
let keywords = [];
export let activeKeyword = null;
let imagePool = [];
let matchups = [];
let currentMatch = 0;
let currentRound = POOL_SIZE;   // 16 → 8 → 4 → 2
let winners = [];
let isAnimating = false;

// ─── DOM Refs ─────────────────────────────────────────────────
const keywordList = document.getElementById('keyword-list');
const arena = document.getElementById('arena');
const emptyState = document.getElementById('empty-state');
const roundBadge = document.getElementById('round-badge');
const imgLeft = document.getElementById('img-left');
const imgRight = document.getElementById('img-right');
const flagLeft = document.getElementById('flag-left');
const flagRight = document.getElementById('flag-right');
const nameLeft = document.getElementById('name-left');
const nameRight = document.getElementById('name-right');
const contLeft = document.getElementById('contender-left');
const contRight = document.getElementById('contender-right');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const uploadBtn = document.getElementById('upload-btn');
const uploadModal = document.getElementById('upload-modal');
const uploadPreview = document.getElementById('upload-preview');
const uploadDrop = document.getElementById('upload-dropzone');
const uploadInputM = document.getElementById('upload-input-modal');
const confirmUpload = document.getElementById('confirm-upload-btn');
const cancelUpload = document.getElementById('cancel-upload-btn');

// ─── Initialise ───────────────────────────────────────────────
export async function initWorldcup() {
    await loadKeywords();
    bindUploadEvents();
}

// ─── Load Keywords ────────────────────────────────────────────
async function loadKeywords() {
    const { country } = getUser();

    // Fetch country-specific + global keywords
    const { data, error } = await supabase
        .from('keywords')
        .select('*')
        .or(`country_code.eq.${country},is_global.eq.true`)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Keywords fetch error:', error);
        showToast('키워드를 불러올 수 없습니다');
        return;
    }

    keywords = data || [];

    if (keywords.length === 0) {
        arena.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    arena.classList.remove('hidden');
    emptyState.classList.add('hidden');
    renderKeywordChips();
    selectKeyword(keywords[0]);
}

// ─── Render Keyword Chips ─────────────────────────────────────
function renderKeywordChips() {
    keywordList.innerHTML = '';
    keywords.forEach((kw, i) => {
        const chip = document.createElement('button');
        chip.className = `keyword-chip${i === 0 ? ' active' : ''}`;
        chip.textContent = `${countryFlag(kw.country_code)} ${kw.keyword_name}`;
        chip.addEventListener('click', () => {
            document.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectKeyword(kw);
        });
        keywordList.appendChild(chip);
    });
}

// ─── Select Keyword & Start Tournament ────────────────────────
async function selectKeyword(kw) {
    activeKeyword = kw;
    await loadImagePool();
}

// ─── Load Image Pool from Supabase ────────────────────────────
async function loadImagePool() {
    const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('keyword_id', activeKeyword.id)
        .limit(100);

    if (error) {
        console.error('Images fetch error:', error);
        showToast('이미지를 불러올 수 없습니다');
        return;
    }

    imagePool = data || [];

    if (imagePool.length < 2) {
        showToast('이미지가 부족합니다 (최소 2장 필요)');
        return;
    }

    startTournament();
}

// ─── Fisher-Yates Shuffle ─────────────────────────────────────
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Start Tournament ─────────────────────────────────────────
function startTournament() {
    // Pick up to POOL_SIZE images (or fewer if pool is smaller)
    const shuffled = shuffle(imagePool);
    const poolCount = Math.min(POOL_SIZE, shuffled.length);
    // Round down to nearest power of 2
    const roundSize = nearestPow2(poolCount);
    const selected = shuffled.slice(0, roundSize);

    currentRound = roundSize;
    winners = [];
    matchups = pairUp(selected);
    currentMatch = 0;

    updateRoundBadge();
    renderMatch();
}

function nearestPow2(n) {
    let p = 1;
    while (p * 2 <= n) p *= 2;
    return p;
}

function pairUp(arr) {
    const pairs = [];
    for (let i = 0; i < arr.length; i += 2) {
        pairs.push([arr[i], arr[i + 1]]);
    }
    return pairs;
}

// ─── Render Current Match ─────────────────────────────────────
function renderMatch() {
    if (currentMatch >= matchups.length) {
        advanceRound();
        return;
    }

    const [left, right] = matchups[currentMatch];

    // Reset classes
    contLeft.className = 'contender';
    contRight.className = 'contender';

    // Set images
    imgLeft.src = left.image_url;
    imgRight.src = right.image_url;

    // Set info
    flagLeft.textContent = countryFlag(left.uploader_country);
    flagRight.textContent = countryFlag(right.uploader_country);
    nameLeft.textContent = left.uploader_nickname;
    nameRight.textContent = right.uploader_nickname;

    // Progress
    const total = matchups.length;
    progressFill.style.width = `${((currentMatch) / total) * 100}%`;
    progressText.textContent = `${currentMatch + 1} / ${total}`;
}

// ─── Click Handlers ───────────────────────────────────────────
contLeft.addEventListener('click', () => pickWinner('left'));
contRight.addEventListener('click', () => pickWinner('right'));

function pickWinner(side) {
    if (isAnimating) return;
    isAnimating = true;

    const [left, right] = matchups[currentMatch];
    const winner = side === 'left' ? left : right;
    const winEl = side === 'left' ? contLeft : contRight;
    const loseEl = side === 'left' ? contRight : contLeft;

    // Animate
    winEl.classList.add('winner-flash');
    loseEl.classList.add('loser-fade');

    winners.push(winner);
    currentMatch++;

    setTimeout(() => {
        isAnimating = false;
        renderMatch();
    }, 600);
}

// ─── Advance Round ────────────────────────────────────────────
function advanceRound() {
    if (winners.length === 1) {
        // 🏆 CHAMPION!
        handleChampion(winners[0]);
        return;
    }

    // Next round
    currentRound = winners.length;
    matchups = pairUp(winners);
    winners = [];
    currentMatch = 0;

    updateRoundBadge();
    renderMatch();
}

function updateRoundBadge() {
    roundBadge.textContent = ROUND_MAP[currentRound] || `${currentRound}강`;
}

// ─── Champion Handler ─────────────────────────────────────────
async function handleChampion(image) {
    // Increment win_count in DB
    const newWins = (image.win_count || 0) + 1;
    await supabase
        .from('images')
        .update({ win_count: newWins })
        .eq('id', image.id);

    image.win_count = newWins;

    // Show winner modal with review section
    showWinnerModal(image, activeKeyword);
    showToast('🏆 우승자 탄생!');
}

// ─── Restart (called from review.js after modal close) ────────
export function restartTournament() {
    startTournament();
}

// ─── Upload System ────────────────────────────────────────────
let pendingFile = null;

function bindUploadEvents() {
    uploadBtn.addEventListener('click', () => {
        if (!activeKeyword) {
            showToast('먼저 키워드를 선택하세요');
            return;
        }
        uploadModal.classList.remove('hidden');
        resetUploadUI();
    });

    cancelUpload.addEventListener('click', () => {
        uploadModal.classList.add('hidden');
        resetUploadUI();
    });

    uploadDrop.addEventListener('click', () => uploadInputM.click());

    uploadInputM.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        pendingFile = file;
        const url = URL.createObjectURL(file);
        uploadPreview.src = url;
        uploadPreview.classList.remove('hidden');
        uploadDrop.classList.add('hidden');
        confirmUpload.disabled = false;
    });

    confirmUpload.addEventListener('click', handleUpload);
}

function resetUploadUI() {
    pendingFile = null;
    uploadPreview.src = '';
    uploadPreview.classList.add('hidden');
    uploadDrop.classList.remove('hidden');
    confirmUpload.disabled = true;
    uploadInputM.value = '';
}

async function handleUpload() {
    if (!pendingFile || !activeKeyword) return;

    confirmUpload.disabled = true;
    confirmUpload.textContent = '업로드 중...';

    const { nickname, country } = getUser();
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${pendingFile.name.split('.').pop()}`;

    try {
        // 1. Upload to Supabase Storage
        const { data: storageData, error: storageErr } = await supabase
            .storage
            .from('user-uploads')
            .upload(filename, pendingFile, {
                cacheControl: '3600',
                upsert: false,
            });

        if (storageErr) throw storageErr;

        // 2. Get public URL
        const { data: urlData } = supabase
            .storage
            .from('user-uploads')
            .getPublicUrl(filename);

        const publicUrl = urlData.publicUrl;

        // 3. Insert into images table
        const { error: insertErr } = await supabase
            .from('images')
            .insert({
                keyword_id: activeKeyword.id,
                image_url: publicUrl,
                uploader_nickname: nickname,
                uploader_country: country,
            });

        if (insertErr) throw insertErr;

        showToast('🔥 이미지가 월드컵 풀에 참전했습니다!');
        uploadModal.classList.add('hidden');
        resetUploadUI();

        // Refresh pool so it's available in next tournament
        const newImg = {
            id: Date.now(),
            keyword_id: activeKeyword.id,
            image_url: publicUrl,
            uploader_nickname: nickname,
            uploader_country: country,
            win_count: 0,
        };
        imagePool.push(newImg);

    } catch (err) {
        console.error('Upload error:', err);
        showToast('업로드 실패 – 다시 시도해주세요');
    } finally {
        confirmUpload.textContent = '업로드';
        confirmUpload.disabled = false;
    }
}
