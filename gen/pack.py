"""Raw RGBA -> the JPEGs the app loads, plus the blurred nav thumbnails."""
import glob, os, pathlib, sys
from PIL import Image, ImageFilter

W, H = 900, 779
SRC = pathlib.Path(sys.argv[1])
DST = pathlib.Path(sys.argv[2])
DST.mkdir(parents=True, exist_ok=True)

total = 0
for p in sorted(SRC.glob('*.rgba')):
    im = Image.frombytes('RGBA', (W, H), p.read_bytes()).convert('RGB')
    out = DST / (p.stem + '.jpg')
    im.save(out, quality=94, optimize=True)
    total += out.stat().st_size
    print(f'{out.name:24} {out.stat().st_size // 1024:4} KB')

    # the prev/next buttons carry a blurred sample of the atmosphere they lead
    # to. Taken from well inside the triangle so no black corner creeps in.
    if p.stem.endswith('_rpca'):
        scene = p.stem[:-5]
        box = im.crop((int(W * .30), int(H * .45), int(W * .70), int(H * .95)))
        thumb = box.resize((44, 44), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
        t = DST / f'{scene}_thumb.jpg'
        thumb.save(t, quality=82)
        total += t.stat().st_size

print(f'total {total/1024/1024:.2f} MB')
