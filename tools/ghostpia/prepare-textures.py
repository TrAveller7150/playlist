from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'blender'
OUT = SRC / 'ghostpia' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)


def rectify(name, source, corners, size, rotate=0):
    image = Image.open(SRC / source).convert('RGB')
    # Reference points are normalized, ordered TL, TR, BR, BL.
    points = [(x * image.width, y * image.height) for x, y in corners]
    target = [(0, 0), (size[0], 0), size, (0, size[1])]
    matrix, rhs = [], []
    for (x, y), (u, v) in zip(target, points):
        matrix.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y], [0, 0, 0, x, y, 1, -v*x, -v*y]])
        rhs.extend([u, v])
    coeff = np.linalg.solve(np.array(matrix), np.array(rhs))
    image = image.transform(size, Image.Transform.PERSPECTIVE, coeff, Image.Resampling.BICUBIC)
    if rotate:
        image = image.rotate(rotate, expand=True)
    image.save(OUT / (name + '.png'))
    return image


rectify('front', 's-l1600.webp', [(0.131,.038),(.882,.037),(.938,.912),(.094,.917)], (448,640))
rectify('back', 'back.jpg', [(.027,.018),(.974,.051),(.987,.896),(.035,.969)], (640,448), 90)
rectify('spine', '微信图片_20260920203420_71_24.jpg', [(.006,.359),(.919,.352),(.913,.584),(.009,.604)], (640,128), -90)
rectify('top', '微信图片_20260920200015_64_24.jpg', [(.123,.418),(.929,.369),(.93,.671),(.14,.71)], (448,128))
rectify('bottom', '微信图片_20260920200016_66_24.jpg', [(.076,.412),(.943,.389),(.948,.694),(.072,.737)], (448,128))

# Reconstruct the opening without baking plastic wrapping highlights into it.
opening = Image.new('RGB', (128,640), '#181b26')
d = ImageDraw.Draw(opening)
d.rectangle((7,19,45,619), fill='#bb2133')
d.rectangle((7,581,45,619), fill='#353956')
d.rectangle((50,74,80,618), fill='#24222b')
d.rectangle((85,8,118,626), fill='#dbd8cf')
for x in [89,94,100,109,115]:
    d.line((x,12,x,620), fill='#b5b0a7', width=1)
from PIL import ImageFont
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
label = Image.new('RGBA',(490,25))
ImageDraw.Draw(label).text((3,1),'ghostpia   season one                         room6',font=font,fill='#f2e9d9')
label = label.rotate(-90,expand=True)
opening.paste(label,(15,60),label)
for y in range(150,310,15):
    d.rectangle((58,y,69,y+6),fill='#b7b3b5')
opening.save(OUT / 'opening.png')

# The clearer opening photo preserves the actual book titles and case markings.
opening = rectify('opening', '微信图片_20260920210216_72_24.jpg',
                  [(.385,.043),(.594,.04),(.606,.912),(.391,.914)], (256,1280))
for name, bounds in [('artbook',(0,8,91,1270)),
                     ('novel',(98,25,170,1063)),
                     ('game',(176,38,255,1191))]:
    opening.crop(bounds).save(OUT / (name + '.png'))

sheet = Image.new('RGB',(1152,800),'#e7e7df')
for name, xy, bounds in [('front',(20,30),(448,640)),('back',(488,30),(448,640)),('spine',(950,30),(128,640))]:
    image=Image.open(OUT/(name+'.png'))
    image.thumbnail(bounds)
    sheet.paste(image,xy)
    ImageDraw.Draw(sheet).text((xy[0],700),name,fill='#30372d')
sheet.save(OUT.parent/'texture-check.jpg')
print(OUT)
