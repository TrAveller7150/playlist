import { createModelViewer, destroyModelViewer, enterModelInspection, leaveModelInspection } from './model-viewer.js';

const items = {
  knife: {
    button: 'inspect-knife', id: 'ITEM 001', type: 'KNIFE / COVERT', selected: 'SELECTED / 01',
    name: '短剑 <i>|</i> 大马士革钢', inspectionName: '短剑（★） | 大马士革钢',
    inspectionId: 'ITEM 001 / STILETTO', caption: '“你给予的闪亮故事”', factLabel: '入藏', fact: '2025.3.24',
    description: ['一把久经沙场的意大利折叠刀，出刃时清脆的响声以及轻盈的手感使其得到了主人的青睐。铭牌上的内容出自动画《摇曳百合》第三季第12话的片尾曲きみがくれたシャイニーストーリー（你给予的闪亮故事）。', '终于，有这么一件无坚不摧的利器能与你无坚不摧的意志相得益彰'],
    label: 'ITEM NAME', model: 'media/inventory/stiletto-damascus.glb', modelSize: 9.2, previewRotation: -.18
  },
  ghostpia: {
    button: 'inspect-ghostpia', id: 'ITEM 002', type: 'GAME / LIMITED EDITION', selected: 'SELECTED / 02',
    name: '游戏卡带套装', inspectionName: 'ghostpia实体版',
    inspectionId: 'ITEM 002 / GHOSTPIA', caption: 'Ghostpia | Season One NS实体版', factLabel: '入藏', fact: '2025.3.22',
    description: ['《Ghostpia Season One》的 Nintendo Switch 初回限定版，包括了插画集，试制剧本与游戏卡带。尽管没有Switch游戏机但还是大费周章地搞到了手，似乎这么做能让Season 2早点出', '我想有个梦，让我拥有可去之处。\n　　我想有个梦，让我不再自缚手足。'],
    label: 'ITEM NAME', model: 'media/inventory/ghostpia-limited.glb', modelSize: 8.4, previewRotation: -.32
  }
};

const dialog = document.getElementById('collection-overlay');
const inventoryView = document.getElementById('inventory-view');
const inspectionView = document.getElementById('inspection-view');
const loading = document.getElementById('inspection-loading');
const preview = document.getElementById('inspection-preview');
const back = document.getElementById('inspection-back');
const placeholder = document.getElementById('model-placeholder');
const inspectionName = dialog.querySelector('.inspection-name');
let inspecting = false;
let selectedItem = items.knife;

function renderItem(item) {
  selectedItem = item;
  for (const candidate of Object.values(items)) {
    document.getElementById(candidate.button).setAttribute('aria-pressed', String(candidate === item));
  }
  document.getElementById('inventory-item-id').textContent = item.id;
  document.getElementById('inventory-item-type').textContent = item.type;
  document.getElementById('inventory-item-label').textContent = item.label;
  document.getElementById('inventory-item-name').innerHTML = item.name;
  document.getElementById('inventory-item-caption').textContent = item.caption;
  document.getElementById('inventory-item-caption').hidden = !item.caption;
  document.getElementById('inventory-item-description').replaceChildren(...item.description.map(text => {
    const paragraph = document.createElement('p');paragraph.textContent = text;return paragraph;
  }));
  document.getElementById('inventory-item-fact-label').textContent = item.factLabel;
  document.getElementById('inventory-item-fact').textContent = item.fact;
  document.getElementById('inventory-selected').textContent = item.selected;
  document.getElementById('inspection-item-id').textContent = item.inspectionId;
  document.getElementById('inspection-item-name').textContent = item.inspectionName;
  document.getElementById('inspection-item-caption').textContent = item.caption;
  document.getElementById('inspection-item-caption').hidden = !item.caption;
  preview.setAttribute('aria-label', `详细检视${item.inspectionName}`);
  document.getElementById('collection-canvas').setAttribute('aria-label', `${item.inspectionName}三维模型`);
}

function loadSelectedModel() {
  loading.hidden = false;
  loading.textContent = '读取藏品…';
  return createModelViewer(inspectionView, document.getElementById('collection-canvas'), loading, selectedItem).catch(error => {
    console.error(error);
    loading.hidden = false;
    loading.textContent = '模型暂时无法读取。';
  });
}

function selectItem(item) {
  if (item === selectedItem || inspecting) return;
  renderItem(item);
  if (dialog.open) loadSelectedModel();
}

renderItem(selectedItem);

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
  loadSelectedModel();
  document.body.classList.add('collection-open');
  document.getElementById('collection-close').focus({ preventScroll: true });
}

function closeCollection() {
  destroyModelViewer();
  if (dialog.open) dialog.close();
  document.body.classList.remove('collection-open');
  document.getElementById('camp-crate-button').focus({ preventScroll: true });
}

function requestCloseCollection() {
  if (!dialog.open || dialog.classList.contains('is-closing')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    closeCollection();
    return;
  }
  dialog.classList.add('is-closing');
  dialog.addEventListener('animationend', event => {
    if (event.target !== dialog) return;
    dialog.classList.remove('is-closing');
    closeCollection();
  }, { once: true });
}

function inspectItem() {
  if (inspecting || !enterModelInspection()) return;
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
  leaveModelInspection();
  preview.focus({ preventScroll: true });
}

document.getElementById('camp-crate-button').addEventListener('click', openCollection);
document.getElementById('collection-close').addEventListener('click', requestCloseCollection);
document.getElementById('inspect-knife').addEventListener('click', () => selectItem(items.knife));
document.getElementById('inspect-ghostpia').addEventListener('click', () => selectItem(items.ghostpia));
preview.addEventListener('click', inspectItem);
back.addEventListener('click', leaveInspection);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (inspecting) leaveInspection();else requestCloseCollection();
});
dialog.addEventListener('contextmenu', event => {
  if (!inspecting) return;
  event.preventDefault();
  leaveInspection();
});
dialog.addEventListener('close', () => { destroyModelViewer();document.body.classList.remove('collection-open'); });
window.addEventListener('hashchange', () => { if (dialog.open) requestCloseCollection(); });
