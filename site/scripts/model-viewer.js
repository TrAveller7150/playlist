let viewer = null;
let viewerRequest = 0;
let inspecting = false;

export async function createKnifeViewer(container, canvas, loading) {
  destroyKnifeViewer();
  const request = ++viewerRequest;
  const [THREE, loaderModule, controlsModule] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/controls/TrackballControls.js')
  ]);
  if (request !== viewerRequest) return;

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
  if (request !== viewerRequest) {
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

  let frame = 0, renderWidth = 0, renderHeight = 0, reset = null;
  const resize = () => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (renderWidth === width && renderHeight === height) return;
    renderWidth = width;renderHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(32 * Math.PI / 360) / Math.min(camera.aspect, 1)));
    camera.updateProjectionMatrix();
    controls.handleResize();
  };
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

export function enterKnifeInspection() {
  if (!viewer || inspecting) return false;
  inspecting = true;
  viewer.controls.enabled = true;
  viewer.finishReset();
  viewer.controls.noRotate = false;
  viewer.controls.noZoom = false;
  return true;
}

export function leaveKnifeInspection() {
  inspecting = false;
  if (!viewer) return;
  viewer.controls.enabled = false;
  viewer.resetPreview();
}

export function destroyKnifeViewer() {
  viewerRequest++;
  inspecting = false;
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
