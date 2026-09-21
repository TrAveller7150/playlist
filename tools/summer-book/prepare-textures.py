from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'blender'
OUT = SOURCE / 'summer-book' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)


def rectify(suffix, corners, size, rotation):
    source = next(SOURCE.glob('*_' + suffix + '_24.jpg'))
    image = ImageOps.exif_transpose(Image.open(source)).convert('RGB')
    points = [(x * image.width, y * image.height) for x, y in corners]
    matrix, rhs = [], []
    for (x, y), (u, v) in zip([(0, 0), (size[0], 0), size, (0, size[1])], points):
        matrix.extend([[x,y,1,0,0,0,-u*x,-u*y], [0,0,0,x,y,1,-v*x,-v*y]])
        rhs.extend([u, v])
    coefficients = np.linalg.solve(np.array(matrix), np.array(rhs))
    return image.transform(size, Image.Transform.PERSPECTIVE, coefficients, Image.Resampling.BICUBIC).rotate(rotation, expand=True)


def straighten_band(image, boundary):
    # Undo photographed paper curl with a column-wise warp anchored at both ends.
    width, height = image.size
    source = np.asarray(image, dtype=float)
    rows = np.arange(height)
    edge = np.interp(np.arange(width), np.linspace(0,width-1,len(boundary)), boundary)
    edge = edge * height / 1024
    target = 783 * height / 1024
    output = np.empty_like(source)
    for x in range(width):
        mapped = np.interp(rows,[0,target,height-1],[0,edge[x],height-1])
        for channel in range(3):
            output[:,x,channel] = np.interp(mapped,rows,source[:,x,channel])
    return Image.fromarray(np.clip(output,0,255).astype('uint8'))


def matched_spine(front, back):
    image = rectify('76', [(.077,.518),(.813,.503),(.819,.567),(.074,.584)], (1400,110), 90)
    source = np.asarray(image,dtype=float)
    scale = image.height/1024
    start,end = round(755*scale),round(805*scale)
    transition = source[start:end,:,0]-source[start:end,:,2] > 35
    boundary = (start+np.argmax(transition,axis=0))/scale
    image = straighten_band(image,boundary)
    image.save(OUT.parent/'spine-source.png')
    height,width = image.height,image.width
    rows = np.linspace(0,1023,height)
    # Broad, shared corrections preserve the title; fold-only offsets are at most 6 px.
    offset = np.interp(rows,[0,140,265,464,548,704,783,1023],[0,-7,-15,-20,-15,-8,0,0])
    offset = cv2.GaussianBlur(offset[:,None],(1,0),sigmaX=0,sigmaY=20).ravel()
    fold = np.interp(rows,[0,140,265,464,548,704,783,1023],[0,-5,-3,-6,-2,0,0,0])
    u = np.linspace(0,1,width)
    edge_weight = np.clip((.25-u)/.25,0,1)**2-np.clip((u-.75)/.25,0,1)**2
    map_y = ((rows+offset)[:,None]+fold[:,None]*edge_weight[None,:])*(height-1)/1023
    map_x = np.broadcast_to(np.linspace(2,width-3,width),(height,width))
    # Prevent the aggressive stretching seen in earlier seam repairs.
    derivative = np.diff(map_y,axis=0)
    assert derivative.min()>.85 and derivative.max()<1.15
    assert np.ptp(map_y[:,width//4:3*width//4],axis=1).max()<.01
    result = cv2.remap(np.asarray(image),map_x.astype('float32'),map_y.astype('float32'),
                       cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    # A two-texel color transition is confined to the fold, away from the title.
    result = result.astype(float)
    for x,weight in [(0,.8),(1,.25)]:
        result[:,x] = result[:,x]*(1-weight)+np.asarray(front)[:,-1]*weight
        result[:,-1-x] = result[:,-1-x]*(1-weight)+np.asarray(back)[:,0]*weight
    return Image.fromarray(np.clip(result,0,255).astype('uint8'))


# The belly band stays baked into the photographed cover, including its back text.
front = rectify('78', [(.122,.136),(.920,.083),(.935,.894),(.120,.855)], (1400,1006), -90)
back = rectify('79', [(.054,.099),(.889,.145),(.890,.882),(.054,.931)], (1400,1006), 90)
front = straighten_band(front,[782,785,787,787,784])
back = straighten_band(back,[781,782,780,778,775])
spine = matched_spine(front,back)
seams = Image.new('RGB',(520,1024),'#eeeee8')
seams.paste(front.crop((front.width-219,0,front.width,front.height)).resize((160,1024)),(0,0))
seams.paste(spine.resize((160,1024)),(180,0))
seams.paste(back.crop((0,0,219,back.height)).resize((160,1024)),(360,0))
seams.save(OUT.parent/'seam-check-after.png')
for name, image in [('front', front), ('back', back), ('spine', spine)]:
    image.save(OUT / (name + '.png'))

# Page strata share the same depth coordinate on fore edge, top and bottom.
rng = np.random.default_rng(7150)
pages = Image.new('RGB', (128,1024))
pixels = pages.load()
for x in range(128):
    shade = int(rng.choice([215,225,232,239,242]))
    for y in range(1024):
        variation = int(2 * np.sin(y / 130))
        pixels[x,y] = (shade + variation, shade + variation, min(255,shade + variation + 1))
pages.save(OUT / 'pages.png')
sheet = Image.new('RGB', (1270,820), '#eeeee8')
draw = ImageDraw.Draw(sheet)
for name, image, x, width in [('FRONT', front, 20,530), ('SPINE',spine,565,58), ('BACK',back,650,530)]:
    thumbnail = image.copy()
    thumbnail.thumbnail((width,750))
    sheet.paste(thumbnail,(x,40))
    draw.text((x,15),name,fill='#333b36')
sheet.save(OUT.parent / 'texture-check.jpg', quality=94)
print(OUT.parent / 'texture-check.jpg')
