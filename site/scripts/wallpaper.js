const $ = id => document.getElementById(id);
const canvas = $('wallpaper');
const hero = $('hero');
const loader = $('cover-loader');
const loaderProgress = $('cover-loader-progress');
const loaderValue = $('cover-loader-value');
const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let visible = true, time = 0, last = 0;
let layers = [], sceneTarget, finalProgram, meshProgram, effectProgram, quad;
let frameFence = null, lastDraw = 0;
let titleTexture, titleQuad, titleSize = '';
let loadProgress = 0;

function updateLoadProgress(value) {
  loadProgress = Math.max(loadProgress, Math.min(1, value));
  const percent = Math.round(loadProgress * 100);
  loader.style.setProperty('--loader-progress', loadProgress);
  loaderProgress.setAttribute('aria-valuenow', String(percent));
  loaderValue.textContent = String(percent).padStart(2, '0');
}
const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function revealCover() {
  updateLoadProgress(1);
  document.body.classList.add('cover-ready');
  await waitForPaint();
  loader.classList.add('is-finished');
  loader.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-loading');
  window.dispatchEvent(new Event('cover-ready'));
}
async function loadFallback() {
  hero.classList.add('wallpaper-fallback');
  const image = new Image();
  image.src = 'media/sunflower.jpg';
  try { await image.decode(); } catch {}
}

function updateTitleTexture() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const size = `${w}:${h}`;
  if (size === titleSize) return;
  titleSize = size;
  const surface = document.createElement('canvas');surface.width = 2560;surface.height = 1440;
  const ctx = surface.getContext('2d');
  const scale = Math.max(w / 2560, h / 1440);
  ctx.setTransform(1 / scale, 0, 0, 1 / scale, (2560 - w / scale) / 2, (1440 - h / scale) / 2);
  const frame = canvas.getBoundingClientRect();
  ctx.textBaseline = 'alphabetic';
  for (const line of document.querySelectorAll('.hero-title span')) {
    const style = getComputedStyle(line), rect = line.getBoundingClientRect();
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = ctx.measureText(line.textContent);
    const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
    const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
    const baseline = (rect.height - ascent - descent) / 2 + ascent;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#111a0da6';ctx.shadowBlur = 16;ctx.shadowOffsetX = 2;ctx.shadowOffsetY = 7;
    ctx.fillText(line.textContent, rect.left - frame.left, rect.top - frame.top + baseline);
  }
  if (titleTexture) gl.deleteTexture(titleTexture);
  titleTexture = texture(2560,1440,surface);
}
function drawTitle() {
  gl.bindFramebuffer(gl.FRAMEBUFFER,sceneTarget.fbo);gl.viewport(0,0,2560,1440);
  gl.useProgram(meshProgram.p);gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  bindTexture(meshProgram,'source',titleTexture,0);draw(titleQuad);
}

