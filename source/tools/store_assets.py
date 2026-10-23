# Builds Play listing images in store/: icon (512 RGBA), feature graphic (1024x500 RGB), captioned screenshots (RGB, no alpha).
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = '/workspace/boomerang-brawl'; ST = R + '/store'; RAW = '/workspace/out/v4.6.1-results/raw'; RAWT = '/workspace/out/v4.6.1-results/raw-tab'
FRED = '/usr/share/fonts/truetype/sand-box/google/Fredoka/Fredoka-VariableFont_wdth,wght.ttf'
LUCK = '/usr/share/fonts/truetype/sand-box/google/Luckiest Guy/LuckiestGuy-Regular.ttf'
def fred(sz, w=700):
    f = ImageFont.truetype(FRED, sz)
    try: f.set_variation_by_axes([w, 100])
    except Exception: pass
    return f
for d in ['icon', 'feature', 'phone', 'tablet-7', 'tablet-10']: os.makedirs(f'{ST}/{d}', exist_ok=True)
# 1) icon: current brand art (same as the app icon), 512x512 32-bit PNG, full square
src = Image.open(R + '/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png').convert('RGBA')
src.resize((512, 512), Image.LANCZOS).save(f'{ST}/icon/icon-512.png', optimize=True)
# 2) feature graphic
def grad(w, h, top, bot):
    g = Image.new('RGB', (w, h)); d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / (h - 1); d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return g
fg = Image.new('RGB', (1024, 500))
bg = Image.open(R + '/assets/brand/bg.png').convert('RGB').resize((1024, 1024), Image.LANCZOS).crop((0, 262, 1024, 762)); fg.paste(bg)
mascot = Image.open(R + '/assets/brand/fg.png').convert('RGBA').resize((560, 560), Image.LANCZOS)
fg.paste(mascot, (560, -30), mascot)
d = ImageDraw.Draw(fg); title = ImageFont.truetype(LUCK, 104)
def stroke_text(d, xy, txt, font, fill, sw=8, sf=(40, 12, 8)):
    d.text(xy, txt, font=font, fill=fill, stroke_width=sw, stroke_fill=sf)
stroke_text(d, (46, 150), 'WHACKERANG', title, (255, 214, 64), 9)
sub = fred(40, 700); stroke_text(d, (54, 272), 'Throw it. Catch it. Whack!', sub, (255, 255, 255), 5, (40, 16, 70))
small = fred(28, 600); stroke_text(d, (56, 330), 'Cartoon boomerang party game', small, (232, 222, 255), 4, (40, 16, 70))
fg.save(f'{ST}/feature/feature-graphic-1024x500.png', optimize=True)
# 3) screenshots: caption bar (top) + unedited game capture
SHOTS = [
    ('menu', 'Throw it. Catch it. Whack!'),
    ('traps1-2', 'Arm the traps, then lure your rivals in!'),
    ('cd-00', '3, 2, 1, GO! Every round starts fair'),
    ('net-search2', 'Auto match: bots fill empty seats (a grown-up turns it on)'),
    ('net-game-4', 'Online with friends: up to 4 players, no chat'),
    ('res-final', 'Win rounds, earn gold, finish daily missions'),
    ('ui-shop', 'Unlock hats and looks with gold you earn'),
    ('ui-heroes', '8 fighters, 8 arenas, 10 party modes and a campaign'),
]
def caption(raw_path, text, out, W):
    im = Image.open(raw_path).convert('RGB'); scale = W / im.width; im = im.resize((W, round(im.height * scale)), Image.LANCZOS)
    H = round(W * 9 / 16); bar = H - im.height; assert bar > 0, (raw_path, im.size)
    c = grad(W, bar, (92, 38, 196), (58, 20, 128)); full = Image.new('RGB', (W, H)); full.paste(c, (0, 0)); full.paste(im, (0, bar))
    d = ImageDraw.Draw(full); sz = int(bar * 0.5)
    while True:
        f = fred(sz, 700); bb = d.textbbox((0, 0), text, font=f, stroke_width=max(2, sz // 14))
        if bb[2] - bb[0] <= W * 0.92 or sz < 20: break
        sz -= 2
    x = (W - (bb[2] - bb[0])) // 2 - bb[0]; y = (bar - (bb[3] - bb[1])) // 2 - bb[1]
    d.text((x, y), text, font=f, fill=(255, 226, 92), stroke_width=max(2, sz // 14), stroke_fill=(34, 10, 70))
    full.save(out, optimize=True); return full.size
for i, (n, t) in enumerate(SHOTS, 1):
    p = f'{RAW}/{n}.png'
    if os.path.exists(p): print('phone', i, n, caption(p, t, f'{ST}/phone/{i:02d}-{n}.png', 1920))
TAB = os.path.isdir(RAWT)
for i, (n, t) in enumerate(SHOTS, 1):
    p = f'{RAWT}/{n}.png'
    if TAB and os.path.exists(p):
        print('tab10', i, n, caption(p, t, f'{ST}/tablet-10/{i:02d}-{n}.png', 2560))
        print('tab7', i, n, caption(p, t, f'{ST}/tablet-7/{i:02d}-{n}.png', 1920))
