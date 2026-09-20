import { createKnifeViewer, destroyKnifeViewer, enterKnifeInspection, leaveKnifeInspection } from './model-viewer.js';

const dialog = document.getElementById('collection-overlay');
const inventoryView = document.getElementById('inventory-view');
const inspectionView = document.getElementById('inspection-view');
const loading = document.getElementById('inspection-loading');
const preview = document.getElementById('inspection-preview');
const back = document.getElementById('inspection-back');
const placeholder = document.getElementById('model-placeholder');
const inspectionName = dialog.querySelector('.inspection-name');
let inspecting = false;

function positionPreview() {
  if (!dialog.open) return;
  const rect = placeholder.getBoundingClientRect();
  const header = document.querySelector('.collection-header').getBoundingClientRect();
  dialog.style.setProperty('--preview-left', `${rect.left}px`);
  dialog.style.setProperty('--preview-top', `${rect.top + dialog.scrollTop}px`);
  dialog.style.setProperty('--preview-width', `${rect.width}px`);
  dialog.style.setProperty('--preview-height', `${rect.height}px`);
  dialog.style.setProperty('--header-height', `${header.height}px`);
}
new ResizeObserver(positionPreview).observe(placeholder);

function openCollection() {
  if (!dialog.open) dialog.showModal();
  inventoryView.hidden = false;
  inspectionView.hidden = false;
  inspecting = false;
  inspectionName.setAttribute('aria-hidden', 'true');
  dialog.classList.remove('is-inspecting');
  inventoryView.inert = false;
  back.hidden = true;
  preview.hidden = false;
  positionPreview();
  loading.hidden = false;
  loading.textContent = '读取藏品…';
  createKnifeViewer(inspectionView, document.getElementById('knife-canvas'), loading).catch(error => {
    console.error(error);
    loading.hidden = false;
    loading.textContent = '模型暂时无法读取。';
  });
  document.body.classList.add('collection-open');
  document.getElementById('collection-close').focus({ preventScroll: true });
}

function closeCollection() {
  destroyKnifeViewer();
  if (dialog.open) dialog.close();
  document.body.classList.remove('collection-open');
  document.getElementById('camp-crate-button').focus({ preventScroll: true });
}

function inspectKnife() {
  if (inspecting || !enterKnifeInspection()) return;
  dialog.scrollTop = 0;
  positionPreview();
  inspecting = true;
  inspectionName.setAttribute('aria-hidden', 'false');
  dialog.classList.add('is-inspecting');
  inventoryView.inert = true;
  preview.hidden = true;
  back.hidden = false;
  back.focus({ preventScroll: true });
}

function leaveInspection() {
  inspecting = false;
  inspectionName.setAttribute('aria-hidden', 'true');
  dialog.classList.remove('is-inspecting');
  inventoryView.inert = false;
  preview.hidden = false;
  back.hidden = true;
  leaveKnifeInspection();
  preview.focus({ preventScroll: true });
}

document.getElementById('camp-crate-button').addEventListener('click', openCollection);
document.getElementById('collection-close').addEventListener('click', closeCollection);
document.getElementById('inspect-knife').addEventListener('click', event => event.currentTarget.setAttribute('aria-pressed', 'true'));
preview.addEventListener('click', inspectKnife);
back.addEventListener('click', leaveInspection);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (inspecting) leaveInspection();else closeCollection();
});
dialog.addEventListener('contextmenu', event => {
  if (!inspecting) return;
  event.preventDefault();
  leaveInspection();
});
dialog.addEventListener('close', () => { destroyKnifeViewer();document.body.classList.remove('collection-open'); });
window.addEventListener('hashchange', () => { if (dialog.open) closeCollection(); });
