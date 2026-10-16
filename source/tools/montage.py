import sys
from PIL import Image
tag=sys.argv[1]; ids=['bao','nori','tako','kuma','pico','yuki']; views=[int(v) for v in (sys.argv[2] if len(sys.argv)>2 else '0,1').split(',')]
cell=int(sys.argv[3]) if len(sys.argv)>3 else 340
W=Image.new('RGB',(cell*3,cell*2*len(views)//1*1),(122,160,224)) if False else None
rows=[]
cols=3
n=len(ids)*len(views)
W=Image.new('RGB',(cell*cols,cell*((n+cols-1)//cols)),(122,160,224))
k=0
for v in views:
  for i,id in enumerate(ids):
    im=Image.open(f'shots/{tag}-{id}.png'); w=im.width//3 if im.width>=im.height*3 else im.height
    cellim=im.crop((v*w,0,(v+1)*w,im.height)).resize((cell,cell))
    W.paste(cellim,((k%cols)*cell,(k//cols)*cell)); k+=1
W.save(f'shots/{tag}-montage.png')
