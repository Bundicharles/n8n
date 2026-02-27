import { 
  fetchPostBySlug, 
  formatDate, 
  FALLBACK_IMAGE, 
  fetchPostLikes, 
  likePost, 
  fetchComments, 
  addComment, 
  addReply 
} from './supabase.js';

/* ─────────────────────────────────────────────
   ELEMENTS
───────────────────────────────────────────── */

const skeletonEl  = document.getElementById('post-skeleton');
const contentEl   = document.getElementById('post-content');
const errorEl     = document.getElementById('error-state');
const errorMsgEl  = document.getElementById('error-message');

const titleEl     = document.getElementById('post-title');
const dateEl      = document.getElementById('post-date');
const readTimeEl  = document.getElementById('post-read-time');
const imageEl     = document.getElementById('post-image');
const bodyEl      = document.getElementById('post-body');

const likeBtn     = document.getElementById('like-btn');
const likeCountEl = document.getElementById('like-count');

const commentBtn       = document.getElementById('comment-btn');
const commentCountEl   = document.getElementById('comment-count');
const commentForm      = document.getElementById('comment-form');
const commentsList     = document.getElementById('comments-list');

const shareBtn   = document.getElementById('share-btn');

/* ───────────────────────────────────────────── */

let postId;
let userHasLiked = false;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
}

function estimateReadTime(html) {
  const text  = html.replace(/<[^>]*>/g, ' ');
  const words = text.trim().split(/\s+/).length;
  const mins  = Math.max(1, Math.round(words / 220));
  return `${mins} min read`;
}

function sanitiseHtml(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('script, iframe, object, embed, form')
    .forEach(el => el.remove());

  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    });
  });

  return doc.body.innerHTML;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

/* ─────────────────────────────────────────────
   SEO
───────────────────────────────────────────── */

function injectSeoMeta(post) {
  const siteBase = window.location.origin;
  const postUrl  = `${siteBase}/post.html?slug=${encodeURIComponent(post.slug)}`;
  const ogImage  = post.featured_image || FALLBACK_IMAGE;
  const metaDesc = post.seo_description || post.excerpt || '';
  const metaTitle = post.seo_title || post.title || 'The Brief';

  document.title = `${metaTitle} — The Brief`;

  const setMeta = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', value);
  };

  setMeta('meta[name="description"]', metaDesc);
  setMeta('meta[property="og:title"]', metaTitle);
  setMeta('meta[property="og:description"]', metaDesc);
  setMeta('meta[property="og:image"]', ogImage);
  setMeta('meta[property="og:url"]', postUrl);
  setMeta('meta[name="twitter:title"]', metaTitle);
  setMeta('meta[name="twitter:description"]', metaDesc);
  setMeta('meta[name="twitter:image"]', ogImage);

  const canonical = document.getElementById('canonical-link');
  if (canonical) canonical.setAttribute('href', postUrl);
}

/* ─────────────────────────────────────────────
   RENDER POST
───────────────────────────────────────────── */

function renderPost(post) {
  const formattedDate = formatDate(post.created_at);

  dateEl.textContent  = formattedDate;
  dateEl.setAttribute('datetime', post.created_at);
  readTimeEl.textContent = estimateReadTime(post.content || '');
  titleEl.textContent = post.title;

  const imgSrc  = post.featured_image || FALLBACK_IMAGE;
  imageEl.src   = imgSrc;
  imageEl.alt   = post.title;
  imageEl.onerror = () => imageEl.src = FALLBACK_IMAGE;

  bodyEl.innerHTML = sanitiseHtml(post.content || '<p>No content available.</p>');

  injectSeoMeta(post);

  skeletonEl.hidden = true;
  contentEl.hidden  = false;
}

/* ─────────────────────────────────────────────
   INTERACTIONS
───────────────────────────────────────────── */

