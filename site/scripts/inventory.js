const dialog = document.getElementById('collection-overlay');
const inventoryView = document.getElementById('inventory-view');
const inspectionView = document.getElementById('inspection-view');
const loading = document.getElementById('inspection-loading');
const canvas = document.getElementById('knife-canvas');
let viewer = null;
let viewerRequest = 0;

function openCollection() {
  if (!dialog.open) dialog.showModal();
  inventoryView.hidden = false;
  inspectionView.hidden = true;
  document.body.classList.add('collection-open');
  document.getElementById('collection-close').focus({ preventScroll: true });
}

function closeCollection() {
  destroyViewer();
  if (dialog.open) dialog.close();
  document.body.classList.remove('collection-open');
  document.getElementById('camp-crate-button').focus({ preventScroll: true });
}

async function inspectKnife() {
  inventoryView.hidden = true;
  inspectionView.hidden = false;
  loading.hidden = false;
  loading.textContent = '读取藏品…';
  document.getElementById('inspection-back').focus({ preventScroll: true });
  try { await createViewer(); }
  catch (error) {
    console.error(error);
    loading.hidden = false;
    loading.textContent = '模型暂时无法读取。';
  }
}

function leaveInspection() {
  destroyViewer();
  inspectionView.hidden = true;
  inventoryView.hidden = false;
  document.getElementById('inspect-knife').focus({ preventScroll: true });
}

async function createViewer() {
  destroyViewer();
  const request = ++viewerRequest;
  const [THREE, loaderModule, controlsModule] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/controls/OrbitControls.js')
  ]);
  if (request !== viewerRequest || inspectionView.hidden || !dialog.open) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1) * .72);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, .25, 16.5);
  scene.add(new THREE.HemisphereLight(0xfff5df, 0x515b51, 2.2));
  const key = new THREE.DirectionalLight(0xffe7c2, 3.3);
  key.position.set(-5, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdceaff, 2.2);
  rim.position.set(6, 2, -5);
  scene.add(rim);

  const controls = new controlsModule.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 25;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = .65;
  controls.target.set(0, 0, 0);

  const gltf = await new loaderModule.GLTFLoader().loadAsync('media/inventory/stiletto-damascus.glb');
  if (request !== viewerRequest || inspectionView.hidden || !dialog.open) {
    renderer.dispose();controls.dispose();
    return;
  }
  const model = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const scale = 9.2 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  model.rotation.y = -.18;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material?.map) continue;
      material.map.magFilter = THREE.NearestFilter;
      material.map.minFilter = THREE.NearestMipmapNearestFilter;
      material.map.needsUpdate = true;
    }
  });
  scene.add(model);
  loading.hidden = true;

  let frame = 0;
  const resize = () => {
    const rect = inspectionView.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(inspectionView);
  resize();
  const render = () => {
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  render();
  viewer = { renderer, scene, controls, observer, frame };
}

function destroyViewer() {
  viewerRequest++;
  if (!viewer) return;
  cancelAnimationFrame(viewer.frame);
  viewer.observer.disconnect();
  viewer.controls.dispose();
  viewer.scene.traverse(object => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material?.map?.dispose();material?.dispose();
    }
  });
  viewer.renderer.dispose();
  viewer = null;
}

document.getElementById('camp-crate-button').addEventListener('click', openCollection);
document.getElementById('collection-close').addEventListener('click', closeCollection);
document.getElementById('inspect-knife').addEventListener('click', inspectKnife);
document.getElementById('inspection-back').addEventListener('click', leaveInspection);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (!inspectionView.hidden) leaveInspection();else closeCollection();
});
dialog.addEventListener('close', () => { destroyViewer();document.body.classList.remove('collection-open'); });
window.addEventListener('hashchange', () => { if (dialog.open) closeCollection(); });
