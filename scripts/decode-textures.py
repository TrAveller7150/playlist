"""Decode this project's TEXV0005/TEXB0003 textures without changing pixels."""
from pathlib import Path
import io
import struct
import lz4.block
from PIL import Image

for source in Path('assets/scene/materials').rglob('*.tex'):
    data = source.read_bytes()
    assert data[:9] == b'TEXV0005\0'
    fmt = struct.unpack_from('<I', data, 18)[0]
    pos = data.index(b'TEXB0003\0') + 9
    count, image_format, mipmaps, w, h, compressed, raw_size, size = struct.unpack_from('<8I', data, pos)
    raw = data[pos + 32:pos + 32 + size]
    if compressed:
        raw = lz4.block.decompress(raw, uncompressed_size=raw_size)
    if image_format != 0xffffffff:
        img = Image.open(io.BytesIO(raw))
    elif fmt == 8:
        channels = Image.frombytes('LA', (w, h), raw).split()
        img = Image.merge('RGB', (channels[0], channels[1], Image.new('L', (w, h))))
    elif fmt == 9:
        img = Image.frombytes('L', (w, h), raw)
    elif fmt == 0:
        img = Image.frombytes('RGBA', (w, h), raw)
    else:
        raise ValueError((source, fmt, w, h, len(raw)))
    target = Path('assets/textures') / source.relative_to('assets/scene/materials').with_suffix('.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    img.save(target)
    print(target, img.size, img.mode)