const vertex = `#version 300 es
layout(location=0) in vec2 position; layout(location=1) in vec2 texcoord; out vec2 uv;
void main(){uv=texcoord;gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform sampler2D source, mask1, mask2;
uniform int kind; uniform float time, strength, speed, scale, phase, power, ratio, direction, perspective, aspect;
uniform vec2 bounds; uniform int sided; uniform bool hasMask, hasMask2;
vec2 rotate2(vec2 v,float a){return mat2(cos(a),sin(a),-sin(a),cos(a))*v;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1,0)),f.x),mix(hash(a+vec2(0,1)),hash(a+1.),f.x),f.y);}
void main(){
 vec2 p=uv;float mask=hasMask?texture(mask1,uv).r:1.;
 if(kind==1){
  vec2 weights=rotate2(vec2(1./(aspect*ratio),aspect*ratio),direction);
  vec2 params=rotate2(uv,direction);
  float ph=(noise(uv*scale*128.)*6.283185+params.x*10.+params.y*5.)*phase;
  vec4 s=sin(ph+speed*time*vec4(1.,-.16161616,.0083333,-.00019841));
  vec4 c=sin(.4+ph+speed*time*vec4(-.5,.041666666,-.001388889,.000024801587));
  s=pow(abs(s),vec4(power))*sign(s);c=pow(abs(c),vec4(power))*sign(c);
  p+=weights*vec2(dot(s,vec4(1)),dot(c,vec4(1)))*strength*strength*.005*mask;
 }else if(kind==2){
  vec2 d=rotate2(vec2(0.,1.),direction);float pos=abs(dot(uv-.5,d));
  p+=sin(time*speed+dot(uv,d)*(scale+perspective*pos))*vec2(d.y,-d.x)*(strength*strength+perspective*pos)*mask;
 }else if(kind==3){
  vec2 flow=(texture(mask1,uv).rg-vec2(.498))*2.;
  float offset=clamp((sin(time*speed+6.283185)*.498+.5-bounds.x)/(bounds.y-bounds.x),0.,1.);
  if(sided==0)offset=offset*2.-1.;if(sided==2)offset-=1.;
  p+=offset*strength*strength*flow;
  if(hasMask2){float m=texture(mask2,p).r;color=mix(texture(source,uv),texture(source,p),m);return;}
 }else if(kind==4){
  float t=time*speed, low=floor(t);
  vec2 a=sin(1.9*low)+sin(2.5*low+vec2(1,2));
  vec2 b=sin(1.9*(low+1.))+sin(2.5*(low+1.)+vec2(1,2));
  vec2 d=mix(a,b,smoothstep(.59,1.,cos(fract(t)*3.141593)*-.5+.5));
  d+=vec2(sin(t),cos(t))*.33;p+=d*.54*.001*mask;
 }
 color=texture(source,p);
 if(kind==5)color.a*=mask;
}`;
const finalFragment = `#version 300 es
precision highp float;
in vec2 uv;out vec4 color;uniform sampler2D source;uniform vec2 crop;uniform float time;uniform bool lighting;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=(uv-.5)*crop+.5;vec3 c=texture(source,p).rgb;
 if(lighting){
  vec2 d=p-vec2(1.06,1.13);float angle=atan(d.y,d.x);
  float rays=pow(max(0.,sin(angle*23.+sin(time*.13)*.4)),12.)*.035;
  rays+=pow(max(0.,sin(angle*47.-time*.045)),22.)*.018;
  c+=vec3(1.,.84,.43)*rays*smoothstep(1.6,.15,length(d));
  c+=(hash(gl_FragCoord.xy+mod(time,100.)*100.)-.5)*.012;
 }color=vec4(c,1.);}`;

