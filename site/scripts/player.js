const $ = id => document.getElementById(id);
const player = $('music-player');
const audio = $('audio');
const orb = $('music-orb');
const handle = $('music-drag');
const tracks = [{ url: audio.getAttribute('src'), title: 'summer playlist', artist: 'Corn Wave' }];
const volumeCeiling = .28;
let trackIndex = 0;
let compact = false, collapsed = false, position = null, drag = null, moved = false;
let morph, fadeVersion = 0, progressFrame = 0;

const formatTime = value => {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

function audioState() {
  $('music-play').innerHTML = `<img src="assets/icons/${audio.paused ? 'play' : 'pause'}.svg" alt="">`;
  $('music-play').title = audio.paused ? '播放' : '暂停';
  $('music-play').setAttribute('aria-label', audio.paused ? '播放音乐' : '暂停音乐');
  player.classList.toggle('playing', !audio.paused && !audio.ended);
}

async function play(autoplay = false) {
  try { await audio.play();$('music-status').textContent = '正在播放'; }
  catch { $('music-status').textContent = autoplay ? '浏览器阻止了自动播放，点击播放按钮即可开始。' : '暂时无法播放，请重试或更换音频。'; }
  audioState();
}

function selectTrack(index) {
  trackIndex = (index + tracks.length) % tracks.length;
  const track = tracks[trackIndex];
  audio.pause();audio.src = track.url;
  $('choose-music').textContent = track.title;
  $('music-artist').textContent = track.artist;
  $('choose-music').title = `${track.title} · 添加本地歌曲`;
  $('music-seek').value = 0;player.style.setProperty('--seek', '0%');$('music-seek').disabled = true;$('music-time').textContent = '00:00 / 00:00';
  play();
}

function volumeState() {
  const muted = audio.muted || audio.volume === 0;
  $('music-mute').innerHTML = `<img src="assets/icons/${muted ? 'volume-x' : 'volume-2'}.svg" alt="">`;
  $('music-mute').setAttribute('aria-label', muted ? '取消静音' : '静音');
  $('music-mute').title = muted ? '取消静音' : '静音';
  $('music-volume').value = audio.muted ? 0 : audio.volume / volumeCeiling;
  $('music-volume').setAttribute('aria-valuetext', `${Math.round(Number($('music-volume').value) * 100)}%`);
}

function renderPlaybackProgress() {
  $('music-time').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
  $('music-seek').value = progress;
  player.style.setProperty('--seek', `${progress}%`);
}

function animatePlaybackProgress() {
  cancelAnimationFrame(progressFrame);
  const tick = () => {
    renderPlaybackProgress();
    if (!audio.paused && !audio.ended) progressFrame = requestAnimationFrame(tick);
  };
  tick();
}

function animateChange(change) {
  const version = ++fadeVersion;
  morph?.cancel();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { change();return; }
  morph = player.animate([{opacity:1},{opacity:0}], {duration:140,fill:'forwards'});
  morph.finished.then(() => {
    if (version !== fadeVersion) return;
    change();morph.cancel();
    morph = player.animate([{opacity:0},{opacity:1}], {duration:220,easing:'ease-out'});
  }).catch(() => {});
}

function place(x, y) {
  const rect = player.getBoundingClientRect();
  position = { x: Math.max(8, Math.min(x, document.documentElement.clientWidth - rect.width - 8)), y: Math.max(8, Math.min(y, innerHeight - rect.height - 8)) };
  player.style.left = `${position.x}px`;player.style.top = `${position.y}px`;
  player.style.right = 'auto';player.style.bottom = 'auto';
}

export function setCompactMode(value) {
  if (value === compact) return;
  const enteringContent = value && !compact;
  compact = value;
  if (enteringContent) collapsed = true;
  animateChange(() => {
    player.classList.toggle('compact', compact);
    player.classList.toggle('collapsed', compact && collapsed);
    orb.setAttribute('aria-expanded', String(compact && !collapsed));
    if (compact && position) place(position.x, position.y);
    else { player.style.left = '';player.style.top = '';player.style.right = '';player.style.bottom = ''; }
  });
}

function collapse(value) {
  collapsed = value;
  animateChange(() => {
    player.classList.toggle('collapsed', value);
    orb.setAttribute('aria-expanded', String(!value));
    if (position) place(position.x, position.y);
    (value ? orb : $('music-collapse')).focus({ preventScroll: true });
  });
}

$('choose-music').onclick = () => $('music-file').click();
$('music-play').onclick = () => {
  if (!audio.src) { $('music-file').click();return; }
  if (audio.paused) play();else audio.pause();
};
$('music-file').onchange = event => {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const first = tracks.length;
  tracks.push(...files.map(file => ({url: URL.createObjectURL(file), title: file.name.replace(/\.[^.]+$/, ''), artist: '本地音乐'})));
  selectTrack(first);event.target.value = '';
};
$('music-prev').onclick = () => selectTrack(trackIndex - 1);
$('music-next').onclick = () => selectTrack(trackIndex + 1);
$('music-mute').onclick = () => { if (!audio.volume) audio.volume = .14;else audio.muted = !audio.muted;volumeState(); };
$('music-volume').oninput = event => { audio.volume = Number(event.target.value) * volumeCeiling;audio.muted = false;volumeState(); };
$('music-seek').oninput = event => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(event.target.value) / 100 * audio.duration;renderPlaybackProgress(); } };
$('music-collapse').onclick = () => collapse(true);
orb.onclick = () => { if (!moved) collapse(false);moved = false; };

audio.addEventListener('ended', () => {
  if (tracks.length > 1) selectTrack(trackIndex + 1);
  else { audio.currentTime = 0;play(); }
});
audio.addEventListener('loadedmetadata', () => {
  $('music-seek').disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
  renderPlaybackProgress();
});
audio.addEventListener('timeupdate', renderPlaybackProgress);
for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, () => { audioState();animatePlaybackProgress(); });
audio.addEventListener('error', () => { $('choose-music').textContent = '无法播放，点此更换音乐';$('music-status').textContent = '音频格式不受支持或文件无法读取。';$('music-seek').disabled = true;audioState(); });

for (const control of [handle, orb]) {
  control.addEventListener('pointerdown', event => {
    if (!compact || event.button !== 0) return;
    morph?.finish();
    const rect = player.getBoundingClientRect();
    moved = false;drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    control.setPointerCapture(event.pointerId);
  });
  control.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;player.classList.add('dragging');place(drag.left + dx, drag.top + dy);
  });
  const end = () => { drag = null;player.classList.remove('dragging'); };
  control.addEventListener('pointerup', end);
  control.addEventListener('pointercancel', end);
  control.addEventListener('lostpointercapture', end);
  control.addEventListener('keydown', event => {
    if (!compact) return;
    const delta = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] }[event.key];
    if (!delta) { moved = false;return; }
    event.preventDefault();const rect = player.getBoundingClientRect();place(rect.left + delta[0], rect.top + delta[1]);
  });
}

window.addEventListener('resize', () => { if (compact && position) place(position.x, position.y); });
audio.volume = volumeCeiling * .5;
volumeState();audioState();play(true);
