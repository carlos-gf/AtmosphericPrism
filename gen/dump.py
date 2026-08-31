"""SRC png -> the 900 x 779 region the prism actually shows -> raw RGBA."""
import glob, math, os, pathlib, sys
from PIL import Image

W = 900
H = int(round(W * math.sqrt(3) / 2))   # 779: the triangle's bounding box
OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

for p in sorted(glob.glob(str(pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'sources') / '*_SRC.png'))):
    scene = os.path.basename(p).split('_')[0]
    im = Image.open(p).convert('RGBA')
    assert im.size == (900, 900), im.size
    top = (900 - H) // 2                      # object-fit: cover crops the middle
    im = im.crop((0, top, W, top + H))
    (OUT / f'{scene}.rgba').write_bytes(im.tobytes())
    print(scene, im.size)

print('H =', H, ' aspect', round(W / H, 6), ' target', round(2 / math.sqrt(3), 6))