function program(v, f) {
  const p = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, v], [gl.FRAGMENT_SHADER, f]]) {
    const s = gl.createShader(type);gl.shaderSource(s, source);gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return { p, uniforms: new Map() };
}
function uniform(p, name, value, type = '1f') {
  if (!p.uniforms.has(name)) p.uniforms.set(name, gl.getUniformLocation(p.p, name));
  const loc = p.uniforms.get(name);
  if (type === '2f') gl.uniform2f(loc, ...value);
  else if (type === '1i') gl.uniform1i(loc, value);
  else gl.uniform1f(loc, value);
}
function texture(width, height, image) {
  const t = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return t;
}
function target(w, h) {
  const tex = texture(w, h);const fbo = gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('无法建立渲染缓冲');
  return { tex, fbo, w, h };
}
function bindTexture(p, name, tex, unit) {gl.activeTexture(gl.TEXTURE0 + unit);gl.bindTexture(gl.TEXTURE_2D, tex);uniform(p, name, unit, '1i');}
function geometry(data, indices) {
  const vao = gl.createVertexArray();gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER, buffer);gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  for (const [name, offset] of [['position', 0], ['texcoord', 8]]) {
    const location = gl.getAttribLocation(meshProgram.p, name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset);
  }
  const ebo = gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  return { vao, buffer, data, count: indices.length };
}
const draw = geo => {gl.bindVertexArray(geo.vao);gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);};
const textures = new Map();
async function loadTexture(name) {
  if (!textures.has(name)) textures.set(name, (async () => {
    const img = new Image();img.src = `assets/textures/${name}.png`;await img.decode();
    return { tex: texture(img.width, img.height, img), w: img.width, h: img.height };
  })());
  return textures.get(name);
}
const jsonFiles = new Map();
function json(url) {
  if (!jsonFiles.has(url)) jsonFiles.set(url, fetch(url).then(response => {
    if (!response.ok) throw new Error(url);
    return response.json();
  }));
  return jsonFiles.get(url);
}
const vec = s => s.split(' ').map(Number);
const mul = (a, b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const inverse = a => {const d=a[0]*a[3]-a[1]*a[2];return [a[3]/d,-a[1]/d,-a[2]/d,a[0]/d,(a[2]*a[5]-a[3]*a[4])/d,(a[1]*a[4]-a[0]*a[5])/d];};
function skin(layer, t) {
  const m = layer.model, anim = m.animations[0];
  const frame = (t % anim.duration) / anim.duration * anim.frames;
  const i = Math.floor(frame), f = frame - i;
  const worlds = [], transforms = [];
  for (let b = 0; b < m.bones.length; b++) {
    const samples = anim.channels[b].samples;
    const a = samples[i], next = samples[Math.min(i+1, samples.length-1)];
    const s = a.map((v,k) => v+(next[k]-v)*f);
    const cos=Math.cos(s[5]),sin=Math.sin(s[5]);
    let local=[cos*s[6],sin*s[6],-sin*s[7],cos*s[7],s[0],s[1]];
    const parent=m.bones[b].parent;
    worlds[b]=parent<0?local:mul(worlds[parent],local);
    transforms[b]=mul(worlds[b],layer.inverseBind[b]);
  }
  const data=layer.geo.data;
  m.vertices.forEach((v,i) => {
    let x=0,y=0;const [px,py]=v.position;
    for(let k=0;k<4;k++){const w=v.weights[k];if(!w)continue;const a=transforms[v.bones[k]];x+=(a[0]*px+a[2]*py+a[4])*w;y+=(a[1]*px+a[3]*py+a[5])*w;}
    data[i*4]=(x+layer.origin[0])/1280-1;data[i*4+1]=(y+layer.origin[1])/720-1;
    data[i*4+2]=v.uv[0];data[i*4+3]=v.uv[1];
  });
  gl.bindBuffer(gl.ARRAY_BUFFER,layer.geo.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
}
async function loadLayer(object) {
  const model = await json(`assets/scene/${object.image}`);
  const material = await json(`assets/scene/${model.material}`);
  const effectRequests = (object.effects || []).map(async e => {
    const pass=e.passes[0];const name=e.file.split('/')[1];
    const [mask, mask2] = await Promise.all([
      pass.textures?.[1]?.startsWith('masks/') ? loadTexture(pass.textures[1]) : null,
      pass.textures?.[3]?.startsWith('masks/') ? loadTexture(pass.textures[3]) : null
    ]);
    return { name, values:pass.constantshadervalues||{}, combos:pass.combos||{}, mask, mask2 };
  });
  const [image, effects, puppet] = await Promise.all([
    loadTexture(material.passes[0].textures[0]),
    Promise.all(effectRequests),
    model.puppet ? json(`assets/models/${object.name}.json`) : null
  ]);
  const layer = { object, image, origin: vec(object.origin), effects };
  if (puppet) {
    layer.model=puppet;
    const worlds=[];
    layer.inverseBind=layer.model.bones.map((b,i)=>{const m=b.matrix;const a=[m[0],m[1],m[4],m[5],m[12],m[13]];worlds[i]=b.parent<0?a:mul(worlds[b.parent],a);return inverse(worlds[i]);});
    layer.geo=geometry(new Float32Array(layer.model.vertices.length*4),layer.model.indices);skin(layer,0);
  } else {
    const [w,h]=vec(object.size),[x,y]=layer.origin;
    layer.geo=geometry(new Float32Array([(x-w/2)/1280-1,(y+h/2)/720-1,0,0,(x+w/2)/1280-1,(y+h/2)/720-1,1,0,(x-w/2)/1280-1,(y-h/2)/720-1,0,1,(x+w/2)/1280-1,(y-h/2)/720-1,1,1]),[0,2,1,1,2,3]);
  }
  if(layer.effects.length)layer.targets=[target(image.w,image.h),target(image.w,image.h)];
  return layer;
}
function applyEffects(layer) {
  let source=layer.image.tex, index=0;
  for(const e of layer.effects){
    const dest=layer.targets[index++%2],p=effectProgram,v=e.values;
    gl.bindFramebuffer(gl.FRAMEBUFFER,dest.fbo);gl.viewport(0,0,dest.w,dest.h);gl.useProgram(p.p);gl.disable(gl.BLEND);
    bindTexture(p,'source',source,0);bindTexture(p,'mask1',e.mask?.tex||layer.image.tex,1);bindTexture(p,'mask2',e.mask2?.tex||layer.image.tex,2);
    uniform(p,'hasMask',!!e.mask,'1i');uniform(p,'hasMask2',!!e.mask2,'1i');
    uniform(p,'kind',({foliagesway:1,waterwaves:2,shake:3,iris:4,opacity:5})[e.name]||0,'1i');
    uniform(p,'time',time);uniform(p,'strength',v.strength??.4);uniform(p,'speed',v.speeduv??v.speed??5);uniform(p,'scale',typeof v.scale==='number'?v.scale:.05);uniform(p,'phase',v.phase??.5);uniform(p,'power',v.power??1);uniform(p,'ratio',v.ratio??.3);uniform(p,'direction',v.scrolldirection??v.direction??0);uniform(p,'perspective',v.perspective??0);uniform(p,'aspect',layer.image.w/layer.image.h);uniform(p,'bounds',vec(v.bounds||'0 1'),'2f');uniform(p,'sided',e.combos.DIRECTION??0,'1i');
    draw(quad);source=dest.tex;
  }
  return source;
}
function render() {
  const width=Math.round(canvas.clientWidth*devicePixelRatio),height=Math.round(canvas.clientHeight*devicePixelRatio);
  if(!width||!height)return;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const layeredTitle = canvas.clientWidth > 650;
  if(layeredTitle) updateTitleTexture();
  gl.bindFramebuffer(gl.FRAMEBUFFER,sceneTarget.fbo);gl.viewport(0,0,sceneTarget.w,sceneTarget.h);gl.clearColor(.1,.12,.08,1);gl.clear(gl.COLOR_BUFFER_BIT);
  for(const layer of layers){
    if(layeredTitle && layer.object.name === 'mam hoa 2') drawTitle();
    if(layer.model)skin(layer,time);
    const tex=applyEffects(layer);
    gl.bindFramebuffer(gl.FRAMEBUFFER,sceneTarget.fbo);gl.viewport(0,0,sceneTarget.w,sceneTarget.h);gl.useProgram(meshProgram.p);
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    bindTexture(meshProgram,'source',tex,0);draw(layer.geo);
  }
  gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.useProgram(finalProgram.p);
  const aspect=width/height,native=2560/1440;
  uniform(finalProgram,'crop',aspect>native?[1,native/aspect]:[aspect/native,1],'2f');uniform(finalProgram,'time',time);uniform(finalProgram,'lighting',true,'1i');bindTexture(finalProgram,'source',sceneTarget.tex,0);draw(quad);
}
function tick(now){
  if(!last)last=now;
  const elapsed=Math.min((now-last)/1000,.5);last=now;
  if(!reducedMotion.matches&&visible&&!document.hidden&&document.body.classList.contains('cover-mode')&&!document.body.classList.contains('reading')){
    time+=elapsed;
    const ready=!frameFence||gl.clientWaitSync(frameFence,0,0)!==gl.TIMEOUT_EXPIRED;
    if(ready&&now-lastDraw>=1000/30){
      if(frameFence)gl.deleteSync(frameFence);
      render();frameFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();lastDraw=now;
    }
  }
  requestAnimationFrame(tick);
}
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible&&layers.length&&reducedMotion.matches)render();},{threshold:0}).observe($('hero'));
window.addEventListener('resize',()=>{if(layers.length&&visible)render();});
document.addEventListener('visibilitychange',()=>{last=0;});
canvas.addEventListener('webglcontextlost',()=>{canvas.style.opacity='0';hero.classList.remove('title-composited');hero.classList.add('wallpaper-fallback');});

