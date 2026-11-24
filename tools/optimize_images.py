"""Create delivery images without changing the original PNG artwork.
Pillow with libwebp is required. No resizing, cropping or palette conversion.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, sys
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
# Retain original aliases in the source tree; deliver identical artwork only once.
ALIASES={'ui_objectives_bg_clean.png':'ui_turn_counter_frame.png','ui_turn_counter_bg_clean.png':'ui_objectives_frame.png'}
UNUSED={'ui_header_decor.png','ui_tab_paper.png'}

def build():
 out=ASSETS/'web';out.mkdir(exist_ok=True)
 records=[]
 for p in sorted(ASSETS.glob('*.png')):
  im=Image.open(p);name=ALIASES.get(p.name,p.name)
  row={'source':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':im.width,'height':im.height,'sourceBytes':p.stat().st_size}
  if p.name in ALIASES and p.read_bytes()!=(ASSETS/ALIASES[p.name]).read_bytes():
   raise RuntimeError('Alias artwork no longer identical: '+p.name)
  if p.name in UNUSED:
   records.append({**row,'delivery':None,'reason':'No reference in the live HTML/CSS or dynamic image manifests'});continue
  dest=out/(Path(name).stem+'.webp');lossy=name.startswith('still_') or name=='ui_background.png'
  if (name==p.name or not dest.exists()) and (not ('--resume' in sys.argv and dest.exists()) or Image.open(dest).info.get('icc_profile',b'')!=im.info.get('icc_profile',b'')):
   im.save(dest,'WEBP',lossless=not lossy,quality=85 if lossy else 100,method=6,exact=True,icc_profile=im.info.get('icc_profile',b''))
   if dest.stat().st_size>=p.stat().st_size:
    raise RuntimeError('WebP not smaller: '+p.name)
  records.append({**row,'delivery':'web/'+dest.name,'deliveryBytes':dest.stat().st_size,'encoding':'quality-85' if lossy else 'lossless',**({'aliasOf':name} if name!=p.name else {})})
 manifest={'originals':'Original PNGs are retained unchanged in assets/.','images':records}
 (ROOT/'image-delivery.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 return manifest
if __name__=='__main__':
 m=build();unique={r['delivery']:r['deliveryBytes'] for r in m['images'] if r['delivery']}
 print(json.dumps({'originalCount':len(m['images']),'deliveredCount':len(unique),'originalBytes':sum(r['sourceBytes'] for r in m['images']),'deliveryBytes':sum(unique.values())}))
