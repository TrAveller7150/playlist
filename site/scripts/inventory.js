const dialog = document.getElementById('collection-overlay');
const inventoryView = document.getElementById('inventory-view');
const inspectionView = document.getElementById('inspection-view');
const loading = document.getElementById('inspection-loading');
const canvas = document.getElementById('knife-canvas');
let viewer = null;
let viewerRequest = 0;
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
  createViewer().catch(error => {
    console.error(error);
    loading.hidden = false;
    loading.textContent = '模型暂时无法读取。';
  });
  document.body.classList.add('collection-open');
  document.getElementById('collection-close').focus({ preventScroll: true });
}

function closeCollection() {
  destroyViewer();
  if (dialog.open) dialog.close();
  document.body.classList.remove('collection-open');
  document.getElementById('camp-crate-button').focus({ preventScroll: true });
}

function inspectKnife() {
  if (!viewer || inspecting) return;
  dialog.scrollTop = 0;
  positionPreview();
  inspecting = true;
  inspectionName.setAttribute('aria-hidden', 'false');
  dialog.classList.add('is-inspecting');
  inventoryView.inert = true;
  preview.hidden = true;
  back.hidden = false;
  viewer.controls.enabled = true;
  viewer.finishReset();
  viewer.controls.noRotate = false;
  viewer.controls.noZoom = false;
  back.focus({ preventScroll: true });
}

function leaveInspection() {
  inspecting = false;
  inspectionName.setAttribute('aria-hidden', 'true');
  dialog.classList.remove('is-inspecting');
  inventoryView.inert = false;
  preview.hidden = false;
  back.hidden = true;
  if (viewer) {
    viewer.controls.enabled = false;
    viewer.resetPreview();
  }
  preview.focus({ preventScroll: true });
}

async function createViewer() {
  destroyViewer();
  const request = ++viewerRequest;
  const [THREE, loaderModule, controlsModule] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/controls/TrackballControls.js')
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

  const controls = new controlsModule.TrackballControls(camera, canvas);
  controls.enabled = inspecting;
  controls.rotateSpeed = 3.8;
  controls.zoomSpeed = 1;
  controls.noRotate = !inspecting;
  controls.noZoom = !inspecting;
  controls.noPan = true;
  controls.staticMoving = false;
  controls.dynamicDampingFactor = .2;
  controls.minDistance = 10;
  controls.maxDistance = 25;
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
  const previewRotation = -.18;
  model.rotation.y = previewRotation;
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
  let renderWidth = 0;
  let renderHeight = 0;
  const resize = () => {
    const rect = inspectionView.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (renderWidth === width && renderHeight === height) return;
    renderWidth = width;
    renderHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(32 * Math.PI / 360) / Math.min(camera.aspect, 1)));
    camera.updateProjectionMatrix();
    controls.handleResize();
  };
  let reset = null;
  const finishReset = () => {
    if (!reset) return;
    camera.position.copy(reset.to);
    camera.up.copy(reset.upTo);
    model.rotation.y = previewRotation;
    reset = null;
    controls.staticMoving = false;
    controls.update();
  };
  const resetPreview = () => {
    const from = camera.position.clone();
    const upFrom = camera.up.clone();
    const rotationFrom = model.rotation.y;
    controls.noRotate = true;
    controls.noZoom = true;
    controls.staticMoving = true;
    controls.update();
    controls.reset();
    const to = camera.position.clone();
    const upTo = camera.up.clone();
    const startPose = new THREE.Spherical().setFromVector3(from);
    const endPose = new THREE.Spherical().setFromVector3(to);
    endPose.theta = startPose.theta + Math.atan2(Math.sin(endPose.theta - startPose.theta), Math.cos(endPose.theta - startPose.theta));
    reset = { to, upFrom, upTo, rotationFrom, startPose, endPose, start: performance.now() };
    camera.position.copy(from);
    camera.up.copy(upFrom);
    model.rotation.y = rotationFrom;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishReset();
  };
  let lastTime = performance.now();
  const render = time => {
    // Resize and draw in the same frame: resizing clears the WebGL buffer.
    resize();
    if (reset) {
      const progress = Math.min((time - reset.start) / 750, 1);
      const eased = 1 - (1 - progress) ** 3;
      camera.position.setFromSphericalCoords(
        THREE.MathUtils.lerp(reset.startPose.radius, reset.endPose.radius, eased),
        THREE.MathUtils.lerp(reset.startPose.phi, reset.endPose.phi, eased),
        THREE.MathUtils.lerp(reset.startPose.theta, reset.endPose.theta, eased)
      );
      camera.up.lerpVectors(reset.upFrom, reset.upTo, eased).normalize();
      model.rotation.y = THREE.MathUtils.lerp(reset.rotationFrom, previewRotation, eased);
      if (progress === 1) finishReset();
    }
    const delta = Math.min((time - lastTime) / 1000, .05);
    if (!inspecting && !reset && !matchMedia('(prefers-reduced-motion: reduce)').matches) model.rotation.y += delta * .34;
    controls.update();
    lastTime = time;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
    if (viewer) viewer.frame = frame;
  };
  viewer = { renderer, scene, controls, frame, resetPreview, finishReset };
  render(lastTime);
}

function destroyViewer() {
  viewerRequest++;
  if (!viewer) return;
  cancelAnimationFrame(viewer.frame);
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
document.getElementById('inspect-knife').addEventListener('click', () => {
  document.getElementById('inspect-knife').setAttribute('aria-pressed', 'true');
});
preview.addEventListener('click', inspectKnife);
document.getElementById('inspection-back').addEventListener('click', leaveInspection);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (inspecting) leaveInspection();else closeCollection();
});
dialog.addEventListener('contextmenu', event => {
  if (!inspecting) return;
  event.preventDefault();
  leaveInspection();
});
dialog.addEventListener('close', () => { destroyViewer();document.body.classList.remove('collection-open'); });
window.addEventListener('hashchange', () => { if (dialog.open) closeCollection(); });