try{
  updateLoadProgress(.03);
  if(!gl)throw new Error('当前浏览器不支持 WebGL 2，请使用较新的浏览器。');
  meshProgram=program(vertex,`#version 300 es\nprecision highp float;in vec2 uv;out vec4 color;uniform sampler2D source;void main(){color=texture(source,uv);}`);
  effectProgram=program(vertex,fragment);finalProgram=program(vertex,finalFragment);
  quad=geometry(new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),[0,1,2,2,1,3]);
  titleQuad=geometry(new Float32Array([-1,-1,0,1,1,-1,1,1,-1,1,0,0,1,1,1,0]),[0,1,2,2,1,3]);
  sceneTarget=target(2560,1440);
  const scene=await json('assets/scene/scene.json');
  updateLoadProgress(.12);
  const objects=scene.objects.filter(o=>o.image&&o.origin);
  let loaded=0;
  layers=await Promise.all(objects.map(async object=>{
    const layer=await loadLayer(object);
    updateLoadProgress(.12+(++loaded/objects.length)*.74);
    return layer;
  }));
  await document.fonts.ready;
  updateLoadProgress(.92);
  render();canvas.classList.add('ready');hero.classList.add('title-composited');
  requestAnimationFrame(tick);
  await revealCover();
}catch(error){
  console.error(error);canvas.style.opacity='0';hero.classList.remove('title-composited');
  updateLoadProgress(.9);await loadFallback();await revealCover();
}
