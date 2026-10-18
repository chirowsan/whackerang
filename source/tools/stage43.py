# stage the source tree into bb-pages/source (mirrors what v4.2 shipped: no node_modules/build outputs/screenshots/bundles)
import os, shutil, sys
SRC = '/workspace/boomerang-brawl'; DST = '/workspace/bb-pages/source'
TOP = ['README.md','assets','build.mjs','docs','icon-192.png','icon-512.png','index.html','manifest.webmanifest','mobile','package-lock.json','package.json','pwa','server','src','style.css','tools','vendor']
SKIP_DIRS = {'node_modules','build','.gradle','.git','www','.idea'}
def ign(d, names):
    out = set()
    for n in names:
        p = os.path.join(d, n)
        if n in SKIP_DIRS or n.endswith(('.apk','.aab','.keystore','.jks','.pw')) or (n == 'public' and d.endswith('assets')) or n in ('local.properties','captures'): out.add(n)
    return out
if os.path.exists(DST): shutil.rmtree(DST)
os.makedirs(DST)
for t in TOP:
    s = os.path.join(SRC, t); d = os.path.join(DST, t)
    if os.path.isdir(s): shutil.copytree(s, d, ignore=ign)
    elif os.path.exists(s): shutil.copy2(s, d)
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DST) for f in fs); print('staged', round(tot/1e6,1), 'MB')
