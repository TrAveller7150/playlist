import fs from 'node:fs';
import path from 'node:path';

const input = fs.readFileSync('2700262458/scene.pkg');
let cursor = 0;
const uint = () => { const value = input.readUInt32LE(cursor); cursor += 4; return value; };
const string = () => { const size = uint(); const value = input.toString('utf8', cursor, cursor + size); cursor += size; return value; };
const version = string();
if (version !== 'PKGV0015') throw new Error(`Unsupported archive: ${version}`);
const count = uint();
const files = Array.from({ length: count }, () => ({ name: string(), offset: uint(), size: uint() }));
const start = cursor;
const root = path.resolve('assets/scene');
for (const file of files) {
  const target = path.resolve(root, file.name);
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid archive path');
  if (start + file.offset + file.size > input.length) throw new Error('Invalid archive range');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, input.subarray(start + file.offset, start + file.offset + file.size));
}
console.log(`Extracted ${files.length} files from ${version} to assets/scene`);
