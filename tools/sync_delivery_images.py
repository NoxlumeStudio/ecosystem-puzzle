"""Sync only runtime images into dist; source PNG artwork remains in assets/."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'image-delivery.json').read_text())
dest=root/'dist/assets/web';dest.mkdir(parents=True,exist_ok=True)
wanted={r['delivery'] for r in m['images'] if r['delivery']}
for rel in wanted:shutil.copy2(root/'assets'/rel,root/'dist/assets'/rel)
for r in m['images']:
 old=root/'dist/assets'/r['source']
 if old.exists():old.unlink()
for p in dest.glob('*'):
 if 'web/'+p.name not in wanted:p.unlink()
print('Synced',len(wanted),'runtime images; original PNGs retained in assets/.')
