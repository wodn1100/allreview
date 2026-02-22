/* ============================================================
   review.js – Winner Modal, Review System, Hall of Fame
   Custom reactions: 🌶️ 팩트폭행, 🥤 사이다, 🤬 개빡침
   ============================================================ */
import { supabase, countryFlag, showToast, getUser } from './config.js';
import { restartTournament } from './worldcup.js';

// ─── DOM Refs ─────────────────────────────────────────────────
const modal = document.getElementById('winner-modal');
const winnerImg = document.getElementById('winner-img');
const winBadge = document.getElementById('win-badge');
const winnerUploader = document.getElementById('winner-uploader');
const reviewInput = document.getElementById('review-input');
const submitReview = document.getElementById('submit-review-btn');
const reviewList = document.getElementById('review-list');
const closeModal = document.getElementById('close-modal-btn');
const confettiEl = document.getElementById('confetti');
const hallList = document.getElementById('hall-list');

let currentWinnerImage = null;

// ─── Show Winner Modal ────────────────────────────────────────
export function showWinnerModal(image, keyword) {
    currentWinnerImage = image;

    // Populate
    winnerImg.src = image.image_url;
    winnerUploader.textContent = `${countryFlag(image.uploader_country)} ${image.uploader_nickname}`;

    // Win badge
    const wins = image.win_count || 1;
    if (wins >= 5) {
        winBadge.textContent = `👑 x${wins}`;
        winBadge.style.display = 'block';
    } else if (wins >= 2) {
        winBadge.textContent = `👑 x${wins}`;
        winBadge.style.display = 'block';
    } else {
        winBadge.style.display = 'none';
    }

    // Load existing reviews
    loadReviews(image.id);

    // Fire confetti
    spawnConfetti();

    // Show modal
    modal.classList.remove('hidden');
    reviewInput.value = '';
}

// ─── Submit Review ────────────────────────────────────────────
submitReview.addEventListener('click', async () => {
    const content = reviewInput.value.trim();
    if (!content) {
        showToast('리뷰를 입력해주세요!');
        return;
    }
    if (!currentWinnerImage) return;

    const { nickname } = getUser();

    submitReview.disabled = true;
    submitReview.textContent = '등록 중...';

    const { error } = await supabase
        .from('reviews')
        .insert({
            image_id: currentWinnerImage.id,
            nickname: nickname,
            content: content,
        });

    if (error) {
        console.error('Review insert error:', error);
        showToast('리뷰 등록 실패');
    } else {
        showToast('🌶️ 리뷰가 등록되었습니다!');
        reviewInput.value = '';
        loadReviews(currentWinnerImage.id);
    }

    submitReview.disabled = false;
    submitReview.textContent = '리뷰 남기기';
});

// ─── Load Reviews for an Image ────────────────────────────────
async function loadReviews(imageId) {
    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('image_id', imageId)
        .order('spicy_votes', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Reviews fetch error:', error);
        return;
    }

    renderReviews(data || []);
}

// ─── Render Review Cards ──────────────────────────────────────
function renderReviews(reviews) {
    reviewList.innerHTML = '';

    if (reviews.length === 0) {
        reviewList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem;">아직 리뷰가 없습니다. 첫 번째 팩트폭행을 남겨주세요! 🌶️</p>';
        return;
    }

    reviews.forEach((rev, i) => {
        const card = document.createElement('div');
        card.className = `review-card${i < 3 ? ' best' : ''}`;

        const bestLabel = i < 3 ? `<span style="color:var(--accent-gold);font-weight:700;font-size:0.7rem;">🏅 BEST #${i + 1}</span>` : '';

        card.innerHTML = `
      ${bestLabel}
      <p class="review-text">${escapeHtml(rev.content)}</p>
      <p class="review-meta">${rev.nickname || 'Anonymous'} · ${timeAgo(rev.created_at)}</p>
      <div class="reaction-bar">
        <button class="reaction-btn spicy" data-type="spicy_votes" data-id="${rev.id}">
          🌶️ ${rev.spicy_votes || 0}
        </button>
        <button class="reaction-btn cider" data-type="cider_votes" data-id="${rev.id}">
          🥤 ${rev.cider_votes || 0}
        </button>
        <button class="reaction-btn angry" data-type="angry_votes" data-id="${rev.id}">
          🤬 ${rev.angry_votes || 0}
        </button>
      </div>
    `;
        reviewList.appendChild(card);
    });

    // Bind reaction clicks
    reviewList.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReaction(btn));
    });
}

