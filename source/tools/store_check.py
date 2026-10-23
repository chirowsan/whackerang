import sys; from PIL import Image; import glob, os
S = '/workspace/boomerang-brawl/store'; ok = True
def chk(c, m):
    global ok; print(('ok  ' if c else 'FAIL') + ' ' + m); ok &= bool(c)
t = open(S + '/title.txt').read().strip(); s = open(S + '/short.txt').read().strip(); f = open(S + '/full-description.txt').read().strip()
chk(len(t) <= 30, f'title {len(t)}'); chk(len(s) <= 80, f'short {len(s)}'); chk(len(f) <= 4000, f'full {len(f)}')
im = Image.open(S + '/icon/icon-512.png'); chk(im.size == (512, 512) and im.mode == 'RGBA' and os.path.getsize(S + '/icon/icon-512.png') <= 1024 * 1024, f'icon {im.size} {im.mode} {os.path.getsize(S + "/icon/icon-512.png")}B')
im = Image.open(S + '/feature/feature-graphic-1024x500.png'); chk(im.size == (1024, 500) and im.mode == 'RGB', f'feature {im.size} {im.mode}')
for d, lo in [('phone', 320), ('tablet-7', 1080), ('tablet-10', 1080)]:
    fs = sorted(glob.glob(f'{S}/{d}/*.png')); chk(2 <= len(fs) <= 8 and (d == 'phone' or len(fs) >= 4), f'{d} count {len(fs)}')
    for p in fs:
        im = Image.open(p); w, h = im.size
        chk(im.mode == 'RGB' and min(w, h) >= lo and max(w, h) <= 7680 and max(w, h) <= 2 * min(w, h) and abs(w / h - 16 / 9) < 0.01 and os.path.getsize(p) <= 8 * 1024 * 1024, f'{d}/{os.path.basename(p)} {w}x{h} {im.mode} {os.path.getsize(p)//1024}KB')
print('ALL PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
