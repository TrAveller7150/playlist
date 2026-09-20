from pathlib import Path
import json
import struct

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'knife' / 'output'
sheet = Image.new('RGB', (1280, 1080), '#e7e7df')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
title_font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 25)
draw.text((34, 25), 'STILETTO / DAMASCUS STEEL', fill='#333b36', font=title_font)
draw.text((34, 65), 'Low-poly study  /  256 x 256 texture  /  Personal inscription', fill='#677066', font=font)
for i, (name, label) in enumerate([('front', '01 / FRONT'), ('back', '02 / BACK'), ('three-quarter', '03 / THREE-QUARTER'), ('edge', '04 / EDGE')]):
    image = Image.open(OUT / ('preview-' + name + '.png')).convert('RGBA')
    assert image.getchannel('A').getbbox(), name + ' render is blank'
    image = image.crop(image.getchannel('A').getbbox())
    image.thumbnail((270, 800))
    sheet.paste(image, (i * 320 + (320 - image.width) // 2, 130 + (800 - image.height) // 2), image)
    draw.text((i * 320 + 34, 958), label, fill='#475146', font=font)
draw.line((34, 1000, 1246, 1000), fill='#c2c7bb', width=1)
report = json.loads((OUT / 'model-report.json').read_text())
draw.text((34, 1021), f"{report['triangles']:,} triangles   |   {report['glb_bytes'] / 1024:.0f} KB GLB   |   No animation", fill='#677066', font=font)
sheet.save(OUT / 'model-overview.jpg', quality=94)

# Inspect the actual GLB payload, including texture embedding and sampler mode.
data = (OUT / 'stiletto-damascus.glb').read_bytes()
magic, version, length = struct.unpack_from('<4sII', data)
assert magic == b'glTF' and version == 2 and length == len(data)
chunk_length, chunk_type = struct.unpack_from('<II', data, 12)
document = json.loads(data[20:20 + chunk_length])
assert not document.get('animations')
assert all('bufferView' in image and 'uri' not in image for image in document['images'])
assert all(sampler.get('magFilter') == 9728 for sampler in document['samplers'])
print(json.dumps({'meshes': len(document['meshes']), 'materials': len(document['materials']), 'embedded_images': len(document['images']), 'samplers': document['samplers']}))
print(OUT / 'model-overview.jpg')
