import sys
from PIL import Image
tag=sys.argv[1]; views=[int(v) for v in sys.argv[2].split(',')]; cell=int(sys.argv[3]); ids=sys.argv[4].split(',') if len(sys.argv)>4 else ['bao','nori','tako','kuma','pico','yuki']
W=Image.new('RGB',(cell*len(views),cell*len(ids)),(122,160,224))
for r,id in enumerate(ids):
  im=Image.open(f'shots/{tag}-{id}.png'); w=im.height
  for c,v in enumerate(views): W.paste(im.crop((v*w,0,(v+1)*w,w)).resize((cell,cell)),(c*cell,r*cell))
W.save(f'shots/{tag}-expr-{ids[0]}.png')
