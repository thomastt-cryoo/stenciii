"""Deterministic M2 test artwork. No runtime network or nonstandard app dependency."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import math
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'web/e2e/corpus'
DEST.mkdir(parents=True, exist_ok=True)
records = []


def svg(name, body, tags, width=300, height=240):
    path = DEST / (name + '.svg')
    path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="white"/>{body}</svg>', encoding='utf-8')
    records.append({'file': path.name, 'tags': tags, 'source': 'Original deterministic M2 fixture; repository license'})


def raster(name, image, tags):
    image.save(DEST / name)
    records.append({'file': name, 'tags': tags, 'source': 'Original deterministic M2 fixture; repository license'})


mark = '<circle cx="150" cy="120" r="85" fill="none" stroke="black" stroke-width="14"/><path d="M85 143 Q150 53 215 143 M106 116 Q150 179 194 116" stroke="black" stroke-width="15" fill="none" stroke-linecap="round"/><circle cx="150" cy="80" r="13"/>'
svg('simple-logo', mark, ['simple logo', 'SVG', 'interior islands', 'organic curves'])
details = '<circle cx="150" cy="120" r="55" fill="none" stroke="black" stroke-width="8"/>'
for i in range(24):
    angle = i * math.pi / 12
    x, y = 150 + 83 * math.cos(angle), 120 + 83 * math.sin(angle)
    details += f'<path d="M{x:.3f} {y:.3f}l-5 -9 11 0Z" fill="black"/>'
details += '<path d="M112 140 L150 75 L188 140Z M130 132 L150 98 L170 132Z" fill="black" fill-rule="evenodd"/>'
svg('detailed-logo', details, ['detailed logo', 'thin features', 'islands'])
svg('line-illustration', '<path d="M22 195L91 55 151 136 207 35 280 195ZM52 171L91 91 125 138M178 109L207 71 245 171" fill="none" stroke="black" stroke-width="5" stroke-linejoin="round"/><circle cx="45" cy="40" r="17" fill="none" stroke="black" stroke-width="4"/>', ['drawing', 'illustration', 'thin lines'])
thin = ''.join(f'<path d="M25 {25+i*25}H275" stroke="black" stroke-width="{.3+i*.6}"/>' for i in range(8))
svg('thin-lines', thin, ['fine detail', 'subpixel strokes'])
font_path = Path('C:/Windows/Fonts/arialbd.ttf')
if not font_path.exists():
    font_path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
lettering = Image.new('RGB', (600, 260), 'white')
draw = ImageDraw.Draw(lettering)
draw.text((25, 15), 'OABR', font=ImageFont.truetype(str(font_path), 180), fill='black')
raster('lettering.png', lettering, ['lettering', 'interior islands'])
colour = Image.new('RGB', (400, 300), 'white'); draw = ImageDraw.Draw(colour)
for xy, fill in [((30, 30, 170, 170), '#ce244c'), ((160, 70, 300, 230), '#086c7c'), ((80, 145, 225, 285), '#f1c547')]:
    draw.ellipse(xy, fill=fill)
draw.rectangle((285, 25, 360, 270), fill='#343434')
raster('colour-graphic.png', colour, ['colour graphic', 'overlap', 'threshold ambiguity'])
transparent = Image.new('RGBA', (240, 240), (0, 0, 0, 0)); draw = ImageDraw.Draw(transparent)
draw.ellipse((35, 35, 205, 205), outline='black', width=17); draw.polygon([(90, 155), (120, 70), (160, 155)], fill='black')
raster('transparent.png', transparent, ['transparent PNG', 'alpha', 'island'])
low = Image.new('RGB', (300, 240), (205, 205, 205)); draw = ImageDraw.Draw(low)
draw.rounded_rectangle((55, 40, 245, 200), radius=50, fill=(180, 180, 180)); draw.ellipse((110, 80, 190, 160), fill=(205, 205, 205))
raster('low-contrast.jpg', low, ['low contrast', 'JPG', 'automatic threshold'])
small = Image.new('RGB', (32, 24), 'white'); draw = ImageDraw.Draw(small)
draw.rectangle((3, 3, 18, 20), fill='black'); draw.rectangle((7, 7, 14, 16), fill='white'); draw.polygon([(21, 20), (25, 3), (29, 20)], fill='black')
raster('small-pixel.bmp', small, ['small image', 'BMP', 'pixel art', 'hard edges'])
large = Image.new('RGB', (3200, 2400), 'white'); draw = ImageDraw.Draw(large)
draw.ellipse((500, 200, 2700, 2200), outline='black', width=100); draw.line([(750, 1750), (1600, 700), (2450, 1750)], fill='black', width=85)
raster('high-resolution.png', large, ['high resolution', 'large image'])
for name, fill, dot in [('nearly-empty', 'white', 'black'), ('nearly-solid', 'black', 'white')]:
    edge = Image.new('RGB', (200, 160), fill); ImageDraw.Draw(edge).ellipse((98, 78, 102, 82), fill=dot)
    raster(name + '.png', edge, [name, 'edge case'])
for name, fill in [('empty', 'white'), ('solid', 'black')]:
    raster(name + '.png', Image.new('RGB', (120, 90), fill), [name, 'edge case'])
for name, tags in [('astronaut', ['portrait', 'face', 'photograph', 'multiple tones']), ('coins', ['photograph', 'multiple tones', 'texture'])]:
    target = DEST / (name + '.png')
    url = f'https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/{name}.png'
    if not target.exists():
        urllib.request.urlretrieve(url, target)
    records.append({'file': target.name, 'tags': tags, 'source': url, 'license': 'Public domain / no known copyright restrictions; see SOURCES.md'})
for record in records:
    path = DEST / record['file']
    record['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    if path.suffix != '.svg':
        with Image.open(path) as image:
            record['size'] = list(image.size)
(DEST / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
print(f'Wrote {len(records)} corpus inputs')
