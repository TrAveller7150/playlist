import { setCompactMode } from './player.js';

const hero = document.getElementById('hero');
const cover = document.querySelector('.cover-shell');
const returnIndicator = document.getElementById('return-progress');
let contentMode = false, returnDistance = 0, touchY = null;
const transitionDistance = () => Math.max(1, cover.offsetHeight);

function resetReturn() {
  returnDistance = 0;returnIndicator.hidden = true;
  returnIndicator.style.setProperty('--return-angle', '0deg');
  returnIndicator.setAttribute('aria-valuenow', '0');
}

function returnGesture(delta, event) {
  if (!contentMode || document.body.classList.contains('reading')) return;
  const boundary = transitionDistance();
  if (delta >= 0) { resetReturn();return; }
  if (scrollY + delta > boundary + 1) return;
  event.preventDefault();
  const remaining = Math.max(0, scrollY - boundary);
  if (remaining > 0) scrollTo({top:boundary,behavior:'instant'});
  returnDistance += Math.max(0, -delta - remaining);
  const progress = Math.min(1, returnDistance / Math.max(1,boundary));
  returnIndicator.hidden = false;
  returnIndicator.style.setProperty('--return-angle', `${progress * 360}deg`);
  returnIndicator.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  if (progress >= 1) {
    resetReturn();scrollTo({top:0,behavior:'instant'});updateScene();
  }
}

function updateScene() {
  const reading = document.body.classList.contains('reading');
  const rect = cover.getBoundingClientRect();
  const hold = transitionDistance();
  const progress = Math.max(0, Math.min(1, -rect.top / hold));
  hero.style.setProperty('--cover-progress', progress);
  const next = reading || (contentMode ? scrollY > 1 : rect.bottom <= 1);
  if (!reading && next && scrollY < hold && scrollY > 1) scrollTo({top:hold,behavior:'instant'});
  if (reading || !next || scrollY > hold + 1) resetReturn();
  document.body.classList.toggle('cover-mode', !next);
  hero.inert = next;
  for (const section of document.querySelectorAll('#home-view > section')) section.inert = !next;
  if (next === contentMode) return;
  contentMode = next;
  setCompactMode(next);
}

let pending = false;
function scheduleScene() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false;updateScene(); });
}

window.addEventListener('wheel', event => {
  if (event.ctrlKey || event.target.closest('input, .music-player')) return;
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  returnGesture(event.deltaY * scale, event);
}, {passive:false});
window.addEventListener('touchstart', event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; }, {passive:true});
window.addEventListener('touchmove', event => {
  if (touchY === null || event.touches.length !== 1 || event.target.closest('input, .music-player')) return;
  const y = event.touches[0].clientY;returnGesture(touchY - y,event);touchY = y;
}, {passive:false});
window.addEventListener('touchend', () => { touchY = null; }, {passive:true});
window.addEventListener('keydown', event => {
  if (event.target.closest('input, button, textarea, [contenteditable]')) return;
  const delta = {ArrowUp:-40,PageUp:-innerHeight*.8,Home:-innerHeight}[event.key];
  if (delta) returnGesture(delta,event);
});
window.addEventListener('scroll', scheduleScene, { passive: true });
window.addEventListener('hashchange', () => { resetReturn();scheduleScene(); });
window.addEventListener('load', scheduleScene);
window.addEventListener('resize', updateScene);
updateScene();