async function loadInteractions(post_id) {
  const likes = await fetchPostLikes(post_id);
  const comments = await fetchComments(post_id);

  likeCountEl.textContent = likes.length;
  commentCountEl.textContent = comments.length;

  userHasLiked = !!localStorage.getItem(`liked_post_${post_id}`);
  updateLikeUI();

  renderComments(comments);
}

/* ─────────────────────────────────────────────
   LIKE SYSTEM (Facebook Style)
───────────────────────────────────────────── */

function updateLikeUI() {
  if (userHasLiked) {
    likeBtn.classList.add('liked');
  } else {
    likeBtn.classList.remove('liked');
  }
}

/* ─────────────────────────────────────────────
   COMMENTS + REPLIES
───────────────────────────────────────────── */

function renderComments(comments) {
  commentsList.innerHTML = '';

  comments.forEach(c => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';

    const repliesHtml = (c.comment_replies || [])
      .map(r => `
        <div class="reply">
          <strong>${escapeHtml(r.user_name)}</strong>:
          ${escapeHtml(r.content)}
        </div>
      `).join('');

    commentEl.innerHTML = `
      <div class="comment-main">
        <p>
          <strong>${escapeHtml(c.user_name)}</strong>
          <small>${new Date(c.created_at).toLocaleString()}</small>
        </p>
        <p>${escapeHtml(c.content)}</p>
      </div>

      <div class="replies">
        ${repliesHtml}

        <form class="reply-form" data-comment-id="${c.id}">
          <input type="text" placeholder="Your Name" required>
          <input type="text" placeholder="Reply..." required>
          <button type="submit">Reply</button>
        </form>
      </div>
    `;

    commentsList.appendChild(commentEl);
  });

  commentsList.querySelectorAll('.reply-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const commentId = form.dataset.commentId;
      const userName = form.children[0].value.trim();
      const content  = form.children[1].value.trim();

      if (!userName || !content) return;

      await addReply(commentId, userName, content);
      await loadInteractions(postId);
    });
  });
}

/* ─────────────────────────────────────────────
   SHARE SYSTEM
───────────────────────────────────────────── */

async function handleShare() {
  const shareData = {
    title: document.title,
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {}
  } else {
    await navigator.clipboard.writeText(shareData.url);
    showToast('Link copied to clipboard!');
  }
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.remove(), 3000);
}

/* ─────────────────────────────────────────────
   ERROR
───────────────────────────────────────────── */

function showError(message) {
  skeletonEl.hidden = true;
  errorMsgEl.textContent = message;
  errorEl.hidden = false;
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

async function init() {
  const slug = getSlugFromUrl();

  if (!slug) {
    showError('No article slug was provided.');
    return;
  }

  try {
    const post = await fetchPostBySlug(decodeURIComponent(slug));
    postId = post.id;

    renderPost(post);
    await loadInteractions(postId);

    // LIKE BUTTON
    likeBtn.addEventListener('click', async () => {
      if (userHasLiked) {
        localStorage.removeItem(`liked_post_${postId}`);
        userHasLiked = false;
        likeCountEl.textContent =
          parseInt(likeCountEl.textContent) - 1;
      } else {
        await likePost(postId);
        localStorage.setItem(`liked_post_${postId}`, 'true');
        userHasLiked = true;
        likeCountEl.textContent =
          parseInt(likeCountEl.textContent) + 1;
      }
      updateLikeUI();
    });

    // COMMENT BUTTON SCROLL
    commentBtn?.addEventListener('click', () => {
      document.getElementById('comment-content')
        .scrollIntoView({ behavior: 'smooth' });
    });

    // SHARE
    shareBtn?.addEventListener('click', handleShare);

    // NEW COMMENT
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const userName = document
        .getElementById('commenter-name').value.trim();
      const content  = document
        .getElementById('comment-content').value.trim();

      if (!userName || !content) return;

      await addComment(postId, userName, content);
      commentForm.reset();
      await loadInteractions(postId);
    });

  } catch (err) {
    console.error(err);
    showError('Could not load this article.');
  }
}

document.addEventListener('DOMContentLoaded', init);