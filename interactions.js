const player = document.getElementById('music-player');
const hero = document.getElementById('hero');
const cover = document.querySelector('.cover-shell');
const audio = document.getElementById('audio');
const orb = document.getElementById('music-orb');
const handle = document.getElementById('music-drag');
let compact = false, collapsed = false, position = null, drag = null, moved = false;
let morph;
let fadeVersion = 0;
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
function updateScene() {
  const reading = document.body.classList.contains('reading');
  const rect = cover.getBoundingClientRect();
  const hold = Math.max(1, cover.offsetHeight);
  const progress = Math.max(0, Math.min(1, -rect.top / hold));
  hero.style.setProperty('--cover-progress', progress);
  // Keep the content pinned at its top until the reverse threshold is crossed.
  const next = reading || (compact ? scrollY > 1 : rect.bottom <= 1);
  document.body.style.setProperty('--return-offset', `${!reading && next ? Math.max(0, hold - scrollY) : 0}px`);
  document.body.classList.toggle('cover-mode', !next);
  hero.inert = next;
  for (const section of document.querySelectorAll('#home-view > section, .site-footer')) section.inert = !next;
  if (next === compact) return;
  compact = next;
  animateChange(() => {
  player.classList.toggle('compact', compact);
  player.classList.toggle('collapsed', compact && collapsed);
  if (compact && position) place(position.x, position.y);
  else { player.style.left = '';player.style.top = '';player.style.right = '';player.style.bottom = ''; }
  });
}
let pending = false;
function scheduleScene() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false;updateScene(); });
}
window.addEventListener('scroll', scheduleScene, { passive: true });
window.addEventListener('hashchange', scheduleScene);
window.addEventListener('resize', () => { updateScene();if (compact && position) place(position.x, position.y); });
function collapse(value) {
  collapsed = value;
  animateChange(() => {
  player.classList.toggle('collapsed', value);
  orb.setAttribute('aria-expanded', String(!value));
  if (position) place(position.x, position.y);
  (value ? orb : document.getElementById('music-collapse')).focus({ preventScroll: true });
  });
}
document.getElementById('music-collapse').onclick = () => collapse(true);
orb.onclick = () => { if (!moved) collapse(false);moved = false; };
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
function playbackState() { player.classList.toggle('playing', !audio.paused && !audio.ended); }
for (const event of ['play','pause','ended']) audio.addEventListener(event, playbackState);
playbackState();updateScene();
