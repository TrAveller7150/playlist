import fs from 'node:fs';

for (const name of ['puppet ward model', 'hoa']) {
  const b = fs.readFileSync(`assets/scene/models/${name}_puppet.mdl`);
  let p = 0;
  const uint = () => { const v = b.readUInt32LE(p); p += 4; return v; };
  const float = () => { const v = b.readFloatLE(p); p += 4; return v; };
  const string = () => { const end = b.indexOf(0, p); const s = b.toString('utf8', p, end); p = end + 1; return s; };
  if (string() !== 'MDLV0013') throw new Error('Unsupported model');
  p = b.indexOf(0, b.indexOf('materials/')) + 1;
  uint();
  const vertexBytes = uint();
  if (vertexBytes % 52) throw new Error('Unexpected vertex stride');
  const vertices = [];
  for (let i = 0; i < vertexBytes / 52; i++) {
    vertices.push({ position: [float(), float(), float()], bones: [uint(), uint(), uint(), uint()], weights: [float(), float(), float(), float()], uv: [float(), float()] });
  }
  const indexBytes = uint();
  const indices = [];
  for (let i = 0; i < indexBytes / 2; i++, p += 2) indices.push(b.readUInt16LE(p));
  if (string() !== 'MDLS0001') throw new Error('Unexpected skeleton');
  const animationOffset = uint();
  const boneCount = uint();
  const bones = [];
  for (let i = 0; i < boneCount; i++) {
    p++;
    const type = uint();
    const parent = uint();
    if (uint() !== 64) throw new Error('Unexpected bind matrix');
    bones.push({ type, parent: parent === 0xffffffff ? -1 : parent, matrix: Array.from({ length: 16 }, float), name: string() });
  }
  if (p !== animationOffset || string() !== 'MDLA0001') throw new Error('Unexpected animation');
  const endOffset = uint();
  const count = uint();
  const animations = [];
  for (let i = 0; i < count; i++) {
    const id = uint();
    const flags = uint();
    const title = string();
    const mode = string();
    const duration = float();
    const frames = uint();
    const unknown = uint();
    const tracks = uint();
    const channels = [];
    for (let j = 0; j < tracks; j++) {
      const trackFlags = uint();
      const length = uint();
      if (length % 36) throw new Error(`Unexpected track ${length}`);
      channels.push({ bone: j, trackFlags, samples: Array.from({ length: length / 36 }, () => Array.from({ length: 9 }, float)) });
    }
    animations.push({ id, flags, title, mode, duration, frames, unknown, channels });
  }
  if (p + 4 === endOffset && uint() !== 0) throw new Error('Unsupported animation extension');
  if (p !== endOffset) throw new Error(`Animation end mismatch ${p} != ${endOffset}`);
  const out = { vertices, indices, bones, animations };
  fs.mkdirSync('assets/models', { recursive: true });
  fs.writeFileSync(`assets/models/${name}.json`, JSON.stringify(out));
  console.log(name, vertices.length, 'vertices;', bones.length, 'bones;', animations.map(a => ({ duration: a.duration, frames: a.frames, channels: a.channels.length, first: a.channels.slice(0, 5).map(c => c.samples[0]) })));
}
