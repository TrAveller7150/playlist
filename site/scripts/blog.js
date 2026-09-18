import { posts } from './posts.js';

const $ = id => document.getElementById(id);
let category = '全部', homeScroll = 0, wasReading = false;
history.scrollRestoration = 'manual';
$('year').textContent = new Date().getFullYear();
const readingTime = post => Math.max(1, Math.ceil(post.body.replace(/<[^>]*>/g, '').length / 350));
const meta = post => `<span class="category">${post.category}</span><time datetime="${post.date.replaceAll('.', '-')}">${post.date}</time><span>${readingTime(post)} 分钟</span>`;

function renderList() {
  const selected = posts.filter(post => category === '全部' || post.category === category);
  $('post-count').textContent = `${String(selected.length).padStart(2, '0')} 篇手记`;
  $('post-list').innerHTML = selected.map(post => `<a class="post-row" href="#post/${post.slug}"><span class="post-number">${String(posts.indexOf(post) + 1).padStart(2, '0')}</span><div><div class="post-meta">${meta(post)}</div><h3>${post.title}</h3><p>${post.excerpt}</p></div><span class="post-arrow" aria-hidden="true">↗</span></a>`).join('');
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', item === button));
  renderList();
}));

function route() {
  const hash = location.hash.slice(1);
  const reading = hash.startsWith('post/');
  if (reading && !wasReading) homeScroll = scrollY;
  document.body.classList.toggle('reading', reading);
  $('home-view').hidden = reading;
  $('article-view').hidden = !reading;
  if (reading) {
    const post = posts.find(item => `post/${item.slug}` === hash);
    if (post) {
      const next = posts[(posts.indexOf(post) + 1) % posts.length];
      document.title = `${post.title} · 日光之间`;
      $('article-content').innerHTML = `<header class="article-header"><div class="post-meta">${meta(post)}<span>示例手记</span></div><h1 tabindex="-1">${post.title}</h1><p class="article-deck">${post.excerpt}</p></header><div class="article-body">${post.body}</div>`;
      $('next-post').hidden = false;
      $('next-post').href = `#post/${next.slug}`;
      $('next-post').innerHTML = `<span>下一篇 / KEEP WANDERING</span>${next.title} ↗`;
    } else {
      document.title = '手记未找到 · 日光之间';
      $('article-content').innerHTML = '<div class="not-found"><h1 tabindex="-1">这一页，还没有写下。</h1><p>回到手记，看看别的故事吧。</p></div>';
      $('next-post').hidden = true;
    }
    scrollTo({ top: 0, behavior: 'instant' });
    $('article-content').querySelector('h1').focus({ preventScroll: true });
  } else {
    document.title = "TrAveller7150's Playlist";
    if (wasReading && (!hash || hash === 'journal')) scrollTo({ top: Math.max(homeScroll, $('journal').offsetTop), behavior: 'instant' });
    else if (!hash || hash === 'home') scrollTo({ top: 0, behavior: 'instant' });
    else if (['journal', 'moments', 'about'].includes(hash)) scrollTo({top: $(hash).offsetTop, behavior: 'instant'});
  }
  wasReading = reading;
  updateProgress();
}
function updateProgress() {
  if (!wasReading) return;
  const height = document.documentElement.scrollHeight - innerHeight;
  $('reading-progress').style.width = `${height > 0 ? Math.min(100, scrollY / height * 100) : 100}%`;
}
window.addEventListener('hashchange', route);
window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
renderList();route();

const audio = $('audio');
const tracks = [{ url: audio.getAttribute('src'), title: 'summer playlist', artist: 'Corn Wave' }];
let trackIndex = 0;
const formatTime = value => {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};
function audioState() {
  $('music-play').innerHTML = `<img src="assets/icons/${audio.paused ? 'play' : 'pause'}.svg" alt="">`;
  $('music-play').title = audio.paused ? '播放' : '暂停';
  $('music-play').setAttribute('aria-label', audio.paused ? '播放音乐' : '暂停音乐');
}
async function play(autoplay = false) {
  try { await audio.play();$('music-status').textContent = '正在播放'; }
  catch { $('music-status').textContent = autoplay ? '浏览器阻止了自动播放，点击播放按钮即可开始。' : '暂时无法播放，请重试或更换音频。'; }
  audioState();
}
$('choose-music').onclick = () => $('music-file').click();
$('music-play').onclick = () => {
  if (!audio.src) { $('music-file').click();return; }
  if (audio.paused) play();else audio.pause();
};
function selectTrack(index) {
  trackIndex = (index + tracks.length) % tracks.length;
  const track = tracks[trackIndex];
  audio.pause();audio.src = track.url;
  $('choose-music').textContent = track.title;
  $('music-artist').textContent = track.artist;
  $('choose-music').title = `${track.title} · 添加本地歌曲`;
  $('music-seek').value = 0;$('music-player').style.setProperty('--seek', '0%');$('music-seek').disabled = true;$('music-time').textContent = '00:00 / 00:00';
  play();
}
$('music-file').onchange = event => {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const first = tracks.length;
  tracks.push(...files.map(file => ({url: URL.createObjectURL(file), title: file.name.replace(/\.[^.]+$/, ''), artist: '本地音乐'})));
  selectTrack(first);event.target.value = '';
};
$('music-prev').onclick = () => selectTrack(trackIndex - 1);
$('music-next').onclick = () => selectTrack(trackIndex + 1);
audio.addEventListener('ended', () => { if (tracks.length > 1) selectTrack(trackIndex + 1); });
const volumeCeiling = .28;
audio.volume = volumeCeiling * .5;
function volumeState() {
  const muted = audio.muted || audio.volume === 0;
  $('music-mute').innerHTML = `<img src="assets/icons/${muted ? 'volume-x' : 'volume-2'}.svg" alt="">`;
  $('music-mute').setAttribute('aria-label', muted ? '取消静音' : '静音');
  $('music-mute').title = muted ? '取消静音' : '静音';
  $('music-volume').value = audio.muted ? 0 : audio.volume / volumeCeiling;
  $('music-volume').setAttribute('aria-valuetext', `${Math.round(Number($('music-volume').value) * 100)}%`);
}
$('music-mute').onclick = () => { if (!audio.volume) audio.volume = .14;else audio.muted = !audio.muted;volumeState(); };
$('music-volume').oninput = event => { audio.volume = Number(event.target.value) * volumeCeiling;audio.muted = false;volumeState(); };
volumeState();
audio.addEventListener('loadedmetadata', () => {
  $('music-seek').disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
  renderPlaybackProgress();
});
let progressFrame = 0;
function renderPlaybackProgress() {
  $('music-time').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
  $('music-seek').value = progress;
  $('music-player').style.setProperty('--seek', `${progress}%`);
}
function animatePlaybackProgress() {
  cancelAnimationFrame(progressFrame);
  const tick = () => {
    renderPlaybackProgress();
    if (!audio.paused && !audio.ended) progressFrame = requestAnimationFrame(tick);
  };
  tick();
}
audio.addEventListener('timeupdate', renderPlaybackProgress);
$('music-seek').oninput = event => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(event.target.value) / 100 * audio.duration;renderPlaybackProgress(); } };
for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, () => { audioState();animatePlaybackProgress(); });
audio.addEventListener('error', () => { $('choose-music').textContent = '无法播放，点此更换音乐';$('music-status').textContent = '音频格式不受支持或文件无法读取。';$('music-seek').disabled = true;audioState(); });
play(true);
