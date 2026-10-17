# Exports Whackerang icons from assets/brand/{bg,fg}.png (made by tools/icons3.mjs)
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
bg = Image.open('assets/brand/bg.png').convert('RGBA'); fg = Image.open('assets/brand/fg.png').convert('RGBA')
def comp(size, fgscale=1.0):
    b = bg.resize((size, size), Image.LANCZOS); f = fg.resize((int(size*fgscale), int(size*fgscale)), Image.LANCZOS)
    o = (size - f.width)//2; b.alpha_composite(f, (o, o)); return b
def save(im, path, rgb=False):
    os.makedirs(os.path.dirname(path), exist_ok=True); (im.convert('RGB') if rgb else im).save(path)
for s in (192, 512): save(comp(s, 1.0), f'pwa/icon-{s}.png', True); save(comp(s, 0.78), f'pwa/icon-maskable-{s}.png', True)
save(comp(180, 0.96), 'pwa/apple-touch-icon.png', True)
save(bg.resize((432,432), Image.LANCZOS), 'pwa/android/ic_launcher_background.png', True)
f = fg.resize((432,432), Image.LANCZOS); can = Image.new('RGBA', (432,432), (0,0,0,0)); k = int(432*0.66*1.12); ff = fg.resize((k,k), Image.LANCZOS); can.alpha_composite(ff, ((432-k)//2, (432-k)//2)); save(can, 'pwa/android/ic_launcher_foreground.png')
R = 'mobile/android/app/src/main/res/'
for d, (legacy, ad) in {'mdpi': (48,108), 'hdpi': (72,162), 'xhdpi': (96,216), 'xxhdpi': (144,324), 'xxxhdpi': (192,432)}.items():
    im = comp(legacy*4, 0.94).resize((legacy,legacy), Image.LANCZOS); save(im, f'{R}mipmap-{d}/ic_launcher.png')
    m = Image.new('L', (legacy*4,)*2, 0); ImageDraw.Draw(m).ellipse((0,0,legacy*4-1,legacy*4-1), fill=255); r = comp(legacy*4, 0.9); r.putalpha(m); save(r.resize((legacy,legacy), Image.LANCZOS), f'{R}mipmap-{d}/ic_launcher_round.png')
    save(bg.resize((ad,ad), Image.LANCZOS), f'{R}mipmap-{d}/ic_launcher_background.png')
    can = Image.new('RGBA', (ad,ad), (0,0,0,0)); k = int(ad*0.66*1.12); ff = fg.resize((k,k), Image.LANCZOS); can.alpha_composite(ff, ((ad-k)//2,(ad-k)//2)); save(can, f'{R}mipmap-{d}/ic_launcher_foreground.png')
save(fg.resize((256,256), Image.LANCZOS), R+'drawable/splash_icon.png')
save(comp(1024, 1.0), 'mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', True)
# splash screens: dark bg, centered logo + wordmark
def splash(w, h, path):
    im = Image.new('RGB', (w,h), (27,16,51)); g = Image.new('RGBA', (w,h)); 
    r = bg.resize((max(w,h),)*2, Image.LANCZOS).filter(ImageFilter.GaussianBlur(2)); r = r.crop(((r.width-w)//2, (r.height-h)//2, (r.width-w)//2+w, (r.height-h)//2+h)); im.paste(r.convert('RGB'))
    s = int(min(w,h)*0.42); l = fg.resize((s,s), Image.LANCZOS); im = im.convert('RGBA'); im.alpha_composite(l, ((w-s)//2, int(h*0.5 - s*0.62)))
    d = ImageDraw.Draw(im); 
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(min(w,h)*0.085))
    except: font = ImageFont.load_default()
    t = 'WHACKERANG'; tw = d.textlength(t, font=font); x = (w-tw)/2; y = h*0.5 + s*0.42
    d.text((x+4, y+5), t, font=font, fill=(60,15,0)); d.text((x, y), t, font=font, fill=(255,210,60)); save(im, path, True)
for f in os.listdir('pwa/splash'):
    n = f[len('splash-'):-4].split('x'); splash(int(n[0]), int(n[1]), 'pwa/splash/'+f)
for f in os.listdir('mobile/ios/App/App/Assets.xcassets/Splash.imageset'):
    if f.endswith('.png'): splash(2732, 2732, 'mobile/ios/App/App/Assets.xcassets/Splash.imageset/'+f)
print('exported')
