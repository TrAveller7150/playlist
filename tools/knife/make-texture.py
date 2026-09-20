from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'knife' / 'output'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(7150)
image = Image.new('RGB', (256, 256), (62, 65, 63))
pixels = image.load()

# Two blade faces: warped contours with a small, deliberately discrete palette.
steel = [(86, 91, 91), (108, 114, 113), (137, 142, 138), (165, 169, 160), (190, 190, 175)]
for y in range(256):
    for x in range(128):
        side = x // 64
        u = (x % 64) / 64
        v = y / 256
        field = 6 * u + 1.1 * math.sin(v * 20 + side * 2) + .8 * math.sin(u * 8 + v * 9)
        field += .7 * math.sin(u * 18 - v * 28) + .3 * math.cos(v * 53 + u * 6)
        contour = (math.sin(field * math.pi * 2) + 1) / 2
        tone = steel[min(4, int(contour * 5))]
        pixels[x, y] = tone

# The handle reads as dark, worn reddish wood instead of glossy plastic.
for y in range(192):
    for x in range(128, 192):
        grain = math.sin((x - 128) * .42 + math.sin(y * .07) * 1.8)
        wear = math.sin(x * .15 + y * .029) * math.cos(y * .11)
        noise = rng.choice((-3, -1, 0, 0, 1, 3))
        base = (59 + grain * 6 + wear * 10, 40 + grain * 4 + wear * 4, 30 + grain * 3)
        pixels[x, y] = tuple(max(0, min(255, int(c + noise))) for c in base)
draw = ImageDraw.Draw(image)
for _ in range(33):
    x, y = rng.randrange(131, 189), rng.randrange(8, 182)
    draw.line((x, y, x + rng.choice((-1, 0, 1)), y + rng.randrange(1, 7)), fill=(91, 57, 33))

# Hardware and a dark channel share the same atlas as the blade and handle.
for y in range(256):
    for x in range(192, 224):
        band = math.sin((x - 192) / 31 * math.pi)
        val = (115, 129, 142, 153, 165)[min(4, int(band * 5))]
        pixels[x, y] = (val, val + 2, val)
draw.rectangle((128, 192, 159, 255), fill=(29, 32, 31))
draw.rectangle((160, 192, 191, 255), fill=(128, 134, 132))

# A vertical inscription retains the personal name tag without extra geometry.
draw.rectangle((224, 0, 255, 255), fill=(24, 27, 26))
draw.line((225, 1, 225, 254), fill=(101, 105, 99))
draw.line((254, 1, 254, 254), fill=(72, 76, 73))
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 21)
caption = '\u4f60\u7ed9\u4e88\u7684\u95ea\u4eae\u6545\u4e8b'
for i, character in enumerate(caption):
    draw.text((240, 27 + i * 27), character, font=font, anchor='mm', fill=(212, 210, 192), stroke_width=0)
image.save(OUT / 'stiletto-atlas.png')
print(OUT / 'stiletto-atlas.png')
