from pathlib import Path
import json
import struct
from PIL import Image, ImageDraw
import numpy as np

OUT = Path(__file__).resolve().parents[2] / 'blender' / 'summer-book'
front = np.asarray(Image.open(OUT/'textures'/'front.png'))
spine = np.asarray(Image.open(OUT/'textures'/'spine.png'))
back = np.asarray(Image.open(OUT/'textures'/'back.png'))
assert front.shape == back.shape == (1400,1006,3), 'Covers must retain their high-resolution photos'
assert spine.shape == (1400,110,3)
data = (OUT/'summer-angel-book.glb').read_bytes()
magic,version,length = struct.unpack_from('<4sII',data)
assert magic==b'glTF' and version==2 and length==len(data)
chunk_length,chunk_type = struct.unpack_from('<II',data,12)
assert chunk_type==0x4e4f534a
document = json.loads(data[20:20+chunk_length])
assert len(document['meshes'])==4
assert len(document['images'])==4
assert all('bufferView' in image and 'uri' not in image for image in document['images'])
assert not document.get('animations')

sheet = Image.new('RGB',(1600,670),'#eceee9')
draw = ImageDraw.Draw(sheet)
for i,name in enumerate(['three-quarter','back','pages','spine']):
    image = Image.open(OUT/('preview-'+name+'.png')).convert('RGBA')
    bounds = image.getchannel('A').getbbox()
    assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<image.width and bounds[3]<image.height, name
    image = image.crop(bounds)
    image.thumbnail((370,580))
    sheet.paste(image,(i*400+(400-image.width)//2,45+(580-image.height)//2),image)
    draw.text((i*400+25,640),name.upper(),fill='#354039')
sheet.save(OUT/'model-overview.jpg',quality=94)
print('Validated high-resolution covers, four meshes, four embedded textures, and preview framing.')
print(OUT/'model-overview.jpg')