// ─── Handle Reaction Vote ─────────────────────────────────────
async function handleReaction(btn) {
    const reviewId = parseInt(btn.dataset.id);
    const voteType = btn.dataset.type; // spicy_votes, cider_votes, angry_votes

    // Check if already voted (simple localStorage throttle)
    const key = `voted_${reviewId}_${voteType}`;
    if (localStorage.getItem(key)) {
        showToast('이미 투표했습니다!');
        return;
    }

    // Fetch current count then increment (RPC would be ideal, but simple approach)
    const { data: current, error: fetchErr } = await supabase
        .from('reviews')
        .select(voteType)
        .eq('id', reviewId)
        .single();

    if (fetchErr) return;

    const newCount = (current[voteType] || 0) + 1;

    const { error } = await supabase
        .from('reviews')
        .update({ [voteType]: newCount })
        .eq('id', reviewId);

    if (!error) {
        localStorage.setItem(key, '1');
        // Update button text
        const emoji = voteType === 'spicy_votes' ? '🌶️' : voteType === 'cider_votes' ? '🥤' : '🤬';
        btn.textContent = `${emoji} ${newCount}`;
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => btn.style.transform = '', 200);
    }
}

// ─── Close Modal → Restart ────────────────────────────────────
closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
    currentWinnerImage = null;
    restartTournament();
});

// ─── Hall of Fame ─────────────────────────────────────────────
export async function loadHallOfFame() {
    hallList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">로딩 중...</p>';

    const { data, error } = await supabase
        .from('images')
        .select('*, keywords(keyword_name)')
        .gt('win_count', 0)
        .order('win_count', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Hall of fame error:', error);
        hallList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">로딩 실패</p>';
        return;
    }

    if (!data || data.length === 0) {
        hallList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">아직 우승 기록이 없습니다. 첫 월드컵을 플레이하세요! 🏆</p>';
        return;
    }

    hallList.innerHTML = '';
    data.forEach(img => {
        const wins = img.win_count || 0;
        let badge = '';
        if (wins >= 10) badge = '👑👑👑';
        else if (wins >= 5) badge = '👑👑';
        else if (wins >= 2) badge = '👑';

        const card = document.createElement('div');
        card.className = 'hall-card';
        card.innerHTML = `
      <img src="${img.image_url}" alt="Champion" class="hall-thumb" loading="lazy" />
      <div class="hall-info">
        <p class="hall-keyword">${img.keywords?.keyword_name || '???'}</p>
        <p class="hall-uploader">${countryFlag(img.uploader_country)} ${img.uploader_nickname}</p>
        <p class="hall-wins">${badge} ${wins}회 우승</p>
      </div>
    `;
        hallList.appendChild(card);
    });
}

// ─── Confetti (Pure CSS/JS) ───────────────────────────────────
function spawnConfetti() {
    confettiEl.innerHTML = '';
    const colors = ['#ff4d4d', '#ffd700', '#00e5ff', '#a855f7', '#22c55e', '#ff8c00'];
    for (let i = 0; i < 40; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.setProperty('--x', `${(Math.random() - 0.5) * 300}px`);
        piece.style.left = `${Math.random() * 100 - 50}px`;
        piece.style.animationDelay = `${Math.random() * 0.4}s`;
        piece.style.animationDuration = `${1 + Math.random() * 1}s`;
        confettiEl.appendChild(piece);
    }
}

// ─── Utility ──────────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    return `${days}일 전`;
}
