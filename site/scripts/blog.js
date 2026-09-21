import { about, notes, posts } from '../data/content.js';

const $ = id => document.getElementById(id);
let homeScroll = 0, wasInnerPage = false;
history.scrollRestoration = 'manual';
$('archive-year').textContent = new Date().getFullYear();
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const readingTime = post => Math.max(1, Math.ceil(post.body.replace(/<[^>]*>/g, '').length / 350));
const meta = post => `<span class="category">${escapeHtml(post.category)}</span><time datetime="${post.date.replaceAll('.', '-')}">${escapeHtml(post.date)}</time><span>${readingTime(post)} 分钟</span>`;
const coverImage = (post, className) => post.cover ? `<div class="${className}"><img src="${escapeHtml(post.cover.src)}" alt="${escapeHtml(post.cover.alt)}" style="object-position:${escapeHtml(post.cover.position)}"></div>` : '';
const excerpt = (post, className = '') => post.excerpt ? `<p${className ? ` class="${className}"` : ''}>${escapeHtml(post.excerpt)}</p>` : '';

function renderContent() {
  const issueDate = notes[0]?.date || about.date;
  $('issue-number').textContent = `ISSUE ${issueDate.slice(0, 7)}`;
  $('featured-post').href = '#about-me';
  $('featured-post').innerHTML = `${about.cover ? `<img class="featured-image" src="${escapeHtml(about.cover.src)}" alt="" style="object-position:${escapeHtml(about.cover.position)}">` : ''}<span class="featured-number">ABOUT</span><div><div class="featured-meta"><span>PERMANENT NOTE</span><span>${readingTime(about)} MIN</span></div><h3>${escapeHtml(about.title)}</h3>${excerpt(about)}<span class="featured-link">继续阅读 ↗</span></div>`;
  $('note-list').innerHTML = notes.slice(0, 4).map(note => `<article class="note-item"><time datetime="${note.date.replaceAll('.', '-')}T${note.time}">${note.date.slice(5)}</time><div><p>${note.html}</p><span>${escapeHtml(note.time)} · ${escapeHtml(note.context)}</span></div></article>`).join('');
  $('article-list').innerHTML = `<div class="article-track-head" aria-hidden="true"><span>#</span><span>文章</span><span>分类</span><span>日期</span><span>时长</span><span></span></div>${posts.map((post, index) => `<a class="article-track" href="#post/${post.slug}"><span class="article-number">${String(index + 1).padStart(2, '0')}</span><div class="article-track-copy"><h3>${escapeHtml(post.title)}</h3>${excerpt(post)}</div><div class="article-track-details"><span>${escapeHtml(post.category)}</span><time datetime="${post.date.replaceAll('.', '-')}">${escapeHtml(post.date)}</time><span>${readingTime(post)} MIN</span></div><span class="post-arrow" aria-hidden="true">↗</span></a>`).join('')}`;
  $('archive-note-count').textContent = `${String(notes.length).padStart(2, '0')} NOTES`;
  $('archive-article-count').textContent = `${String(posts.length).padStart(2, '0')} ESSAYS`;
  $('archive-note-list').innerHTML = notes.map(note => `<article><time datetime="${note.date.replaceAll('.', '-')}T${note.time}">${note.date} · ${note.time}</time><p>${note.html}</p><span>${escapeHtml(note.context)}</span></article>`).join('');
  $('archive-article-list').innerHTML = posts.map((post, index) => `<a href="#post/${post.slug}"><span>${String(index + 1).padStart(2, '0')}</span><div><div class="post-meta">${meta(post)}</div><h3>${escapeHtml(post.title)}</h3>${excerpt(post)}</div><span class="post-arrow" aria-hidden="true">↗</span></a>`).join('');
}

function route() {
  const hash = location.hash.slice(1);
  const aboutReading = hash === 'about-me';
  const reading = aboutReading || hash.startsWith('post/');
  const notesArchive = hash === 'notes';
  const articleArchive = hash === 'archive';
  const innerPage = reading || notesArchive || articleArchive;
  if (innerPage && !wasInnerPage) homeScroll = scrollY;
  document.body.classList.toggle('reading', innerPage);
  document.body.classList.toggle('archive-page', notesArchive || articleArchive);
  $('home-view').hidden = innerPage;
  $('article-view').hidden = !reading;
  $('notes-view').hidden = !notesArchive;
  $('archive-view').hidden = !articleArchive;
  if (reading) {
    const post = aboutReading ? about : posts.find(item => `post/${item.slug}` === hash);
    if (post) {
      const next = !aboutReading && posts.length > 1 ? posts[(posts.indexOf(post) + 1) % posts.length] : null;
      document.title = `${post.title} · TrAveller7150's Playlist`;
      $('article-content').innerHTML = `<header class="article-header"><div class="post-meta">${meta(post)}<span>${aboutReading ? '固定文章' : '长文章'}</span></div><h1 tabindex="-1">${escapeHtml(post.title)}</h1>${excerpt(post, 'article-deck')}</header>${aboutReading ? coverImage(post, 'article-cover') : ''}<div class="article-body">${post.body}</div>`;
      $('next-post').hidden = !next;
      if (aboutReading) {
        $('article-back').href = '#journal';
        $('article-back').textContent = '← 返回主页（内容区）';
      } else if (next) {
        $('next-post').href = `#post/${next.slug}`;
        $('next-post').innerHTML = `<span>下一篇 / KEEP WANDERING</span>${escapeHtml(next.title)} ↗`;
      }
    } else {
      document.title = "手记未找到 · TrAveller7150's Playlist";
      $('article-content').innerHTML = '<div class="not-found"><h1 tabindex="-1">这一页，还没有写下。</h1><p>回到手记，看看别的故事吧。</p></div>';
      $('next-post').hidden = true;
    }
    scrollTo({ top: 0, behavior: 'instant' });
    $('article-content').querySelector('h1').focus({ preventScroll: true });
  } else if (notesArchive) {
    document.title = `碎碎念归档 · TrAveller7150's Playlist`;
    scrollTo({ top: 0, behavior: 'instant' });
  } else if (articleArchive) {
    document.title = `文章归档 · TrAveller7150's Playlist`;
    $('article-back').href = '#archive';
    $('article-back').textContent = '← 返回归档';
    scrollTo({ top: 0, behavior: 'instant' });
  } else {
    document.title = "TrAveller7150's Playlist";
    $('article-back').href = '#journal';
    $('article-back').textContent = '← 返回手记';
    if (wasInnerPage && (!hash || hash === 'journal')) scrollTo({ top: Math.max(homeScroll, $('journal').offsetTop), behavior: 'instant' });
    else if (!hash || hash === 'home') scrollTo({ top: 0, behavior: 'instant' });
    else if (['journal', 'articles', 'camp'].includes(hash)) scrollTo({top: $(hash).offsetTop, behavior: 'instant'});
  }
  wasInnerPage = innerPage;
  updateProgress();
}
function updateProgress() {
  if ($('article-view').hidden) return;
  const height = document.documentElement.scrollHeight - innerHeight;
  $('reading-progress').style.width = `${height > 0 ? Math.min(100, scrollY / height * 100) : 100}%`;
}
window.addEventListener('hashchange', route);
window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
renderContent();route();
