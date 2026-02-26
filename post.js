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

const commentForm = document.getElementById('comment-form');
const commentsList = document.getElementById('comments-list');

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
  doc.querySelectorAll('script, iframe, object, embed, form').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

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

  setMeta('meta[name="description"]',        metaDesc);
  setMeta('meta[property="og:title"]',       metaTitle);
  setMeta('meta[property="og:description"]', metaDesc);
  setMeta('meta[property="og:image"]',       ogImage);
  setMeta('meta[property="og:url"]',         postUrl);
  setMeta('meta[name="twitter:title"]',      metaTitle);
  setMeta('meta[name="twitter:description"]',metaDesc);
  setMeta('meta[name="twitter:image"]',      ogImage);

  const canonical = document.getElementById('canonical-link');
  if (canonical) canonical.setAttribute('href', postUrl);
}

function renderPost(post) {
  const formattedDate = formatDate(post.created_at);

  dateEl.textContent  = formattedDate;
  dateEl.setAttribute('datetime', post.created_at);
  readTimeEl.textContent = estimateReadTime(post.content || '');
  titleEl.textContent = post.title;

  const imgSrc  = post.featured_image || FALLBACK_IMAGE;
  imageEl.src   = imgSrc;
  imageEl.alt   = post.title;
  imageEl.onerror = () => { imageEl.src = FALLBACK_IMAGE; };

  bodyEl.innerHTML = sanitiseHtml(post.content || '<p>No content available.</p>');

  injectSeoMeta(post);

  skeletonEl.hidden = true;
  contentEl.hidden  = false;
}

function showError(message) {
  skeletonEl.hidden = true;
  if (errorMsgEl) errorMsgEl.textContent = message;
  errorEl.hidden = false;
}

async function loadInteractions(post_id) {
  const likes = await fetchPostLikes(post_id);
  likeCountEl.textContent = likes.length;

  const comments = await fetchComments(post_id);
  renderComments(comments);
}

function renderComments(comments) {
  commentsList.innerHTML = '';
  comments.forEach(c => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.innerHTML = `
      <p><strong>${c.user_name}</strong> (${new Date(c.created_at).toLocaleString()})</p>
      <p>${c.content}</p>
      <div class="replies">
        ${c.comment_replies.map(r => `<p><strong>${r.user_name}</strong>: ${r.content}</p>`).join('')}
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

let postId;

async function init() {
  const slug = getSlugFromUrl();

  if (!slug) {
    showError('No article slug was provided. Please navigate from the homepage.');
    return;
  }

  try {
    const post = await fetchPostBySlug(decodeURIComponent(slug));
    postId = post.id;
    renderPost(post);
    await loadInteractions(postId);

    likeBtn.addEventListener('click', async () => {
      await likePost(postId);
      await loadInteractions(postId);
    });

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userName = document.getElementById('commenter-name').value.trim();
      const content  = document.getElementById('comment-content').value.trim();
      if (!userName || !content) return;
      await addComment(postId, userName, content);
      commentForm.reset();
      await loadInteractions(postId);
    });

  } catch (err) {
    console.error('[Blog] Failed to load post:', err);
    if (err?.code === 'PGRST116' || err?.message?.includes('no rows')) {
      showError('This article doesn\'t exist or has been unpublished.');
    } else {
      showError('Could not load this article. Please try again later.');
    }
  }
}

document.addEventListener('DOMContentLoaded', init);