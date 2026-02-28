import { fetchPublishedPosts, formatDate, FALLBACK_IMAGE } from './supabase.js';

// ── DOM references ────────────────────────────────────────────────────────
const skeletonEl   = document.getElementById('skeleton-container');
const gridEl       = document.getElementById('posts-grid');
const errorEl      = document.getElementById('error-state');
const emptyEl      = document.getElementById('empty-state');
const postCountEl  = document.getElementById('post-count');

// ── Skeleton helpers ──────────────────────────────────────────────────────

/**
 * Render N skeleton card placeholders while data is loading.
 * @param {number} count
 */
function showSkeletons(count = 6) {
  skeletonEl.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skel skel-img"></div>
      <div class="skel-body">
        <div class="skel skel-date"></div>
        <div class="skel skel-title-1"></div>
        <div class="skel skel-title-2"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line"></div>
      </div>
    </div>
  `).join('');
}

function hideSkeletons() {
  skeletonEl.innerHTML = '';
  skeletonEl.hidden = true;
}

// ── Card renderer ─────────────────────────────────────────────────────────

/**
 * Build the HTML for a single post card.
 * @param {Object} post
 * @returns {string} HTML string
 */
function buildCard(post) {
  const image   = post.featured_image || FALLBACK_IMAGE;
  const date    = formatDate(post.created_at);
  const excerpt = post.excerpt || '';
  const title   = escapeHtml(post.title || 'Untitled');

  return `
    <article class="card" role="article">
      <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="card-image-wrap" tabindex="-1" aria-hidden="true">
        <img
          src="${image}"
          alt="${title}"
          loading="lazy"
          onerror="this.src='${FALLBACK_IMAGE}'"
        >
        <div class="card-image-overlay"></div>
      </a>

      <div class="card-body">
        <time class="card-date" datetime="${post.created_at}">${date}</time>
        <h2 class="card-title">
          <a href="post.html?slug=${encodeURIComponent(post.slug)}">${title}</a>
        </h2>
        <p class="card-excerpt">${escapeHtml(excerpt)}</p>
      </div>

      <div class="card-footer">
        <a
          href="post.html?slug=${encodeURIComponent(post.slug)}"
          class="btn-read"
          aria-label="Read more about ${title}"
        >
          Read Article
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
    </article>
  `;
}

// ── Safety utility ────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS in card metadata.
 * Post body HTML is rendered on the post page via innerHTML after DOMParser sanitisation.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}



function showError(message) {
  errorEl.querySelector('p').textContent = message;
  errorEl.hidden = false;
}

function renderPosts(posts) {
  if (posts.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  if (postCountEl) {
    postCountEl.textContent = `${posts.length} article${posts.length !== 1 ? 's' : ''}`;
  }

  gridEl.innerHTML = posts.map(buildCard).join('');
  gridEl.hidden = false;
}


async function init() {
  showSkeletons(6);

  try {
    const posts = await fetchPublishedPosts();
    hideSkeletons();
    renderPosts(posts);
  } catch (err) {
    hideSkeletons();
    console.error('[Blog] Failed to load posts:', err);
    showError(
      'Could not load posts. Please check your Supabase configuration or try again later.'
    );
  }
}
const colors = [
    "#1100ff",
    "#ff0000",
    "#33ff00",
    "#ff00b3",
    "#f1e6e6",
    "#00ffdd"
];

let colorIndex = 0;

function showTime() {
    const now = new Date();
    const el = document.getElementById('currentTime');

    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };

    // Update date + time (no GMT)
    el.innerHTML = now.toLocaleString(undefined, options);

    // Change color every second
    el.style.color = colors[colorIndex];
    el.style.textShadow = `0 0 10px ${colors[colorIndex]}`;

    colorIndex = (colorIndex + 1) % colors.length;
}

showTime();
setInterval(showTime, 1000);
document.addEventListener('DOMContentLoaded', init);
